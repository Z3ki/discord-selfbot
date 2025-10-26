import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

config();

const client = new Client();

client.on('ready', async () => {
  console.log('Bot is ready, triggering join_server tool...');
  
  // Create a mock message to trigger the AI to use the join_server tool
  const mockMessage = {
    content: 'Please join this Discord server for me: https://discord.gg/bYUQkGjvH',
    author: { 
      id: '123456789',
      username: 'testuser',
      discriminator: '0001'
    },
    channel: { 
      id: 'test-channel',
      type: 'DM'
    },
    id: 'test-msg-123',
    mentions: new Set(),
    reference: null,
    attachments: new Map(),
    stickers: new Map()
  };

  // Import and use the tool executor directly
  const { ToolExecutor } = await import('./tools/ToolExecutor.js');
  const toolExecutor = new ToolExecutor();
  
  try {
    // Simulate AI calling the join_server tool
    const result = await toolExecutor.executeTool({
      funcName: 'join_server',
      args: { invite: 'https://discord.gg/bYUQkGjvH' }
    }, mockMessage, client, null, null, null, null, null, null, null, null);
    
    console.log('Tool execution result:', result);
  } catch (error) {
    console.error('Tool execution failed:', error.message);
  }
  
  setTimeout(() => {
    console.log('Checking current servers...');
    client.guilds.cache.forEach(guild => {
      console.log(`- ${guild.name} (${guild.id})`);
    });
    process.exit(0);
  }, 5000);
});

client.login(process.env.DISCORD_USER_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
  process.exit(1);
});