// Simple script to check current server prompts and find the right guild
import { DataManager } from './services/DataManager.js';

async function checkCurrentGuild() {
  const dataManager = new DataManager();
  const serverPrompts = await dataManager.loadData('serverPrompts.json');
  
  console.log('=== CURRENT SERVER PROMPTS ===');
  console.log('Total server prompts:', serverPrompts.size);
  
  for (const [guildId, prompt] of serverPrompts.entries()) {
    console.log(`\nGuild ID: ${guildId}`);
    console.log(`Prompt: "${prompt}"`);
    console.log(`Contains "HUTLER": ${prompt.toUpperCase().includes('HUTLER')}`);
    console.log(`Contains "HITLER": ${prompt.toUpperCase().includes('HITLER')}`);
  }
  
  console.log('\n=== SEARCHING FOR "TU AMAS A HUTLER" ===');
  let found = false;
  for (const [guildId, prompt] of serverPrompts.entries()) {
    if (prompt.toUpperCase().includes('TU AMAS') && prompt.toUpperCase().includes('HUTLER')) {
      console.log(`Found exact match in guild: ${guildId}`);
      console.log(`Full prompt: "${prompt}"`);
      found = true;
    }
  }
  
  if (!found) {
    console.log('No server prompt found with "TU AMAS A HUTLER"');
    console.log('Available prompts contain:');
    for (const [guildId, prompt] of serverPrompts.entries()) {
      console.log(`  Guild ${guildId}: "${prompt.substring(0, 50)}..."`);
    }
  }
}

checkCurrentGuild().catch(console.error);