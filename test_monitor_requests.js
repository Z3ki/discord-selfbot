import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.DISCORD_USER_TOKEN;

if (!BOT_TOKEN) {
  console.error('DISCORD_USER_TOKEN not found in environment variables');
  process.exit(1);
}

async function monitorFriendRequests() {
  console.log('👀 Monitoring friend requests...');
  console.log('🎯 Will auto-accept any incoming friend requests');
  
  const client = new Client();
  
  // Set up the auto-accept handler
  client.on('relationshipAdd', async (relationship) => {
    console.log('🔔 Relationship added!', {
      userId: relationship.id,
      type: relationship.type,
      typeName: getRelationshipTypeName(relationship.type),
      username: relationship.user?.username || 'Unknown'
    });

    if (relationship.type === 1) { // 1 = incoming friend request
      console.log('📬 Incoming friend request detected! Auto-accepting...');
      
      try {
        // Accept the friend request using API method
        await client.api.users('@me').relationships[relationship.id].put({
          type: 1
        });

        console.log('✅ Friend request accepted successfully!', {
          userId: relationship.id,
          username: relationship.user?.username || 'Unknown'
        });

        // Send a welcome message
        try {
          const user = await client.users.fetch(relationship.id);
          if (user) {
            await user.send('Hello! Thanks for the friend request! 👋');
            console.log('💬 Welcome message sent!');
          }
        } catch (msgError) {
          console.log('⚠️ Could not send welcome message:', msgError.message);
        }

      } catch (error) {
        console.error('❌ Failed to accept friend request:', error.message);
      }
    }
  });
  
  client.on('relationshipRemove', async (relationship) => {
    console.log('🗑️ Relationship removed!', {
      userId: relationship.id,
      type: relationship.type,
      typeName: getRelationshipTypeName(relationship.type),
      username: relationship.user?.username || 'Unknown'
    });
  });
  
  try {
    // Login the bot
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Successfully logged in and monitoring!');
    
    // Wait for everything to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check current status
    console.log('\n📊 Current relationship status:');
    const relationships = client.relationships.cache;
    console.log(`Total relationships: ${relationships.size}`);
    
    relationships.forEach((relationship, userId) => {
      console.log(`  ${userId}: Type ${relationship.type} (${getRelationshipTypeName(relationship.type)})`);
    });
    
    console.log('\n👀 Monitoring for friend requests... (Press Ctrl+C to stop)');
    
    // Keep running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping monitor...');
      if (client.readyAt) {
        await client.destroy();
        console.log('✅ Logged out');
      }
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Monitor failed:', error.message);
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

// Run the monitor
monitorFriendRequests().catch(console.error);