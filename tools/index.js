import { sendDMTool } from './communication/sendDM.js';
import { updateContextTool } from './communication/updateContext.js';

import { changePresenceTool } from './discord/changePresence.js';

import { addReactionTool } from './discord/addReaction.js';
import { removeReactionTool } from './discord/removeReaction.js';
import { getReactionsTool } from './discord/getReactions.js';
import { createThreadTool } from './discord/createThread.js';
import { archiveThreadTool } from './discord/archiveThread.js';
import { joinThreadTool } from './discord/joinThread.js';
import { leaveThreadTool } from './discord/leaveThread.js';
import { getMemberListTool } from './discord/getMemberList.js';
import { getChannelPermissionsTool } from './discord/getChannelPermissions.js';
import { pinMessageTool } from './discord/pinMessage.js';
import { unpinMessageTool } from './discord/unpinMessage.js';
import { getPinnedMessagesTool } from './discord/getPinnedMessages.js';
import { getChannelInfoTool } from './discord/getChannelInfo.js';
import { getServerInfoTool } from './discord/getServerInfo.js';

import { createInviteTool } from './discord/createInvite.js';
import { getInvitesTool } from './discord/getInvites.js';
import { getServerListTool } from './discord/getServerList.js';
import { inviteToServerTool } from './discord/inviteToServer.js';
import { joinServerTool } from './discord/joinServer.js';
import { leaveServerTool } from './discord/leaveServer.js';
import { setPromptTool } from './system/setPrompt.js';
import { calculateTool } from './system/calculate.js';
import { reasonComplexTool } from './system/reasonComplex.js';
import { investigateUserTool } from './investigation/investigateUser.js';

import { getUserProfileCompleteTool } from './investigation/getUserProfileComplete.js';


import { handleFriendRequestTool } from './relationship/handleFriendRequest.js';
import { checkFriendRequestsTool } from './relationship/checkFriendRequests.js';

import { analyzeArgumentTool } from './reasoning/analyzeArgument.js';
import { debugCodeTool } from './reasoning/debugCode.js';
import { evaluateEvidenceTool } from './reasoning/evaluateEvidence.js';
import { solveEquationTool } from './reasoning/solveEquation.js';


// Combine all tools
export const tools = [
  sendDMTool,
  updateContextTool,
  changePresenceTool,
  addReactionTool,
  removeReactionTool,
  getReactionsTool,
  createThreadTool,
  archiveThreadTool,
  joinThreadTool,
  leaveThreadTool,
  getMemberListTool,
  getChannelPermissionsTool,
  pinMessageTool,
  unpinMessageTool,
  getPinnedMessagesTool,
  getChannelInfoTool,
  getServerInfoTool,
  createInviteTool,
  getInvitesTool,
  getServerListTool,
  inviteToServerTool,
  joinServerTool,
  leaveServerTool,
   setPromptTool,
   calculateTool,
   reasonComplexTool,
   investigateUserTool,
  getUserProfileCompleteTool,

  handleFriendRequestTool,
  checkFriendRequestsTool,
  analyzeArgumentTool,
  debugCodeTool,
  evaluateEvidenceTool,
  solveEquationTool
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
      'DISCORD MANAGEMENT': ['change_presence', 'add_reaction', 'remove_reaction', 'get_reactions', 'create_thread', 'archive_thread', 'join_thread', 'leave_thread', 'pin_message', 'unpin_message', 'get_pinned_messages', 'get_channel_info', 'get_server_info', 'create_invite', 'get_invites', 'get_server_list', 'invite_to_server', 'join_server', 'leave_server', 'get_member_list', 'get_channel_permissions'],
      'INVESTIGATION': ['investigate_user', 'get_user_profile_complete'],
      'SYSTEM': ['set_prompt', 'calculate', 'reason_complex'],
      'REASONING': ['analyze_argument', 'debug_code', 'evaluate_evidence', 'solve_equation'],
      'RELATIONSHIPS': ['handle_friend_request', 'check_friend_requests']
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