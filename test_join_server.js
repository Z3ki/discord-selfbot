import { executeJoinServer } from './tools/discord/joinServer.js';
import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.DISCORD_USER_TOKEN;
const INVITE_LINK = 'https://discord.gg/bYUQkGjvH';

if (!BOT_TOKEN) {
  console.error('DISCORD_USER_TOKEN not found in environment variables');
  process.exit(1);
}

async function testJoinServer() {
  console.log('🔧 Testing server join functionality...');
  console.log(`🎯 Target server: ${INVITE_LINK}`);
  
  const client = new Client();
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Logged in!');
    
    // Wait for ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Join the server
    console.log(`\n🚪 Attempting to join server: ${INVITE_LINK}`);
    const result = await executeJoinServer({ invite: INVITE_LINK }, client);
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('🎉 Successfully joined the server!');
      
      // Check current servers
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('\n📊 Current servers:');
      const guilds = client.guilds.cache;
      guilds.forEach(guild => {
        console.log(`  🏠 ${guild.name} (${guild.id})`);
      });
    } else {
      console.log('❌ Failed to join server:', result.error);
    }
    
    console.log('\n✅ Server join test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.destroy();
  }
}

// Run test
testJoinServer().catch(console.error);