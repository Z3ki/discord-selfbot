import { toolRegistry } from './tools/index.js';
import { ToolExecutor } from './tools/ToolExecutor.js';
import { getDMMetadata, loadUserContext } from './utils/index.js';
import { processMessageMedia } from './media.js';
import { buildPromptContent, buildFollowUpContent } from './prompts.js';
import { logger } from './utils/logger.js';

// Response quality monitoring removed for faster responses




function parseToolArgs(funcName, paramsStr) {
  const args = {};

  // Special handling for set_prompt with quoted string
  if (funcName === 'set_prompt' && paramsStr.startsWith('"') && paramsStr.endsWith('"')) {
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
    } else if (inQuotes && char === quoteChar && (i === 0 || paramsStr[i-1] !== '\\')) {
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
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    args[key] = value;
  }

  return args;
}

export function extractToolCalls(text) {
  const toolCalls = [];
  // Get list of valid tool names to filter out invalid ones
  const validToolNames = new Set(toolRegistry.getAllTools().map(tool => tool.name));
  
  // Support both TOOL: format and ```tool format
  const regex1 = /TOOL:\s*(\w+)\s+(.+?)(?:\n|$)/g;
  // Only match ```tool blocks, not regular code blocks with language identifiers
  const regex2 = /```tool\s+([\s\S]*?)```/g;
  // Support ```funcName format but exclude common programming languages
  const regex4 = /```(python|javascript|js|java|cpp|c\+\+|c|go|rust|php|ruby|swift|kotlin|scala|typescript|ts|bash|shell|sh|sql|html|css|xml|json|yaml|yml|markdown|md|text|txt)\s+([\s\S]*?)```/g;
  // Support valid tool names in backticks
  const validToolNamesPattern = Array.from(validToolNames).join('|');
  const regex5 = new RegExp('```(' + validToolNamesPattern + ')\\s+([\\s\\S]*?)```', 'g');

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
      logger.error('Failed to parse TOOL: call', { error: e.message, toolCallText: match[0] });
    }
  }

  // Reset regex lastIndex and check ```tool format
  regex2.lastIndex = 0;
  while ((match = regex2.exec(text)) !== null) {
    try {
      const content = match[1].trim();
      // Parse the content within backticks - should be "funcName params" format
      const lines = content.split('\n').map(line => line.trim()).filter(line => line);
      let funcName, paramsStr;

      if (lines.length >= 1) {
        // First line is function name, rest are params
        funcName = lines[0];
        paramsStr = lines.slice(1).join(' ');
      }

      if (funcName && funcName !== 'tool' && validToolNames.has(funcName)) {
        toolCalls.push({ funcName, args: parseToolArgs(funcName, paramsStr) });
      } else if (funcName && !validToolNames.has(funcName)) {
        logger.warn(`Invalid tool name in \`\`\`tool format: ${funcName}`);
      }
    } catch (e) {
      logger.error('Failed to parse ```tool call', { error: e.message, toolCallText: match[0] });
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
      logger.error('Failed to parse ```funcName call', { error: e.message, toolCallText: match[0] });
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
      error: error.message
    });
    throw error;
  }
}

export async function generateResponseWithProvider(message, providerManager, providerName, channelMemories, dmOrigins, client, globalPrompt, lastPrompt, lastResponse, lastToolCalls, lastToolResults, apiResourceManager) {
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
    return await generateResponse(message, providerManager, channelMemories, dmOrigins, client, globalPrompt, lastPrompt, lastResponse, lastToolCalls, lastToolResults, apiResourceManager);
  } finally {
    // Restore original primary provider
    providerManager.primaryProvider = originalPrimary;
  }
}

