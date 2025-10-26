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

async function testForceFriendRequest() {
  console.log('🤖 Testing forced friend request...');
  console.log(`📋 Target user ID: ${TEST_USER_ID}`);
  
  const client = new Client();
  
  try {
    // Login the bot
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Successfully logged in');
    
    // Wait a bit for everything to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to send friend request with bypass
    console.log(`\n📤 Attempting to force friend request to ${TEST_USER_ID}...`);
    try {
      // Method 1: Try with confirm option
      console.log('🔄 Trying method 1: addFriend with confirm...');
      const result1 = await client.relationships.addFriend(TEST_USER_ID, { confirm: true });
      console.log('✅ Method 1 succeeded!', result1);
    } catch (error1) {
      console.log('❌ Method 1 failed:', error1.message);
      
      // Method 2: Try direct API call
      try {
        console.log('🔄 Trying method 2: Direct API call...');
        const result2 = await client.api.users(TEST_USER_ID).relationships.post({ type: 1 });
        console.log('✅ Method 2 succeeded!', result2);
      } catch (error2) {
        console.log('❌ Method 2 failed:', error2.message);
        
        // Method 3: Try with different approach
        try {
          console.log('🔄 Trying method 3: Alternative approach...');
          const result3 = await client.relationships.addFriend(TEST_USER_ID, { bypassConfirmation: true });
          console.log('✅ Method 3 succeeded!', result3);
        } catch (error3) {
          console.log('❌ Method 3 failed:', error3.message);
          console.log('💡 All methods failed - this may require manual confirmation');
        }
      }
    }
    
    // Check relationship after attempts
    console.log('\n🔍 Checking relationship after attempts...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const newRelationship = client.relationships.cache.get(TEST_USER_ID);
    if (newRelationship) {
      console.log(`New relationship type: ${newRelationship.type}`);
      console.log('Relationship types: 0=None, 1=Incoming, 2=Outgoing, 3=Friend, 4=Blocked');
      
      if (newRelationship.type === 2) {
        console.log('✅ Friend request successfully sent!');
      } else if (newRelationship.type === 3) {
        console.log('✅ Already friends!');
      }
    } else {
      console.log('No relationship found after attempts');
    }
    
    console.log('\n✅ Force friend request test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    // Logout
    if (client.readyAt) {
      console.log('\n🔒 Logging out...');
      await client.destroy();
      console.log('✅ Logged out');
    }
  }
}

// Run the test
testForceFriendRequest().catch(console.error);