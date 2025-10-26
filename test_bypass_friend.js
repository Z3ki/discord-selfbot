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

async function testBypassFriendRequest() {
  console.log('🤖 Testing bypassed friend request...');
  console.log(`📋 Target user ID: ${TEST_USER_ID}`);
  
  // Create client with bypass options
  const client = new Client({
    checkUpdate: false,
    autoRedeemNitro: false,
    patchVoice: true,
    bypassConfirmation: true, // Try to bypass confirmation
    riskyActions: true // Enable risky actions
  });
  
  try {
    // Login the bot
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Successfully logged in');
    
    // Wait a bit for everything to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to send friend request
    console.log(`\n📤 Attempting friend request to ${TEST_USER_ID}...`);
    try {
      // Try different approaches
      console.log('🔄 Method 1: Standard addFriend...');
      const result1 = await client.relationships.addFriend(TEST_USER_ID);
      console.log('✅ Method 1 succeeded!', result1);
    } catch (error1) {
      console.log('❌ Method 1 failed:', error1.message);
      
      try {
        console.log('🔄 Method 2: Using client.rest...');
        const result2 = await client.rest.put(`/users/@me/relationships/${TEST_USER_ID}`, {
          body: { type: 1 }
        });
        console.log('✅ Method 2 succeeded!', result2);
      } catch (error2) {
        console.log('❌ Method 2 failed:', error2.message);
        
        try {
          console.log('🔄 Method 3: Using webhook approach...');
          const result3 = await client.api.users('@me').relationships[TEST_USER_ID].put({
            type: 1
          });
          console.log('✅ Method 3 succeeded!', result3);
        } catch (error3) {
          console.log('❌ Method 3 failed:', error3.message);
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
    
    console.log('\n✅ Bypass friend request test completed!');
    
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
testBypassFriendRequest().catch(console.error);