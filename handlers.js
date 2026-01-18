import fs from 'fs';
import path from 'path';

import { saveMapToJSON } from './utils/index.js';
import {
  getHealthMetrics,
  logHealthMetrics,
  hasHealthPermission,
} from './health.js';
import { logger } from './utils/logger.js';
import { processMessageMedia } from './media.js';
import { ConcurrentMap } from './utils/mutex.js';

// Stealth utilities removed - no stealth features

// Helper function to safely send replies
async function safeReply(message, content) {
  try {
    return await message.reply(content);
  } catch (error) {
    logger.error('Failed to reply to message', {
      error: error.message,
      channelId: message.channel?.id || message.channelId,
      userId: message.author.id,
    });
    return null;
  }
}

// Helper function to ensure bot has server prompts initialized
function ensureServerPromptsInitialized(bot) {
  if (!bot.serverPrompts) {
    bot.serverPrompts = new Map();
  }
}

function sanitizeInput(input, maxLength = 2000) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control characters
    .replace(/[<>]/g, '') // Remove HTML tags
    .trim()
    .substring(0, maxLength);
}

// Enhanced input validation utility
function validateUserInput(input, maxLength = 4000, allowEmpty = false) {
  if (!allowEmpty && (!input || input.trim() === '')) {
    return { valid: false, error: 'Input cannot be empty' };
  }

  if (typeof input !== 'string') {
    return { valid: false, error: 'Invalid input type' };
  }

  if (input.length > maxLength) {
    return {
      valid: false,
      error: `Input exceeds maximum length of ${maxLength} characters`,
    };
  }

  // Check for potential injection patterns
  const dangerousPatterns = [
    /javascript:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
    /onclick=/i,
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\(/i,
    /setTimeout\(/i,
    /setInterval\(/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      return {
        valid: false,
        error: 'Input contains potentially dangerous content',
      };
    }
  }

  return { valid: true, sanitized: sanitizeInput(input, maxLength) };
}

// Validate Discord user ID format
function validateDiscordUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    return { valid: false, error: 'Invalid user ID' };
  }

  // Discord user IDs are 17-19 digit snowflake IDs
  const snowflakeRegex = /^\d{17,19}$/;
  if (!snowflakeRegex.test(userId)) {
    return { valid: false, error: 'Invalid Discord user ID format' };
  }

  return { valid: true };
}

// Validate server ID format
function validateServerId(serverId) {
  return validateDiscordUserId(serverId); // Same format as user IDs
}

// Path validation utility
const VALID_PATHS = ['globalPrompt.txt', 'data-selfbot/'];
function validatePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') return false;

  const normalized = path.normalize(inputPath);
  const resolved = path.resolve(normalized);

  // Create absolute paths for valid locations
  const allowedPaths = VALID_PATHS.map((p) => path.resolve(p));

  // Check if the resolved path starts with any allowed path
  return allowedPaths.some((allowed) => resolved.startsWith(allowed));
}

