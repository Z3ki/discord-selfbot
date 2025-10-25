export const pinMessageTool = {
  name: 'pin_message',
  description: 'Pin a message in a channel',
  parameters: {
    type: 'object',
    properties: {
      channelId: { type: 'string' },
      messageId: { type: 'string' }
    },
    required: ['channelId', 'messageId']
  }
};

export async function executePinMessage(args, client) {
  try {
    // Validate that args.channelId is actually a channel ID, not a user ID
    const { validateChannelId } = await import('../../utils/index.js');
    const channel = validateChannelId(client, args.channelId, 'message pinning');
    const message = await channel.messages.fetch(args.messageId);
    await message.pin();
    return 'Message pinned successfully';
  } catch (error) {
    return 'Failed to pin message: ' + error.message;
  }
}