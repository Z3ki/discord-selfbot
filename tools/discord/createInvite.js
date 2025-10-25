export const createInviteTool = {
  name: 'create_invite',
  description: 'Create an invite link for a channel',
  parameters: {
    type: 'object',
    properties: {
      channelId: { type: 'string' },
      maxAge: { type: 'number', description: 'Max age in seconds (0 for never)' },
      maxUses: { type: 'number', description: 'Max uses (0 for unlimited)' }
    },
    required: ['channelId']
  }
};

export async function executeCreateInvite(args, client) {
  try {
    // Validate that args.channelId is actually a channel ID, not a user ID
    const { validateChannelId } = await import('../../utils/index.js');
    const channel = validateChannelId(client, args.channelId, 'invite creation');
    const invite = await channel.createInvite({
      maxAge: args.maxAge || 0,
      maxUses: args.maxUses || 0
    });
    return `Invite created: ${invite.url}`;
  } catch (error) {
    return 'Failed to create invite: ' + error.message;
  }
}