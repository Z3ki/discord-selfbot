import { sendDMTool } from './communication/sendDM.js';

import { changePresenceTool } from './discord/changePresence.js';

import { reactionManagerTool } from './discord/reactionManager.js';

import { joinServerTool } from './discord/joinServer.js';

import { leaveServerTool } from './discord/leaveServer.js';



import { dockerExecTool } from './system/dockerExec.js';

import { wikipediaInfoTool } from './information/wikipedia.js';




// Combine all tools
export const tools = [
  sendDMTool,
  changePresenceTool,
  reactionManagerTool,
  joinServerTool,
  leaveServerTool,
  dockerExecTool,
  wikipediaInfoTool,
];

// Tool registry for execution
export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.registerTools();
  }

  registerTools() {
    tools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getAllTools() {
    return tools;
  }

  getToolsText(serverId, bot) {
    // Group tools by category
    const categories = {
      'COMMUNICATION': ['send_dm'],
      'DISCORD MANAGEMENT': ['change_presence', 'reaction_manager', 'join_server', 'leave_server'],
      'SYSTEM': [],
      'INFORMATION': ['wikipedia_info'],
      'RELATIONSHIPS': []
    };

    // Add docker_exec only if shell access is enabled for this server
    if ((serverId && bot && bot.shellAccessServers && bot.shellAccessServers.get(serverId)) || (!serverId && bot && bot.shellAccessDMs)) {
      categories['SYSTEM'].push('docker_exec');
    }

    const sections = [];

    for (const [category, toolNames] of Object.entries(categories)) {
      const categoryTools = tools.filter(tool => toolNames.includes(tool.name));
      if (categoryTools.length > 0) {
        const toolTexts = categoryTools.map(tool => {
          const params = Object.entries(tool.parameters.properties || {})
            .map(([key, prop]) => {
              const required = tool.parameters.required?.includes(key) ? ' (required)' : ' (optional)';
              return `  ${key}: ${prop.type}${required}`;
            })
            .join('\n');

          return `${tool.name}: ${tool.description}\nParameters:\n${params}`;
        });

        sections.push(`--- ${category} ---\n${toolTexts.join('\n\n')}`);
      }
    }

    return sections.join('\n\n');
  }
}

export const toolRegistry = new ToolRegistry();
