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

async function testDirectFriendRequest() {
  console.log('🤖 Testing direct friend request...');
  console.log(`📋 Target user ID: ${TEST_USER_ID}`);
  
  const client = new Client();
  
  try {
    // Login the bot
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Successfully logged in');
    
    // Wait a bit for everything to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check current relationship
    console.log('\n🔍 Checking current relationship...');
    const currentRelationship = client.relationships.cache.get(TEST_USER_ID);
    if (currentRelationship) {
      console.log(`Current relationship type: ${currentRelationship.type}`);
      console.log('Relationship types: 0=None, 1=Incoming, 2=Outgoing, 3=Friend, 4=Blocked');
    } else {
      console.log('No existing relationship found');
    }
    
    // Try to send friend request directly
    console.log(`\n📤 Attempting to send friend request to ${TEST_USER_ID}...`);
    try {
      const result = await client.relationships.addFriend(TEST_USER_ID);
      console.log('✅ Friend request sent successfully!');
      console.log('Result:', result);
    } catch (error) {
      console.log('❌ Error sending friend request:', error.message);
      
      // Check if it's a common error
      if (error.message.includes('Risky action')) {
        console.log('💡 This is a security feature. The friend request would work with manual confirmation.');
      } else if (error.message.includes('Already sent')) {
        console.log('💡 Friend request already sent');
      } else if (error.message.includes('Unknown user')) {
        console.log('💡 User ID not found or invalid');
      }
    }
    
    // Check relationship after attempt
    console.log('\n🔍 Checking relationship after attempt...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    const newRelationship = client.relationships.cache.get(TEST_USER_ID);
    if (newRelationship) {
      console.log(`New relationship type: ${newRelationship.type}`);
      console.log('Relationship types: 0=None, 1=Incoming, 2=Outgoing, 3=Friend, 4=Blocked');
    } else {
      console.log('No relationship found after attempt');
    }
    
    console.log('\n✅ Direct friend request test completed!');
    
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
testDirectFriendRequest().catch(console.error);