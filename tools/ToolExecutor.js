import { toolRegistry } from './index.js';
import { getDMMetadata, loadUserContext } from '../utils/index.js';
import { processMessageMedia } from '../media.js';
import { logger } from '../utils/logger.js';

// Import tool execution functions
import { executeChangePresence } from './discord/changePresence.js';

import { executeReactionManager } from './discord/reactionManager.js';
import { executeJoinServer } from './discord/joinServer.js';

import { executeLeaveServer } from './discord/leaveServer.js';

export class ToolExecutor {
  constructor() {
    this.registry = toolRegistry;
  }

  /**
   * Execute a tool call
   */
  async executeTool(
    call,
    message,
    client,
    providerManager,
    channelMemories,
    dmOrigins,
    globalPrompt,
    apiResourceManager,
    currentLlmResponse = null
  ) {
    const { funcName, args } = call;
    const tool = this.registry.getTool(funcName);

    if (!tool) {
      logger.warn(`Unknown tool called: ${funcName}`, {
        availableTools: Array.from(this.registry.tools.keys()),
      });
      return `Unknown tool: ${funcName}. Available tools: ${Array.from(this.registry.tools.keys()).join(', ')}`;
    }

    try {
      // Validate required parameters
      if (tool.parameters && tool.parameters.required) {
        const missingParams = tool.parameters.required.filter(
          (param) => !(param in args)
        );
        if (missingParams.length > 0) {
          logger.warn(`Missing required parameters for tool ${funcName}`, {
            missing: missingParams,
            provided: Object.keys(args),
          });
          return `Error: Missing required parameters for ${funcName}: ${missingParams.join(', ')}`;
        }
      }

      logger.debug('Executing tool', {
        funcName,
        args: JSON.stringify(args),
        clientAvailable: !!client,
        clientReady: client?.readyAt,
      });

      // Check if tool has embedded execute function
      if (tool.execute) {
        const context = {
          message,
          client,
          providerManager,
          channelMemories,
          dmOrigins,
          globalPrompt,
          apiResourceManager,
        };

        // For create_message_file tool, automatically pass current LLM response
        if (funcName === 'create_message_file' && currentLlmResponse) {
          context.llmResponse = currentLlmResponse;
        }

        return await tool.execute(args, context);
      }

      // Route to appropriate execution function based on tool name
      switch (funcName) {
        case 'change_presence':
          return await executeChangePresence(args, client);
        case 'reaction_manager':
          return await executeReactionManager(args, client, message);
        case 'join_server':
          return await executeJoinServer(args, client);

        case 'leave_server':
          return await executeLeaveServer(args, client);

        case 'shell': {
          // For single shell calls, we still need to use the special handling
          // Create a mock toolCall object for consistency
          const mockToolCall = { funcName: 'shell', args };
          const executionResult = await this.executeShellWithUpdates(
            mockToolCall,
            message,
            client,
            providerManager,
            channelMemories,
            dmOrigins,
            globalPrompt,
            apiResourceManager
          );
          return executionResult.result;
        }

        default:
          logger.warn(`No execution function found for tool: ${funcName}`);
          return `Tool ${funcName} not implemented`;
      }
    } catch (error) {
      const errorMessage = error.message || 'Unknown error';
      const errorCode = error.code || 'UNKNOWN';

      // Categorize errors for better handling
      if (errorMessage.includes('Missing Access') || errorCode === 50001) {
        logger.warn(
          `Access denied for tool ${funcName} - likely selfbot restriction`,
          {
            funcName,
            error: errorMessage,
            code: errorCode,
          }
        );
        return `Access denied: ${funcName} cannot be executed due to Discord API restrictions. This is normal for selfbots.`;
      } else if (
        errorMessage.includes('rate limit') ||
        errorMessage.includes('429')
      ) {
        logger.warn(`Rate limit hit for tool ${funcName}`, {
          funcName,
          error: errorMessage,
        });
        return `Rate limited: ${funcName} is temporarily unavailable due to rate limits. Please try again later.`;
      } else if (errorMessage.includes('timeout')) {
        logger.warn(`Timeout executing tool ${funcName}`, {
          funcName,
          error: errorMessage,
        });
        return `Timeout: ${funcName} took too long to execute. Please try again.`;
      } else {
        logger.error(`Error executing tool ${funcName}:`, {
          funcName,
          error: errorMessage,
          code: errorCode,
          stack: error.stack,
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
  async executeTools(
    toolCalls,
    message,
    client,
    channelMemories,
    dmOrigins,
    providerManager,
    globalPrompt,
    lastPrompt,
    lastResponse,
    lastToolCalls,
    lastToolResults,
    apiResourceManager,
    currentLlmResponse = null
  ) {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(
          toolCall,
          message,
          client,
          providerManager,
          channelMemories,
          dmOrigins,
          globalPrompt,
          apiResourceManager,
          currentLlmResponse
        );
        results.push({
          tool: toolCall.funcName,
          result: result,
        });
      } catch (error) {
        logger.error(`Tool execution failed for ${toolCall.funcName}`, {
          error: error.message,
        });
        results.push({
          tool: toolCall.funcName,
          result: `Error: ${error.message}`,
        });
      }
    }

    return { results };
  }
}
