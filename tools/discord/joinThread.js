export const joinThreadTool = {
  name: 'join_thread',
  description: 'Join a thread',
  parameters: {
    type: 'object',
    properties: {
      threadId: { type: 'string' }
    },
    required: ['threadId']
  }
};

export async function executeJoinThread(args, client) {
  try {
    const thread = await client.channels.fetch(args.threadId);
    await thread.join();
    return 'Joined thread';
  } catch (error) {
    return 'Failed to join thread: ' + error.message;
  }
}