import { toolRegistry } from './index.js';
import { getDMMetadata, loadUserContext } from '../utils/index.js';
import { processMessageMedia } from '../media.js';
import { logger } from '../utils/logger.js';

// Import tool execution functions
import { executeSendDM } from './communication/sendDM.js';
import { executeUpdateContext } from './communication/updateContext.js';

import { executeChangePresence } from './discord/changePresence.js';

import { executeReactionManager } from './discord/reactionManager.js';
import { executeInviteManager } from './discord/inviteManager.js';
import { executeServerUtils } from './discord/serverUtils.js';
import { executeMessageManager } from './discord/messageManager.js';
import { executeGetServerList } from './discord/getServerList.js';
import { executeLeaveServer } from './discord/leaveServer.js';
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
        case 'reaction_manager':
          return await executeReactionManager(args, client, message);
        case 'invite_manager':
          return await executeInviteManager(args, client);
        case 'server_utils':
          return await executeServerUtils(args, client, message);
        case 'message_manager':
          return await executeMessageManager(args, client);
        case 'get_server_list':
          return await executeGetServerList(args, client);
        case 'leave_server':
          return await executeLeaveServer(args, client);
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