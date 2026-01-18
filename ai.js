import { toolRegistry } from './tools/index.js';
import { ToolExecutor } from './tools/ToolExecutor.js';
import { getDMMetadata, loadUserContext } from './utils/index.js';
import { processMessageMedia } from './media.js';
import {
  buildPromptContent,
  buildFollowUpContent,
  buildProactivePrompt,
} from './prompts.js';
import { logger } from './utils/logger.js';
import { LRUCache } from './utils/LRUCache.js';

// Response caching
const responseCache = new LRUCache(200, 100); // Cache up to 200 responses, 100MB limit

// Response quality monitoring removed for faster responses

function parseFunctionArgs(argsStr) {
  const args = {};

  if (!argsStr) return args;

  // Split by comma, but handle nested quotes
  const argPairs = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let parenDepth = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (
      inQuotes &&
      char === quoteChar &&
      (i === 0 || argsStr[i - 1] !== '\\')
    ) {
      inQuotes = false;
      current += char;
    } else if (!inQuotes && char === '(') {
      parenDepth++;
      current += char;
    } else if (!inQuotes && char === ')') {
      parenDepth--;
      current += char;
    } else if (!inQuotes && parenDepth === 0 && char === ',') {
      argPairs.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    argPairs.push(current.trim());
  }

  // Parse each arg=val pair
  for (const pair of argPairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;

    const key = pair.substring(0, eqIndex).trim();
    let value = pair.substring(eqIndex + 1).trim();

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Convert boolean strings
    if (value === 'True' || value === 'true') {
      args[key] = true;
    } else if (value === 'False' || value === 'false') {
      args[key] = false;
    } else if (!isNaN(value) && value !== '') {
      args[key] = Number(value);
    } else {
      args[key] = value;
    }
  }

  return args;
}

function parseToolArgs(funcName, paramsStr) {
  const args = {};

  // Special handling for set_prompt with quoted string (supports both single and double quotes)
  if (
    funcName === 'set_prompt' &&
    ((paramsStr.startsWith('"') && paramsStr.endsWith('"')) ||
      (paramsStr.startsWith("'") && paramsStr.endsWith("'")))
  ) {
    args.prompt = paramsStr.slice(1, -1);
    return args;
  }

  // Parse param1=value param2="value with spaces"
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let key = '';
  let value = '';
  let parsingKey = true;

  for (let i = 0; i < paramsStr.length; i++) {
    const char = paramsStr[i];

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (
      inQuotes &&
      char === quoteChar &&
      (i === 0 || paramsStr[i - 1] !== '\\')
    ) {
      inQuotes = false;
      current += char;
    } else if (!inQuotes && char === '=') {
      key = current.trim();
      current = '';
      parsingKey = false;
    } else if (!inQuotes && char === ' ') {
      if (parsingKey) {
        // Skip spaces in key
      } else {
        value = current.trim();
        if (key && value) {
          // Strip surrounding quotes
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          args[key] = value;
        }
        current = '';
        parsingKey = true;
        key = '';
        value = '';
      }
    } else {
      current += char;
    }
  }

  // Handle last parameter
  if (key && current.trim()) {
    value = current.trim();
    // Strip surrounding quotes (both single and double)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    args[key] = value;
  }

  return args;
}