export async function handleCommand(
  message,
  channelMemories,
  client,
  providerManager,
  globalPrompt,
  lastPrompt,
  lastResponse,
  lastToolCalls,
  lastToolResults,
  generateResponse,
  dmOrigins,
  dmContexts,
  apiResourceManager,
  bot
) {
  // Validate message content
  const messageValidation = validateUserInput(message.content, 4000);
  if (!messageValidation.valid) {
    await safeReply(message, 'Invalid message content');
    return;
  }

  const args = message.content.slice(1).trim().split(' ');
  const command = args.shift().toLowerCase();

  // Validate command
  const commandValidation = validateUserInput(command, 50);
  if (!commandValidation.valid) {
    await safeReply(message, 'Invalid command');
    return;
  }

  // Import admin manager for admin checks
  const { adminManager } = await import('./utils/adminManager.js');

  // Admin check for all commands except help and admin (admin command handles its own permissions)
  if (
    command !== 'help' &&
    command !== 'admin' &&
    !adminManager.isAdmin(message.author.id)
  ) {
    await message.reply(
      'Access denied. This command is restricted to administrators only.'
    );
    return;
  }

  try {
    switch (command) {
      case 'help': {
        const helpText = `**Commands**

\`,help\` - Show commands
\`,admin <action> [userId]\` - Manage administrators (add/remove/toggle/list/clear)
\`,debug\` - Debug info
\`,functions\` - List available tools
\`,restart\` - Restart
\`,refresh <type>\` - Clear data (memories/context/dm/all)
\`,info\` - Bot info

\`,blacklist\` - Manage blacklisted servers
\`,prompt <text>\` - Set server prompt
  \`,prompt all <text>\` - Set global prompt
  \`,prompt clear <text>\` - Clear memory + set server prompt
  \`,prompt clear all <text>\` - Clear memory + set global prompt
\`,nvidia <msg>\` - NVIDIA AI
\`,health\` - Health (admin)
\`,testqueue\` - Test queue
 \`,safemode\` - Toggle safe mode (restricted/unrestricted responses)`;
        await safeReply(message, helpText);
        break;
      }

      case 'admin': {
        // Only existing admins can manage other admins
        if (!adminManager.isAdmin(message.author.id)) {
          await message.reply(
            'Access denied. Only existing administrators can manage admin access.'
          );
          return;
        }

        const actionValidation = validateUserInput(args[0], 20);
        const userIdValidation = validateUserInput(args[1], 50);

        if (!actionValidation.valid || !actionValidation.sanitized) {
          await safeReply(message, 'Invalid action parameter');
          return;
        }

        const action = actionValidation.sanitized.toLowerCase();
        const userId = userIdValidation.sanitized;

        if (!action) {
          const adminHelp = `**Admin Management**

**Usage:**
\`,admin <action> [userId]\`

**Actions:**
• \`add <userId>\` - Add user as admin
• \`remove <userId>\` - Remove admin from user
• \`toggle <userId>\` - Toggle admin status
• \`list\` - Show all administrators
• \`clear\` - Remove all admins

**Examples:**
\`,admin add 123456789012345678\`
\`,admin toggle 123456789012345678\`
\`,admin list\`

**Note:** Use Discord Developer Mode to get user IDs`;
          await safeReply(message, adminHelp);
          return;
        }

        try {
          switch (action) {
            case 'add': {
              if (!userId) {
                await message.reply(
                  'User ID required for add action\nUsage: `,admin add <userId>`'
                );
                return;
              }

              const userIdCheck = validateDiscordUserId(userId);
              if (!userIdCheck.valid) {
                await message.reply(`Invalid user ID: ${userIdCheck.error}`);
                return;
              }
              const addResult = adminManager.toggleAdmin(userId);
              if (addResult.success && addResult.action === 'added') {
                await safeReply(
                  message,
                  `**Admin Added**\n\n**User ID:** ${userId}\n**Total Admins:** ${adminManager.getAdminCount()}`
                );
              } else if (addResult.success && addResult.action === 'removed') {
                await safeReply(
                  message,
                  `**User was already admin** - removed instead\n\n**User ID:** ${userId}`
                );
              } else {
                await safeReply(message, `**Error:** ${addResult.error}`);
              }
              break;
            }

            case 'remove': {
              if (!userId) {
                await message.reply(
                  'User ID required for remove action\nUsage: `,admin remove <userId>`'
                );
                return;
              }

              const userIdCheck = validateDiscordUserId(userId);
              if (!userIdCheck.valid) {
                await message.reply(`Invalid user ID: ${userIdCheck.error}`);
                return;
              }
              const removeResult = adminManager.toggleAdmin(userId);
              if (removeResult.success && removeResult.action === 'removed') {
                await safeReply(
                  message,
                  `**Admin Removed**\n\n**User ID:** ${userId}\n**Total Admins:** ${adminManager.getAdminCount()}`
                );
              } else if (
                removeResult.success &&
                removeResult.action === 'added'
              ) {
                await safeReply(
                  message,
                  `**User was not admin** - added instead\n\n**User ID:** ${userId}`
                );
              } else {
                await safeReply(message, `**Error:** ${removeResult.error}`);
              }
              break;
            }

            case 'toggle': {
              if (!userId) {
                await message.reply(
                  'User ID required for toggle action\nUsage: `,admin toggle <userId>`'
                );
                return;
              }

              const userIdCheck = validateDiscordUserId(userId);
              if (!userIdCheck.valid) {
                await message.reply(`Invalid user ID: ${userIdCheck.error}`);
                return;
              }
              const toggleResult = adminManager.toggleAdmin(userId);
              if (toggleResult.success) {
                const status =
                  toggleResult.action === 'added'
                    ? 'Now an admin'
                    : 'No longer an admin';
                await safeReply(
                  message,
                  `**Admin Status Toggled**\n\n**User ID:** ${userId}\n**Action:** ${toggleResult.action}\n**Status:** ${status}\n**Total Admins:** ${adminManager.getAdminCount()}`
                );
              } else {
                await safeReply(message, `**Error:** ${toggleResult.error}`);
              }
              break;
            }

            case 'list': {
              const admins = adminManager.getAdmins();
              let listResponse = `**Bot Administrators**\n\n**Total Admins:** ${admins.length}\n\n`;
              if (admins.length > 0) {
                listResponse += `**Admin IDs:**\n`;
                admins.forEach((adminId, index) => {
                  listResponse += `${index + 1}. ${adminId}\n`;
                });
              } else {
                listResponse += `*No administrators configured*`;
              }
              await safeReply(message, listResponse);
              break;
            }

            case 'clear': {
              const clearResult = adminManager.clearAdmins();
              await safeReply(
                message,
                `**All Admins Cleared**\n\n**Removed:** ${clearResult.count} admin(s)\n**Warning:** No admins remain!`
              );
              break;
            }

            default:
              await safeReply(
                message,
                `Unknown action: ${action}\n\nUse \`,admin\` to see available actions.`
              );
              break;
          }
        } catch (error) {
          logger.error('Admin command failed', {
            error: error.message,
            action,
            userId,
            executorId: message.author.id,
          });
          await message.reply(
            'An error occurred while processing admin command.'
          );
        }
        break;
      }

      case 'functions':
      case 'tools': {
        const { ToolExecutor } = await import('./tools/ToolExecutor.js');
        const toolExecutor = new ToolExecutor();
        const allTools = toolExecutor.registry.getAllTools();

        let functionsList = '**Available Functions/Tools:**\n\n';
        allTools.forEach((tool) => {
          functionsList += `🔧 **${tool.name}**\n${tool.description}\n`;

          // Add parameters if they exist
          if (tool.parameters && tool.parameters.properties) {
            const params = Object.entries(tool.parameters.properties)
              .map(([key, prop]) => {
                const required = tool.parameters.required?.includes(key)
                  ? ' (required)'
                  : ' (optional)';
                return `  • ${key}: ${prop.type}${required}`;
              })
              .join('\n');
            if (params) {
              functionsList += `Parameters:\n${params}\n`;
            }
          }
          functionsList += '\n';
        });

        // Split into chunks if too long for Discord
        const maxLength = 1900;
        if (functionsList.length > maxLength) {
          const chunks = [];
          let currentChunk = '';
          const lines = functionsList.split('\n');

          for (const line of lines) {
            if ((currentChunk + line + '\n').length > maxLength) {
              chunks.push(currentChunk.trim());
              currentChunk = line + '\n';
            } else {
              currentChunk += line + '\n';
            }
          }
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
          }

          for (let i = 0; i < chunks.length; i++) {
            const title =
              i === 0
                ? '**Available Functions/Tools**'
                : `**Functions/Tools (Part ${i + 1}/${chunks.length})**`;
            await safeReply(message, `${title}\n\n${chunks[i]}`);
          }
        } else {
          await safeReply(
            message,
            `**Available Functions/Tools**\n\n${functionsList}`
          );
        }
        break;
      }

      case 'debug': {
        const channelCount = channelMemories.size();
        const totalMessages = Array.from(channelMemories.values()).reduce(
          (sum, mem) => sum + mem.length,
          0
        );
        const truncate = (str, len) =>
          str && str.length > len ? str.substring(0, len) + '...' : str;

        // Helper to safely stringify objects
        const safeStringify = (obj, len = 400) => {
          if (obj === null || obj === undefined) return 'None';
          if (typeof obj === 'string') return truncate(obj, len);
          try {
            const str = JSON.stringify(obj);
            return truncate(str, len);
          } catch (e) {
            return truncate(String(obj), len);
          }
        };

        // Get memory usage
        const memoryUsage = process.memoryUsage();
        const memoryInfo = `Memory: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`;

        // Get current channel memory
        const currentMemory =
          channelMemories.get(message.channel?.id || message.channelId) || [];
        const memoryPreview = currentMemory
          .slice(-5)
          .map(
            (m) =>
              `[${m.user.includes(client.user.id) ? 'BOT' : 'USER'}:${m.user.split(' ')[0]}]: ${truncate(m.message, 100)}`
          )
          .join('\n');

        // Get server-specific info
        const serverId = message.guild?.id;
        const isDM = !serverId;
        let serverPrompt = null;
        let safeMode = false;
        if (bot && bot.serverPrompts && serverId && !isDM) {
          serverPrompt = bot.serverPrompts.get(serverId) || null;
        }
        if (bot && bot.safeModeServers && serverId) {
          safeMode = bot.safeModeServers.get(serverId) || false;
        }

        // Build what the AI would see for a sample message
        const { buildPromptContent } = await import('./prompts.js');
        const { toolRegistry } = await import('./tools/index.js');

        // Simulate memory text building
        const memoryText = currentMemory
          .slice(-15)
          .map((m) => {
            const isBotMessage = m.user.includes(client.user.id);
            const prefix = isBotMessage ? '[BOT_RESPONSE' : '[USER_MESSAGE';
            return `${prefix}: ${m.user}]: ${m.message}`;
          })
          .join('\n---\n');

        const toolsText = toolRegistry.getToolsText();
        const currentUserInfo = `CURRENT_USER (asking you now): Username: ${message.author.username}, Display Name: ${message.author.globalName || 'None'}`;
        const currentTime = new Date().toLocaleString('en-US', {
          timeZone: 'UTC',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          weekday: 'long',
        });
        const mentionInfo = message.isMentioned
          ? 'YOU ARE BEING MENTIONED/PINGED IN THIS MESSAGE. The user is directly addressing you.'
          : 'You are not mentioned in this message.';
        const messageInfo = `=== MESSAGE INFO ===\nTime: ${currentTime} UTC. ${mentionInfo}`;
        const presenceInfo = 'Bot status: available';

        // Sample message content
        const sampleMessageContent = 'Hello, can you help me with something?';
        const samplePrompt = buildPromptContent(
          globalPrompt[0],
          memoryText,
          toolsText,
          currentUserInfo,
          messageInfo,
          presenceInfo,
          '',
          sampleMessageContent,
          false,
          [],
          '',
          '',
          serverPrompt,
          safeMode
        );

        let debugInfo = `**FULL AI CONTEXT DEBUG**\nMemory channels: ${channelCount}\nTotal messages: ${totalMessages}\n${memoryInfo}\nGlobal prompt: ${globalPrompt && globalPrompt[0] ? 'Set' : 'None'}\nServer prompt: ${serverPrompt ? 'Set' : 'None'}\nSafe mode: ${safeMode ? 'ENABLED (restricted)' : 'DISABLED (unrestricted)'}\n\n**RECENT MEMORY (${currentMemory.length} messages):**\n${memoryPreview || 'None'}\n\n**WHAT AI SEES (Sample Prompt Structure):**\n${typeof samplePrompt === 'string' ? truncate(samplePrompt, 800) : 'MULTIMODAL_PROMPT'}\n\n**LAST AI RESPONSE:**\n${safeStringify(lastResponse[0], 200)}`;

        if (
          lastToolCalls.length > 0 &&
          lastToolCalls[0] &&
          lastToolCalls[0].length > 0
        ) {
          const callsStr = JSON.stringify(lastToolCalls[0]);
          debugInfo += `\n\n**LAST TOOL CALLS:** ${callsStr.length > 200 ? callsStr.substring(0, 200) + '...' : callsStr}`;
        }
        if (
          lastToolResults.length > 0 &&
          lastToolResults[0] &&
          lastToolResults[0].length > 0
        ) {
          const resultsStr = JSON.stringify(lastToolResults[0]);
          debugInfo += `\n\n**LAST TOOL RESULTS:** ${resultsStr.length > 200 ? resultsStr.substring(0, 200) + '...' : resultsStr}`;
        }

        // Send the main debug info first
        await safeReply(message, debugInfo);

        // Send the full last prompt in separate messages if it exists
        if (lastPrompt[0]) {
          const fullPrompt =
            typeof lastPrompt[0] === 'string'
              ? lastPrompt[0]
              : JSON.stringify(lastPrompt[0]);
          const maxChunkSize = 1900;

          if (fullPrompt.length <= maxChunkSize) {
            await safeReply(
              message,
              `**FULL LAST PROMPT SENT TO AI:**\n${fullPrompt}`
            );
          } else {
            // Split into chunks
            const chunks = [];
            for (let i = 0; i < fullPrompt.length; i += maxChunkSize) {
              chunks.push(fullPrompt.substring(i, i + maxChunkSize));
            }

            for (let i = 0; i < chunks.length; i++) {
              const title =
                i === 0
                  ? '**FULL LAST PROMPT SENT TO AI (Part 1):**\n'
                  : `**FULL LAST PROMPT (Part ${i + 1}/${chunks.length}):**\n`;
              await safeReply(message, title + chunks[i]);
            }
          }
        } else {
          await safeReply(message, '**No last prompt available**');
        }
        break;
      }

      case 'restart':
        await safeReply(message, 'Restarting bot...');
        logger.info('Bot restart requested', {
          username: message.author.username,
          userId: message.author.id,
        });
        process.exit(0);
        break;

      case 'refresh_commands':
        await safeReply(
          message,
          'Command refresh not needed with ; prefix system!'
        );
        break;

      case 'refresh': {
        const refreshTypeValidation = validateUserInput(args[0], 20);
        if (!refreshTypeValidation.valid) {
          await message.reply(
            'Usage: `,refresh <type>` where type is:\n- `memories` - Clear conversation memories\n- `context` - Clear user context data\n- `dm` - Clear DM metadata\n- `all` - Clear everything'
          );
          break;
        }
        const refreshType = refreshTypeValidation.sanitized.toLowerCase();

        if (!refreshType) {
          await message.reply(
            'Usage: `,refresh <type>` where type is:\n- `memories` - Clear conversation memories\n- `context` - Clear user context data\n- `dm` - Clear DM metadata\n- `all` - Clear everything'
          );
          break;
        }

        let clearedItems = [];

        if (refreshType === 'memories' || refreshType === 'all') {
          // Clear both bot's memory and handlers reference
          bot.channelMemories.clear();
          channelMemories.clear();
          dmContexts.clear();
          dmOrigins.clear();

          // Save empty state to disk immediately (skip debouncing for refresh)
          await saveMapToJSON(
            channelMemories,
            'data-selfbot/channelMemories.json'
          );
          await saveMapToJSON(dmContexts, 'data-selfbot/dmContexts.json');
          await saveMapToJSON(dmOrigins, 'data-selfbot/dmOrigins.json');

          // Force reload to ensure consistency
          await bot.loadData();

          // Verify memory was cleared
          const verifyCleared = () => {
            const memory =
              channelMemories.get(message.channel?.id || message.channelId) ||
              [];
            const dmContext =
              dmContexts.get(message.channel?.id || message.channelId) || [];
            const dmOrigin = dmOrigins.get(
              message.channel?.id || message.channelId
            );
            return memory.length === 0 && dmContext.length === 0 && !dmOrigin;
          };

          if (!verifyCleared()) {
            await message.reply(
              'Memory may not have cleared properly. Please try again.'
            );
            return;
          }

          clearedItems.push(
            'conversation memories, DM contexts, and DM origins'
          );
        }

        if (refreshType === 'context' || refreshType === 'all') {
          // Clear user context
          const { loadUserContext, saveUserContext } = await import(
            './utils/index.js'
          );
          const userContext = await loadUserContext();
          userContext.clear();
          await saveUserContext(userContext);
          clearedItems.push('user context');
        }

        if (refreshType === 'dm' || refreshType === 'all') {
          // Clear DM metadata
          const dmMetadataPath = './data-selfbot/dmMetadata.json';
          if (validatePath(dmMetadataPath) && fs.existsSync(dmMetadataPath)) {
            await fs.promises.writeFile(dmMetadataPath, JSON.stringify({}));
          }
          clearedItems.push('DM metadata');
        }

        if (refreshType === 'all') {
          await safeReply(
            message,
            'All memories, user context, and DM metadata cleared!'
          );
        } else if (clearedItems.length > 0) {
          await safeReply(message, `Cleared: ${clearedItems.join(', ')}.`);
        } else {
          await safeReply(
            message,
            'Invalid refresh type. Use `,refresh` to see available options.'
          );
        }
        break;
      }

      case 'prompt': {
        // Capture everything after ";prompt " to preserve newlines and formatting
        const promptContent = message.content.slice(8).trim();
        const promptArgsValidation = validateUserInput(promptContent, 3000);
        if (
          !promptArgsValidation.valid &&
          promptArgsValidation.error !== 'Input cannot be empty'
        ) {
          await safeReply(message, 'Invalid prompt content');
          return;
        }
        const promptArgs = promptArgsValidation.sanitized || '';
        const args = promptArgs.split(' ');

        const serverId = message.guild?.id;
        const isDM = !serverId;

        if (args[0] === 'clear') {
          // Check if this is "clear all" or just "clear"
          const isClearAll = args[1] === 'all';
          const newPromptArgs = isClearAll ? args.slice(2) : args.slice(1);
          const newPrompt = newPromptArgs.join(' ').trim();

          if (!newPrompt) {
            if (isClearAll) {
              await safeReply(
                message,
                'Usage: `,prompt clear all <new prompt text>` - Clears memory and sets new global prompt'
              );
            } else {
              await safeReply(
                message,
                'Usage: `,prompt clear <new prompt text>` - Clears memory and sets new server prompt'
              );
            }
            return;
          }

          try {
            // Clear memory
            bot.channelMemories.clear();
            channelMemories.clear();
            // Save empty state to disk immediately (skip debouncing for refresh)
            await saveMapToJSON(
              channelMemories,
              'data-selfbot/channelMemories.json'
            );
            await bot.loadData();

            // Verify memory was cleared
            const verifyCleared = () => {
              const memory =
                channelMemories.get(message.channel?.id || message.channelId) ||
                [];
              return memory.length === 0;
            };

            if (!verifyCleared()) {
              await message.reply(
                'Memory may not have cleared properly. Prompt not updated.'
              );
              return;
            }

            // Set new prompt (server-specific or global)
            if (isClearAll || isDM) {
              if (validatePath('globalPrompt.txt')) {
                await fs.promises.writeFile('globalPrompt.txt', newPrompt);
                globalPrompt[0] = newPrompt;
                await safeReply(
                  message,
                  'Memory cleared and global prompt updated successfully!'
                );
              } else {
                await safeReply(
                  message,
                  'Invalid file path for global prompt.'
                );
                return;
              }
            } else {
              // Server-specific prompt
              ensureServerPromptsInitialized(bot);
              bot.serverPrompts.set(serverId, newPrompt);
              await bot.dataManager.saveData(
                'serverPrompts.json',
                bot.serverPrompts
              );
              await safeReply(
                message,
                'Memory cleared and server prompt updated successfully!'
              );
            }
          } catch (error) {
            await message.reply(
              'Failed to clear memory and update prompt: ' + error.message
            );
          }
          return;
        }

        if (!promptArgs) {
          // Show current prompts and usage instructions
          const globalPromptText = globalPrompt[0] || 'None set';
          let serverPromptText = 'None set';

          if (!isDM && bot.serverPrompts && bot.serverPrompts.has(serverId)) {
            serverPromptText = bot.serverPrompts.get(serverId);
          }

          let response = `**Current Prompts:**\n\n`;
          if (!isDM) {
            response += `**Server Prompt:**\n\`\`\`\n${serverPromptText}\n\`\`\`\n\n`;
          }
          response += `**Global Prompt:**\n\`\`\`\n${globalPromptText}\n\`\`\`\n\n**Usage:**\n`;
          if (!isDM) {
            response += `\`,prompt <text>\` - Set a new server prompt\n`;
            response += `\`,prompt all <text>\` - Set a new global prompt\n`;
            response += `\`,prompt clear <text>\` - Clear memory and set new server prompt\n`;
            response += `\`,prompt clear all <text>\` - Clear memory and set new global prompt\n\n`;
          } else {
            response += `\`,prompt <text>\` - Set a new global prompt (DMs only support global prompts)\n`;
            response += `\`,prompt clear <text>\` - Clear memory and set new global prompt\n\n`;
          }
          response += `You can include newlines and formatting in your prompt.`;

          await safeReply(message, response);
          return;
        }

        try {
          if (args[0] === 'all' || isDM) {
            // Global prompt
            let promptText;
            if (args[0] === 'all') {
              // Remove "all" from the beginning
              promptText = args.slice(1).join(' ');
            } else {
              promptText = promptArgs;
            }

            if (!promptText) {
              await safeReply(
                message,
                'Usage: `,prompt all <text>` - Set a new global prompt'
              );
              return;
            }

            if (validatePath('globalPrompt.txt')) {
              await fs.promises.writeFile('globalPrompt.txt', promptText);
              globalPrompt[0] = promptText;
              await safeReply(message, 'Global prompt updated successfully!');
            } else {
              await safeReply(message, 'Invalid file path for global prompt.');
            }
          } else {
            // Server-specific prompt
            ensureServerPromptsInitialized(bot);
            bot.serverPrompts.set(serverId, promptArgs);
            await bot.dataManager.saveData(
              'serverPrompts.json',
              bot.serverPrompts
            );
            await safeReply(message, 'Server prompt updated successfully!');
          }
        } catch (error) {
          await safeReply(message, 'Failed to update prompt: ' + error.message);
        }
        break;
      }

      case 'nvidia': {
        const nvidiaMessageValidation = validateUserInput(
          args.join(' ').trim(),
          2000,
          true
        );
        if (!nvidiaMessageValidation.valid) {
          await safeReply(
            message,
            'Invalid message content for NVIDIA command'
          );
          break;
        }
        const nvidiaMessage = nvidiaMessageValidation.sanitized || '';

        try {
          await safeReply(message, '*Using NVIDIA NIM provider...*');

          // Process media attachments for NVIDIA NIM
          const { multimodalContent } = await processMessageMedia(message);
          const contentToSend = multimodalContent || {
            text: nvidiaMessage || 'What is shown in this image?',
          };

          // Call NVIDIA provider directly
          const response = await providerManager.generateContent(contentToSend);
          await safeReply(message, response);
        } catch (error) {
          logger.error('NVIDIA NIM command failed', { error: error.message });
          await safeReply(
            message,
            'NVIDIA NIM provider failed: ' + error.message
          );
        }
        break;
      }

      case 'info':
        await safeReply(
          message,
          `This is ${client.user.username}, a Discord selfbot powered by Google's Gemma 3-27B-IT model. It can engage in conversations and perform actions via tools.`
        );
        break;

      case 'health': {
        if (!hasHealthPermission(message)) {
          await safeReply(
            message,
            'You do not have permission to view health metrics. This command requires Manage Server permission.'
          );
          break;
        }
        const metrics = getHealthMetrics(client);
        await logHealthMetrics(metrics); // Log every time health is checked
        const memoryStatus =
          metrics.memory.heapUsed > 100
            ? 'HIGH'
            : metrics.memory.heapUsed > 50
              ? 'MEDIUM'
              : 'LOW';
        const healthText = `**Bot Health Status**
**Uptime:** ${metrics.uptime}
**Memory Usage:** Heap ${metrics.memory.heapUsed}/${metrics.memory.heapTotal}MB (${memoryStatus})
**API Latency:** ${metrics.apiLatency}ms
**Last Error:** ${metrics.lastError}`;
        await safeReply(message, healthText);
        break;
      }

      case 'testqueue': {
        // Import the formatPositionMessage method from queues.js
        const { RequestQueue } = await import('./queues.js');
        const tempQueue = new RequestQueue();
        const testMessage = tempQueue.formatPositionMessage(2); // Test with position 2

        const sentMessage = await safeReply(message, testMessage);

        // Animate for 5 seconds then delete
        let animationCount = 0;
        const maxAnimations = 5; // 5 frames * 1000ms = 5 seconds

        const animationInterval = setInterval(async () => {
          animationCount++;
          if (animationCount >= maxAnimations) {
            clearInterval(animationInterval);
            try {
              await sentMessage.delete();
            } catch (error) {
              // Message might already be deleted
            }
            return;
          }

          try {
            const updatedMessage = tempQueue.formatPositionMessage(2);
            await sentMessage.edit(updatedMessage);
          } catch (error) {
            clearInterval(animationInterval);
          }
        }, 1000);

        break;
      }

      case 'blacklist': {
        const subcommandValidation = validateUserInput(args[0], 20, true);
        const serverIdValidation = validateUserInput(args[1], 50, true);

        if (!subcommandValidation.valid) {
          await safeReply(message, 'Invalid subcommand');
          break;
        }

        const subcommand = subcommandValidation.sanitized?.toLowerCase() || '';
        const serverId = serverIdValidation.sanitized;

        if (!subcommand) {
          // Show current blacklist
          const blacklisted = Array.from(bot.blacklist);
          const response =
            blacklisted.length > 0
              ? `Blacklisted servers (${blacklisted.length}):\n${blacklisted.join('\n')}`
              : 'No servers are blacklisted.';
          await safeReply(message, response);
          break;
        }

        if (subcommand === 'add') {
          if (!serverId) {
            await message.reply('Usage: `,blacklist add <server_id>`');
            break;
          }

          const serverIdCheck = validateServerId(serverId);
          if (!serverIdCheck.valid) {
            await message.reply(`Invalid server ID: ${serverIdCheck.error}`);
            break;
          }
          if (bot.blacklist.has(serverId)) {
            await safeReply(
              message,
              `Server ${serverId} is already blacklisted.`
            );
          } else {
            bot.blacklist.add(serverId);
            await bot.saveData();
            await safeReply(message, `Server ${serverId} added to blacklist.`);
          }
        } else if (subcommand === 'remove' || subcommand === 'rm') {
          if (!serverId) {
            await safeReply(message, 'Usage: `,blacklist remove <server_id>`');
            break;
          }

          const serverIdCheck = validateServerId(serverId);
          if (!serverIdCheck.valid) {
            await safeReply(
              message,
              `Invalid server ID: ${serverIdCheck.error}`
            );
            break;
          }
          if (bot.blacklist.has(serverId)) {
            bot.blacklist.delete(serverId);
            await bot.saveData();
            await safeReply(
              message,
              `Server ${serverId} removed from blacklist.`
            );
          } else {
            await safeReply(message, `Server ${serverId} is not blacklisted.`);
          }
        } else {
          await safeReply(
            message,
            'Usage: `,blacklist` (show), `,blacklist add <server_id>`, `,blacklist remove <server_id>`'
          );
        }
        break;
      }

      case 'safemode': {
        if (!message.guild) {
          await safeReply(
            message,
            'Safe mode can only be toggled in servers, not DMs.'
          );
          break;
        }

        const serverId = message.guild.id;

        // Initialize safe mode map if it doesn't exist
        if (!bot.safeModeServers) {
          bot.safeModeServers = new Map();
        }

        // Toggle safe mode for this server
        const currentMode = bot.safeModeServers.get(serverId) || false;
        const newMode = !currentMode;
        bot.safeModeServers.set(serverId, newMode);

        // Save the data
        await bot.saveData();

        const modeText = newMode ? 'ENABLED' : 'DISABLED';
        await safeReply(
          message,
          `Safe mode ${modeText} for this server. In safe mode, the bot will provide restricted, family-friendly responses.`
        );
        break;
      }

      default:
        await safeReply(
          message,
          `Unknown command: ${command}. Use \`,help\` for available commands.`
        );
    }
  } catch (error) {
    logger.error('Error handling command', {
      command,
      error: error.message,
      userId: message.author.id,
    });
    await message.reply('There was an error while executing this command!');
  }
}

