import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.DISCORD_USER_TOKEN;
const TEST_USER_ID = '877972869001412768';

if (!BOT_TOKEN) {
  console.error('DISCORD_USER_TOKEN not found in environment variables');
  process.exit(1);
}

async function apiCheckTest() {
  console.log('🔧 Testing Discord API directly...');
  console.log(`🎯 Target user: ${TEST_USER_ID}`);
  
  const client = new Client();
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Logged in!');
    
    // Wait for ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check relationships via API
    console.log('\n🔍 Checking relationships via API...');
    try {
      const relationships = await client.api.users('@me').relationships.get();
      console.log(`Found ${relationships.length} relationships via API`);
      
      relationships.forEach(rel => {
        console.log(`  ${rel.id}: Type ${rel.type} (${getRelationshipTypeName(rel.type)}) - ${rel.user?.username || 'Unknown'}`);
        
        // If this is our target user and it's an incoming request
        if (rel.id === TEST_USER_ID && rel.type === 1) {
          console.log('📬 FOUND INCOMING FRIEND REQUEST! Accepting...');
          
          acceptFriendRequest(client, TEST_USER_ID);
        }
      });
      
    } catch (apiError) {
      console.error('❌ API check failed:', apiError.message);
    }
    
    // Try to force accept anyway (in case the request exists but isn't showing)
    console.log('\n🔄 Attempting force accept...');
    await acceptFriendRequest(client, TEST_USER_ID);
    
    console.log('\n✅ API check test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.destroy();
  }
}

async function acceptFriendRequest(client, userId) {
  console.log(`📤 Attempting to accept friend request from ${userId}...`);
  
  const methods = [
    {
      name: 'API PUT',
      fn: async () => {
        await client.api.users('@me').relationships[userId].put({
          type: 1
        });
      }
    },
    {
      name: 'addFriend',
      fn: async () => {
        await client.relationships.addFriend(userId);
      }
    },
    {
      name: 'REST API',
      fn: async () => {
        await client.rest.put(`/users/@me/relationships/${userId}`, {
          body: { type: 1 }
        });
      }
    },
    {
      name: 'Direct API POST',
      fn: async () => {
        await client.api.users('@me').relationships.post({
          type: 1,
          user_id: userId
        });
      }
    }
  ];
  
  for (const method of methods) {
    try {
      console.log(`🔄 Trying ${method.name}...`);
      await method.fn();
      console.log(`✅ ${method.name} succeeded!`);
      
      // Send welcome message
      try {
        const user = await client.users.fetch(userId);
        if (user) {
          await user.send('Hello! Thanks for the friend request! 👋');
          console.log('💬 Welcome message sent!');
        }
      } catch (msgError) {
        console.log('⚠️ Welcome message failed:', msgError.message);
      }
      
      return true;
    } catch (error) {
      console.log(`❌ ${method.name} failed:`, error.message);
    }
  }
  
  return false;
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

// Run test
apiCheckTest().catch(console.error);