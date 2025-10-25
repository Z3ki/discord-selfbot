import { toolRegistry } from './index.js';
import { getDMMetadata, loadUserContext } from '../utils/index.js';
import { processMessageMedia } from '../media.js';
import { logger } from '../utils/logger.js';

// Import tool execution functions
import { executeSendDM } from './communication/sendDM.js';
import { executeUpdateContext } from './communication/updateContext.js';

import { executeChangePresence } from './discord/changePresence.js';

import { executeAddReaction } from './discord/addReaction.js';
import { executeRemoveReaction } from './discord/removeReaction.js';
import { executeGetReactions } from './discord/getReactions.js';
import { executeCreateThread } from './discord/createThread.js';
import { executeArchiveThread } from './discord/archiveThread.js';
import { executeJoinThread } from './discord/joinThread.js';
import { executeLeaveThread } from './discord/leaveThread.js';
import { executeGetMemberList } from './discord/getMemberList.js';
import { executeGetChannelPermissions } from './discord/getChannelPermissions.js';
import { executePinMessage } from './discord/pinMessage.js';
import { executeUnpinMessage } from './discord/unpinMessage.js';
import { executeGetPinnedMessages } from './discord/getPinnedMessages.js';
import { executeGetChannelInfo } from './discord/getChannelInfo.js';
import { executeGetServerInfo } from './discord/getServerInfo.js';
import { executeCreateInvite } from './discord/createInvite.js';
import { executeGetInvites } from './discord/getInvites.js';
import { executeGetServerList } from './discord/getServerList.js';
import { executeInviteToServer } from './discord/inviteToServer.js';
import { executeJoinServer } from './discord/joinServer.js';
import { executeLeaveServer } from './discord/leaveServer.js';
import { executeSetPrompt } from './system/setPrompt.js';
import { executeCalculate } from './system/calculate.js';
import { executeReasonComplex } from './system/reasonComplex.js';
import { executeInvestigateUser } from './investigation/investigateUser.js';

import { executeGetUserProfileComplete } from './investigation/getUserProfileComplete.js';

import { executeHandleFriendRequest } from './relationship/handleFriendRequest.js';
import { executeCheckFriendRequests } from './relationship/checkFriendRequests.js';

import { executeAnalyzeArgument } from './reasoning/analyzeArgument.js';
import { executeDebugCode } from './reasoning/debugCode.js';
import { executeEvaluateEvidence } from './reasoning/evaluateEvidence.js';
import { executeSolveEquation } from './reasoning/solveEquation.js';

export class ToolExecutor {
  constructor() {
    this.registry = toolRegistry;
  }

  /**
   * Execute a tool call
   */
  async executeTool(call, message, client, providerManager, channelMemories, dmOrigins, globalPrompt, apiResourceManager) {
    const { funcName, args } = call;
    const tool = this.registry.getTool(funcName);

    if (!tool) {
      logger.warn(`Unknown tool called: ${funcName}`);
      return `Unknown tool: ${funcName}`;
    }

    try {
      logger.debug('Executing tool', { funcName, args: JSON.stringify(args), clientAvailable: !!client, clientReady: client?.readyAt });

      // Check if tool has embedded execute function
      if (tool.execute) {
        return await tool.execute(args, { message, client, providerManager, channelMemories, dmOrigins, globalPrompt, apiResourceManager });
      }

      // Route to appropriate execution function based on tool name
      switch (funcName) {
        case 'send_dm':
          return await executeSendDM(args, client, message, dmOrigins);
        case 'update_context':
          return await executeUpdateContext(args, client);

        case 'change_presence':
          return await executeChangePresence(args, client);
        case 'add_reaction':
          return await executeAddReaction(args, client);
        case 'remove_reaction':
          return await executeRemoveReaction(args, client, message);
        case 'get_reactions':
          return await executeGetReactions(args, client);
        case 'create_thread':
          return await executeCreateThread(args, client);
        case 'archive_thread':
          return await executeArchiveThread(args, client);
        case 'join_thread':
          return await executeJoinThread(args, client);
        case 'leave_thread':
          return await executeLeaveThread(args, client);
        case 'get_member_list':
          return await executeGetMemberList(args, client, message);
        case 'get_channel_permissions':
          return await executeGetChannelPermissions(args, client, message);
        case 'pin_message':
          return await executePinMessage(args, client);
        case 'unpin_message':
          return await executeUnpinMessage(args, client);
        case 'get_pinned_messages':
          return await executeGetPinnedMessages(args, client);
        case 'get_channel_info':
          return await executeGetChannelInfo(args, client);
        case 'get_server_info':
          return await executeGetServerInfo(args, message);
        case 'create_invite':
          return await executeCreateInvite(args, client);
        case 'get_invites':
          return await executeGetInvites(args, message);
        case 'get_server_list':
          return await executeGetServerList(args, client);
        case 'invite_to_server':
          return await executeInviteToServer(args, client);
        case 'join_server':
          return await executeJoinServer(args, client);
        case 'leave_server':
          return await executeLeaveServer(args, client);
        case 'set_prompt':
          return await executeSetPrompt(args, globalPrompt);
        case 'calculate':
          return await executeCalculate(args);
        case 'reason_complex':
          return await executeReasonComplex(args, message, client, providerManager);
        case 'investigate_user':
          return await executeInvestigateUser(args, client, message);
        case 'get_user_profile_complete':
          return await executeGetUserProfileComplete(args, client, message);

        case 'handle_friend_request':
          return await executeHandleFriendRequest(args, client);
        case 'check_friend_requests':
          return await executeCheckFriendRequests(args, client);

        case 'analyze_argument':
          return await executeAnalyzeArgument(args, message, client, providerManager);
        case 'debug_code':
          return await executeDebugCode(args, message, client, providerManager);
        case 'evaluate_evidence':
          return await executeEvaluateEvidence(args, message, client, providerManager);
        case 'solve_equation':
          return await executeSolveEquation(args, message, client, providerManager);

        default:
          logger.warn(`No execution function found for tool: ${funcName}`);
          return `Tool ${funcName} not implemented`;
      }

    } catch (error) {
      logger.error(`Error executing tool ${funcName}:`, error);
      return `Error executing ${funcName}: ${error.message}`;
    }
  }



  /**
   * Get tools text for AI prompt
   */
  getToolsText() {
    return this.registry.getToolsText();
  }

  /**
   * Utility methods for tools
   */
  async getDMMetadata(channelId) {
    return await getDMMetadata(channelId);
  }

  async loadUserContext() {
    return await loadUserContext();
  }

  async processMessageMedia(message) {
    return await processMessageMedia(message);
  }

  /**
   * Execute multiple tool calls
   */
  async executeTools(toolCalls, message, client, channelMemories, dmOrigins, providerManager, globalPrompt, lastPrompt, lastResponse, lastToolCalls, lastToolResults, apiResourceManager) {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(toolCall, message, client, providerManager, channelMemories, dmOrigins, globalPrompt, apiResourceManager);
        results.push({
          tool: toolCall.funcName,
          result: result
        });
      } catch (error) {
        logger.error(`Tool execution failed for ${toolCall.funcName}`, { error: error.message });
        results.push({
          tool: toolCall.funcName,
          result: `Error: ${error.message}`
        });
      }
    }

    return results;
  }
}