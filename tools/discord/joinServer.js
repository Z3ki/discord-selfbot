export const joinServerTool = {
  name: 'join_server',
  description: 'Join a Discord server using an invite link',
  parameters: {
    type: 'object',
    properties: {
      inviteLink: {
        type: 'string',
        description: 'The invite link or code to join the server',
      },
    },
    required: ['inviteLink'],
  },
};

export async function executeJoinServer(args, client) {
  const inviteInput = args.inviteLink.trim();
  if (!inviteInput) {
    return 'Failed to join server: inviteLink cannot be empty';
  }

  if (!client || !client.ready) {
    return 'Failed to join server: Discord client is not ready';
  }

  try {
    await client.acceptInvite(inviteInput);
    return `Successfully joined server with invite: ${inviteInput}`;
  } catch (inviteError) {
    // Handle CAPTCHA requirement
    if (
      inviteError.message &&
      (inviteError.message.includes('CAPTCHA') ||
        inviteError.message.includes('captcha') ||
        inviteError.message.includes('verification'))
    ) {
      const fullInviteLink = inviteInput.startsWith('http')
        ? inviteInput
        : `https://discord.gg/${inviteInput}`;

      return `**CAPTCHA Required** for server invite: ${inviteInput}

Discord is requiring verification to join this server.

**Manual Join Required:**
Click this link to join manually: ${fullInviteLink}

You'll need to solve the CAPTCHA in your browser to join this server.`;
    }

    // Handle specific Discord errors
    if (inviteError.code === 10006) {
      return 'Failed to join server: Invalid or expired invite link';
    }

    throw inviteError;
  }
}
