// Input validation utility
function validateUserInput(input, maxLength = 4000, allowEmpty = false) {
  if (!allowEmpty && (!input || input.trim() === '')) {
    return { valid: false, error: 'Input cannot be empty' };
  }

  if (typeof input !== 'string') {
    return { valid: false, error: 'Invalid input type' };
  }

  if (input.length > maxLength) {
    return {
      valid: false,
      error: `Input exceeds maximum length of ${maxLength} characters`,
    };
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /javascript:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
    /onclick=/i,
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      return {
        valid: false,
        error: 'Input contains potentially dangerous content',
      };
    }
  }

  return { valid: true, sanitized: input.trim() };
}

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

  // Validate input
  const inputValidation = validateUserInput(inviteInput, 500);
  if (!inputValidation.valid) {
    return `Invalid invite link: ${inputValidation.error}`;
  }

  const sanitizedInput = inputValidation.sanitized;

  // Validate invite format
  const inviteCode =
    sanitizedInput.match(/discord\.gg\/([a-zA-Z0-9]+)/)?.[1] || sanitizedInput;
  if (!/^[a-zA-Z0-9]+$/.test(inviteCode)) {
    return 'Invalid invite format. Expected discord.gg/XXXXXX or just the code';
  }

  if (!client || !client.ready) {
    return 'Failed to join server: Discord client is not ready';
  }

  try {
    // Use newer invite accept method
    const invite = await client.fetchInvite(sanitizedInput);
    await invite.accept();
    return `Successfully joined server: ${invite.guild?.name || sanitizedInput}`;
  } catch (inviteError) {
    // Handle CAPTCHA requirement
    if (
      inviteError.message &&
      (inviteError.message.includes('CAPTCHA') ||
        inviteError.message.includes('captcha') ||
        inviteError.message.includes('verification'))
    ) {
      const fullInviteLink = sanitizedInput.startsWith('http')
        ? sanitizedInput
        : `https://discord.gg/${sanitizedInput}`;

      return `**CAPTCHA Required** for server invite: ${sanitizedInput}

Discord is requiring verification to join this server.

**Manual Join Required:**
Click this link to join manually: ${fullInviteLink}

You'll need to solve CAPTCHA in your browser to join this server.`;
    }

    // Handle specific Discord errors
    if (inviteError.code === 10006) {
      return 'Failed to join server: Invalid or expired invite link';
    }

    throw inviteError;
  }
}
