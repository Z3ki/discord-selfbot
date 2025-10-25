export const getMemberListTool = {
  name: 'get_member_list',
  description: 'Get a list of server members',
  parameters: {
    type: 'object',
    properties: {
      serverId: { type: 'string' },
      limit: { type: 'number' }
    },
    required: []
  }
};

export async function executeGetMemberList(args, client, message) {
  try {
    const guild = args.serverId ? client.guilds.cache.get(args.serverId) : message.guild;
    if (!guild) return 'Guild not found';
    const members = await guild.members.fetch({ limit: args.limit || 50 });
    const memberList = members.map(m => `${m.user.username} (${m.user.id})`).join(', ');
    return `Members: ${memberList}`;
  } catch (error) {
    return 'Failed to get member list: ' + error.message;
  }
}