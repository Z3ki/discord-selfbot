import { sendDMTool } from './communication/sendDM.js';
import { updateContextTool } from './communication/updateContext.js';

import { changePresenceTool } from './discord/changePresence.js';

import { reactionManagerTool } from './discord/reactionManager.js';
import { inviteManagerTool } from './discord/inviteManager.js';
import { serverUtilsTool } from './discord/serverUtils.js';
import { messageManagerTool } from './discord/messageManager.js';
import { getServerListTool } from './discord/getServerList.js';
import { leaveServerTool } from './discord/leaveServer.js';
import { joinServerTool } from './discord/joinServer.js';
import { reasonComplexTool } from './system/reasonComplex.js';
import { investigateUserTool } from './investigation/investigateUser.js';

import { getUserProfileCompleteTool } from './investigation/getUserProfileComplete.js';


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
  serverUtilsTool,
  messageManagerTool,
  getServerListTool,
  leaveServerTool,
  joinServerTool,
  reasonComplexTool,
  investigateUserTool,
  getUserProfileCompleteTool,
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

  getToolsText() {
    // Group tools by category
    const categories = {
      'COMMUNICATION': ['send_dm', 'update_context'],
      'DISCORD MANAGEMENT': ['change_presence', 'reaction_manager', 'invite_manager', 'server_utils', 'message_manager', 'get_server_list', 'leave_server', 'join_server'],
      'INVESTIGATION': ['investigate_user', 'get_user_profile_complete'],
      'SYSTEM': ['reason_complex'],
      
      'RELATIONSHIPS': ['handle_friend_request', 'check_friend_requests', 'send_friend_request']
    };

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