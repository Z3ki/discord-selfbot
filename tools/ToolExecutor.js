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
 import { executeDockerExec } from './system/dockerExec.js';
 import { executeInvestigateUser } from './investigation/investigateUser.js';

import { executeGetUserProfileComplete } from './investigation/getUserProfileComplete.js';

import { executeHandleFriendRequest } from './relationship/handleFriendRequest.js';
import { executeCheckFriendRequests } from './relationship/checkFriendRequests.js';
import { executeSendFriendRequest } from './relationship/sendFriendRequest.js';



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
         case 'docker_exec':
           return await executeDockerExec(args);
         case 'investigate_user':
          return await executeInvestigateUser(args, client, message);
        case 'get_user_profile_complete':
          return await executeGetUserProfileComplete(args, client, message);

        case 'handle_friend_request':
          return await executeHandleFriendRequest(args, client);
        case 'check_friend_requests':
          return await executeCheckFriendRequests(args, client);
        case 'send_friend_request':
          return await executeSendFriendRequest(args, client);

        

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
  getToolsText(serverId, bot) {
    return this.registry.getToolsText(serverId, bot);
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
        // Special handling for docker_exec with live updates
        if (toolCall.funcName === 'docker_exec') {
          const result = await this.executeDockerExecWithUpdates(toolCall, message, client, providerManager, channelMemories, dmOrigins, globalPrompt, apiResourceManager);
          results.push({
            tool: toolCall.funcName,
            result: result
          });
        } else {
          const result = await this.executeTool(toolCall, message, client, providerManager, channelMemories, dmOrigins, globalPrompt, apiResourceManager);
          results.push({
            tool: toolCall.funcName,
            result: result
          });
        }
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

  /**
   * Execute docker_exec with live message updates
   */
  async executeDockerExecWithUpdates(toolCall, message, client, providerManager, channelMemories, dmOrigins, globalPrompt, apiResourceManager) {
    const { args } = toolCall;
    const { command } = args;

    // Send initial status message
    let statusMessage;
    try {
      const isDM = message.channel?.type === 'DM' || message.channel?.type === 1;
      const initialContent = `**Executing:** \`${command}\`\n**Status:** Starting...`;

      if (isDM) {
        statusMessage = await message.channel.send(initialContent);
      } else {
        statusMessage = await message.reply(initialContent);
      }

      logger.debug('Sent initial tool status message', { messageId: statusMessage.id });
    } catch (error) {
      logger.warn('Failed to send initial status message', { error: error.message });
    }

    // Execute the docker command with progress updates
    try {
      const result = await this.executeDockerExecWithProgress(toolCall, message, client, statusMessage);
      return result;
    } catch (error) {
      logger.error('Docker exec with updates failed', { error: error.message });

      // Update status message with error
      if (statusMessage) {
        try {
          const errorContent = `**Command failed:** \`${command}\`\n**Error:** ${error.message}`;
          await statusMessage.edit(errorContent);
        } catch (editError) {
          logger.warn('Failed to update error status', { error: editError.message });
        }
      }

      throw error;
    }
  }

  /**
   * Execute docker_exec with progress updates
   */
  async executeDockerExecWithProgress(toolCall, message, client, statusMessage) {
    const { args } = toolCall;
    const { command } = args;

    // Import the docker exec function
    const { executeDockerExec } = await import('./system/dockerExec.js');

    // Execute with progress callback
    let lastUpdate = 0;
    const progressCallback = async (progress) => {
      if (statusMessage && progress) {
        // Throttle updates to once per second to avoid spam
        const now = Date.now();
        if (now - lastUpdate < 1000 && !progress.completed) return;
        lastUpdate = now;

        try {
          let content = `**Executing:** \`${command}\`\n`;

          if (progress.status) {
            content += `**Status:** ${progress.status}\n`;
          }

          if (progress.stdout && progress.stdout.length > 0) {
            const preview = progress.stdout.length > 800 ? progress.stdout.substring(0, 800) + '...' : progress.stdout;
            content += `**Output:**\n\`\`\`\n${preview}\n\`\`\`\n`;
          }

          if (progress.stderr && progress.stderr.length > 0) {
            const preview = progress.stderr.length > 300 ? progress.stderr.substring(0, 300) + '...' : progress.stderr;
            content += `**Errors:**\n\`\`\`\n${preview}\n\`\`\`\n`;
          }

          if (progress.completed) {
            if (progress.timed_out) {
              content += `**Timed out after ${args.timeout || 10}s**`;
            } else {
              content += progress.exit_code === 0 ? '**Completed successfully**' : `**Failed (exit code: ${progress.exit_code})**`;
            }
          }

          // Ensure content doesn't exceed Discord limit
          if (content.length > 1900) {
            content = content.substring(0, 1900) + '\n... (truncated)';
          }

          await statusMessage.edit(content);
        } catch (error) {
          logger.warn('Failed to update progress', { error: error.message });
        }
      }
    };

    // Execute with progress updates
    const result = await executeDockerExec(args, progressCallback);

    // Final update with complete results
    if (statusMessage) {
      try {
        // Parse the result to get clean output
        let finalContent = `**Command completed:** \`${command}\`\n`;

        if (typeof result === 'string' && result.includes('stdout')) {
          try {
            const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, ''));
            if (parsed.stdout) {
              finalContent += `**Output:**\n\`\`\`\n${parsed.stdout}\n\`\`\`\n`;
            }
            if (parsed.stderr) {
              finalContent += `**Errors:**\n\`\`\`\n${parsed.stderr}\n\`\`\`\n`;
            }
            finalContent += parsed.exit_code === 0 ? '**Success**' : `**Failed (code: ${parsed.exit_code})**`;
          } catch (e) {
            // Fallback to raw result
            finalContent += result;
          }
        } else {
          finalContent += result;
        }

        // Ensure final content doesn't exceed Discord limit
        if (finalContent.length > 1900) {
          finalContent = finalContent.substring(0, 1900) + '\n... (truncated)';
        }

        await statusMessage.edit(finalContent);
      } catch (error) {
        logger.warn('Failed to send final update', { error: error.message });
      }
    }

    return result;
  }
}