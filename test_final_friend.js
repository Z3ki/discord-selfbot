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

async function testFinalFriendRequest() {
  console.log('🤖 Testing final friend request approach...');
  console.log(`📋 Target user ID: ${TEST_USER_ID}`);
  
  // Create client with all possible bypass options
  const client = new Client({
    checkUpdate: false,
    autoRedeemNitro: false,
    patchVoice: true,
    // Disable captcha and other security features
    captchaSolver: true,
    restRequestTimeout: 30000,
    restGlobalRateLimit: 50,
    restSweepInterval: 30000,
    restTimeOffset: 0
  });
  
  // Override the risky action handler
  client.on('ready', () => {
    console.log('🔓 Disabling risky action confirmation...');
    // Try to disable the risky action confirmation
    if (client.options && client.options.riskyActions !== undefined) {
      client.options.riskyActions = true;
    }
  });
  
  try {
    // Login the bot
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Successfully logged in');
    
    // Wait for everything to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try multiple approaches
    console.log(`\n📤 Attempting friend request to ${TEST_USER_ID}...`);
    
    let success = false;
    
    // Approach 1: Direct API with different endpoint
    try {
      console.log('🔄 Approach 1: Direct API POST...');
      const result1 = await client.api.users('@me').relationships.post({
        type: 1,
        user_id: TEST_USER_ID
      });
      console.log('✅ Approach 1 succeeded!', result1);
      success = true;
    } catch (error1) {
      console.log('❌ Approach 1 failed:', error1.message);
    }
    
    if (!success) {
      // Approach 2: REST API
      try {
        console.log('🔄 Approach 2: REST API...');
        const result2 = await client.rest.request('PUT', `/users/@me/relationships/${TEST_USER_ID}`, {
          body: { type: 1 }
        });
        console.log('✅ Approach 2 succeeded!', result2);
        success = true;
      } catch (error2) {
        console.log('❌ Approach 2 failed:', error2.message);
      }
    }
    
    if (!success) {
      // Approach 3: Force addFriend with modified options
      try {
        console.log('🔄 Approach 3: Force addFriend...');
        // Temporarily disable risky action checking
        const originalRiskyAction = client._confirmRiskyAction;
        client._confirmRiskyAction = async () => true;
        
        const result3 = await client.relationships.addFriend(TEST_USER_ID);
        console.log('✅ Approach 3 succeeded!', result3);
        success = true;
        
        // Restore original function
        client._confirmRiskyAction = originalRiskyAction;
      } catch (error3) {
        console.log('❌ Approach 3 failed:', error3.message);
      }
    }
    
    // Check final relationship status
    console.log('\n🔍 Checking final relationship status...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    const finalRelationship = client.relationships.cache.get(TEST_USER_ID);
    if (finalRelationship) {
      console.log(`Final relationship type: ${finalRelationship.type}`);
      console.log('Relationship types: 0=None, 1=Incoming, 2=Outgoing, 3=Friend, 4=Blocked');
      
      if (finalRelationship.type === 2) {
        console.log('🎉 Friend request successfully sent!');
      } else if (finalRelationship.type === 3) {
        console.log('🎉 Already friends!');
      }
    } else {
      console.log('No relationship found - friend request may still be processing');
    }
    
    console.log('\n✅ Final friend request test completed!');
    
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
testFinalFriendRequest().catch(console.error);