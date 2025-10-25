export const getServerListTool = {
  name: 'get_server_list',
  description: 'Get a list of all Discord servers the bot is currently in. Use this when users ask about servers the bot is in or want to see available servers.',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  }
};

export async function executeGetServerList(args, client) {
  try {
    const guilds = client.guilds.cache;
    const serverList = guilds.map(g => `${g.name} (${g.id}) - ${g.memberCount} members`).join('\n');
    return guilds.size > 0 ? `Bot is in ${guilds.size} servers:\n${serverList}` : 'Bot is not in any servers';
  } catch (error) {
    return 'Failed to get server list: ' + error.message;
  }
}