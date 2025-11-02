import { sendDM, saveDMMetadata } from '../../utils/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Tool for sending direct messages to users
 * @typedef {Object} SendDMArgs
 * @property {string} userId - Target user ID, username, display name, or mention
 * @property {string} content - Message content to send
 * @property {string} [reason] - Detailed reason for sending the DM
 * 
 * @typedef {Object} ExecutionContext
 * @property {Client} client - Discord client instance
 * @property {Message} message - Original message that triggered the tool
 * @property {Map} dmOrigins - Map tracking DM channel origins
 */

/**
 * Send DM tool definition
 * @type {Object}
 */
export const sendDMTool = {
  name: 'send_dm',
  description: 'Send a direct message to a USER (not a channel). SELFBOT CAPABILITY: Selfbots can send DMs to users in mutual servers. The target user MUST be in at least one server that the selfbot is also in. You can use: user ID (numeric), username (plain text like "john_doe"), display name (server nickname), or Discord mention (@user). NEVER use channel IDs as user IDs. The bot will automatically resolve usernames and display names by searching through all servers it is in. If the user is not found in any mutual server, the DM will fail. MULTI-LINE SUPPORT: Content can span multiple lines with proper formatting preserved.',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'Target user ID, username, display name, or Discord mention'
      },
      content: {
        type: 'string',
        description: 'Message content to send (supports multi-line with \\n, auto-splits long messages)'
      },
      reason: {
        type: 'string',
        description: 'Detailed reason for sending the DM, e.g., "User requested information about server rules" or "Responding to user query about bot features"'
      }
    },
    required: ['userId', 'content']
  },

  /**
    * Execute the send DM tool
    * @param {SendDMArgs} args - Tool arguments
    * @param {ExecutionContext} context - Execution context
    * @returns {Promise<string>} Result message
    */
  async execute(args, context) {
    try {
      const { client, message } = context;

      // Process and validate content
      let processedContent = this.processContent(args.content);

      // Check if content is too long and needs splitting
      const messages = this.splitLongMessage(processedContent);

      let firstMessage = null;
      let messageCount = 0;

      // Send all message parts
      for (const contentPart of messages) {
        const dmMessage = await sendDM(client, args.userId, contentPart);
        if (!firstMessage) firstMessage = dmMessage;
        messageCount++;
      }

      const dmMessage = firstMessage;

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

        const messageText = messageCount === 1 ? 'DM sent' : `${messageCount} DMs sent`;
        return `${messageText} to user ${args.userId} successfully.`;
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
      if (error.message.includes('CAPTCHA') || error.code === 500) {
        return `DM blocked by Discord's anti-abuse protection (CAPTCHA required). Selfbots cannot solve CAPTCHAs. Try using a regular bot account or wait and retry.`;
      }
      return `Error sending DM: ${error.message}`;
    }
  },

  /**
   * Process and validate message content
   * @param {string} content - Raw content
   * @returns {string} Processed content
   */
  processContent(content) {
    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string');
    }

    // Trim excessive whitespace but preserve intentional formatting
    let processed = content.trim();

    // Normalize line endings to \n
    processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Remove excessive consecutive empty lines (more than 2)
    processed = processed.replace(/\n{3,}/g, '\n\n');

    // Handle semicolons in command chains - add line breaks for better splitting
    // This helps prevent cutting off shell commands in the middle of command chains
    processed = processed.replace(/;(?!\s*$)/g, ';\n');

    // Basic validation
    if (processed.length === 0) {
      throw new Error('Content cannot be empty after processing');
    }

    return processed;
  },

  /**
   * Split long messages into multiple parts (Discord 2000 char limit)
   * @param {string} content - Content to split
   * @param {number} maxLength - Maximum length per message (default: 1900 for safety)
   * @returns {string[]} Array of message parts
   */
  splitLongMessage(content, maxLength = 1900) {
    if (content.length <= maxLength) {
      return [content];
    }

    const parts = [];
    let remaining = content;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        parts.push(remaining);
        break;
      }

      // Find the best split point (prefer line breaks, then semicolons, then spaces)
      let splitIndex = maxLength;

      // Try to split at line break first
      const lineBreakIndex = remaining.lastIndexOf('\n', maxLength);
      if (lineBreakIndex > maxLength * 0.7) { // Only if it's reasonably close to maxLength
        splitIndex = lineBreakIndex;
      } else {
        // Try to split at semicolon (for command chains)
        const semicolonIndex = remaining.lastIndexOf(';', maxLength);
        if (semicolonIndex > maxLength * 0.7) {
          splitIndex = semicolonIndex + 1; // Include the semicolon in the current part
        } else {
          // Try to split at space
          const spaceIndex = remaining.lastIndexOf(' ', maxLength);
          if (spaceIndex > maxLength * 0.7) {
            splitIndex = spaceIndex;
          }
        }
      }

      // Extract the part and add continuation marker if not the last part
      const part = remaining.substring(0, splitIndex).trim();
      parts.push(part);

      // Remove the processed part
      remaining = remaining.substring(splitIndex).trim();

      // Prevent infinite loops
      if (parts.length > 10) {
        logger.warn('Message splitting exceeded 10 parts, truncating', { originalLength: content.length });
        break;
      }
    }

    // Add part indicators for multi-part messages
    if (parts.length > 1) {
      parts.forEach((part, index) => {
        const indicator = `\n\n[Part ${index + 1}/${parts.length}]`;
        if (part.length + indicator.length <= maxLength) {
          parts[index] = part + indicator;
        }
      });
    }

    return parts;
  }
};

/**
 * Execute send DM function (legacy compatibility)
 * @param {SendDMArgs} args - Tool arguments
 * @param {Client} client - Discord client instance
 * @param {Message} message - Original message
 * @param {Map} dmOrigins - Map tracking DM channel origins
 * @returns {Promise<string>} Result message
 */
export async function executeSendDM(args, client, message, dmOrigins) {
  try {
    // Process and validate content
    let processedContent = sendDMTool.processContent(args.content);

    // Check if content is too long and needs splitting
    const messages = sendDMTool.splitLongMessage(processedContent);

    let firstMessage = null;
    let messageCount = 0;

    // Send all message parts
    for (const contentPart of messages) {
      const dmMessage = await sendDM(client, args.userId, contentPart);
      if (!firstMessage) firstMessage = dmMessage;
      messageCount++;
    }

    const dmMessage = firstMessage;

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

      const messageText = messageCount === 1 ? 'DM sent' : `${messageCount} DMs sent`;
      return `${messageText} to user ${args.userId} successfully.`;
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
    if (error.message.includes('CAPTCHA') || error.code === 500) {
      return `DM blocked by Discord's anti-abuse protection (CAPTCHA required). Selfbots cannot solve CAPTCHAs. Try using a regular bot account or wait and retry.`;
    }
    return `Error sending DM: ${error.message}`;
  }
}

