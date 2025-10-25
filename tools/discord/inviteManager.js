export const inviteManagerTool = {
  name: 'invite_manager',
  description: 'Manage Discord server invites (create, join, get server invites)',
  parameters: {
    type: 'object',
    properties: {
      action: { 
        type: 'string', 
        enum: ['create_channel', 'create_server', 'join', 'get_server_invites'],
        description: 'Action to perform: create_channel (for specific channel), create_server (for server), join (server), get_server_invites'
      },
      channelId: { 
        type: 'string', 
        description: 'Channel ID for create_channel action' 
      },
      serverId: { 
        type: 'string', 
        description: 'Server ID for create_server action' 
      },
      inviteLink: { 
        type: 'string', 
        description: 'Invite link or code for join action' 
      },
      maxAge: { 
        type: 'number', 
        description: 'Max age in seconds (0 for never, default varies by action)' 
      },
      maxUses: { 
        type: 'number', 
        description: 'Max uses (0 for unlimited, default varies by action)' 
      }
    },
    required: ['action']
  }
};

export async function executeInviteManager(args, client) {
  try {
    switch (args.action) {
      case 'create_channel':
        if (!args.channelId) {
          return 'Error: channelId is required for create_channel action';
        }
        return await createChannelInvite(args, client);

      case 'create_server':
        if (!args.serverId) {
          return 'Error: serverId is required for create_server action';
        }
        return await createServerInvite(args, client);

      case 'join':
        if (!args.inviteLink) {
          return 'Error: inviteLink is required for join action';
        }
        return await joinServer(args, client);

      case 'get_server_invites':
        if (!args.serverId) {
          return 'Error: serverId is required for get_server_invites action';
        }
        return await getServerInvites(args, client);

      default:
        return 'Error: Invalid action. Use create_channel, create_server, join, or get_server_invites';
    }
  } catch (error) {
    return `Failed to manage invites: ${error.message}`;
  }
}

async function createChannelInvite(args, client) {
  const { validateChannelId } = await import('../../utils/index.js');
  const channel = validateChannelId(client, args.channelId, 'invite creation');
  
  const invite = await channel.createInvite({
    maxAge: args.maxAge || 0,
    maxUses: args.maxUses || 0
  });
  
  return `Channel invite created: ${invite.url}`;
}

async function createServerInvite(args, client) {
  const guild = client.guilds.cache.get(args.serverId);
  if (!guild) return 'Server not found or bot is not in that server';

  // Find a suitable channel to create invite from
  let inviteChannel = null;

  // Check if client.user is available
  if (!client.user) {
    return 'Error: Bot user not available - client may not be fully initialized';
  }
  
  // Try to find common channel names
  const preferredNames = ['general', 'main', 'welcome', 'lobby', 'chat'];
  
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

  return `Server invite created for ${guild.name}: ${invite.url} (expires in ${args.maxAge || 86400} seconds, max uses: ${args.maxUses || 1})`;
}

async function joinServer(args, client) {
  const inviteInput = args.inviteLink.trim();
  if (!inviteInput) {
    return 'Failed to join server: inviteLink cannot be empty';
  }

  // Extract invite code from the link
  let inviteCode;
  try {
    if (inviteInput.includes('/')) {
      inviteCode = inviteInput.split('/').pop().split('?')[0];
    } else {
      inviteCode = inviteInput;
    }
  } catch (parseError) {
    return 'Failed to join server: Invalid invite link format';
  }

  if (!inviteCode) {
    return 'Failed to join server: Could not extract invite code from link';
  }

  try {
    await client.acceptInvite(inviteCode);
    return `Successfully joined server with invite: ${inviteCode}`;
  } catch (inviteError) {
    // Handle CAPTCHA requirement
    if (inviteError.message && (
      inviteError.message.includes('CAPTCHA') || 
      inviteError.message.includes('captcha') ||
      inviteError.message.includes('verification')
    )) {
      const fullInviteLink = inviteInput.includes('/') ? inviteInput : `https://discord.gg/${inviteCode}`;
      
      return `**CAPTCHA Required** for server invite: ${inviteCode}

Discord is requiring verification to join this server.

**Manual Join Required:**
Click this link to join manually: ${fullInviteLink}

You'll need to solve the CAPTCHA in your browser to join this server.`;
    }
    
    // Try alternative join method for selfbot
    try {
      // Attempt to join using the full URL
      if (inviteInput.startsWith('http')) {
        await client.acceptInvite(inviteInput);
        return `Successfully joined server with invite: ${inviteInput}`;
      }
    } catch (altError) {
      // If both methods fail, return the original error
      throw inviteError;
    }
    
    throw inviteError;
  }
}

async function getServerInvites(args, client) {
  const guild = client.guilds.cache.get(args.serverId);
  if (!guild) return 'Server not found or bot is not in that server';

  try {
    const invites = await guild.invites.fetch();
    if (invites.size === 0) {
      return 'No invites found for this server';
    }

    const inviteList = invites.map(invite => ({
      code: invite.code,
      url: invite.url,
      channel: invite.channel?.name || 'Unknown',
      uses: invite.uses,
      maxUses: invite.maxUses,
      temporary: invite.temporary,
      createdAt: invite.createdAt?.toISOString(),
      expiresAt: invite.expiresAt?.toISOString(),
      inviter: invite.inviter?.tag || 'Unknown'
    }));

    return JSON.stringify(inviteList, null, 2);
  } catch (error) {
    return `Failed to fetch server invites: ${error.message}`;
  }
}