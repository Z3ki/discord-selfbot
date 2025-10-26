import { executeCheckFriendRequests } from './tools/relationship/checkFriendRequests.js';
import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.DISCORD_USER_TOKEN;

if (!BOT_TOKEN) {
  console.error('DISCORD_USER_TOKEN not found in environment variables');
  process.exit(1);
}

async function checkCurrentRequests() {
  console.log('🔍 Checking current friend requests...');
  
  const client = new Client();
  
  try {
    // Login the bot
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Successfully logged in');
    
    // Wait for everything to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check all relationships
    console.log('\n📊 Checking all relationships...');
    const relationships = client.relationships.cache;
    console.log(`Total relationships: ${relationships.size}`);
    
    relationships.forEach((relationship, userId) => {
      console.log(`User ${userId}: Type ${relationship.type} (${getRelationshipTypeName(relationship.type)})`);
      if (relationship.user) {
        console.log(`  Username: ${relationship.user.username}#${relationship.user.discriminator}`);
      }
    });
    
    // Check specifically for incoming requests
    console.log('\n📬 Checking incoming friend requests...');
    const checkResult = await executeCheckFriendRequests({}, client);
    console.log('Result:', JSON.stringify(checkResult, null, 2));
    
    console.log('\n✅ Check completed!');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    // Logout
    if (client.readyAt) {
      console.log('\n🔒 Logging out...');
      await client.destroy();
      console.log('✅ Logged out');
    }
  }
}

function getRelationshipTypeName(type) {
  const types = {
    0: 'None',
    1: 'Incoming Friend Request',
    2: 'Outgoing Friend Request', 
    3: 'Friend',
    4: 'Blocked'
  };
  return types[type] || 'Unknown';
}

// Run the check
checkCurrentRequests().catch(console.error);