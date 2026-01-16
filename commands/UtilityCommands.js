import { logger } from '../utils/logger.js';
import { toolRegistry } from '../tools/index.js';

// Input validation utility
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

  return { valid: true, sanitized: input.trim() };
}

/**
 * Handle utility commands like help, functions, testqueue
 */
export async function handleHelpCommand(message) {
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

  await message.reply(helpText);
}

export async function handleFunctionsCommand(message) {
  const tools = toolRegistry.getAllTools();
  const toolCategories = toolRegistry.getCategories();

  let response = `**Available Tools (${tools.length} total)**\n\n`;

  for (const [category, toolNames] of Object.entries(toolCategories)) {
    if (toolNames.length > 0) {
      response += `**${category}** (${toolNames.length}):\n`;
      toolNames.forEach((toolName) => {
        const tool = tools.find((t) => t.name === toolName);
        if (tool) {
          response += `• \`${tool.name}\` - ${tool.description.substring(0, 100)}${tool.description.length > 100 ? '...' : ''}\n`;
        }
      });
      response += '\n';
    }
  }

  await message.reply(response);
}

export async function handleTestQueueCommand(message, bot) {
  try {
    const queueStats = {
      totalChannels: bot.requestQueue?.queues?.size || 0,
      processingChannels: bot.requestQueue?.processing?.size || 0,
      userLimits: bot.requestQueue?.userLimits?.size || 0,
      spamHistory: bot.requestQueue?.spamHistory?.size || 0,
      globalDMQueue: bot.globalDMQueue?.queue?.length || 0,
    };

    const statsText = `**Queue Statistics**

**Request Queue:**
- Total Channels: ${queueStats.totalChannels}
- Processing: ${queueStats.processingChannels}
- User Limits: ${queueStats.userLimits}
- Spam History: ${queueStats.spamHistory}

**Global DM Queue:**
- Queued Messages: ${queueStats.globalDMQueue}

**Rate Limits:**
- Per User: ${bot.requestQueue?.maxRequestsPerWindow || 10} requests/minute
- Window: ${bot.requestQueue?.limitWindow || 60000}ms

**Spam Detection:**
- Window: ${bot.requestQueue?.spamWindow || 10000}ms
- Max Identical: ${bot.requestQueue?.maxIdenticalMessages || 3}
- Max Messages: ${bot.requestQueue?.maxMessagesInWindow || 5}`;

    await message.reply(statsText);
  } catch (error) {
    logger.error('Error in testqueue command', { error: error.message });
    await message.reply('An error occurred while fetching queue statistics.');
  }
}

export async function handleSafeModeCommand(message, args, bot) {
  const { adminManager } = await import('../utils/adminManager.js');

  if (!adminManager.isAdmin(message.author.id)) {
    await message.reply('Access denied. Admin command only.');
    return;
  }

  // Validate args (should be empty for this command)
  const argsValidation = validateUserInput(args.join(' '), 1000, true);
  if (!argsValidation.valid) {
    await message.reply('Invalid arguments for safe mode command');
    return;
  }

  const serverId =
    message.guild?.id || message.channel?.id || message.channelId;
  const currentMode = bot.safeModeServers.get(serverId) || false;

  // Toggle safe mode
  bot.safeModeServers.set(serverId, !currentMode);

  const newMode = !currentMode;
  const modeText = newMode ? 'RESTRICTED' : 'UNRESTRICTED';

  await message.reply(
    `**Safe Mode Updated**\n\n**Server:** ${serverId}\n**Mode:** ${modeText}\n\n${newMode ? 'Responses will be restricted and filtered.' : 'Responses will be unrestricted.'}`
  );
}
