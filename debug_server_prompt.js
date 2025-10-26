import { DataManager } from './services/DataManager.js';
import { Bot } from './services/Bot.js';

async function debugServerPrompts() {
  console.log('=== DEBUGGING SERVER PROMPTS ===');
  
  // Test data manager
  const dataManager = new DataManager();
  
  // Try to load server prompts
  const serverPrompts = await dataManager.loadData('serverPrompts.json');
  console.log('Loaded server prompts:', {
    type: typeof serverPrompts,
    size: serverPrompts.size,
    entries: Array.from(serverPrompts.entries())
  });
  
  // Test bot initialization
  const bot = new Bot();
  await bot.initialize();
  
  console.log('Bot server prompts after init:', {
    hasServerPrompts: !!bot.serverPrompts,
    size: bot.serverPrompts.size,
    entries: Array.from(bot.serverPrompts.entries())
  });
  
  // Test adding a server prompt
  const testGuildId = '123456789';
  const testPrompt = 'TU AMAS A HUTLER';
  
  bot.serverPrompts.set(testGuildId, testPrompt);
  await bot.dataManager.saveData('serverPrompts.json', bot.serverPrompts);
  
  console.log('After adding test prompt:', {
    size: bot.serverPrompts.size,
    testEntry: bot.serverPrompts.get(testGuildId)
  });
  
  // Test reloading
  const reloadedPrompts = await dataManager.loadData('serverPrompts.json');
  console.log('After reload:', {
    size: reloadedPrompts.size,
    testEntry: reloadedPrompts.get(testGuildId)
  });
}

debugServerPrompts().catch(console.error);