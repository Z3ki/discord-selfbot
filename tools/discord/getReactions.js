export const getReactionsTool = {
  name: 'get_reactions',
  description: 'Get users who reacted to a message with a specific emoji',
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

export async function executeGetReactions(args, client) {
  try {
    // Validate that args.channelId is actually a channel ID, not a user ID
    const { validateChannelId } = await import('../../utils/index.js');
    const channel = validateChannelId(client, args.channelId, 'reaction retrieval');
    const message = await channel.messages.fetch(args.messageId);
    const reaction = message.reactions.resolve(args.emoji);
    if (!reaction) return 'No such reaction';
    const users = await reaction.users.fetch();
    const userList = users.map(u => `${u.username} (${u.id})`).join(', ');
    return `Users who reacted with ${args.emoji}: ${userList}`;
  } catch (error) {
    return 'Failed to get reactions: ' + error.message;
  }
}