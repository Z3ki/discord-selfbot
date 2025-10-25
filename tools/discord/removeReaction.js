// Helper function to resolve user identifier (ID or username) to user ID
async function resolveUserId(identifier, client, message) {
  // Check for mention format <@id> or <@!id>
  const mentionMatch = identifier.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return mentionMatch[1];
  }

  // If it's already a numeric ID, return it
  if (/^\d+$/.test(identifier)) {
    return identifier;
  }

  // Otherwise, search for username/display name in the guild
  if (message.guild) {
    try {
      const member = message.guild.members.cache.find(m =>
        m.user.username.toLowerCase() === identifier.toLowerCase() ||
        (m.displayName && m.displayName.toLowerCase() === identifier.toLowerCase()) ||
        m.user.tag.toLowerCase() === identifier.toLowerCase()
      );
      if (member) {
        return member.id;
      }
    } catch (error) {
      logger.error('Error resolving user:', error);
    }
  }

  // Fallback: try to fetch user directly (for DMs or global) - only works with ID
  try {
    const user = await client.users.fetch(identifier);
    return user.id;
  } catch (error) {
    throw new Error(`Could not resolve user: ${identifier}`);
  }
}

export const removeReactionTool = {
  name: 'remove_reaction',
  description: 'Remove a reaction from a message',
  parameters: {
    type: 'object',
    properties: {
      channelId: { type: 'string' },
      messageId: { type: 'string' },
      emoji: { type: 'string' },
      userId: { type: 'string', description: 'User identifier: ID, username, display name, or mention (optional, defaults to bot)' }
    },
    required: ['channelId', 'messageId', 'emoji']
  }
};

export async function executeRemoveReaction(args, client, message) {
  try {
    // Validate that args.channelId is actually a channel ID, not a user ID
    const { validateChannelId, validateUserId } = await import('../../utils/index.js');
    const channel = validateChannelId(client, args.channelId, 'reaction removal');

    // Validate userId if provided
    if (args.userId) {
      validateUserId(client, args.userId, 'reaction removal');
    }
    const messageObj = await channel.messages.fetch(args.messageId);
    
    // Check if client.user is available
    if (!client.user && !args.userId) {
      return 'Error: Bot user not available - client may not be fully initialized';
    }
    
    const user = args.userId ? await client.users.fetch(await resolveUserId(args.userId, client, message)) : client.user;
    await messageObj.reactions.resolve(args.emoji).users.remove(user);
    return 'Reaction removed';
  } catch (error) {
    return 'Failed to remove reaction: ' + error.message;
  }
}