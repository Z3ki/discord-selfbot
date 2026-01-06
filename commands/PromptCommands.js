import { logger } from '../utils/logger.js';

/**
 * Handle prompt management commands
 */
export async function handlePromptCommand(message, args, bot) {
  const { adminManager } = await import('../utils/adminManager.js');

  if (!adminManager.isAdmin(message.author.id)) {
    await message.reply('Access denied. Admin command only.');
    return;
  }

  const type = args[0]?.toLowerCase();
  const promptText = args.slice(1).join(' ');

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
        bot.serverPrompts.set(
          serverId,
          type + (promptText ? ' ' + promptText : '')
        );
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

  const msg = args.join(' ');
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
