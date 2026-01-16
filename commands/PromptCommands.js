import { logger } from '../utils/logger.js';

// Input validation utility
function validateUserInput(input, maxLength = 4000, allowEmpty = false) {
  if (!allowEmpty && (!input || input.trim() === '')) {
    return { valid: false, error: 'Input cannot be empty' };
  }

  if (typeof input !== 'string') {
    return { valid: false, error: 'Invalid input type' };
  }

  if (input.length > maxLength) {
    return {
      valid: false,
      error: `Input exceeds maximum length of ${maxLength} characters`,
    };
  }

  return { valid: true, sanitized: input.trim() };
}

/**
 * Handle prompt management commands
 */
export async function handlePromptCommand(message, args, bot) {
  const { adminManager } = await import('../utils/adminManager.js');

  if (!adminManager.isAdmin(message.author.id)) {
    await message.reply('Access denied. Admin command only.');
    return;
  }

  const typeValidation = validateUserInput(args[0], 20);
  const promptTextValidation = validateUserInput(args.slice(1).join(' '), 3000);

  if (!typeValidation.valid) {
    await message.reply('Invalid prompt type parameter');
    return;
  }

  const type = typeValidation.sanitized.toLowerCase();
  const promptText = promptTextValidation.sanitized || '';

  if (!type) {
    const promptHelp = `**Prompt Management**

**Usage:**
\`,prompt <type> [text]\`

**Types:**
• \`<text>\` - Set server prompt
• \`all <text>\` - Set global prompt
• \`clear <text>\` - Clear memory + set server prompt
• \`clear all <text>\` - Clear memory + set global prompt

**Examples:**
\`,prompt You are a helpful assistant\`
\`,prompt all You are a helpful assistant\`
\`,prompt clear You are a helpful assistant\`

**Note:** Server prompts override global prompts for specific servers.`;
    await message.reply(promptHelp);
    return;
  }

  try {
    const channelId = message.channel?.id || message.channelId;
    const serverId = message.guild?.id || channelId;

    switch (type) {
      case 'clear': {
        if (!promptText) {
          await message.reply(
            'Prompt text required for clear command\nUsage: `,prompt clear <text>`'
          );
          return;
        }

        const promptCheck = validateUserInput(promptText, 3000);
        if (!promptCheck.valid) {
          await message.reply(`Invalid prompt text: ${promptCheck.error}`);
          return;
        }

        // Clear memory for this channel
        bot.channelMemories.delete(channelId);

        // Set server prompt
        bot.serverPrompts.set(serverId, promptText);
        await bot.dataManager.saveData('serverPrompts.json', bot.serverPrompts);
        await message.reply(`**Memory cleared and server prompt set**`);
        break;
      }

      case 'all': {
        if (!promptText) {
          await message.reply(
            'Prompt text required for global prompt\nUsage: `,prompt all <text>`'
          );
          return;
        }

        const promptCheck = validateUserInput(promptText, 3000);
        if (!promptCheck.valid) {
          await message.reply(`Invalid prompt text: ${promptCheck.error}`);
          return;
        }

        // Set global prompt
        bot.globalPrompt[0] = promptText;
        await bot.dataManager.saveGlobalPrompt(promptText);
        await message.reply(`**Global prompt updated**`);
        break;
      }

      case 'clearall': {
        if (!promptText) {
          await message.reply(
            'Prompt text required for clear all command\nUsage: `,prompt clearall <text>`'
          );
          return;
        }

        const promptCheck = validateUserInput(promptText, 3000);
        if (!promptCheck.valid) {
          await message.reply(`Invalid prompt text: ${promptCheck.error}`);
          return;
        }

        // Clear all memories
        bot.channelMemories.clear();
        bot.dmContexts.clear();
        bot.dmOrigins.clear();

        // Set global prompt
        bot.globalPrompt[0] = promptText;
        await bot.dataManager.saveGlobalPrompt(promptText);
        await message.reply(`**All memory cleared and global prompt set**`);
        break;
      }

      default: {
        // Default behavior: set server prompt
        const fullPrompt = type + (promptText ? ' ' + promptText : '');
        const promptCheck = validateUserInput(fullPrompt, 3000);
        if (!promptCheck.valid) {
          await message.reply(`Invalid prompt text: ${promptCheck.error}`);
          return;
        }

        bot.serverPrompts.set(serverId, promptCheck.sanitized);
        await bot.dataManager.saveData('serverPrompts.json', bot.serverPrompts);
        await message.reply(`**Server prompt updated**`);
        break;
      }
    }
  } catch (error) {
    logger.error('Error in prompt command', { error: error.message, type });
    await message.reply('An error occurred while updating the prompt.');
  }
}

/**
 * Handle NVIDIA AI command
 */
export async function handleNvidiaCommand(message, args, providerManager) {
  const { adminManager } = await import('../utils/adminManager.js');

  if (!adminManager.isAdmin(message.author.id)) {
    await message.reply('Access denied. Admin command only.');
    return;
  }

  const msgValidation = validateUserInput(args.join(' '), 2000);
  if (!msgValidation.valid) {
    await message.reply(`Invalid message: ${msgValidation.error}`);
    return;
  }

  const msg = msgValidation.sanitized;
  if (!msg) {
    await message.reply(
      'Message required for NVIDIA AI\nUsage: `,nvidia <message>`'
    );
    return;
  }

  try {
    const nvidiaProvider = providerManager.providers.nvidia;
    if (!nvidiaProvider || !nvidiaProvider.isAvailable) {
      await message.reply('NVIDIA AI provider is not available.');
      return;
    }

    await message.reply('**Processing with NVIDIA AI...**');

    const response = await nvidiaProvider.generateContent(msg);
    await message.reply(`**NVIDIA AI Response:**\n\n${response.text}`);
  } catch (error) {
    logger.error('Error in NVIDIA command', { error: error.message });
    await message.reply('An error occurred while processing with NVIDIA AI.');
  }
}
