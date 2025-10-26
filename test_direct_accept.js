import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.DISCORD_USER_TOKEN;
const TEST_USER_ID = '1352606240899072051';

if (!BOT_TOKEN) {
  console.error('DISCORD_USER_TOKEN not found in environment variables');
  process.exit(1);
}

async function directAcceptTest() {
  console.log('🔧 Testing direct friend request acceptance...');
  console.log(`🎯 Target user: ${TEST_USER_ID}`);
  
  const client = new Client();
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Logged in!');
    
    // Wait for ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Force refresh all relationships
    console.log('🔄 Fetching relationships...');
    await client.relationships.fetch();
    
    // Check current relationship with target user
    console.log('\n🔍 Checking relationship with target user...');
    const relationship = client.relationships.cache.get(TEST_USER_ID);
    
    if (relationship) {
      console.log('Found relationship:', {
        id: relationship.id,
        type: relationship.type,
        typeName: getRelationshipTypeName(relationship.type),
        user: relationship.user?.username
      });
      
      // If it's an incoming request (type 1), accept it
      if (relationship.type === 1) {
        console.log('📬 Incoming friend request found! Accepting...');
        
        try {
          // Method 1: API PUT
          console.log('🔄 Trying API PUT method...');
          await client.api.users('@me').relationships[TEST_USER_ID].put({
            type: 1
          });
          console.log('✅ API PUT succeeded!');
        } catch (error1) {
          console.log('❌ API PUT failed:', error1.message);
          
          try {
            // Method 2: addFriend
            console.log('🔄 Trying addFriend method...');
            await client.relationships.addFriend(TEST_USER_ID);
            console.log('✅ addFriend succeeded!');
          } catch (error2) {
            console.log('❌ addFriend failed:', error2.message);
            
            try {
              // Method 3: REST API
              console.log('🔄 Trying REST API...');
              await client.rest.put(`/users/@me/relationships/${TEST_USER_ID}`, {
                body: { type: 1 }
              });
              console.log('✅ REST API succeeded!');
            } catch (error3) {
              console.log('❌ REST API failed:', error3.message);
            }
          }
        }
        
        // Check result after accepting
        await new Promise(resolve => setTimeout(resolve, 2000));
        const newRelationship = client.relationships.cache.get(TEST_USER_ID);
        if (newRelationship) {
          console.log('📊 New relationship type:', newRelationship.type, getRelationshipTypeName(newRelationship.type));
        }
        
      } else {
        console.log(`ℹ️ Relationship type is ${relationship.type} (${getRelationshipTypeName(relationship.type)}) - not an incoming request`);
      }
      
    } else {
      console.log('❌ No relationship found with target user');
    }
    
    // List all relationships for debugging
    console.log('\n📋 All relationships:');
    client.relationships.cache.forEach((rel, id) => {
      if (rel.type !== undefined) { // Only show defined types
        console.log(`  ${id}: Type ${rel.type} (${getRelationshipTypeName(rel.type)}) - ${rel.user?.username || 'Unknown'}`);
      }
    });
    
    console.log('\n✅ Direct accept test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.destroy();
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

// Run test
directAcceptTest().catch(console.error);