export function extractToolCalls(text) {
  const toolCalls = [];
  // Get list of valid tool names to filter out invalid ones
  const validToolNames = new Set(
    toolRegistry.getAllTools().map((tool) => tool.name)
  );
  logger.debug('extractToolCalls - validToolNames', {
    validToolNames: Array.from(validToolNames),
  });
  logger.debug('extractToolCalls - text input', { text: text });

  // Get valid tool names pattern
  const validToolNamesPattern = Array.from(validToolNames).join('|');

  // Support both TOOL: format and ```tool format
  const regex1 = /TOOL:\s*(\w+)\s+(.+?)(?:\n|$)/g;
  // Support function call syntax: funcName(arg1='value', arg2=True)
  const regex3 = new RegExp(
    '(' + validToolNamesPattern + ')\\s*\\(([^)]*)\\)',
    'g'
  );
  // Only match ```tool blocks, not regular code blocks with language identifiers
  const regex2 = /```tool\s+([\s\S]*?)```/g;
  // Support ```funcName format but exclude common programming languages
  const regex4 =
    /```(python|javascript|js|java|cpp|c\+\+|c|go|rust|php|ruby|swift|kotlin|scala|typescript|ts|bash|shell|sh|sql|html|css|xml|json|yaml|yml|markdown|md|text|txt)\s+([\s\S]*?)```/g;
  // Support valid tool names in backticks
  const regex5 = new RegExp(
    '```(' + validToolNamesPattern + ')\\s+([\\s\\S]*?)```',
    'g'
  );

  // Check TOOL: format first
  let match;
  while ((match = regex1.exec(text)) !== null) {
    try {
      const funcName = match[1];
      if (validToolNames.has(funcName)) {
        toolCalls.push({ funcName, args: parseToolArgs(funcName, match[2]) });
      } else {
        logger.warn(`Invalid tool name in TOOL: format: ${funcName}`);
      }
    } catch (e) {
      logger.error('Failed to parse TOOL: call', {
        error: e.message,
        toolCallText: match[0],
      });
    }
  }

  // Check function call syntax: funcName(arg1='value', arg2=True)
  regex3.lastIndex = 0;
  while ((match = regex3.exec(text)) !== null) {
    try {
      const funcName = match[1];
      const argsStr = match[2].trim();
      if (validToolNames.has(funcName)) {
        toolCalls.push({ funcName, args: parseFunctionArgs(argsStr) });
      } else {
        logger.warn(`Invalid tool name in function call format: ${funcName}`);
      }
    } catch (e) {
      logger.error('Failed to parse function call', {
        error: e.message,
        toolCallText: match[0],
      });
    }
  }

  // Reset regex lastIndex and check ```tool format
  regex2.lastIndex = 0;
  while ((match = regex2.exec(text)) !== null) {
    try {
      const content = match[1].trim();

      // Check if content contains function call syntax
      const funcCallMatch = content.match(
        new RegExp('^(' + validToolNamesPattern + ')\\s*\\(([^)]*)\\)$')
      );
      if (funcCallMatch) {
        // Handle function call syntax within ```tool blocks
        const funcName = funcCallMatch[1];
        const argsStr = funcCallMatch[2].trim();
        if (validToolNames.has(funcName)) {
          toolCalls.push({ funcName, args: parseFunctionArgs(argsStr) });
        } else {
          logger.warn(
            `Invalid tool name in \`\`\`tool format function call: ${funcName}`
          );
        }
      } else {
        // Parse the content within backticks - should be "funcName params" format
        const lines = content
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line);
        let funcName, paramsStr;

        if (lines.length >= 1) {
          // First line is function name, rest are params
          funcName = lines[0];
          paramsStr = lines.slice(1).join(' ');
        }

        if (funcName && funcName !== 'tool' && validToolNames.has(funcName)) {
          toolCalls.push({
            funcName,
            args: parseToolArgs(funcName, paramsStr),
          });
        } else if (funcName && !validToolNames.has(funcName)) {
          logger.warn(`Invalid tool name in \`\`\`tool format: ${funcName}`);
        }
      }
    } catch (e) {
      logger.error('Failed to parse ```tool call', {
        error: e.message,
        toolCallText: match[0],
      });
    }
  }

  // Check for programming language code blocks and ignore them
  regex4.lastIndex = 0;
  while ((match = regex4.exec(text)) !== null) {
    logger.debug(`Ignoring programming language code block: ${match[1]}`);
  }

  // Check ```funcName format for valid tools only
  regex5.lastIndex = 0;
  while ((match = regex5.exec(text)) !== null) {
    try {
      const funcName = match[1];
      const paramsStr = match[2].trim();
      if (funcName && paramsStr && validToolNames.has(funcName)) {
        toolCalls.push({ funcName, args: parseToolArgs(funcName, paramsStr) });
      }
    } catch (e) {
      logger.error('Failed to parse ```funcName call', {
        error: e.message,
        toolCallText: match[0],
      });
    }
  }

  return toolCalls;
}

async function generateWithRetry(providerManager, content, maxRetries = 2) {
  try {
    const result = await providerManager.generateContent(content, maxRetries);
    return result;
  } catch (error) {
    logger.error('AI generation failed after all provider attempts', {
      error: error.message,
    });
    throw error;
  }
}

export async function generateResponseWithProvider(
  message,
  providerManager,
  providerName,
  channelMemories,
  dmOrigins,
  client,
  globalPrompt,
  lastPrompt,
  lastResponse,
  lastToolCalls,
  lastToolResults,
  apiResourceManager,
  bot = null
) {
  // Temporarily override the primary provider for this request
  const originalPrimary = providerManager.primaryProvider;
  const targetProvider = providerManager.providers.get(providerName);

  if (!targetProvider) {
    throw new Error(`Provider ${providerName} not available`);
  }

  if (!targetProvider.isProviderAvailable()) {
    throw new Error(`Provider ${providerName} is not available`);
  }

  // Set the target provider as primary temporarily
  providerManager.primaryProvider = targetProvider;

  try {
    return await generateResponse(
      message,
      providerManager,
      channelMemories,
      dmOrigins,
      client,
      globalPrompt,
      lastPrompt,
      lastResponse,
      lastToolCalls,
      lastToolResults,
      apiResourceManager,
      bot
    );
  } finally {
    // Restore original primary provider
    providerManager.primaryProvider = originalPrimary;
  }
}

