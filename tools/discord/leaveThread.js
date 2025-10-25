export const leaveThreadTool = {
  name: 'leave_thread',
  description: 'Leave a thread',
  parameters: {
    type: 'object',
    properties: {
      threadId: { type: 'string' }
    },
    required: ['threadId']
  }
};

export async function executeLeaveThread(args, client) {
  try {
    const thread = await client.channels.fetch(args.threadId);
    await thread.leave();
    return 'Left thread';
  } catch (error) {
    return 'Failed to leave thread: ' + error.message;
  }
}