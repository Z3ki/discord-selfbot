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

export const getChannelPermissionsTool = {
  name: 'get_channel_permissions',
  description: 'Check permissions for a user/role in a channel',
  parameters: {
    type: 'object',
    properties: {
      channelId: { type: 'string' },
      userId: { type: 'string', description: 'User identifier: ID, username, display name, or mention' },
      roleId: { type: 'string' }
    },
    required: ['channelId']
  }
};

export async function executeGetChannelPermissions(args, client, message) {
  try {
    // Validate that args.channelId is actually a channel ID, not a user ID
    const { validateChannelId, validateUserId } = await import('../../utils/index.js');
    const channel = validateChannelId(client, args.channelId, 'permission checking');

    // Validate userId if provided
    if (args.userId) {
      validateUserId(client, args.userId, 'permission checking');
    }
    let permissions;
    if (args.userId) {
      const userId = await resolveUserId(args.userId, client, message);
      const user = await client.users.fetch(userId);
      const member = await channel.guild.members.fetch(user);
      permissions = channel.permissionsFor(member);
    } else if (args.roleId) {
      const role = channel.guild.roles.cache.get(args.roleId);
      permissions = channel.permissionsFor(role);
    } else {
      return 'Provide userId or roleId';
    }
    const permList = permissions.toArray().join(', ');
    return `Permissions: ${permList}`;
  } catch (error) {
    return 'Failed to get permissions: ' + error.message;
  }
}