export const createThreadTool = {
  name: 'create_thread',
  description: 'Create a thread from a message',
  parameters: {
    type: 'object',
    properties: {
      channelId: { type: 'string' },
      messageId: { type: 'string' },
      name: { type: 'string' },
      autoArchiveDuration: { type: 'number' }
    },
    required: ['channelId', 'messageId', 'name']
  }
};

export async function executeCreateThread(args, client) {
  try {
    // Validate that args.channelId is actually a channel ID, not a user ID
    const { validateChannelId } = await import('../../utils/index.js');
    const channel = validateChannelId(client, args.channelId, 'thread creation');
    const message = await channel.messages.fetch(args.messageId);
    const thread = await channel.threads.create({
      name: args.name,
      startMessage: message,
      autoArchiveDuration: args.autoArchiveDuration || 60
    });
    return `Thread created: ${thread.id}`;
  } catch (error) {
    return 'Failed to create thread: ' + error.message;
  }
}