export async function generateResponse(message, providerManager, channelMemories, dmOrigins, client, globalPrompt, lastPrompt, lastResponse, lastToolCalls, lastToolResults, apiResourceManager) {
  const memory = channelMemories.get(message.channel.id) || [];

  // Self-response loop prevention disabled for faster responses

    // Optimize memory: limit to last 20 messages and clean old entries
    if (memory.length > 50) {
      // Keep only last 50 messages to prevent memory bloat
      const excess = memory.length - 50;
      memory.splice(0, excess);
      channelMemories.set(message.channel.id, memory);
      logger.debug('Trimmed channel memory', { 
        channelId: message.channel.id, 
        removed: excess, 
        remaining: memory.length 
      });
    }
    
    // Optimized memory text building with single-pass efficiency
    function buildOptimizedMemoryText(targetMessages, maxLength = 128000) {
      // Single pass to build optimal memory from most recent
      let memoryText = '';
      for (const msg of targetMessages.slice().reverse()) { // Start from most recent
        const msgText = `${msg.user}: ${msg.message}`;
        const newText = msgText + '\n' + memoryText;
        if (newText.length <= maxLength) {
          memoryText = newText;
        } else {
          break;
        }
      }
      return memoryText.trim();
    }

    // Filter and prepare target messages
    let targetMessages = memory.slice(-50).filter(m => m.user !== 'SYSTEM');

    // If replying to bot, keep the most recent bot message for context but filter out older ones
    if (message.isReplyToBot) {
      // Find the most recent bot message (the one being replied to)
      const recentBotMessages = targetMessages.filter(m => m.user.includes(client.user.id));
      const mostRecentBotMessage = recentBotMessages.length > 0 ? recentBotMessages[recentBotMessages.length - 1] : null;

      // Keep only non-bot messages plus the most recent bot message
      targetMessages = targetMessages.filter(m => !m.user.includes(client.user.id));
      if (mostRecentBotMessage) {
        targetMessages.push(mostRecentBotMessage);
        // Sort by timestamp to maintain chronological order
        targetMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      }

      logger.debug('Kept most recent bot message in context for reply', {
        channelId: message.channel.id,
        totalMessages: targetMessages.length,
        keptBotMessage: !!mostRecentBotMessage
      });
    }

    // Build memory text efficiently
    const memoryText = buildOptimizedMemoryText(targetMessages);
    
    logger.debug('Memory text built for AI', {
      channelId: message.channel.id,
      totalMemoryMessages: memory.length,
      targetMessages: targetMessages.length,
      memoryTextLength: memoryText.length,
      isReplyToBot: message.isReplyToBot || false,
      memoryPreview: memoryText.substring(0, 1000) + (memoryText.length > 1000 ? '...' : '')
    });
    
    // Special debugging for number-related queries
    if (message.content.toLowerCase().includes('number') || message.content.toLowerCase().includes('remember')) {
      logger.info('MEMORY DEBUG - Number/Remember query detected', {
        userMessage: message.content,
        fullMemoryText: memoryText,
        targetMessagesCount: targetMessages.length,
        containsNumber21: memoryText.includes('21'),
        containsRemember: memoryText.toLowerCase().includes('remember')
      });
    }
    // If DM, include context from original channel and DM metadata (with length limits)
    const isDM = message.channel.type === 'DM' || message.channel.type === 1; // Discord.js v13 uses numbers for channel types
    let finalMemoryText = memoryText;

    if (isDM) {
      const originalChannelId = dmOrigins.get(message.channel.id);
      const dmMetadata = getDMMetadata(message.channel.id);
      const userContext = (await loadUserContext()).get(message.author.id);

      let contextText = '';

      if (dmMetadata) {
        // Truncate long trigger messages (32k tokens ~ 128k chars)
        const truncatedTrigger = dmMetadata.triggerMessage && dmMetadata.triggerMessage.length > 5000
          ? dmMetadata.triggerMessage.substring(0, 5000) + '...'
          : dmMetadata.triggerMessage || 'None';

        contextText = `\n\nDM PURPOSE: ${dmMetadata.reason || 'Direct message'}\nTriggered by: ${dmMetadata.triggerUser || 'Unknown'}\nOriginal message: "${truncatedTrigger}"`;
      }

      if (userContext) {
        // Limit user context to prevent bloat (32k tokens ~ 128k chars)
        const themes = userContext.themes ? userContext.themes.slice(0, 10).join(', ') : 'None';
        const prefs = userContext.preferences && userContext.preferences.length > 2000
          ? userContext.preferences.substring(0, 2000) + '...'
          : userContext.preferences || 'None';
        const displayName = userContext.displayName || 'Unknown';
        contextText += `\n\nUSER CONTEXT: Display Name - ${displayName}\nPreferences - ${prefs}\nThemes: ${themes}`;
      }

      if (originalChannelId) {
        const channelMemory = channelMemories.get(originalChannelId) || [];
        const recentChannelMemory = channelMemory.slice(-10); // Increased to 10 messages for 32k token context
        const channelMemoryText = recentChannelMemory.map(m => {
          // Truncate individual messages (32k tokens ~ 128k chars)
          const msg = `${m.user}: ${m.message}`;
          return msg.length > 5000 ? msg.substring(0, 5000) + '...' : msg;
        }).join('\n');
        finalMemoryText = `Recent channel context:\n${channelMemoryText}\n\nDM conversation:\n${memoryText}${contextText}`;
      } else {
        finalMemoryText = `DM conversation:\n${memoryText}${contextText}`;
      }
    }

    // Include all available tools
    const toolsText = toolRegistry.getToolsText();

    logger.debug('Built tools text', { toolCount: toolRegistry.getAllTools().length, toolsTextLength: toolsText.length });

    const currentUserInfo = `Username: ${message.author.username}, Display Name: ${message.author.globalName || 'None'}, ID: ${message.author.id}`;
    const currentTime = new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long'
    });
    const mentionInfo = message.isMentioned ? 'YOU ARE BEING MENTIONED/PINGED IN THIS MESSAGE. The user is directly addressing you.' : 'You are not mentioned in this message.';

    // Add information about mentioned users
    let mentionedUsersInfo = '';
    if (message.mentions.users.size > 0) {
      const mentionedUsers = message.mentions.users.map(user => `${user.username} (ID: ${user.id})`).join(', ');
      mentionedUsersInfo = ` Mentioned users: ${mentionedUsers}`;
    }

    const replyInfo = message.isReplyToBot ? 'This message is a reply to one of your previous messages.' : 'This message is not a reply to you.';
    const messageInfo = `Current message ID: ${message.id}, Channel ID: ${message.channel.id} (this is a channel, not a user), Channel Type: ${message.channel.type}, Time: ${currentTime} UTC. ${mentionInfo}${mentionedUsersInfo} ${replyInfo}`;
    

    
    // Show processing message for messages with media (images, videos, GIFs, stickers)
    const hasMediaAttachments = message.attachments.size > 0 &&
      Array.from(message.attachments.values()).some(
        attachment => attachment.contentType && (
          attachment.contentType.startsWith('image/') ||
          attachment.contentType.startsWith('video/') ||
          attachment.contentType === 'image/gif'
        )
      );
    const hasStickers = message.stickers && message.stickers.size > 0;
    const hasMediaContent = hasMediaAttachments || hasStickers;

    if (hasMediaContent) {
      // Start typing indicator instead of sending processing message
      try {
        await message.channel.sendTyping();
        logger.debug('Started typing indicator for media processing', { channelId: message.channel.id });
      } catch (error) {
        logger.warn('Failed to start typing indicator', { error: error.message });
      }
    }

