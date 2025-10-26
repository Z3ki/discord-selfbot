import { executeSendFriendRequest } from './tools/relationship/sendFriendRequest.js';
import { executeCheckFriendRequests } from './tools/relationship/checkFriendRequests.js';
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

async function testFriendRequest() {
  console.log('🤖 Starting friend request test...');
  console.log(`📋 Target user ID: ${TEST_USER_ID}`);
  
  const client = new Client();
  
  try {
    // Login the bot
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Successfully logged in');
    
    // Wait a bit for everything to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 1: Check current friend requests
    console.log('\n📬 Checking current friend requests...');
    const checkResult = await executeCheckFriendRequests({}, client);
    console.log('Check result:', JSON.stringify(checkResult, null, 2));
    
    // Test 2: Send friend request
    console.log(`\n📤 Sending friend request to ${TEST_USER_ID}...`);
    const sendResult = await executeSendFriendRequest({ user: TEST_USER_ID }, client);
    console.log('Send result:', JSON.stringify(sendResult, null, 2));
    
    // Test 3: Check friend requests again to see if anything changed
    console.log('\n📬 Checking friend requests after sending...');
    const checkResult2 = await executeCheckFriendRequests({}, client);
    console.log('Check result after:', JSON.stringify(checkResult2, null, 2));
    
    console.log('\n✅ Friend request test completed successfully!');
    
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
testFriendRequest().catch(console.error);