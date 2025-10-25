export const archiveThreadTool = {
  name: 'archive_thread',
  description: 'Archive a thread',
  parameters: {
    type: 'object',
    properties: {
      threadId: { type: 'string' }
    },
    required: ['threadId']
  }
};

export async function executeArchiveThread(args, client) {
  try {
    const thread = await client.channels.fetch(args.threadId);
    await thread.setArchived(true);
    return 'Thread archived';
  } catch (error) {
    return 'Failed to archive thread: ' + error.message;
  }
}