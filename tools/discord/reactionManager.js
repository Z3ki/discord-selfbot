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
      const member = message.guild.members.cache.find(
        (m) =>
          m.user.username.toLowerCase() === identifier.toLowerCase() ||
          (m.displayName &&
            m.displayName.toLowerCase() === identifier.toLowerCase()) ||
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

export const reactionManagerTool = {
  name: 'reaction_manager',
  description: 'Manage reactions on messages (add, remove, get reactions)',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'remove', 'get'],
        description: 'Action to perform: add, remove, or get reactions',
      },
      channelId: { type: 'string' },
      messageId: { type: 'string' },
      emoji: {
        type: 'string',
        description: 'Emoji to add/remove (required for add/remove)',
      },
      userId: {
        type: 'string',
        description:
          'User identifier: ID, username, display name, or mention (optional for remove, defaults to bot)',
      },
    },
    required: ['action', 'channelId', 'messageId'],
  },
};

export async function executeReactionManager(args, client, message) {
  try {
    const { validateChannelId, validateUserId } = await import(
      '../../utils/index.js'
    );
    const channel = validateChannelId(
      client,
      args.channelId,
      'reaction management'
    );
    const messageObj = await channel.messages.fetch(args.messageId);

    switch (args.action) {
      case 'add':
        if (!args.emoji) {
          return 'Error: emoji is required for add action';
        }
        await messageObj.react(args.emoji);
        return 'Reaction added successfully';

      case 'remove':
        if (!args.emoji) {
          return 'Error: emoji is required for remove action';
        }

        // Validate userId if provided
        if (args.userId) {
          validateUserId(client, args.userId, 'reaction removal');
        }

        // Check if client.user is available
        if (!client.user && !args.userId) {
          return 'Error: Bot user not available - client may not be fully initialized';
        }

        const user = args.userId
          ? await client.users.fetch(
              await resolveUserId(args.userId, client, message)
            )
          : client.user;

        await messageObj.reactions.resolve(args.emoji).users.remove(user);
        return 'Reaction removed successfully';

      case 'get':
        const reactions = [];
        messageObj.reactions.cache.forEach((reaction, emoji) => {
          reactions.push({
            emoji: emoji,
            count: reaction.count,
            users: reaction.users.cache.map((u) => u.tag),
          });
        });
        return JSON.stringify(reactions, null, 2);

      default:
        return 'Error: Invalid action. Use add, remove, or get';
    }
  } catch (error) {
    return `Failed to manage reactions: ${error.message}`;
  }
}
