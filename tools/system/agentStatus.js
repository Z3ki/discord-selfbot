export const checkAgentStatusTool = {
  name: 'check_agent_status',
  description:
    'Check the status of running agents and their tasks. Use this to see if website creation or other long-running tasks are complete.',
  parameters: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description:
          'Specific agent ID to check (optional - if not provided, lists all agents)',
      },
      taskType: {
        type: 'string',
        description:
          'Filter by task type (optional - website_creation, code_review, etc.)',
      },
    },
    required: [],
  },
};

export async function executeCheckAgentStatus(args, context) {
  const { client } = context;
  const { agentId, taskType } = args;

  try {
    // Get subagent coordinator from bot instance
    const bot = context.bot || client.bot;
    if (!bot || !bot.subagentCoordinator) {
      return 'Error: Agent system not available';
    }

    const coordinator = bot.subagentCoordinator;

    if (agentId) {
      // Check specific agent
      const agent = coordinator.subagents.get(agentId);
      if (!agent) {
        return `Agent '${agentId}' not found. Available agents: ${Array.from(coordinator.subagents.keys()).join(', ')}`;
      }

      return `Agent '${agentId}':
- Status: ${agent.status}
- Capabilities: ${agent.capabilities.join(', ')}
- Created: ${new Date(agent.created).toISOString()}
- Active Tasks: ${agent.status === 'busy' ? '1' : '0'}`;
    }

    // List all agents
    let response = 'Active Agents:\n';
    let count = 0;

    for (const [id, agent] of coordinator.subagents) {
      if (!taskType || agent.capabilities.includes(taskType)) {
        response += `\n${id}:
- Status: ${agent.status}
- Capabilities: ${agent.capabilities.join(', ')}
- Created: ${new Date(agent.created).toISOString()}`;
        count++;
      }
    }

    if (count === 0) {
      response += '\nNo agents found';
      if (taskType) {
        response += ` with capability '${taskType}'`;
      }
    }

    return response;
  } catch (error) {
    return `Error checking agent status: ${error.message}`;
  }
}
