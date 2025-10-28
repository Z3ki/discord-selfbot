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

import { executeMessageManager } from './discord/messageManager.js';

import { executeLeaveServer } from './discord/leaveServer.js';




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

        case 'message_manager':
          return await executeMessageManager(args, client);

        case 'leave_server':
          return await executeLeaveServer(args, client);

         
case 'docker_exec': {
            // For single docker_exec calls, we still need to use the special handling
            // Create a mock toolCall object for consistency
            const mockToolCall = { funcName: 'docker_exec', args };
            const executionResult = await this.executeDockerExecWithUpdates(mockToolCall, message, client, providerManager, channelMemories, dmOrigins, globalPrompt, apiResourceManager);
            return executionResult.result;
          }

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
  async executeTools(toolCalls, message, client, channelMemories, dmOrigins, providerManager, globalPrompt, lastPrompt, lastResponse, lastToolCalls, lastToolResults, apiResourceManager, sharedStatusMessage = null) {
    const results = [];
    let dockerStatusMessage = sharedStatusMessage;

    for (const toolCall of toolCalls) {
      try {
        // Special handling for docker_exec with live updates
        if (toolCall.funcName === 'docker_exec') {
          const executionResult = await this.executeDockerExecWithUpdates(toolCall, message, client, providerManager, channelMemories, dmOrigins, globalPrompt, apiResourceManager, dockerStatusMessage);

          // Store the status message for reuse in subsequent docker_exec calls
          if (!dockerStatusMessage && executionResult.statusMessage) {
            dockerStatusMessage = executionResult.statusMessage;
          }

          results.push({
            tool: toolCall.funcName,
            result: executionResult.result
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

    return { results, statusMessage: dockerStatusMessage };
  }

  /**
   * Execute docker_exec with live message updates
   */
  async executeDockerExecWithUpdates(toolCall, message, client, providerManager, channelMemories, dmOrigins, globalPrompt, apiResourceManager, existingStatusMessage = null) {
    const { args } = toolCall;
    const { command } = args;

    // Use existing status message or create new one
    let statusMessage = existingStatusMessage;
    if (!statusMessage) {
      try {
        const isDM = message.channel?.type === 'DM' || message.channel?.type === 1;
        const initialContent = `\`\`\`\n$ ${command}\n[Executing...]\n\`\`\``;

        if (isDM) {
          statusMessage = await message.channel.send(initialContent);
        } else {
          statusMessage = await message.reply(initialContent);
        }

        logger.debug('Sent initial tool status message', { messageId: statusMessage.id });
      } catch (error) {
        logger.warn('Failed to send initial status message', { error: error.message });
      }
    } else {
      // Update existing message with new command
      try {
        const currentContent = statusMessage.content;
        const newContent = currentContent.replace(/```$/, '') + `$ ${command}\n[Executing...]\n\`\`\``;
        await statusMessage.edit(newContent);
      } catch (error) {
        logger.warn('Failed to update existing status message', { error: error.message });
      }
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
          let content = `\`\`\`\n$ ${command}\n`;

          if (progress.stdout && progress.stdout.length > 0) {
            content += progress.stdout;
          }

          if (progress.stderr && progress.stderr.length > 0) {
            content += progress.stderr;
          }

          if (progress.completed) {
            if (progress.timed_out) {
              content += `\n[Command timed out after ${args.timeout || 10}s]`;
            } else if (progress.exit_code !== 0) {
              content += `\n[Exit code: ${progress.exit_code}]`;
            }
          }

          content += `\n\`\`\``;

          // Ensure content doesn't exceed Discord limit
          if (content.length > 1990) {
            // Show the END of the output (most recent) instead of beginning
            const truncatedLength = 1990 - '`\n... (truncated)'.length;
            content = '... (showing last ' + truncatedLength + ' chars)\n' + content.substring(-truncatedLength) + '`\n... (truncated)';
          }

          try {
            await statusMessage.edit(content);
          } catch (error) {
            if (error.message.includes('2000') || error.message.includes('Must be 2000')) {
              logger.warn('Discord message too long, replacing with latest output', { originalLength: content.length });
              const truncatedContent = content.substring(0, 1950) + '`';
              await statusMessage.edit(truncatedContent);
            } else {
              throw error;
            }
          }
} catch (error) {
        if (error.message.includes('2000') || error.message.includes('Must be 2000')) {
          logger.warn('Progress update too long for Discord, skipping update', { error: error.message });
        } else {
          logger.warn('Failed to update progress', { error: error.message });
        }
      }
      }
    };

    // Execute with progress updates
    const result = await executeDockerExec(args, progressCallback);

    // Final update with complete results
    if (statusMessage) {
      try {
        // Parse the result to get clean output
        let finalContent = `\`\`\`\n$ ${command}\n`;

        if (typeof result === 'string' && result.includes('stdout')) {
          try {
            const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, ''));
            if (parsed.stdout) {
              finalContent += parsed.stdout;
            }
            if (parsed.stderr) {
              finalContent += parsed.stderr;
            }
            if (parsed.exit_code !== 0) {
              finalContent += `\n[Exit code: ${parsed.exit_code}]`;
            }
          } catch (e) {
            // Fallback to raw result
            finalContent += result;
          }
        } else {
          finalContent += result;
        }

        finalContent += `\n\`\`\``;

        // Ensure final content doesn't exceed Discord limit
        if (finalContent.length > 1990) {
          finalContent = finalContent.substring(0, 1990) + '`\n... (truncated)';
        }

        try {
          await statusMessage.edit(finalContent);
        } catch (error) {
          if (error.message.includes('2000') || error.message.includes('Must be 2000')) {
            logger.warn('Final Discord message too long, replacing with latest output', { originalLength: finalContent.length });
            const truncatedContent = finalContent.substring(0, 1950) + '`';
            await statusMessage.edit(truncatedContent);
          } else {
            throw error;
          }
        }
      } catch (error) {
        if (error.message.includes('2000') || error.message.includes('Must be 2000')) {
          logger.warn('Final update too long for Discord, sending latest output only', { error: error.message });
          const shortContent = 'Command completed. Output updated with latest results.';
          try {
            await statusMessage.edit(shortContent);
          } catch (fallbackError) {
            logger.error('Failed to send fallback message', { error: fallbackError.message });
          }
        } else {
          logger.warn('Failed to send final update', { error: error.message });
        }
      }
    }

    return { result, statusMessage };
  }
}
