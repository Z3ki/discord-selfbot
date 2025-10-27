/**
 * Tool for managing Discord messages and threads
 * @typedef {Object} MessageManagerArgs
 * @property {string} action - Action to perform
 * @property {string} [channelId] - Channel ID where the message/thread is located
 * @property {string} [messageId] - Message ID for pin/unpin actions
 * @property {string} [threadId] - Thread ID for thread actions
 * @property {string} [threadName] - Thread name for create_thread action
 * @property {number} [autoArchiveDuration] - Auto archive duration in minutes
 * @property {string} [reason] - Reason for the action
 */

/**
 * Message manager tool definition
 * @type {Object}
 */
export const messageManagerTool = {
  name: 'message_manager',
  description: 'Manage messages (pin, archive threads, create threads)',
  parameters: {
    type: 'object',
    properties: {
      action: { 
        type: 'string', 
        enum: ['pin', 'unpin', 'archive_thread', 'create_thread', 'join_thread', 'leave_thread'],
        description: 'Action to perform: pin, unpin, archive_thread, create_thread, join_thread, leave_thread'
      },
      channelId: { 
        type: 'string', 
        description: 'Channel ID where the message/thread is located' 
      },
      messageId: { 
        type: 'string', 
        description: 'Message ID for pin/unpin actions' 
      },
      threadId: { 
        type: 'string', 
        description: 'Thread ID for thread actions' 
      },
      threadName: { 
        type: 'string', 
        description: 'Thread name for create_thread action' 
      },
      autoArchiveDuration: { 
        type: 'number', 
        description: 'Auto archive duration in minutes for create_thread (60, 1440, 4320, 10080)' 
      }
    },
      reason: {
        type: 'string',
        description: 'Reason for performing this action'
      }
    },
    required: ['action', 'channelId']
  },

  /**
   * Execute the message manager tool
   * @param {MessageManagerArgs} args - Tool arguments
   * @param {Object} context - Execution context
   * @returns {Promise<string>} Result message
   */
  async execute(args, context) {
    try {
      const { client } = context;
      const { validateChannelId } = await import('../../utils/index.js');

      // Validate channel ID
      if (!args.channelId || !validateChannelId(args.channelId, client)) {
        return 'Invalid channel ID provided.';
      }

      const channel = await client.channels.fetch(args.channelId).catch(() => null);
      if (!channel) {
        return 'Channel not found or inaccessible.';
      }

      switch (args.action) {
        case 'pin':
          if (!args.messageId) {
            return 'Message ID is required for pin action.';
          }
          try {
            const message = await channel.messages.fetch(args.messageId);
            await message.pin();
            return `Message ${args.messageId} pinned successfully.`;
          } catch (error) {
            return `Failed to pin message: ${error.message}`;
          }

        case 'unpin':
          if (!args.messageId) {
            return 'Message ID is required for unpin action.';
          }
          try {
            const message = await channel.messages.fetch(args.messageId);
            await message.unpin();
            return `Message ${args.messageId} unpinned successfully.`;
          } catch (error) {
            return `Failed to unpin message: ${error.message}`;
          }

        case 'archive_thread':
          if (!args.threadId) {
            return 'Thread ID is required for archive_thread action.';
          }
          try {
            const thread = await channel.threads.fetch(args.threadId);
            await thread.setArchived(true);
            return `Thread ${args.threadId} archived successfully.`;
          } catch (error) {
            return `Failed to archive thread: ${error.message}`;
          }

        case 'create_thread':
          if (!args.threadName) {
            return 'Thread name is required for create_thread action.';
          }
          try {
            const thread = await channel.threads.create({
              name: args.threadName,
              autoArchiveDuration: args.autoArchiveDuration || 1440
            });
            return `Thread "${args.threadName}" created successfully with ID: ${thread.id}`;
          } catch (error) {
            return `Failed to create thread: ${error.message}`;
          }

        case 'join_thread':
          if (!args.threadId) {
            return 'Thread ID is required for join_thread action.';
          }
          try {
            const thread = await channel.threads.fetch(args.threadId);
            await thread.join();
            return `Joined thread ${args.threadId} successfully.`;
          } catch (error) {
            return `Failed to join thread: ${error.message}`;
          }

        case 'leave_thread':
          if (!args.threadId) {
            return 'Thread ID is required for leave_thread action.';
          }
          try {
            const thread = await channel.threads.fetch(args.threadId);
            await thread.leave();
            return `Left thread ${args.threadId} successfully.`;
          } catch (error) {
            return `Failed to leave thread: ${error.message}`;
          }

        default:
          return `Unknown action: ${args.action}. Supported actions: pin, unpin, archive_thread, create_thread, join_thread, leave_thread`;
      }
    } catch (error) {
      return `Error executing message manager: ${error.message}`;
    }
  }
};

