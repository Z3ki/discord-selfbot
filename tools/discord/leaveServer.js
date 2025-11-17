export const leaveServerTool = {
  name: 'leave_server',
  description: 'Leave a Discord server',
  parameters: {
    type: 'object',
    properties: {
      serverId: {
        type: 'string',
        description: 'The ID of the server to leave',
      },
    },
    required: ['serverId'],
  },
};

export async function executeLeaveServer(args, client) {
  try {
    const guild = client.guilds.cache.get(args.serverId);
    if (!guild) {
      return 'Server not found or not a member of this server';
    }

    await guild.leave();
    return `Successfully left server: ${guild.name} (ID: ${guild.id})`;
  } catch (error) {
    return 'Failed to leave server: ' + error.message;
  }
}
