import { logger } from '../utils/logger.js';

// Input validation utilities
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

function validateDiscordId(id) {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Invalid ID format' };
  }

  const snowflakeRegex = /^\d{17,19}$/;
  if (!snowflakeRegex.test(id)) {
    return { valid: false, error: 'Invalid Discord ID format' };
  }

  return { valid: true };
}

/**
 * Handle admin management commands
 */
export async function handleAdminCommand(message, args) {
  const { adminManager } = await import('../utils/adminManager.js');

  // Only existing admins can manage other admins
  if (!adminManager.isAdmin(message.author.id)) {
    await message.reply(
      'Access denied. Only existing administrators can manage admin access.'
    );
    return;
  }

  const actionValidation = validateUserInput(args[0], 20);
  const userIdValidation = validateUserInput(args[1], 50);

  if (!actionValidation.valid) {
    await message.reply('Invalid action parameter');
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
    await message.reply(adminHelp);
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

        const userIdCheck = validateDiscordId(userId);
        if (!userIdCheck.valid) {
          await message.reply(`Invalid user ID: ${userIdCheck.error}`);
          return;
        }
        const addResult = await adminManager.toggleAdmin(
          message.author.id,
          userId
        );
        if (addResult.success && addResult.action === 'added') {
          await message.reply(
            `**Admin Added**\n\n**User ID:** ${userId}\n**Total Admins:** ${adminManager.getAdminCount()}`
          );
        } else if (addResult.success && addResult.action === 'removed') {
          await message.reply(
            `**User was already admin** - removed instead\n\n**User ID:** ${userId}`
          );
        } else {
          await message.reply(`**Error:** ${addResult.error}`);
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

        const userIdCheck = validateDiscordId(userId);
        if (!userIdCheck.valid) {
          await message.reply(`Invalid user ID: ${userIdCheck.error}`);
          return;
        }
        const removeResult = await adminManager.toggleAdmin(
          message.author.id,
          userId
        );
        if (removeResult.success && removeResult.action === 'removed') {
          await message.reply(
            `**Admin Removed**\n\n**User ID:** ${userId}\n**Total Admins:** ${adminManager.getAdminCount()}`
          );
        } else if (removeResult.success && removeResult.action === 'added') {
          await message.reply(
            `**User was not admin** - added instead\n\n**User ID:** ${userId}`
          );
        } else {
          await message.reply(`**Error:** ${removeResult.error}`);
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

        const userIdCheck = validateDiscordId(userId);
        if (!userIdCheck.valid) {
          await message.reply(`Invalid user ID: ${userIdCheck.error}`);
          return;
        }
        const toggleResult = await adminManager.toggleAdmin(
          message.author.id,
          userId
        );
        if (toggleResult.success) {
          const status =
            toggleResult.action === 'added'
              ? 'Now an admin'
              : 'No longer an admin';
          await message.reply(
            `**Admin Status Toggled**\n\n**User ID:** ${userId}\n**Action:** ${toggleResult.action}\n**Status:** ${status}\n**Total Admins:** ${adminManager.getAdminCount()}`
          );
        } else {
          await message.reply(`**Error:** ${toggleResult.error}`);
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
        await message.reply(listResponse);
        break;
      }

      case 'clear': {
        await adminManager.clearAdmins(message.author.id);
        await message.reply(
          '**All administrators removed**\n\nUse `,admin add <userId>` to add new administrators.'
        );
        break;
      }

      default: {
        await message.reply(
          `Unknown admin action: ${action}\nUse \` ,admin\` to see available actions.`
        );
        break;
      }
    }
  } catch (error) {
    logger.error('Error in admin command', {
      error: error.message,
      action,
      userId,
    });
    await message.reply(
      'An error occurred while processing the admin command.'
    );
  }
}

/**
 * Handle blacklist management commands
 */
export async function handleBlacklistCommand(message, args, bot) {
  const { adminManager } = await import('../utils/adminManager.js');

  if (!adminManager.isAdmin(message.author.id)) {
    await message.reply('Access denied. Admin command only.');
    return;
  }

  const actionValidation = validateUserInput(args[0], 20);
  const serverIdValidation = validateUserInput(args[1], 50);

  if (!actionValidation.valid) {
    await message.reply('Invalid action parameter');
    return;
  }

  const action = actionValidation.sanitized.toLowerCase();
  const serverId = serverIdValidation.sanitized;

  if (!action) {
    const blacklistHelp = `**Blacklist Management**

**Usage:**
\`,blacklist <action> [serverId]\`

**Actions:**
• \`add <serverId>\` - Add server to blacklist
• \`remove <serverId>\` - Remove server from blacklist
• \`list\` - Show all blacklisted servers
• \`clear\` - Clear all blacklisted servers

**Examples:**
\`,blacklist add 123456789012345678\`
\`,blacklist list\`

**Note:** Use Discord Developer Mode to get server IDs`;
    await message.reply(blacklistHelp);
    return;
  }

  try {
    switch (action) {
      case 'add': {
        if (!serverId) {
          await message.reply(
            'Server ID required for add action\nUsage: `,blacklist add <serverId>`'
          );
          return;
        }

        const serverIdCheck = validateDiscordId(serverId);
        if (!serverIdCheck.valid) {
          await message.reply(`Invalid server ID: ${serverIdCheck.error}`);
          return;
        }
        bot.blacklist.add(serverId);
        await message.reply(
          `**Server Added to Blacklist**\n\n**Server ID:** ${serverId}\n**Total Blacklisted:** ${bot.blacklist.size}`
        );
        break;
      }

      case 'remove': {
        if (!serverId) {
          await message.reply(
            'Server ID required for remove action\nUsage: `,blacklist remove <serverId>`'
          );
          return;
        }

        const serverIdCheck = validateDiscordId(serverId);
        if (!serverIdCheck.valid) {
          await message.reply(`Invalid server ID: ${serverIdCheck.error}`);
          return;
        }
        const removed = bot.blacklist.delete(serverId);
        if (removed) {
          await message.reply(
            `**Server Removed from Blacklist**\n\n**Server ID:** ${serverId}\n**Total Blacklisted:** ${bot.blacklist.size}`
          );
        } else {
          await message.reply(
            `**Server Not Found**\n\nServer ID ${serverId} was not in the blacklist.`
          );
        }
        break;
      }

      case 'list': {
        if (bot.blacklist.size === 0) {
          await message.reply('**No blacklisted servers**');
          return;
        }

        let listResponse = `**Blacklisted Servers**\n\n**Total:** ${bot.blacklist.size}\n\n`;
        bot.blacklist.forEach((serverId, index) => {
          listResponse += `${index + 1}. ${serverId}\n`;
        });
        await message.reply(listResponse);
        break;
      }

      case 'clear': {
        const count = bot.blacklist.size;
        bot.blacklist.clear();
        await message.reply(
          `**Blacklist Cleared**\n\nRemoved ${count} servers from the blacklist.`
        );
        break;
      }

      default: {
        await message.reply(
          `Unknown blacklist action: ${action}\nUse \` ,blacklist\` to see available actions.`
        );
        break;
      }
    }
  } catch (error) {
    logger.error('Error in blacklist command', {
      error: error.message,
      action,
      serverId,
    });
    await message.reply(
      'An error occurred while processing the blacklist command.'
    );
  }
}
