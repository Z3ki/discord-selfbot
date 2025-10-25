export const addReactionTool = {
  name: 'add_reaction',
  description: 'Add a reaction emoji to a message',
  parameters: {
    type: 'object',
    properties: {
      channelId: { type: 'string' },
      messageId: { type: 'string' },
      emoji: { type: 'string' }
    },
    required: ['channelId', 'messageId', 'emoji']
  }
};

export async function executeAddReaction(args, client) {
  try {
    // Validate that args.channelId is actually a channel ID, not a user ID
    const { validateChannelId } = await import('../../utils/index.js');
    const channel = validateChannelId(client, args.channelId, 'reaction adding');
    const message = await channel.messages.fetch(args.messageId);
    await message.react(args.emoji);
    return 'Reaction added';
  } catch (error) {
    return 'Failed to add reaction: ' + error.message;
  }
}