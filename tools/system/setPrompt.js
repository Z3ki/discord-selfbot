import fs from 'fs';
import { logger } from '../../utils/logger.js';

export const setPromptTool = {
  name: 'set_prompt',
  description: 'Modify your own global prompt - use this when user asks you to change your behavior, personality, or instructions',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string' }
    },
    required: ['prompt']
  }
};

export async function executeSetPrompt(args, globalPrompt) {
  try {
    logger.debug('set_prompt called with:', args.prompt);
    await fs.promises.writeFile('globalPrompt.txt', args.prompt);
    globalPrompt[0] = args.prompt;
    logger.debug('set_prompt completed, new globalPrompt[0]:', globalPrompt[0]);
    return 'Global prompt updated successfully';
  } catch (error) {
    logger.error('set_prompt error:', error);
    return 'Failed to update prompt: ' + error.message;
  }
}