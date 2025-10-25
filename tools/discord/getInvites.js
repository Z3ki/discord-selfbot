export const getInvitesTool = {
  name: 'get_invites',
  description: 'Get all active invites for the server',
  parameters: {
    type: 'object',
    properties: {}
  }
};

export async function executeGetInvites(args, message) {
  try {
    const guild = message.guild;
    if (!guild) return 'Not in a server';
    const invites = await guild.invites.fetch();
    const inviteList = invites.map(inv => `${inv.code}: ${inv.uses}/${inv.maxUses} uses, expires ${inv.expiresAt || 'never'}`).join('\n');
    return invites.size > 0 ? `Active invites:\n${inviteList}` : 'No active invites';
  } catch (error) {
    return 'Failed to get invites: ' + error.message;
  }
}