/**
 * Execute message manager function (legacy compatibility)
 * @param {MessageManagerArgs} args - Tool arguments
 * @param {Client} client - Discord client instance
 * @returns {Promise<string>} Result message
 */
export async function executeMessageManager(args, client) {
  try {
    const { validateChannelId } = await import('../../utils/index.js');
    const channel = validateChannelId(client, args.channelId, 'message management');

    switch (args.action) {
      case 'pin':
        if (!args.messageId) {
          return 'Error: messageId is required for pin action';
        }
        return await pinMessage(channel, args.messageId);

      case 'unpin':
        if (!args.messageId) {
          return 'Error: messageId is required for unpin action';
        }
        return await unpinMessage(channel, args.messageId);

      case 'archive_thread':
        if (!args.threadId) {
          return 'Error: threadId is required for archive_thread action';
        }
        return await archiveThread(client, args.threadId);

      case 'create_thread':
        if (!args.messageId) {
          return 'Error: messageId is required for create_thread action';
        }
        if (!args.threadName) {
          return 'Error: threadName is required for create_thread action';
        }
        return await createThread(channel, args.messageId, args.threadName, args.autoArchiveDuration);

      case 'join_thread':
        if (!args.threadId) {
          return 'Error: threadId is required for join_thread action';
        }
        return await joinThread(client, args.threadId);

      case 'leave_thread':
        if (!args.threadId) {
          return 'Error: threadId is required for leave_thread action';
        }
        return await leaveThread(client, args.threadId);

      default:
        return 'Error: Invalid action. Use pin, unpin, archive_thread, create_thread, join_thread, or leave_thread';
    }
  } catch (error) {
    return `Failed to manage messages: ${error.message}`;
  }
}

async function pinMessage(channel, messageId) {
  const message = await channel.messages.fetch(messageId);
  await message.pin();
  return 'Message pinned successfully';
}

async function unpinMessage(channel, messageId) {
  const message = await channel.messages.fetch(messageId);
  await message.unpin();
  return 'Message unpinned successfully';
}

async function archiveThread(client, threadId) {
  const thread = await client.channels.fetch(threadId);
  if (!thread || !thread.isThread()) {
    return 'Error: Not a valid thread';
  }
  
  await thread.setArchived(true);
  return `Thread "${thread.name}" archived successfully`;
}

async function createThread(channel, messageId, threadName, autoArchiveDuration) {
  const message = await channel.messages.fetch(messageId);
  const thread = await message.startThread({
    name: threadName,
    autoArchiveDuration: autoArchiveDuration || 1440 // Default 24 hours
  });
  return `Thread "${thread.name}" created successfully with ID: ${thread.id}`;
}

async function joinThread(client, threadId) {
  const thread = await client.channels.fetch(threadId);
  if (!thread || !thread.isThread()) {
    return 'Error: Not a valid thread';
  }
  
  await thread.join();
  return `Joined thread "${thread.name}" successfully`;
}

async function leaveThread(client, threadId) {
  const thread = await client.channels.fetch(threadId);
  if (!thread || !thread.isThread()) {
    return 'Error: Not a valid thread';
  }
  
  await thread.leave();
  return `Left thread "${thread.name}" successfully`;
}