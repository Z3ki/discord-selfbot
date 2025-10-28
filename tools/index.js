import { sendDMTool } from './communication/sendDM.js';
import { updateContextTool } from './communication/updateContext.js';

import { changePresenceTool } from './discord/changePresence.js';

import { reactionManagerTool } from './discord/reactionManager.js';
import { inviteManagerTool } from './discord/inviteManager.js';

import { messageManagerTool } from './discord/messageManager.js';

import { leaveServerTool } from './discord/leaveServer.js';

 
import { dockerExecTool } from './system/dockerExec.js';


import { handleFriendRequestTool } from './relationship/handleFriendRequest.js';
import { checkFriendRequestsTool } from './relationship/checkFriendRequests.js';
import { sendFriendRequestTool } from './relationship/sendFriendRequest.js';




// Combine all tools
export const tools = [
  sendDMTool,
  updateContextTool,
  changePresenceTool,
  reactionManagerTool,
  inviteManagerTool,

  messageManagerTool,

  leaveServerTool,
   dockerExecTool,
  handleFriendRequestTool,
  checkFriendRequestsTool,
  sendFriendRequestTool,

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
      'COMMUNICATION': ['send_dm', 'update_context'],
       'DISCORD MANAGEMENT': ['change_presence', 'reaction_manager', 'invite_manager', 'message_manager', 'leave_server'],

      'SYSTEM': [],
      'RELATIONSHIPS': ['handle_friend_request', 'check_friend_requests', 'send_friend_request']
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
