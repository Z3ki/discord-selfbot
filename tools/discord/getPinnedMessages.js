export const getPinnedMessagesTool = {
  name: 'get_pinned_messages',
  description: 'Get all pinned messages in a channel',
  parameters: {
    type: 'object',
    properties: {
      channelId: { type: 'string' }
    },
    required: ['channelId']
  }
};

export async function executeGetPinnedMessages(args, client) {
  try {
    // Validate that args.channelId is actually a channel ID, not a user ID
    const { validateChannelId } = await import('../../utils/index.js');
    const channel = validateChannelId(client, args.channelId, 'pinned message retrieval');
    const pinned = await channel.messages.fetchPinned();
    const pinnedList = pinned.map(msg => `${msg.id}: ${msg.content.substring(0, 100)}...`).join('\n');
    return pinned.size > 0 ? `Pinned messages:\n${pinnedList}` : 'No pinned messages';
  } catch (error) {
    return 'Failed to get pinned messages: ' + error.message;
  }
}