// Confusion detection function

// Typing state tracker (concurrent)
const typingStates = new ConcurrentMap(); // channelId-userId -> { isTyping: boolean, lastTyping: timestamp }

// Anti-spam system (concurrent)
const lastMessageTimes = new ConcurrentMap(); // userId -> channelId -> timestamp
const SPAM_THRESHOLD = 1000; // 1 second between messages
const spamWarnings = new ConcurrentMap(); // userId -> channelId -> warningCount

// Memory cleanup for anti-spam maps
async function cleanupSpamMaps() {
  const now = Date.now();
  const CLEANUP_THRESHOLD = 5 * 60 * 1000; // 5 minutes

  // Cleanup lastMessageTimes
  const lastTimeEntries = await lastMessageTimes.entries();
  for (const [userId, channels] of lastTimeEntries) {
    for (const [channelId, timestamp] of channels.entries()) {
      if (now - timestamp > CLEANUP_THRESHOLD) {
        channels.delete(channelId);
      }
    }
    if (channels.size === 0) {
      await lastMessageTimes.delete(userId);
    }
  }

  // Cleanup spamWarnings
  const spamWarningEntries = await spamWarnings.entries();
  for (const [userId, channels] of spamWarningEntries) {
    for (const [channelId] of channels.entries()) {
      // Keep warnings for shorter time - 2 minutes
      if (now - channels.get(channelId) > 2 * 60 * 1000) {
        channels.delete(channelId);
      }
    }
    if (channels.size === 0) {
      await spamWarnings.delete(userId);
    }
  }

  // Cleanup typingStates
  const typingEntries = await typingStates.entries();
  for (const [key, state] of typingEntries) {
    if (now - state.lastTyping > CLEANUP_THRESHOLD) {
      await typingStates.delete(key);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupSpamMaps, 10 * 60 * 1000);

// Batch memory saves to reduce I/O operations
const memorySaveQueue = new Map();
const SAVE_DEBOUNCE_TIME = 2000; // 2 seconds

function scheduleMemorySave(mapName, mapData, filePath) {
  if (memorySaveQueue.has(mapName)) {
    clearTimeout(memorySaveQueue.get(mapName));
  }

  const timeoutId = setTimeout(async () => {
    try {
      await saveMapToJSON(mapData, filePath);
      memorySaveQueue.delete(mapName);
    } catch (error) {
      logger.error('Batch memory save failed', {
        mapName,
        error: error.message,
      });
    }
  }, SAVE_DEBOUNCE_TIME);

  memorySaveQueue.set(mapName, timeoutId);
}

export function setupHandlers(
  client,
  requestQueue,
  apiResourceManager,
  channelMemories,
  dmContexts,
  dmOrigins,
  globalDMQueue,
  globalPrompt,
  lastPrompt,
  lastResponse,
  lastToolCalls,
  lastToolResults,
  generateResponse,
  providerManager,
  bot
) {
  logger.debug('Setup handlers received bot', {
    bot: !!bot,
    botType: typeof bot,
    hasServerPrompts: bot?.serverPrompts?.size > 0,
  });

  // Typing start handler - ignore bot's own typing
  client.on('typingStart', async (typing) => {
    try {
      if (typing.user.id === client.user.id) return; // Ignore bot's own typing
      const key = `${typing.channel.id}-${typing.user.id}`;
      await typingStates.set(key, {
        isTyping: true,
        lastTyping: Date.now(),
      });
      logger.debug('User started typing', {
        userId: typing.user.id,
        channelId: typing.channel.id,
      });
    } catch (error) {
      logger.warn('Error in typingStart handler', { error: error.message });
    }
  });

  // Typing stop handler
  client.on('typingStop', async (typing) => {
    try {
      const key = `${typing.channel.id}-${typing.user.id}`;
      const state = await typingStates.get(key);
      if (state) {
        state.isTyping = false;
        // Keep the state for a short time in case they start typing again
        setTimeout(async () => {
          try {
            await typingStates.delete(key);
          } catch (e) {
            // Ignore cleanup errors
          }
        }, 2000); // Clean up after 2 seconds
      }
      logger.debug('User stopped typing', {
        userId: typing.user.id,
        channelId: typing.channel.id,
      });
    } catch (error) {
      logger.warn('Error in typingStop handler', { error: error.message });
    }
  });

  // Friend request functionality has been removed to prevent CAPTCHA loops and excessive restarts

  // Message handler
  client.on('messageCreate', async (message) => {
    try {
      logger.debug('Message received', {
        content: message.content.substring(0, 100),
        author: message.author.username,
        authorId: message.author.id,
        botId: client.user.id,
        isBot: message.author.bot,
        channel: message.channel.name,
        hasAttachments: message.attachments.size > 0,
        channelId: message.channel?.id || message.channelId,
        hasStickers: message.stickers?.size > 0,
      });

      if (message.author.id === client.user.id) {
        logger.debug('Ignoring own message', {
          authorId: message.author.id,
          botId: client.user.id,
        });
        return;
      }

      // Check if server is blacklisted
      const isDM =
        message.channel?.type === 'DM' || message.channel?.type === 1;
      if (!isDM && message.guild && bot.blacklist.has(message.guild.id)) {
        logger.debug('Ignoring message from blacklisted server', {
          serverId: message.guild.id,
        });
        return;
      }

      // Stickers are now processed in the image processing function

      const isMentioned = message.mentions?.has(client.user.id) || false;

      // Add mention info to message for AI awareness
      message.isMentioned = isMentioned;

      logger.debug('Message analysis', {
        isDM,
        isMentioned,
        botId: client.user.id,
        mentions: message.mentions?.users?.map((u) => u.id) || [],
        contentLength: message.content.length,
      });

      // Enhanced identity tracking debug logging
      logger.debug('Identity context tracking', {
        authorId: message.author.id,
        botId: client.user.id,
        isBot: message.author.bot,
        repliedMessageAuthor: message.reference ? 'checked' : 'none',
        channelType: message.channel?.type,
        hasMentions: message.mentions?.users?.size > 0,
      });

      // Check for , prefix commands
      if (message.content.startsWith(',')) {
        try {
          await handleCommand(
            message,
            channelMemories,
            client,
            providerManager,
            globalPrompt,
            lastPrompt,
            lastResponse,
            lastToolCalls,
            lastToolResults,
            generateResponse,
            dmOrigins,
            dmContexts,
            apiResourceManager,
            bot
          );
        } catch (commandError) {
          logger.error('Error handling command', {
            command: message.content.split(' ')[0],
            error: commandError.message,
            userId: message.author.id,
          });
          try {
            await message.reply(
              'There was an error while executing this command!'
            );
          } catch (replyError) {
            logger.error('Failed to send command error message', {
              error: replyError.message,
            });
          }
        }
        return;
      }

      if (message.author.bot) return; // Ignore all bot messages
      if (!isDM && !isMentioned) return; // In channels, only respond to mentions

      // Anti-spam check (only for messages the bot will process)
      const userId = message.author.id;
      const channelId = message.channel?.id || message.channelId;
      const now = Date.now();

      // Check for spam with atomic operations
      const isSpam = await lastMessageTimes.atomicUpdateNestedMap(
        userId,
        channelId,
        async (userChannels) => {
          if (userChannels.has(channelId)) {
            const lastTime = userChannels.get(channelId);
            const timeDiff = now - lastTime;
            return { isSpam: timeDiff < SPAM_THRESHOLD, timeDiff };
          }
          return { isSpam: false, timeDiff: null };
        }
      );

      if (isSpam.isSpam) {
        // Detected spam - ignore the message
        logger.info('Spam detected - ignoring message', {
          userId,
          channelId,
          timeDiff: isSpam.timeDiff,
          content: message.content.substring(0, 50),
        });

        // Track warnings with atomic operation
        const warningCount = await spamWarnings.atomicUpdateNestedMap(
          userId,
          channelId,
          async (userWarnings) => {
            if (!userWarnings.has(channelId)) {
              userWarnings.set(channelId, 0);
            }
            const currentCount = userWarnings.get(channelId) + 1;
            userWarnings.set(channelId, currentCount);
            return currentCount;
          }
        );

        // Warn after 3 consecutive spam messages
        if (warningCount >= 3) {
          try {
            await message.reply(
              'Please slow down with your messages. You are sending them too quickly.'
            );
            // Reset warning count
            await spamWarnings.atomicUpdateNestedMap(
              userId,
              channelId,
              async (userWarnings) => {
                userWarnings.set(channelId, 0);
              }
            );
          } catch (error) {
            logger.warn('Failed to send spam warning', {
              error: error.message,
            });
          }
        }

        return; // Ignore the spam message
      }

      // Update last message time atomically
      await lastMessageTimes.atomicUpdateNestedMap(
        userId,
        channelId,
        async (userChannels) => {
          userChannels.set(channelId, now);
        }
      );

      logger.debug('Processing message for response', {
        hasAttachments: message.attachments.size > 0,
        hasStickers: message.stickers?.size > 0,
        hasEmbeds: message.embeds?.length > 0,
        attachmentTypes: message.attachments.map((a) => a.contentType),
        embedCount: message.embeds?.length || 0,
      });

      // Check for embeds
      let embedInfo = '';
      if (message.embeds && message.embeds.length > 0) {
        const embedSummaries = message.embeds.map((embed, index) => {
          let summary = `EMBED ${index + 1}:`;
          if (embed.title) summary += ` Title: "${embed.title}"`;
          if (embed.description)
            summary += ` Description: "${embed.description.substring(0, 200)}${embed.description.length > 200 ? '...' : ''}"`;
          if (embed.url) summary += ` URL: ${embed.url}`;
          if (embed.author?.name) summary += ` Author: "${embed.author.name}"`;
          if (embed.fields && embed.fields.length > 0) {
            summary += ` Fields: ${embed.fields.map((field) => `"${field.name}: ${field.value.substring(0, 100)}${field.value.length > 100 ? '...' : ''}"`).join(', ')}`;
          }
          if (embed.image?.url) summary += ` Image: ${embed.image.url}`;
          if (embed.thumbnail?.url)
            summary += ` Thumbnail: ${embed.thumbnail.url}`;
          if (embed.footer?.text) summary += ` Footer: "${embed.footer.text}"`;
          return summary;
        });
        embedInfo = `\n\nEMBEDS: ${embedSummaries.join(' | ')}`;
      }

      // Check for media attachments (images, videos, GIFs, audio)
      let mediaInfo = '';
      let transcriptionInfo = '';
      if (message.attachments.size > 0) {
        const mediaAttachments = message.attachments.filter(
          (attachment) =>
            attachment.contentType &&
            (attachment.contentType.startsWith('image/') ||
              attachment.contentType.startsWith('video/') ||
              attachment.contentType === 'image/gif')
        );
        if (mediaAttachments.length > 0) {
          mediaInfo = `\n\nMEDIA ATTACHMENTS: ${mediaAttachments.map((media) => `${media.url} (${media.contentType})`).join(', ')}`;
        }

        // Process audio attachments for transcription
        const audioAttachments = message.attachments.filter(
          (attachment) =>
            attachment.contentType &&
            attachment.contentType.startsWith('audio/')
        );
        if (audioAttachments.length > 0) {
          try {
            // Import processMessageMedia here to avoid circular imports
            const { processMessageMedia } = await import('./media.js');
            const tempMessage = { ...message, attachments: audioAttachments };
            const { audioTranscription } =
              await processMessageMedia(tempMessage);
            if (audioTranscription && audioTranscription.trim()) {
              transcriptionInfo = `\n\nAUDIO TRANSCRIPTION: "${audioTranscription}"`;
              logger.info(
                `Audio transcription added to memory: ${audioTranscription.substring(0, 100)}...`
              );
            }
          } catch (error) {
            logger.warn('Failed to transcribe audio for memory storage', {
              error: error.message,
            });
          }
        }
      }

      // Process message in queue
      try {
        await requestQueue.add(
          message.channel?.id || message.channelId,
          async () => {
            // const processingStartTime = Date.now();

            // Start typing indicator to show the bot is processing
            try {
              await message.channel.sendTyping();
              logger.debug('Started typing indicator for message processing', {
                channelId: message.channel?.id || message.channelId,
              });
            } catch (error) {
              logger.warn(
                'Failed to start typing indicator for message processing',
                { error: error.message }
              );
            }

            let response;
            try {
              logger.debug('About to call generateResponse', {
                bot: !!bot,
                botType: typeof bot,
                hasServerPrompts: bot?.serverPrompts?.size > 0,
                guildId: message.guild?.id,
              });
              response = await generateResponse(
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
            } catch (error) {
              logger.error('Message processing failed', {
                error: error.message,
                stack: error.stack,
                messageId: message.id,
                channelId: message.channel?.id,
                authorId: message.author?.id,
              });

              if (
                error.message.includes('rate limit') ||
                error.message.includes('User rate limit exceeded')
              ) {
                // Stealth: More human-like rate limit message
                const humanMessages = [
                  'Whoa, slow down there! The API is getting hammered. Give me a sec...',
                  "Looks like I'm getting rate limited. Too many people talking to me at once!",
                  'Hold on, the servers are getting overwhelmed. Try again in a moment.',
                  'API is getting hammered right now. Give me a bit to catch up.',
                ];
                const randomMessage =
                  humanMessages[
                    Math.floor(Math.random() * humanMessages.length)
                  ];
                try {
                  await message.reply(randomMessage);
                } catch (replyError) {
                  logger.error('Failed to send rate limit message', {
                    error: replyError.message,
                  });
                }
              } else {
                // Generic error message for other failures
                try {
                  await message.reply(
                    "Sorry, I'm having trouble processing your message right now. Please try again later."
                  );
                } catch (replyError) {
                  logger.error('Failed to send generic error message', {
                    error: replyError.message,
                  });
                }
              }
              return; // Don't continue processing if there's an error
            }

            // Handle new response format { response, toolResults }
            let responseText = null;
            let toolResults = [];
            if (response && typeof response === 'object') {
              responseText = response.response;
              toolResults = response.toolResults || [];
            } else if (typeof response === 'string') {
              // Backward compatibility for string responses
              responseText = response;
            }

            logger.debug('Generated response', {
              responseLength: responseText?.length || 0,
              toolResultsCount: toolResults.length,
              channelId: message.channel?.id || message.channelId,
              ignored: responseText === null,
            });

            if (responseText) {
              // Add user message to memory now that we're responding
              try {
                if (
                  !channelMemories.has(message.channel?.id || message.channelId)
                ) {
                  channelMemories.set(
                    message.channel?.id || message.channelId,
                    []
                  );
                }
                const memory = channelMemories.get(
                  message.channel?.id || message.channelId
                );
                const userMessage = {
                  user: `${message.author.displayName || message.author.username} (${message.author.username})`,
                  message:
                    message.content + embedInfo + mediaInfo + transcriptionInfo,
                  timestamp: Date.now(),
                };
                memory.push(userMessage);
                if (memory.length > 15) {
                  memory.shift();
                }

                logger.debug('Added user message to memory', {
                  channelId: message.channel?.id || message.channelId,
                  user: userMessage.user,
                  messageLength: userMessage.message.length,
                  totalMessages: memory.length,
                });

                scheduleMemorySave(
                  'channelMemories',
                  channelMemories,
                  'data-selfbot/channelMemories.json'
                );

                // Also add to dmContexts if this is a DM
                if (isDM) {
                  if (
                    !dmContexts.has(message.channel?.id || message.channelId)
                  ) {
                    dmContexts.set(
                      message.channel?.id || message.channelId,
                      []
                    );
                  }
                  const dmMemory = dmContexts.get(
                    message.channel?.id || message.channelId
                  );
                  dmMemory.push(userMessage);
                  if (dmMemory.length > 15) {
                    // dmContexts limit
                    dmMemory.shift();
                  }
                  logger.debug('Added DM message to dmContexts', {
                    dmChannelId: message.channel?.id || message.channelId,
                    totalMessages: dmMemory.length,
                  });
                }
              } catch (memoryError) {
                logger.error('Error saving message to memory', {
                  error: memoryError.message,
                  channelId: message.channel.id,
                });
                // Continue processing even if memory save fails
              }

              logger.debug('Sending follow-up response to Discord', {
                responseLength: response.response?.length || 0,
                channelId: message.channel?.id || message.channelId,
                userId: message.author.id,
              });

              // Start typing indicator to show the bot is responding
              try {
                await message.channel.sendTyping();
                logger.debug('Started typing indicator for response', {
                  channelId: message.channel?.id || message.channelId,
                });
              } catch (error) {
                logger.warn('Failed to start typing indicator for response', {
                  error: error.message,
                });
              }

              // No delay for typing indicator

              // No stealth processing - direct response

              try {
                // Handle response chunking for long messages
                const { chunkMessage } = await import(
                  './utils/messageUtils.js'
                );
                const responseText = response.response;

                if (responseText.length > 2000) {
                  const chunks = chunkMessage(responseText);
                  for (let i = 0; i < chunks.length; i++) {
                    const chunkText =
                      i === 0
                        ? chunks[i]
                        : `**Response (Part ${i + 1}/${chunks.length})**\n\n${chunks[i]}`;

                    if (i === 0) {
                      // First chunk uses reply/send as before
                      if (isDM) {
                        await message.channel.send(chunkText);
                      } else {
                        await message.reply(chunkText);
                      }
                    } else {
                      // Subsequent chunks use send
                      await message.channel.send(chunkText);
                    }
                  }
                  logger.debug('Chunked response sent successfully', {
                    channelId: message.channel?.id || message.channelId,
                    userId: message.author.id,
                    totalChunks: chunks.length,
                    usedReply: !isDM,
                  });
                } else {
                  // Original logic for short responses
                  if (isDM) {
                    await message.channel.send(responseText);
                  } else {
                    await message.reply(responseText);
                  }
                  logger.debug('Follow-up response sent successfully', {
                    channelId: message.channel?.id || message.channelId,
                    userId: message.author.id,
                    usedReply: !isDM,
                  });
                }
              } catch (error) {
                if (
                  error.code === 50035 &&
                  error.message.includes('message_reference')
                ) {
                  // Fallback: send without reply if reference is invalid
                  logger.warn(
                    'Reply failed due to invalid message_reference, sending without reply',
                    { error: error.message }
                  );
                  try {
                    await message.channel.send(response.response);
                  } catch (sendError) {
                    logger.error('Failed to send fallback response', {
                      error: sendError.message,
                    });
                  }
                } else {
                  logger.error('Failed to send response', {
                    error: error.message,
                  });
                }
              }
              // Add follow-up response to memory
              const memory = channelMemories.get(
                message.channel?.id || message.channelId
              );
              if (memory) {
                const botMessage = {
                  user: `${client.user.displayName || client.user.username} (${client.user.username})`,
                  message: response.response,
                  timestamp: Date.now(),
                };
                memory.push(botMessage);
                if (memory.length > 15) {
                  memory.shift();
                }

                logger.debug('Added bot response to memory', {
                  channelId: message.channel?.id || message.channelId,
                  user: botMessage.user,
                  messageLength: botMessage.message.length,
                  totalMessages: memory.length,
                });

                // Save memory after adding bot's response
                scheduleMemorySave(
                  'channelMemories',
                  channelMemories,
                  'data-selfbot/channelMemories.json'
                );

                // Also add to dmContexts if this is a DM
                if (isDM) {
                  const dmMemory = dmContexts.get(
                    message.channel?.id || message.channelId
                  );
                  if (dmMemory) {
                    dmMemory.push(botMessage);
                    if (dmMemory.length > 15) {
                      dmMemory.shift();
                    }
                    logger.debug('Added bot response to dmContexts', {
                      dmChannelId: message.channel?.id || message.channelId,
                      totalMessages: dmMemory.length,
                    });
                  }
                }
              }
            }
          }
        );
      } catch (queueError) {
        logger.error('Error in request queue', {
          error: queueError.message,
          userId: message.author.id,
          channelId: message.channel.id,
        });
        try {
          await message.reply(
            'Sorry, I encountered an error while processing your message.'
          );
        } catch (replyError) {
          logger.error('Failed to send queue error message', {
            error: replyError.message,
          });
        }
      }
    } catch (error) {
      logger.error('Error generating response', {
        error: error.message,
        userId: message.author.id,
        channelId: message.channel.id,
      });
      try {
        await message.reply(
          'Sorry, I encountered an error while processing your message.'
        );
      } catch (e) {
        logger.error('Failed to send error message', { error: e.message });
      }
    }
  });

  // Interaction handler
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        try {
          if (interaction.commandName === 'prompt') {
            await interaction.deferReply();
            const textInput = interaction.options.getString('text');
            const textValidation = validateUserInput(textInput, 3000);
            if (!textValidation.valid) {
              await interaction.editReply(
                `Invalid prompt: ${textValidation.error}`
              );
              return;
            }
            globalPrompt[0] = textValidation.sanitized;
            if (validatePath('globalPrompt.txt')) {
              await fs.promises.writeFile(
                'globalPrompt.txt',
                textValidation.sanitized
              );
            }
            try {
              await interaction.editReply('Custom prompt set!');
            } catch (error) {
              logger.error('Failed to edit interaction reply', {
                error: error.message,
              });
            }
          } else if (interaction.commandName === 'debug') {
            await interaction.deferReply();
            const channelCount = channelMemories.size();
            const totalMessages = Array.from(channelMemories.values()).reduce(
              (sum, mem) => sum + mem.length,
              0
            );
            const truncate = (str, len) =>
              str && str.length > len ? str.substring(0, len) + '...' : str;

            // Helper to safely stringify objects
            const safeStringify = (obj, len = 500) => {
              if (obj === null || obj === undefined) return 'None';
              if (typeof obj === 'string') return truncate(obj, len);
              try {
                const str = JSON.stringify(obj);
                return truncate(str, len);
              } catch (e) {
                return truncate(String(obj), len);
              }
            };

            let debugInfo = `Channels with memory: ${channelCount}\nTotal messages stored: ${totalMessages}\nGlobal prompt: ${globalPrompt && globalPrompt[0] ? 'Set' : 'None'}\n\nLast prompt (truncated):\n${safeStringify(lastPrompt[0], 500)}\n\nLast response (truncated):\n${safeStringify(lastResponse[0], 500)}`;
            if (
              lastToolCalls.length > 0 &&
              lastToolCalls[0] &&
              lastToolCalls[0].length > 0
            ) {
              const callsStr = JSON.stringify(lastToolCalls[0]);
              debugInfo += `\n\nLast tool calls: ${callsStr.length > 500 ? callsStr.substring(0, 500) + '...' : callsStr}`;
            }
            if (
              lastToolResults.length > 0 &&
              lastToolResults[0] &&
              lastToolResults[0].length > 0
            ) {
              const resultsStr = JSON.stringify(lastToolResults[0]);
              debugInfo += `\n\nLast tool results: ${resultsStr.length > 500 ? resultsStr.substring(0, 500) + '...' : resultsStr}`;
            }
            // Truncate to fit Discord limit
            if (debugInfo.length > 1900) {
              debugInfo = debugInfo.substring(0, 1900) + '...';
            }
            try {
              await interaction.editReply(debugInfo);
            } catch (error) {
              logger.error('Failed to edit debug interaction reply', {
                error: error.message,
              });
            }
          } else if (interaction.commandName === 'refresh') {
            await interaction.deferReply();
            const refreshTypeInput =
              interaction.options.getString('type') || 'all';
            const refreshTypeValidation = validateUserInput(
              refreshTypeInput,
              20
            );
            if (!refreshTypeValidation.valid) {
              await interaction.editReply(
                `Invalid refresh type: ${refreshTypeValidation.error}`
              );
              return;
            }
            const refreshType = refreshTypeValidation.sanitized;

            let clearedItems = [];

            if (refreshType === 'memories' || refreshType === 'all') {
              channelMemories.clear();
              clearedItems.push('conversation memories');
            }

            if (refreshType === 'context' || refreshType === 'all') {
              // Clear user context
              const { loadUserContext, saveUserContext } = await import(
                './utils/index.js'
              );
              const userContext = await loadUserContext();
              userContext.clear();
              await saveUserContext(userContext);
              clearedItems.push('user context');
            }

            if (refreshType === 'dm' || refreshType === 'all') {
              // Clear DM metadata
              const dmMetadataPath = './data-selfbot/dmMetadata.json';
              if (
                validatePath(dmMetadataPath) &&
                fs.existsSync(dmMetadataPath)
              ) {
                await fs.promises.writeFile(dmMetadataPath, JSON.stringify({}));
              }
              clearedItems.push('DM metadata');
            }

            try {
              if (refreshType === 'all') {
                await interaction.editReply(
                  'All memories, user context, and DM metadata cleared! Shell history preserved.'
                );
              } else if (clearedItems.length > 0) {
                await interaction.editReply(
                  `Cleared: ${clearedItems.join(', ')}. Shell history preserved.`
                );
              } else {
                await interaction.editReply('Invalid refresh type.');
              }
            } catch (error) {
              logger.error('Failed to edit refresh interaction reply', {
                error: error.message,
              });
            }
          } else if (interaction.commandName === 'info') {
            await interaction.deferReply();
            try {
              await interaction.editReply(
                "This is a Discord selfbot powered by Google's Gemma 3-27B-IT model. It can engage in conversations and perform actions via tools."
              );
            } catch (error) {
              logger.error('Failed to edit info interaction reply', {
                error: error.message,
              });
            }
          }
        } catch (commandError) {
          logger.error('Error handling slash command', {
            command: interaction.commandName,
            error: commandError.message,
            userId: interaction.user?.id || 'unknown',
          });
          try {
            try {
              if (interaction.replied || interaction.deferred) {
                await interaction.editReply(
                  'There was an error while executing this command!'
                );
              } else {
                await interaction.reply(
                  'There was an error while executing this command!'
                );
              }
            } catch (error) {
              logger.error('Failed to send interaction error reply', {
                error: error.message,
              });
            }
          } catch (replyError) {
            logger.error('Failed to send slash command error message', {
              error: replyError.message,
            });
          }
        }
      }
    } catch (interactionError) {
      logger.error('Error processing interaction', {
        error: interactionError.message,
        userId: interaction.user?.id || 'unknown',
      });
    }
  });
}