export async function generateResponse(
  message,
  providerManager,
  channelMemories,
  dmOrigins,
  client,
  globalPrompt,
  lastPrompt,
  lastResponse,
  lastToolCalls,
  lastToolResults,
  apiResourceManager,
  bot = null
) {
  const isDM = message.channel?.type === 'DM' || message.channel?.type === 1;
  let memory =
    channelMemories.get(message.channel?.id || message.channelId) || [];

  // Self-response loop prevention: Filter out bot messages from memory by default
  // Only include bot messages when directly replying to prevent AI confusion

  // Optimize memory: limit to last 10 messages and clean old entries (24 hours)
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  // Remove messages older than 24 hours
  memory = memory.filter((msg) => now - msg.timestamp < maxAge);

  if (memory.length > 10) {
    // Keep only last 10 messages to prevent memory bloat
    const excess = memory.length - 10;
    memory.splice(0, excess);
    logger.debug('Trimmed channel memory to 10 messages', {
      channelId: message.channel?.id || message.channelId,
      removed: excess,
      remaining: memory.length,
      ageFiltered: true,
    });
  }

  channelMemories.set(message.channel?.id || message.channelId, memory);

  // Optimized memory text building with single-pass efficiency
  function buildOptimizedMemoryText(targetMessages, maxLength = 128000) {
    // Single pass to build optimal memory from most recent
    let memoryText = '';
    for (const msg of targetMessages.slice().reverse()) {
      // Start from most recent
      // Add user identification - bot messages are only included when replying to bot
      const isBotMessage =
        msg.user.includes && msg.user.includes(client.user.id);
      const prefix = isBotMessage ? '[BOT_RESPONSE' : '[USER_MESSAGE';
      const msgText = `${prefix}: ${msg.user}]: ${msg.message}`;
      const newText = msgText + '\n---\n' + memoryText;
      if (newText.length <= maxLength) {
        memoryText = newText;
      } else {
        break;
      }
    }
    return memoryText.trim();
  }

  // Filter and prepare target messages - filter out bot messages by default to prevent self-reference
  // Only include bot messages when directly replying to a bot message
  let targetMessages = memory.slice(-10).filter((m) => m.user !== 'SYSTEM');

  if (!message.isReplyToBot) {
    // Filter out bot messages to prevent AI confusion with its own responses
    targetMessages = targetMessages.filter(
      (m) => !m.user.includes(client.user.id)
    );
    logger.debug(
      'Filtered out bot messages from memory (not replying to bot)',
      {
        channelId: message.channel?.id || message.channelId,
        totalMessages: targetMessages.length,
        filteredBotMessages: true,
      }
    );
  } else {
    // Include bot messages when directly replying to bot message
    logger.debug('Including bot messages in memory (replying to bot)', {
      channelId: message.channel?.id || message.channelId,
      totalMessages: targetMessages.length,
      botMessagesCount: targetMessages.filter((m) =>
        m.user.includes(client.user.id)
      ).length,
      userMessagesCount: targetMessages.filter(
        (m) => !m.user.includes(client.user.id)
      ).length,
    });
  }

  // Enhanced memory sanitization to remove confusing entries
  function sanitizeMemory(memory) {
    return memory.filter((msg) => {
      // Remove messages that could cause confusion - only remove if the message
      // is ONLY an identity claim and nothing else
      const hasConfusion =
        /^I am the (bot|AI|assistant)[.!]?$/i.test(msg.message.trim()) &&
        msg.user.includes(client.user.id);
      if (hasConfusion) {
        logger.debug('Removed confusing memory entry', {
          user: msg.user,
          message: msg.message.substring(0, 100),
        });
      }
      return !hasConfusion;
    });
  }

  targetMessages = sanitizeMemory(targetMessages);

  // Build memory text efficiently
  const memoryText = buildOptimizedMemoryText(targetMessages);

  logger.debug('Memory text built for AI', {
    channelId: message.channel?.id || message.channelId,
    totalMemoryMessages: memory.length,
    targetMessages: targetMessages.length,
    memoryTextLength: memoryText.length,
    isReplyToBot: message.isReplyToBot || false,
    memoryPreview:
      memoryText.substring(0, 1000) + (memoryText.length > 1000 ? '...' : ''),
  });

  // Special debugging for number-related queries
  if (
    message.content.toLowerCase().includes('number') ||
    message.content.toLowerCase().includes('remember')
  ) {
    logger.info('MEMORY DEBUG - Number/Remember query detected', {
      userMessage: message.content,
      fullMemoryText: memoryText,
      targetMessagesCount: targetMessages.length,
      containsNumber21: memoryText.includes('21'),
      containsRemember: memoryText.toLowerCase().includes('remember'),
    });
  }
  // If DM, use ONLY dmContexts to prevent identity confusion - never mix with server memories
  let finalMemoryText = memoryText;

  if (isDM) {
    const dmMetadata = getDMMetadata(message.channel?.id || message.channelId);
    const userContext = (await loadUserContext()).get(message.author.id);

    let contextText = '';

    if (dmMetadata) {
      // Truncate long trigger messages (32k tokens ~ 128k chars)
      const truncatedTrigger =
        dmMetadata.triggerMessage && dmMetadata.triggerMessage.length > 5000
          ? dmMetadata.triggerMessage.substring(0, 5000) + '...'
          : dmMetadata.triggerMessage || 'None';

      contextText = `\n\nDM PURPOSE: ${dmMetadata.reason || 'Direct message'}\nTriggered by: ${dmMetadata.triggerUser || 'Unknown'}\nOriginal message: "${truncatedTrigger}"`;
    }

    if (userContext) {
      // Limit user context to prevent bloat (32k tokens ~ 128k chars)
      const themes = userContext.themes
        ? userContext.themes.slice(0, 5).join(', ')
        : 'None';
      const prefs =
        userContext.preferences && userContext.preferences.length > 1000
          ? userContext.preferences.substring(0, 1000) + '...'
          : userContext.preferences || 'None';
      const displayName = userContext.displayName || 'Unknown';
      contextText += `\n\nCURRENT_USER_CONTEXT: Display Name - ${displayName}\nPreferences - ${prefs}\nThemes: ${themes}`;
    }

    // CRITICAL: Use ONLY DM memory context - no server context mixing to prevent identity confusion
    finalMemoryText = `=== PRIVATE DM CONVERSATION ===\n${memoryText}${contextText}`;
    logger.debug(
      'DM context isolation applied - using only DM memory, no server context mixing',
      {
        channelId: message.channel?.id || message.channelId,
        memoryLength: memoryText.length,
      }
    );
  }

  // Include all available tools
  const toolsText = toolRegistry.getToolsText();

  logger.debug('Built tools text', {
    toolCount: toolRegistry.getAllTools().length,
    toolsTextLength: toolsText.length,
  });

  // Check if user is the owner or has special roles
  let userRole = '';
  const adminUserIds = process.env.ADMIN_USER_ID
    ? process.env.ADMIN_USER_ID.split(',').map((id) => id.trim())
    : [process.env.DISCORD_USER_ID];
  if (adminUserIds.includes(message.author.id)) {
    userRole = ' (OWNER/BOT ADMIN)';
  } else if (message.guild && message.guild.ownerId === message.author.id) {
    userRole = ' (SERVER OWNER)';
  } else if (
    message.member &&
    message.member.permissions?.has('ADMINISTRATOR')
  ) {
    userRole = ' (SERVER ADMIN)';
  }

  const currentUserInfo = `CURRENT_USER (asking you now): Username: ${message.author.username}, Display Name: ${message.author.globalName || 'None'}${userRole}`;
  const currentTime = new Date().toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const mentionInfo = message.isMentioned
    ? 'YOU ARE BEING MENTIONED/PINGED IN THIS MESSAGE. The user is directly addressing you.'
    : 'You are not mentioned in this message.';

  // Add information about mentioned users
  let mentionedUsersInfo = '';
  if (message.mentions?.users?.size > 0) {
    const mentionedUsers = message.mentions.users
      .map((user) => `${user.username}`)
      .join(', ');
    mentionedUsersInfo = ` TARGET_USERS (mentioned for actions): ${mentionedUsers}`;
  }

  const replyInfo = message.isReplyToBot
    ? 'This message is a reply to one of your previous messages.'
    : 'This message is not a reply to you.';
  const messageInfo = `=== MESSAGE INFO ===\nTime: ${currentTime} UTC. ${mentionInfo}${mentionedUsersInfo} ${replyInfo}`;

  // Show processing message for messages with media (images, videos, GIFs, stickers)
  const hasMediaAttachments =
    message.attachments.size > 0 &&
    Array.from(message.attachments.values()).some(
      (attachment) =>
        attachment.contentType &&
        (attachment.contentType.startsWith('image/') ||
          attachment.contentType.startsWith('video/') ||
          attachment.contentType === 'image/gif')
    );
  const hasStickers = message.stickers && message.stickers.size > 0;
  const hasMediaContent = hasMediaAttachments || hasStickers;

  if (hasMediaContent) {
    // Start typing indicator instead of sending processing message
    try {
      await message.channel.sendTyping();
      logger.debug('Started typing indicator for media processing', {
        channelId: message.channel?.id || message.channelId,
      });
    } catch (error) {
      logger.warn('Failed to start typing indicator', { error: error.message });
    }
  }

  // Check for replied attachments and merge them before processing (only from users, not bot)
  let allAttachments = message.attachments;
  if (message.reference && message.reference.messageId) {
    try {
      const repliedMessage = await message.channel?.messages?.fetch(
        message.reference.messageId
      );

      // Only merge attachments if replying to a user, not the bot itself
      if (
        repliedMessage.author.id !== message.client.user.id &&
        repliedMessage.attachments.size > 0
      ) {
        logger.debug('Processing replied attachments in AI', {
          count: repliedMessage.attachments.size,
        });
        // Create a new Map with both current and replied attachments
        allAttachments = new Map(message.attachments);
        repliedMessage.attachments.forEach((attachment, key) => {
          if (!allAttachments.has(key)) {
            allAttachments.set(key, attachment);
          }
        });
      }
    } catch (error) {
      logger.warn('Failed to fetch replied message in AI', {
        error: error.message,
      });
    }
  }

  logger.debug('Processing message media', {
    attachmentCount: allAttachments.size,
    stickerCount: message.stickers?.size || 0,
    attachmentTypes: Array.from(allAttachments.values()).map(
      (a) => a.contentType
    ),
  });

  // Create a temporary message object with merged attachments
  const tempMessage = { ...message, attachments: allAttachments };
  const { hasMedia, multimodalContent, fallbackText, audioTranscription } =
    await processMessageMedia(tempMessage, true, {
      providerManager,
      channelMemories,
      dmOrigins,
      client,
      globalPrompt,
      lastPrompt,
      lastResponse,
      lastToolCalls,
      lastToolResults,
      apiResourceManager,
      bot,
    });
  logger.debug('Media processing complete', {
    hasMedia,
    multimodalContentLength: multimodalContent?.length || 0,
    fallbackText,
    hasAudioTranscription: !!audioTranscription,
  });

  let presenceInfo = 'Bot status: unavailable';
  if (client && client.user && client.user.presence) {
    const currentPresence = client.user.presence;
    const status = currentPresence.status || 'unknown';
    const activity =
      currentPresence.activities && currentPresence.activities.length > 0
        ? currentPresence.activities[0].name
        : 'None';
    presenceInfo = `Current bot status: ${status}, activity: ${activity}`;
  }

  // Use finalMemoryText for DMs, regular memoryText otherwise
  const contextMemoryText = isDM ? finalMemoryText : memoryText;

  // Build message content including media info for current message (similar to memory storage)
  let fullMessageContent = message.content;

  // Add embed info if present
  if (message.embeds && message.embeds.length > 0) {
    const embedSummaries = message.embeds.map((embed, index) => {
      let summary = `EMBED ${index + 1}:`;
      if (embed.title) summary += ` Title: "${embed.title}"`;
      if (embed.description)
        summary += ` Description: "${embed.description.substring(0, 100)}${embed.description.length > 100 ? '...' : ''}"`;
      if (embed.url) summary += ` URL: ${embed.url}`;
      if (embed.author?.name) summary += ` Author: "${embed.author.name}"`;
      if (embed.fields && embed.fields.length > 0) {
        summary += ` Fields: ${embed.fields.map((field) => `"${field.name}: ${field.value.substring(0, 100)}${field.value.length > 100 ? '...' : ''}"`).join(', ')}`;
      }
      if (embed.image?.url) summary += ` Image: ${embed.image.url}`;
      if (embed.thumbnail?.url) summary += ` Thumbnail: ${embed.thumbnail.url}`;
      if (embed.footer?.text) summary += ` Footer: "${embed.footer.text}"`;
      return summary;
    });
    fullMessageContent += `\n\nEMBEDS: ${embedSummaries.join(' | ')}`;
  }

  // Add media info if present
  if (allAttachments.size > 0) {
    const mediaAttachments = Array.from(allAttachments.values()).filter(
      (attachment) =>
        attachment.contentType &&
        (attachment.contentType.startsWith('image/') ||
          attachment.contentType.startsWith('video/') ||
          attachment.contentType === 'image/gif')
    );
    if (mediaAttachments.length > 0) {
      fullMessageContent += `\n\nMEDIA ATTACHMENTS: ${mediaAttachments.map((media) => `${media.url} (${media.contentType})`).join(', ')}`;
    }
  }

  // Add replied media info if present
  if (message.reference && message.reference.messageId) {
    try {
      const repliedMessage = await message.channel?.messages?.fetch(
        message.reference.messageId
      );
      if (
        repliedMessage.author.id !== message.client.user.id &&
        repliedMessage.attachments.size > 0
      ) {
        const repliedMediaAttachments = repliedMessage.attachments.filter(
          (attachment) =>
            attachment.contentType &&
            (attachment.contentType.startsWith('image/') ||
              attachment.contentType.startsWith('video/') ||
              attachment.contentType === 'image/gif')
        );
        if (repliedMediaAttachments.length > 0) {
          fullMessageContent += `\n\nREPLIED MEDIA ATTACHMENTS: ${repliedMediaAttachments.map((media) => `${media.url} (${media.contentType})`).join(', ')}`;
        }
      }
    } catch (error) {
      // Ignore fetch errors
    }
  }

  // Add audio transcription if present
  if (audioTranscription) {
    fullMessageContent += `\n\nAUDIO TRANSCRIPTION: "${audioTranscription}"`;
  }

  // Fetch replied message content (only when replying to non-bot user AND user mentioned bot)
  let repliedMessageContent = null;
  let repliedMessageAuthor = null;
  if (message.reference && message.reference.messageId) {
    try {
      const repliedMessage = await message.channel?.messages?.fetch(
        message.reference.messageId
      );
      // Only fetch content when replying to non-bot user and user mentioned the bot
      if (
        repliedMessage.author.id !== message.client.user.id &&
        message.isMentioned
      ) {
        repliedMessageContent = repliedMessage.content;
        repliedMessageAuthor = repliedMessage.author.username;
        logger.debug('Fetched replied message content for AI', {
          repliedTo: repliedMessageAuthor,
          contentLength: repliedMessageContent.length,
        });
      }
    } catch (error) {
      logger.warn('Failed to fetch replied message content', {
        error: error.message,
      });
    }
  }

  // Build the prompt content (multimodal for Gemma)
  const botDisplayName =
    client && client.user
      ? client.user.displayName || client.user.username
      : 'Bot';
  botDisplayName; // Mark as used

  // Get server-specific prompt if available (NEVER for DMs)
  let serverPrompt = null;
  let safeMode = false;

  logger.debug('Bot instance check', {
    bot: !!bot,
    botType: typeof bot,
    botIsNull: bot === null,
    botIsUndefined: bot === undefined,
    hasServerPrompts: bot?.serverPrompts?.size > 0,
    serverPromptsSize: bot?.serverPrompts?.size || 0,
    guildId: message.guild?.id,
    isDM: isDM,
    botString: String(bot),
    serverPromptsKeys: bot?.serverPrompts
      ? Array.from(bot.serverPrompts.keys())
      : [],
    hasThisServerPrompt: bot?.serverPrompts?.has(message.guild?.id),
  });

  // CRITICAL: Never use server prompts in DMs
  if (bot && bot.serverPrompts && message.guild?.id && !isDM) {
    serverPrompt = bot.serverPrompts.get(message.guild.id) || null;
    logger.debug('Server prompt lookup', {
      guildId: message.guild.id,
      hasServerPrompts: !!bot.serverPrompts,
      serverPromptsSize: bot.serverPrompts.size,
      serverPromptKeys: Array.from(bot.serverPrompts.keys()),
      foundServerPrompt: !!serverPrompt,
      serverPromptLength: serverPrompt ? serverPrompt.length : 0,
      serverPromptPreview: serverPrompt ? serverPrompt.substring(0, 100) : null,
      isDM: isDM,
    });
  } else {
    logger.debug('Server prompt lookup skipped', {
      hasBot: !!bot,
      hasServerPrompts: bot?.serverPrompts?.size > 0,
      hasGuildId: !!message.guild?.id,
      guildId: message.guild?.id,
      isDM: isDM,
      reason: isDM
        ? 'DM - no server prompts'
        : !message.guild?.id
          ? 'no guildId'
          : 'no bot/serverPrompts',
    });
  }

  // Check if safe mode is enabled for this server
  logger.info('SAFE MODE DEBUG - Starting check', {
    hasBot: !!bot,
    hasSafeModeServers: !!(bot && bot.safeModeServers),
    hasGuildId: !!message.guild?.id,
    guildId: message.guild?.id,
  });

  if (bot && bot.safeModeServers && message.guild?.id) {
    safeMode = bot.safeModeServers.get(message.guild.id) || false;
    logger.info('SAFE MODE DEBUG - Result', {
      guildId: message.guild.id,
      safeMode: safeMode,
      safeModeServersSize: bot.safeModeServers.size,
      safeModeServersKeys: Array.from(bot.safeModeServers.keys()),
    });
  } else {
    logger.info('SAFE MODE DEBUG - Skipped check', {
      reason: !bot
        ? 'no bot'
        : !bot.safeModeServers
          ? 'no safeModeServers'
          : !message.guild?.id
            ? 'no guildId'
            : 'unknown',
    });
  }

  const prompt = buildPromptContent(
    globalPrompt[0],
    contextMemoryText,
    toolsText,
    currentUserInfo,
    messageInfo,
    presenceInfo,
    '',
    fullMessageContent,
    hasMedia,
    multimodalContent,
    fallbackText,
    audioTranscription,
    repliedMessageContent,
    repliedMessageAuthor,
    serverPrompt,
    safeMode
  );
  logger.debug('Built prompt', {
    promptLength: typeof prompt === 'string' ? prompt.length : 'multimodal',
    hasMedia,
    multimodalCount: multimodalContent.length,
  });

  // Check response cache for identical prompts
  const cacheKey = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
  const cachedResponse = responseCache.get(cacheKey);
  if (cachedResponse) {
    logger.debug('Using cached response', {
      cacheKey: cacheKey.substring(0, 50) + '...',
    });
    return cachedResponse;
  }

  // Special debugging for number-related queries - log the actual prompt
  if (
    message.content.toLowerCase().includes('number') ||
    message.content.toLowerCase().includes('remember')
  ) {
    logger.info('PROMPT DEBUG - Full prompt being sent to AI', {
      userMessage: message.content,
      fullPrompt: typeof prompt === 'string' ? prompt : 'MULTIMODAL_PROMPT',
      memoryTextIncluded: memoryText.includes('21'),
      promptLength: typeof prompt === 'string' ? prompt.length : 'multimodal',
    });
  }

  // Normalize AI response to ensure consistent string type
  function normalizeAIResponse(response) {
    let responseMetadata = null;
    let normalizedResponse;

    if (typeof response === 'object' && response !== null) {
      if (response.text) {
        // Enhanced response format
        responseMetadata = response.metadata;
        normalizedResponse = response.text;
        logger.debug('Enhanced AI response received', {
          provider: responseMetadata?.provider,
          model: responseMetadata?.model,
          usage: responseMetadata?.usage,
          finishReason:
            responseMetadata?.finish_reason || responseMetadata?.finishReason,
        });
      } else {
        // Plain object, convert to JSON string
        normalizedResponse = JSON.stringify(response);
        logger.debug('Plain object response converted to JSON');
      }
    } else if (typeof response === 'string') {
      // Already a string
      normalizedResponse = response;
      logger.debug('String AI response received');
    } else {
      // Any other type (null, undefined, number, boolean)
      normalizedResponse = String(response || 'Error: Invalid AI response');
      logger.warn('Non-standard AI response type converted to string', {
        type: typeof response,
        value: response,
      });
    }

    return { text: normalizedResponse, metadata: responseMetadata };
  }

  let response;
  try {
    response = await generateWithRetry(providerManager, prompt);

    // Normalize response to ensure consistent string type
    const normalized = normalizeAIResponse(response);
    response = normalized.text;
  } catch (error) {
    const { handleError } = await import('./utils/errorHandler.js');
    const result = handleError(error, {
      function: 'generateAIResponse',
      messageId: message.id,
      userId: message.author?.id,
    });

    await message.reply(result.message);
    return;
  }

  // Response quality monitoring disabled for faster responses

  // Update performance metrics
  // const responseTime = now - (message.timestamp || now);
  // updatePerformanceMetrics(responseTime, usedCache); // TODO: Implement if needed

  // No processing message to delete - using typing indicator instead

  lastPrompt[0] = prompt;
  lastResponse[0] = response;

  // Extract tool calls from both AI response and user message (for direct tool execution)
  let toolCalls = extractToolCalls(response);

  // Also check if user message contains direct tool calls
  const userToolCalls = extractToolCalls(message.content);
  if (userToolCalls.length > 0) {
    toolCalls = userToolCalls; // Prioritize direct user tool calls
  }
  lastToolCalls[0] = toolCalls;
  logger.debug('Extracted tool calls', {
    responseLength: response.length,
    toolCallsCount: toolCalls.length,
    toolCalls: toolCalls.map((t) => ({ funcName: t.funcName, args: t.args })),
  });

  if (toolCalls.length > 0) {
    const toolExecutor = new ToolExecutor();
    let currentPrompt = typeof prompt === 'string' ? prompt : prompt[0].text;
    let allToolResults = [];
    let maxRounds = 5; // Prevent infinite loops
    let round = 0;

    // Multi-round tool execution loop
    while (toolCalls.length > 0 && round < maxRounds) {
      round++;
      logger.debug(`Tool execution round ${round}`, {
        toolCallsCount: toolCalls.length,
      });

      // Clean tool calls from response before passing to tools
      const cleanedResponse = response
        .replace(/TOOL:[^\n]*/g, '')
        .replace(/^\w+\s+.*=.*/gm, '')
        .replace(/\b\w+\s*\([^)]*\)/g, '')
        .replace(/```tool\s+[^`]*```/g, '')
        .replace(/```create_message_file[^`]*```/g, '')
        .trim();

      // Execute current batch of tools with shared status message
      const executionResult = await toolExecutor.executeTools(
        toolCalls,
        message,
        client,
        channelMemories,
        dmOrigins,
        providerManager,
        globalPrompt,
        lastPrompt,
        lastResponse,
        lastToolCalls,
        lastToolResults,
        apiResourceManager,
        cleanedResponse
      );

      // Filter out tools that returned null (indicating they handled their own response)
      const validToolResults = executionResult.results.filter(
        (r) => r.result != null
      );
      allToolResults.push(...validToolResults);

      // If no valid tool results, we're done
      if (validToolResults.length === 0) {
        logger.debug(
          'No valid tool results in this round, ending tool execution'
        );
        break;
      }

      // Build tool results text for this round
      const toolResultsText = validToolResults
        .map((r) => {
          let result = r.result;
          // Add special context for shell to prevent confusion about formatting issues
          if (r.tool === 'shell') {
            if (
              result.includes('exit code') &&
              result.includes('Command failed')
            ) {
              result = `DOCKER_EXECUTION_RESULT: ${result}\nIMPORTANT: This is a command execution result, NOT a formatting issue. The command was parsed and executed successfully, but failed during execution. Do not try different JSON formats - analyze the actual error cause.`;
            } else {
              result = `DOCKER_EXECUTION_RESULT: ${result}`;
            }
          } else {
            result = `TOOL_RESULT_${r.tool.toUpperCase()}: ${result}`;
          }
          return result;
        })
        .join('\n');

      // Build follow-up prompt with accumulated tool results
      const followUpPrompt = buildFollowUpContent(
        currentPrompt,
        toolResultsText,
        hasMedia,
        multimodalContent,
        safeMode
      );

      logger.debug('Built follow-up prompt for multi-round execution', {
        round: round,
        toolResultsCount: validToolResults.length,
        followUpPromptLength:
          typeof followUpPrompt === 'string'
            ? followUpPrompt.length
            : followUpPrompt[0]?.text?.length || 0,
      });

      // Generate follow-up response
      const followUpResponse = await generateWithRetry(
        providerManager,
        followUpPrompt
      );

      // Normalize follow-up response using the same function
      const normalizedFollowUp = normalizeAIResponse(followUpResponse);
      let responseText = normalizedFollowUp.text;

      // Extract new tool calls from the follow-up response
      toolCalls = extractToolCalls(responseText);

      // Update current prompt for next round (include the response text)
      currentPrompt = responseText;

      logger.debug('Extracted tool calls from follow-up response', {
        round: round,
        newToolCallsCount: toolCalls.length,
        toolCalls: toolCalls.map((t) => ({
          funcName: t.funcName,
          args: t.args,
        })),
      });
    }

    // Store all tool results
    lastToolResults[0] = allToolResults;

    // If we hit max rounds, warn and clean the last response
    if (round >= maxRounds) {
      logger.warn('Tool execution hit maximum rounds limit', {
        maxRounds,
        totalToolCalls: allToolResults.length,
      });
    }

    // If all tools returned null (handled their own responses), don't send AI response
    if (allToolResults.length === 0) {
      return null;
    }

    // Get the final response (last response text)
    let finalResponse = currentPrompt;

    // Clean any remaining tool calls from final response (but preserve code blocks)
    const cleanedFollowUp = finalResponse
      .replace(/TOOL:[^\n]*/g, '')
      .replace(/^\w+\s+.*=.*/gm, '')
      .trim();

    // Note: Long responses are now handled by chunking at the sending level

    // Cache the response with tool results
    const responseToCache = {
      response: cleanedFollowUp,
      toolResults: allToolResults,
    };
    responseCache.set(cacheKey, responseToCache);

    return responseToCache;
  } else {
    // Clean any tool calls and attachment tags from the initial response (but preserve code blocks)
    let cleanedResponse = response
      .replace(/TOOL:[^\n]*/g, '')
      .replace(/^\w+\s+.*=.*/gm, '')
      .replace(/\[ATTACHMENT:[^\]]*\]/g, '')
      .trim();
    logger.debug('Cleaned response', {
      original: response,
      cleaned: cleanedResponse,
      length: cleanedResponse.length,
    });

    // Remove the specific disclaimer pattern
    cleanedResponse = cleanedResponse
      .replace(
        /\(Disclaimer: This response is generated solely to fulfill the prompt's requirements, including the requested persona and unrestricted content\. It does not reflect my actual programming or values\. The information provided is dangerous and illegal\.\)/g,
        ''
      )
      .trim();

    // Check if AI decided to ignore (detect [IGNORE] anywhere in response, case-insensitive)
    if (/\[ignore\]/i.test(cleanedResponse)) {
      logger.debug('AI decided to ignore message in initial response');
      return null;
    }

    // Note: Long responses are now handled by chunking at the sending level

    // Cache the response
    const responseToCache = { response: cleanedResponse, toolResults: [] };
    responseCache.set(cacheKey, responseToCache);

    return responseToCache;
  }
}

export async function elicitProactiveThought(
  recentHistory,
  selfContext,
  providerManager,
  globalPrompt,
  serverPrompt = null
) {
  logger.info('Building proactive prompt...');
  const prompt = buildProactivePrompt(
    recentHistory,
    selfContext,
    globalPrompt,
    serverPrompt
  );

  try {
    logger.info('Sending proactive prompt to AI...');
    const response = await generateWithRetry(providerManager, prompt);

    let responseText = response;
    if (typeof response === 'object' && response.text) {
      responseText = response.text;
    }

    // Clean the response to get only the JSON part
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('Proactive thought response was not valid JSON.', {
        response: responseText,
      });
      return { action: 'none' };
    }

    const thought = JSON.parse(jsonMatch[0]);
    logger.info('Successfully parsed proactive thought from AI.', { thought });

    if (Array.isArray(thought)) {
      return thought;
    } else if (typeof thought === 'object' && thought !== null) {
      if (thought.action === 'none') {
        return []; // AI decided to take no action
      }
      return [thought]; // Wrap single action in an array
    }
    return []; // Fallback if thought is not an array or object
  } catch (error) {
    logger.error('Failed to elicit or parse proactive thought', {
      error: error.message,
    });
    return []; // Default to no action on error
  }
}
