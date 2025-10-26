import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.DISCORD_USER_TOKEN;

if (!BOT_TOKEN) {
  console.error('DISCORD_USER_TOKEN not found in environment variables');
  process.exit(1);
}

async function debugRelationshipAddEvent() {
  console.log('🔍 Debugging relationshipAdd event...');
  
  const client = new Client();
  
  // Set up the event listener to see what parameters we get
  client.on('relationshipAdd', (...args) => {
    console.log('🔔 relationshipAdd event fired!');
    console.log('Arguments count:', args.length);
    args.forEach((arg, index) => {
      console.log(`Arg ${index}:`, arg, typeof arg);
      if (typeof arg === 'object' && arg !== null) {
        console.log(`  - Keys:`, Object.keys(arg));
        if (arg.username) {
          console.log(`  - Username:`, arg.username);
        }
      }
    });
  });
  
  client.on('relationshipRemove', (...args) => {
    console.log('🗑️ relationshipRemove event fired!');
    console.log('Arguments count:', args.length);
    args.forEach((arg, index) => {
      console.log(`Arg ${index}:`, arg, typeof arg);
    });
  });
  
  try {
    // Login the bot
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Successfully logged in');
    
    // Wait for everything to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check current relationships
    console.log('\n📊 Current relationships:');
    const relationships = client.relationships.cache;
    console.log(`Total relationships: ${relationships.size}`);
    
    relationships.forEach((type, userId) => {
      console.log(`  ${userId}: Type ${type} (${getRelationshipTypeName(type)})`);
    });
    
    console.log('\n👀 Monitoring for relationship changes... (Send a friend request to test)');
    console.log('💡 This will run for 60 seconds or until you press Ctrl+C');
    
    // Keep running for 60 seconds
    setTimeout(async () => {
      console.log('\n✅ Debug completed!');
      if (client.readyAt) {
        await client.destroy();
        console.log('✅ Logged out');
      }
      process.exit(0);
    }, 60000);
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
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

// Run the debug
debugRelationshipAddEvent().catch(console.error);