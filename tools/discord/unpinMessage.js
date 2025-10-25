export const unpinMessageTool = {
  name: 'unpin_message',
  description: 'Unpin a message in a channel',
  parameters: {
    type: 'object',
    properties: {
      channelId: { type: 'string' },
      messageId: { type: 'string' }
    },
    required: ['channelId', 'messageId']
  }
};

export async function executeUnpinMessage(args, client) {
  try {
    // Validate that args.channelId is actually a channel ID, not a user ID
    const { validateChannelId } = await import('../../utils/index.js');
    const channel = validateChannelId(client, args.channelId, 'message unpinning');
    const message = await channel.messages.fetch(args.messageId);
    await message.unpin();
    return 'Message unpinned successfully';
  } catch (error) {
    return 'Failed to unpin message: ' + error.message;
  }
}