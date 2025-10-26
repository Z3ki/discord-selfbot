import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';
import { logger } from './utils/logger.js';

// Load environment variables
config();

const BOT_TOKEN = process.env.DISCORD_USER_TOKEN;
const TEST_USER_ID = '1352606240899072051';

if (!BOT_TOKEN) {
  console.error('DISCORD_USER_TOKEN not found in environment variables');
  process.exit(1);
}

async function testAutoAcceptFriendRequest() {
  console.log('🤖 Testing automatic friend request acceptance...');
  console.log(`📋 Target user ID: ${TEST_USER_ID}`);
  
  const client = new Client({
    checkUpdate: false,
    autoRedeemNitro: false,
    patchVoice: true
  });
  
  // Set up the auto-accept handler
  client.on('relationshipAdd', async (relationship) => {
    if (relationship.type === 1) { // 1 = incoming friend request
      console.log('📬 Incoming friend request detected!', {
        userId: relationship.id,
        username: relationship.user?.username || 'Unknown'
      });

      // Automatically accept the friend request
      try {
        console.log('✅ Automatically accepting friend request...');
        
        // Accept the friend request using API method
        await client.api.users('@me').relationships[relationship.id].put({
          type: 1
        });

        console.log('🎉 Friend request accepted successfully!', {
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
  
  try {
    // Login the bot
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Successfully logged in');
    
    // Wait for everything to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check current relationship
    console.log('\n🔍 Checking current relationship...');
    const currentRelationship = client.relationships.cache.get(TEST_USER_ID);
    if (currentRelationship) {
      console.log(`Current relationship type: ${currentRelationship.type}`);
      console.log('Relationship types: 0=None, 1=Incoming, 2=Outgoing, 3=Friend, 4=Blocked');
    } else {
      console.log('No existing relationship found');
    }
    
    // Send a friend request to trigger the auto-accept when they accept
    console.log(`\n📤 Sending friend request to ${TEST_USER_ID}...`);
    try {
      await client.api.users('@me').relationships[TEST_USER_ID].put({
        type: 1
      });
      console.log('✅ Friend request sent successfully!');
    } catch (error) {
      console.log('❌ Error sending friend request:', error.message);
    }
    
    // Wait for potential response
    console.log('\n⏳ Waiting for friend request response (this requires the other user to accept)...');
    console.log('💡 The auto-accept will trigger when they send a friend request back');
    
    // Monitor for changes
    let checkCount = 0;
    const checkInterval = setInterval(async () => {
      checkCount++;
      const relationship = client.relationships.cache.get(TEST_USER_ID);
      
      if (relationship) {
        console.log(`🔍 Check ${checkCount}: Relationship type ${relationship.type}`);
        
        if (relationship.type === 3) {
          console.log('🎉 Now friends with the user!');
          clearInterval(checkInterval);
        } else if (relationship.type === 1) {
          console.log('📬 Incoming friend request detected - auto-accept should trigger!');
        }
      } else {
        console.log(`🔍 Check ${checkCount}: No relationship yet`);
      }
      
      if (checkCount >= 10) {
        console.log('⏰ Check period ended');
        clearInterval(checkInterval);
      }
    }, 5000);
    
    // Keep the bot running for a while to monitor
    setTimeout(() => {
      console.log('\n✅ Auto-accept test completed!');
      process.exit(0);
    }, 60000); // Run for 60 seconds
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the test
testAutoAcceptFriendRequest().catch(console.error);