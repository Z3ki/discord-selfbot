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
      logger.warn(`Unknown tool called: ${funcName}`, { availableTools: Array.from(this.registry.tools.keys()) });
      return `Unknown tool: ${funcName}. Available tools: ${Array.from(this.registry.tools.keys()).join(', ')}`;
    }

    try {
      // Validate required parameters
      if (tool.parameters && tool.parameters.required) {
        const missingParams = tool.parameters.required.filter(param => !(param in args));
        if (missingParams.length > 0) {
          logger.warn(`Missing required parameters for tool ${funcName}`, { missing: missingParams, provided: Object.keys(args) });
          return `Error: Missing required parameters for ${funcName}: ${missingParams.join(', ')}`;
        }
      }

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

        

        default:
          logger.warn(`No execution function found for tool: ${funcName}`);
          return `Tool ${funcName} not implemented`;
      }

    } catch (error) {
      const errorMessage = error.message || 'Unknown error';
      const errorCode = error.code || 'UNKNOWN';
      
      // Categorize errors for better handling
      if (errorMessage.includes('Missing Access') || errorCode === 50001) {
        logger.warn(`Access denied for tool ${funcName} - likely selfbot restriction`, { 
          funcName, 
          error: errorMessage, 
          code: errorCode 
        });
        return `Access denied: ${funcName} cannot be executed due to Discord API restrictions. This is normal for selfbots.`;
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        logger.warn(`Rate limit hit for tool ${funcName}`, { funcName, error: errorMessage });
        return `Rate limited: ${funcName} is temporarily unavailable due to rate limits. Please try again later.`;
      } else if (errorMessage.includes('timeout')) {
        logger.warn(`Timeout executing tool ${funcName}`, { funcName, error: errorMessage });
        return `Timeout: ${funcName} took too long to execute. Please try again.`;
      } else {
        logger.error(`Error executing tool ${funcName}:`, { 
          funcName, 
          error: errorMessage, 
          code: errorCode,
          stack: error.stack 
        });
        return `Error executing ${funcName}: ${errorMessage}`;
      }
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