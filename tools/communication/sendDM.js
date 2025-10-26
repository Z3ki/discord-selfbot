import { sendDM, saveDMMetadata } from '../../utils/index.js';
import { logger } from '../../utils/logger.js';

export const sendDMTool = {
  name: 'send_dm',
   description: 'Send a direct message to a USER (not a channel). SELFBOT CAPABILITY: Selfbots can send DMs to users in mutual servers. The target user MUST be in at least one server that the selfbot is also in. You can use: user ID (numeric), username (plain text like "john_doe"), display name (server nickname), or Discord mention (@user). NEVER use channel IDs as user IDs. The bot will automatically resolve usernames and display names by searching through all servers it is in. If the user is not found in any mutual server, the DM will fail.',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      content: { type: 'string' },
      reason: { type: 'string', description: 'Detailed reason for sending the DM, e.g., "User requested information about server rules" or "Responding to user query about bot features"' }
    },
    required: ['userId', 'content']
  },

  async execute(args, context) {
    try {
      const { client, message } = context;
      const dmMessage = await sendDM(client, args.userId, args.content);

      if (dmMessage) {
        // Save DM metadata for context tracking
        await saveDMMetadata(dmMessage.channel.id, {
          originalChannelId: message.channel?.id || message.channelId,
          originalMessageId: message.id,
          triggerMessage: message.content,
          reason: args.reason || 'No reason provided',
          timestamp: Date.now(),
          userId: message.author.id
        });

        // Set dmOrigins to link DM channel to original channel
        context.dmOrigins.set(dmMessage.channel.id, message.channel?.id || message.channelId);

        logger.info('DM sent successfully', {
          targetUserId: args.userId,
          reason: args.reason,
          originalChannel: message.channel?.id || message.channelId,
          dmChannel: dmMessage.channel.id
        });

        return `DM sent to user ${args.userId} successfully.`;
      } else {
        return `Failed to send DM to user ${args.userId}. The user may not exist, not be in any mutual server with the bot, or have DMs disabled. Selfbots can only DM users in shared servers.`;
      }
    } catch (error) {
      logger.error('Error sending DM:', error);
      if (error.message.includes('INVALID_USER_ID')) {
        return error.message.replace('INVALID_USER_ID: ', 'ERROR: ');
      }
      if (error.message.includes('fetch') || error.message.includes('resolve')) {
        return `Could not find user ${args.userId}. Make sure the user is in a server that the bot is also in. Selfbots cannot DM users not in mutual servers.`;
      }
      return `Error sending DM: ${error.message}`;
    }
  }
};

export async function executeSendDM(args, client, message, dmOrigins) {
  try {
    const dmMessage = await sendDM(client, args.userId, args.content);

    if (dmMessage) {
      // Save DM metadata for context tracking
      await saveDMMetadata(dmMessage.channel.id, {
        originalChannelId: message.channel?.id || message.channelId,
        originalMessageId: message.id,
        triggerMessage: message.content,
        reason: args.reason || 'No reason provided',
        timestamp: Date.now(),
        userId: message.author.id
      });

      // Set dmOrigins to link DM channel to original channel
      // Note: dmOrigins is passed as parameter in executeSendDM
      if (dmOrigins) {
        dmOrigins.set(dmMessage.channel.id, message.channel?.id || message.channelId);
      }

      logger.info('DM sent successfully', {
        targetUserId: args.userId,
        reason: args.reason,
        originalChannel: message.channel?.id || message.channelId,
        dmChannel: dmMessage.channel.id
      });

      return `DM sent to user ${args.userId} successfully.`;
    } else {
      return `Failed to send DM to user ${args.userId}. The user may not exist, not be in any mutual server with the bot, or have DMs disabled. Selfbots can only DM users in shared servers.`;
    }
  } catch (error) {
    logger.error('Error sending DM:', error);
    if (error.message.includes('INVALID_USER_ID')) {
      return error.message.replace('INVALID_USER_ID: ', 'ERROR: ');
    }
    if (error.message.includes('fetch') || error.message.includes('resolve')) {
      return `Could not find user ${args.userId}. Make sure the user is in a server that the bot is also in. Selfbots cannot DM users not in mutual servers.`;
    }
    return `Error sending DM: ${error.message}`;
  }
}

