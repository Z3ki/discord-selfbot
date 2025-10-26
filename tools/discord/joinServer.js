/**
 * Join Discord servers using invite links
 */

export const joinServerTool = {
  name: 'join_server',
  description: 'Join a Discord server using an invite link or invite code',
  parameters: {
    type: 'object',
    properties: {
      invite: {
        type: 'string',
        description: 'Discord invite link (https://discord.gg/XXXXX) or invite code (XXXXX)'
      }
    },
    required: ['invite']
  }
};

export async function executeJoinServer(args, client) {
  try {
    const { invite } = args;
    if (!invite) {
      return {
        success: false,
        error: 'Missing required parameter: invite'
      };
    }

    if (!client) {
      return {
        success: false,
        error: 'Discord client not available'
      };
    }

    // Extract invite code from full link if provided
    let inviteCode = invite;
    if (invite.includes('discord.gg/')) {
      inviteCode = invite.split('discord.gg/')[1]?.split('?')[0];
    } else if (invite.includes('discord.com/invite/')) {
      inviteCode = invite.split('discord.com/invite/')[1]?.split('?')[0];
    }

    if (!inviteCode) {
      return {
        success: false,
        error: 'Invalid invite format. Please provide a valid Discord invite link or code.'
      };
    }

    try {
      // Join the server using the invite code
      const result = await client.acceptInvite(inviteCode);
      
      return {
        success: true,
        message: `Successfully joined server using invite code: ${inviteCode}`,
        inviteCode: inviteCode,
        result: result
      };
    } catch (error) {
      // Handle common Discord API errors
      if (error.message.includes('Unknown Invite')) {
        return {
          success: false,
          error: `Invalid or expired invite: ${inviteCode}`
        };
      }
      if (error.message.includes('Banned')) {
        return {
          success: false,
          error: `Cannot join server: You are banned from this server`
        };
      }
      if (error.message.includes('Already Joined')) {
        return {
          success: false,
          error: `You are already a member of this server`
        };
      }
      if (error.message.includes('Full')) {
        return {
          success: false,
          error: `Server is full and cannot accept new members`
        };
      }
      
      return {
        success: false,
        error: `Failed to join server: ${error.message}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to join server: ${error.message}`
    };
  }
}