// Check for replied attachments and merge them before processing (only from users, not bot)
    let allAttachments = message.attachments;
    if (message.reference && message.reference.messageId) {
      try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);

        // Only merge attachments if replying to a user, not the bot itself
        if (repliedMessage.author.id !== message.client.user.id && repliedMessage.attachments.size > 0) {
          logger.debug('Processing replied attachments in AI', { count: repliedMessage.attachments.size });
          // Create a new Map with both current and replied attachments
          allAttachments = new Map(message.attachments);
          repliedMessage.attachments.forEach((attachment, key) => {
            if (!allAttachments.has(key)) {
              allAttachments.set(key, attachment);
            }
          });
        }
      } catch (error) {
        logger.warn('Failed to fetch replied message in AI', { error: error.message });
      }
    }

    logger.debug('Processing message media', {
      attachmentCount: allAttachments.size,
      stickerCount: message.stickers?.size || 0,
      attachmentTypes: Array.from(allAttachments.values()).map(a => a.contentType)
    });

    // Create a temporary message object with merged attachments
    const tempMessage = { ...message, attachments: allAttachments };
    const { hasMedia, multimodalContent, fallbackText, audioTranscription } = await processMessageMedia(tempMessage, true, {
      providerManager,
      channelMemories,
      dmOrigins,
      client,
      globalPrompt,
      lastPrompt,
      lastResponse,
      lastToolCalls,
      lastToolResults,
      apiResourceManager
    });
    logger.debug('Media processing complete', {
      hasMedia,
      multimodalContentLength: multimodalContent?.length || 0,
      fallbackText,
      hasAudioTranscription: !!audioTranscription
    });

    const currentPresence = client.user.presence;
    const status = currentPresence.status;
    const activity = currentPresence.activities.length > 0 ? currentPresence.activities[0].name : 'None';
    const presenceInfo = `Current bot status: ${status}, activity: ${activity}`;

    // Use finalMemoryText for DMs, regular memoryText otherwise
    const contextMemoryText = isDM ? finalMemoryText : memoryText;

    // Build message content including media info for current message (similar to memory storage)
    let fullMessageContent = message.content;

    // Add embed info if present
    if (message.embeds && message.embeds.length > 0) {
      const embedSummaries = message.embeds.map((embed, index) => {
        let summary = `EMBED ${index + 1}:`;
        if (embed.title) summary += ` Title: "${embed.title}"`;
        if (embed.description) summary += ` Description: "${embed.description.substring(0, 200)}${embed.description.length > 200 ? '...' : ''}"`;
        if (embed.url) summary += ` URL: ${embed.url}`;
        if (embed.author?.name) summary += ` Author: "${embed.author.name}"`;
        if (embed.fields && embed.fields.length > 0) {
          summary += ` Fields: ${embed.fields.map(field => `"${field.name}: ${field.value.substring(0, 100)}${field.value.length > 100 ? '...' : ''}"`).join(', ')}`;
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
      const mediaAttachments = Array.from(allAttachments.values()).filter(attachment =>
        attachment.contentType && (
          attachment.contentType.startsWith('image/') ||
          attachment.contentType.startsWith('video/') ||
          attachment.contentType === 'image/gif'
        )
      );
      if (mediaAttachments.length > 0) {
        fullMessageContent += `\n\nMEDIA ATTACHMENTS: ${mediaAttachments.map(media => `${media.url} (${media.contentType})`).join(', ')}`;
      }
    }

    // Add replied media info if present
    if (message.reference && message.reference.messageId) {
      try {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMessage.author.id !== message.client.user.id && repliedMessage.attachments.size > 0) {
          const repliedMediaAttachments = repliedMessage.attachments.filter(attachment =>
            attachment.contentType && (
              attachment.contentType.startsWith('image/') ||
              attachment.contentType.startsWith('video/') ||
              attachment.contentType === 'image/gif'
            )
          );
          if (repliedMediaAttachments.length > 0) {
            fullMessageContent += `\n\nREPLIED MEDIA ATTACHMENTS: ${repliedMediaAttachments.map(media => `${media.url} (${media.contentType})`).join(', ')}`;
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

    // Build the prompt content (multimodal for Gemma)
    const prompt = buildPromptContent(globalPrompt[0], contextMemoryText, toolsText, currentUserInfo, messageInfo, presenceInfo, '', fullMessageContent, hasMedia, multimodalContent, fallbackText, audioTranscription, client.user.displayName, message.repliedMessageContent);
    logger.debug('Built prompt', { promptLength: typeof prompt === 'string' ? prompt.length : 'multimodal', hasMedia, multimodalCount: multimodalContent.length });
    
    // Special debugging for number-related queries - log the actual prompt
    if (message.content.toLowerCase().includes('number') || message.content.toLowerCase().includes('remember')) {
      logger.info('PROMPT DEBUG - Full prompt being sent to AI', {
        userMessage: message.content,
        fullPrompt: typeof prompt === 'string' ? prompt : 'MULTIMODAL_PROMPT',
        memoryTextIncluded: memoryText.includes('21'),
        promptLength: typeof prompt === 'string' ? prompt.length : 'multimodal'
      });
    }

    let response;
    let responseMetadata = null;
    try {
      response = await generateWithRetry(providerManager, prompt);

      // Handle enhanced response format
      if (typeof response === 'object' && response.text) {
        responseMetadata = response.metadata;
        response = response.text;
        logger.debug('Enhanced AI response received', {
          provider: responseMetadata?.provider,
          model: responseMetadata?.model,
          usage: responseMetadata?.usage,
          finishReason: responseMetadata?.finish_reason || responseMetadata?.finishReason
        });
      } else if (typeof response === 'string') {
        // Legacy string response
        logger.debug('Legacy AI response received (string format)');
      } else {
        // Unexpected response type, convert to string
        logger.warn('Unexpected AI response type, converting to string', { type: typeof response, value: response });
        response = String(response || 'Error: Invalid AI response');
      }
    } catch (error) {
      logger.error('AI generation failed', { error: error.message });
      // Respond with error message
      await message.reply('Sorry, I\'m having trouble processing your message right now. Please try again later.');
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
        toolCalls: toolCalls.map(t => ({ funcName: t.funcName, args: t.args }))
      });

      if (toolCalls.length > 0) {
        // Execute tools
        const toolExecutor = new ToolExecutor();
        const toolResults = await toolExecutor.executeTools(toolCalls, message, client, channelMemories, dmOrigins, providerManager, globalPrompt, lastPrompt, lastResponse, lastToolCalls, lastToolResults, apiResourceManager);
        lastToolResults[0] = toolResults;

        // Filter out tools that returned null (indicating they handled their own response)
        const validToolResults = toolResults.filter(r => r.result != null);

        // Only generate follow-up if there are valid tool results
        if (validToolResults.length > 0) {
          // Build follow-up prompt with tool results
          const toolResultsText = validToolResults.map(r => `${r.tool.toUpperCase()}: ${r.result}`).join('\n');
          const followUpPrompt = buildFollowUpContent(
            typeof prompt === 'string' ? prompt : prompt[0].text,
            toolResultsText,
            hasMedia,
            multimodalContent
          );

          logger.debug('Built follow-up prompt with tool results', {
            toolResultsCount: validToolResults.length,
            toolResultsText: toolResultsText,
            followUpPromptPreview: typeof followUpPrompt === 'string' ? followUpPrompt.substring(0, 500) : followUpPrompt[0]?.text?.substring(0, 500) || 'N/A',
            followUpPromptLength: typeof followUpPrompt === 'string' ? followUpPrompt.length : followUpPrompt[0]?.text?.length || 0
          });

          // Generate follow-up response
          const followUpResponse = await generateWithRetry(providerManager, followUpPrompt);

          logger.debug('Generated follow-up response', {
            followUpResponseType: typeof followUpResponse,
            followUpResponseLength: typeof followUpResponse === 'string' ? followUpResponse.length : followUpResponse?.text?.length || 0,
            followUpResponsePreview: typeof followUpResponse === 'string' ? followUpResponse.substring(0, 100) : followUpResponse?.text?.substring(0, 100) || 'N/A'
          });

          // Handle enhanced response format
          let finalResponse = followUpResponse;
          if (typeof followUpResponse === 'object' && followUpResponse.text) {
            finalResponse = followUpResponse.text;
          } else if (typeof followUpResponse !== 'string') {
            // Unexpected response type, convert to string
            logger.warn('Unexpected follow-up AI response type, converting to string', { type: typeof followUpResponse, value: followUpResponse });
            finalResponse = String(followUpResponse || 'Error: Invalid AI follow-up response');
          }

          // Clean any remaining tool calls from follow-up response
          const cleanedFollowUp = finalResponse.replace(/TOOL:[^\n]*/g, '').replace(/```[\s\S]*?```/g, '').replace(/^\w+\s+.*=.*/gm, '').trim();

          // Check Discord message length limit (2000 characters)
          if (cleanedFollowUp.length > 2000) {
            logger.warn('Follow-up response too long for Discord, truncating', { 
              originalLength: cleanedFollowUp.length,
              channelId: message.channel.id 
            });
            // Truncate to 1990 characters to leave room for "..." if needed
            return cleanedFollowUp.substring(0, 1990) + (cleanedFollowUp.length > 1990 ? '...' : '');
          }

          return cleanedFollowUp;
        } else {
          // No valid tool results, tools handled their own responses
          logger.debug('No valid tool results, skipping follow-up response');
          return null;
        }
    } else {
      // Clean any tool calls and attachment tags from the initial response
      const cleanedResponse = response.replace(/TOOL:[^\n]*/g, '').replace(/```[\s\S]*?```/g, '').replace(/^\w+\s+.*=.*/gm, '').replace(/\[ATTACHMENT:[^\]]*\]/g, '').trim();
      
      // Check if AI decided to ignore (detect [IGNORE] anywhere in response)
      if (cleanedResponse.includes('[IGNORE]')) {
        logger.debug('AI decided to ignore message in initial response');
        return null;
      }
      
      // Check Discord message length limit (2000 characters)
      if (cleanedResponse.length > 2000) {
        logger.warn('Response too long for Discord, truncating', { 
          originalLength: cleanedResponse.length,
          channelId: message.channel.id 
        });
        // Truncate to 1990 characters to leave room for "..." if needed
        return cleanedResponse.substring(0, 1990) + (cleanedResponse.length > 1990 ? '...' : '');
      }
      
      return cleanedResponse;
    }
}