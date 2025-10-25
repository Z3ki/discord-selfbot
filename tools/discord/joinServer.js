export const joinServerTool = {
  name: 'join_server',
  description: 'Join a Discord server using an invite link or invite code',
  parameters: {
    type: 'object',
    properties: {
      inviteLink: { type: 'string', description: 'The invite link (e.g., https://discord.gg/abc123) or invite code (e.g., abc123) to join the server' }
    },
    required: ['inviteLink']
  }
};

export async function executeJoinServer(args, client) {
  try {
    // Validate input - accept both inviteLink and inviteCode for flexibility
    const inviteInput = args.inviteLink || args.inviteCode;
    if (!args || !inviteInput) {
      return 'Failed to join server: inviteLink parameter is required';
    }

    const inviteLink = inviteInput.trim();
    if (!inviteLink) {
      return 'Failed to join server: inviteLink cannot be empty';
    }

    // Extract invite code from the link
    let inviteCode;
    try {
      // Handle different invite link formats
      if (inviteLink.includes('/')) {
        inviteCode = inviteLink.split('/').pop().split('?')[0];
      } else {
        // Assume it's already just the code
        inviteCode = inviteLink;
      }
    } catch (parseError) {
      return 'Failed to join server: Invalid invite link format';
    }

    if (!inviteCode) {
      return 'Failed to join server: Could not extract invite code from link';
    }

    // Use the client's acceptInvite method (selfbot specific)
    try {
      await client.acceptInvite(inviteCode);
      return `Successfully joined server with invite: ${inviteCode}`;
    } catch (inviteError) {
      // Handle CAPTCHA requirement with simple manual guidance
      if (inviteError.message && (
        inviteError.message.includes('CAPTCHA') || 
        inviteError.message.includes('captcha') ||
        inviteError.message.includes('verification')
      )) {
        const fullInviteLink = inviteLink.includes('/') ? inviteLink : `https://discord.gg/${inviteCode}`;
        
        return `🔐 **CAPTCHA Required** for server invite: ${inviteCode}

Discord is requiring verification to join this server.

**Manual Join Required:**
Click this link to join manually: ${fullInviteLink}

You'll need to solve the CAPTCHA in your browser to join this server.`;
      }
      throw inviteError;
    }
  } catch (error) {
    return 'Failed to join server: ' + error.message;
  }
}