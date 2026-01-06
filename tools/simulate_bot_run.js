import { extractToolCalls } from '../ai.js';
import { ToolExecutor } from './ToolExecutor.js';
import { logger } from '../utils/logger.js';
import { buildPromptContent } from '../prompts.js';
import { toolRegistry } from './index.js';

async function simulate() {
  // Sample assistant output that contains a tool call
  const sampleAssistantOutput = `create_website(name="simulated_site", html="<!DOCTYPE html><html><head><title>Simulated Site</title></head><body><h1>Simulated site content</h1><p>Test run</p></body></html>")`;

  logger.info('SIMULATION START');
  logger.debug('Assistant output (sample):', {
    sampleLength: sampleAssistantOutput.length,
  });
  // Build the system prompt as the AI would see it
  const globalPrompt = '';
  const memoryText = '';
  const toolsText = toolRegistry?.getToolsText
    ? toolRegistry.getToolsText()
    : 'create_website(name, html)';
  const currentUserInfo = 'Username: simuser';
  const messageInfo = 'Channel: SIM_CHANNEL; DM: false';
  const presenceInfo = '';
  const messageContent = 'User requested a test website';

  const systemPrompt = buildPromptContent(
    globalPrompt,
    memoryText,
    toolsText,
    currentUserInfo,
    messageInfo,
    presenceInfo,
    '',
    messageContent,
    false,
    [],
    '',
    '',
    null,
    null,
    false,
    null,
    'qwen/qwen3-next-80b-a3b-instruct'
  );

  // Print full system prompt so you can see exactly what the model receives
  logger.info('FULL SYSTEM PROMPT (begin)');
  console.log(systemPrompt);
  logger.info('FULL SYSTEM PROMPT (end)');

  // 1) Extract tool calls
  const calls = extractToolCalls(sampleAssistantOutput);
  logger.info('Extracted tool calls', { count: calls.length });
  console.log('EXTRACTED_CALLS:', JSON.stringify(calls, null, 2));

  if (calls.length === 0) {
    logger.warn('No tool calls parsed from assistant output');
    return;
  }

  // 2) Execute calls via ToolExecutor
  const executor = new ToolExecutor();

  // Minimal fake message object for logging context
  const fakeMessage = {
    content: 'simulated message',
    author: { id: 'SIM_USER', username: 'simuser' },
    channel: { id: 'SIM_CHANNEL', type: 'GUILD_TEXT' },
    attachments: new Map(),
    mentions: { users: new Map(), has: () => false },
    isReplyToBot: false,
    isMentioned: false,
  };

  // Minimal contexts
  const channelMemories = new Map();
  const dmOrigins = new Map();

  logger.info('Executing parsed tool calls...');
  const { results } = await executor.executeTools(
    calls,
    fakeMessage,
    null, // client
    channelMemories,
    dmOrigins,
    null, // providerManager
    null, // globalPrompt
    null, // lastPrompt
    null, // lastResponse
    null, // lastToolCalls
    null, // lastToolResults
    null, // apiResourceManager
    null // bot
  );

  logger.info('Tool execution results', { resultsCount: results.length });
  console.log('TOOL_RESULTS:', JSON.stringify(results, null, 2));

  // 3) Final metadata check
  logger.info('SIMULATION COMPLETE');
}

simulate().catch((err) => {
  logger.error('Simulation failed', { error: err?.message || String(err) });
  console.error(err);
  process.exit(1);
});
