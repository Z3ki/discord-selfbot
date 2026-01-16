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
  // Handle both parameter names for compatibility
  const { inviteLink, invite } = args;
  const inviteInput = (inviteLink || invite)?.trim();

  if (!inviteInput) {
    return 'Failed to join server: inviteLink parameter is required';
  }

  // Validate invite format
  const inviteCode =
    inviteInput.match(/discord\.gg\/([a-zA-Z0-9]+)/)?.[1] || inviteInput;
  if (!/^[a-zA-Z0-9]+$/.test(inviteCode)) {
    return 'Invalid invite format. Expected discord.gg/XXXXXX or just the code';
  }

  if (!client || !client.ready) {
    return 'Failed to join server: Discord client is not ready';
  }

  try {
    // Use the newer invite accept method
    const invite = await client.fetchInvite(inviteInput);
    await invite.accept();
    return `Successfully joined server: ${invite.guild?.name || inviteInput}`;
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
