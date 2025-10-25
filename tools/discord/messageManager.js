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
    required: ['action', 'channelId']
  }
};

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