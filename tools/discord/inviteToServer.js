export const inviteToServerTool = {
  name: 'invite_to_server',
  description: 'Create an invite link for a server by finding a suitable channel. Use this when users want to join a server the bot is in. The tool automatically finds a suitable channel and creates a single-use invite that expires in 24 hours.',
  parameters: {
    type: 'object',
    properties: {
      serverId: { type: 'string', description: 'The server ID to create an invite for (get this from get_server_list)' },
      maxAge: { type: 'number', description: 'Max age in seconds (0 for never, default 86400/24 hours)' },
      maxUses: { type: 'number', description: 'Max uses (0 for unlimited, default 1)' }
    },
    required: ['serverId']
  }
};

export async function executeInviteToServer(args, client) {
  try {
    const guild = client.guilds.cache.get(args.serverId);
    if (!guild) return 'Server not found or bot is not in that server';

    // Find a suitable channel to create invite from
    // Prefer general, main, or welcome channels, otherwise first text channel
    let inviteChannel = null;

    // Try to find common channel names
    const preferredNames = ['general', 'main', 'welcome', 'lobby', 'chat'];
    // Check if client.user is available
    if (!client.user) {
      return 'Error: Bot user not available - client may not be fully initialized';
    }
    
    for (const name of preferredNames) {
      inviteChannel = guild.channels.cache.find(c =>
        c.type === 0 && // TEXT channel
        c.name.toLowerCase().includes(name) &&
        c.permissionsFor(client.user).has('CreateInstantInvite')
      );
      if (inviteChannel) break;
    }

    // If no preferred channel found, use first available text channel
    if (!inviteChannel) {
      inviteChannel = guild.channels.cache.find(c =>
        c.type === 0 && // TEXT channel
        c.permissionsFor(client.user).has('CreateInstantInvite')
      );
    }

    if (!inviteChannel) {
      return 'No suitable channel found to create invite (bot lacks permission to create invites)';
    }

    const invite = await inviteChannel.createInvite({
      maxAge: args.maxAge || 86400, // 24 hours default
      maxUses: args.maxUses || 1 // Single use default
    });

    return `Invite created for ${guild.name}: ${invite.url} (expires in ${args.maxAge || 86400} seconds, max uses: ${args.maxUses || 1})`;
  } catch (error) {
    return 'Failed to create server invite: ' + error.message;
  }
}