import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.DISCORD_USER_TOKEN;

if (!BOT_TOKEN) {
  console.error('DISCORD_USER_TOKEN not found in environment variables');
  process.exit(1);
}

async function triggerAcceptTest() {
  console.log('🔧 Testing auto-accept trigger...');
  
  const client = new Client();
  
  // Set up the same handler as main bot
  client.on('relationshipAdd', async (relationship) => {
    console.log('🔔 RELATIONSHIP ADD EVENT FIRED!');
    console.log('Details:', {
      id: relationship.id,
      type: relationship.type,
      username: relationship.user?.username
    });
    
    if (relationship.type === 1) { // 1 = incoming friend request
      console.log('📬 INCOMING FRIEND REQUEST! Auto-accepting...');
      
      try {
        await client.api.users('@me').relationships[relationship.id].put({
          type: 1
        });
        
        console.log('✅ Friend request accepted!');
        
        // Send welcome message
        try {
          const user = await client.users.fetch(relationship.id);
          if (user) {
            await user.send('Hello! Thanks for the friend request! 👋');
            console.log('💬 Welcome message sent!');
          }
        } catch (msgError) {
          console.log('⚠️ Welcome message failed:', msgError.message);
        }
        
      } catch (error) {
        console.error('❌ Auto-accept failed:', error.message);
        
        if (error.message.includes('CAPTCHA')) {
          console.log('🛡️ CAPTCHA required - skipping auto-accept');
        }
      }
    }
  });
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Logged in and monitoring!');
    
    // Wait for ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Manually check and trigger for existing requests
    console.log('\n🔄 Checking for existing incoming requests...');
    const relationships = await client.api.users('@me').relationships.get();
    const incomingRequests = relationships.filter(rel => rel.type === 1);
    
    console.log(`Found ${incomingRequests.length} incoming requests`);
    
    // Try to accept first one as test
    if (incomingRequests.length > 0) {
      const testRequest = incomingRequests[0];
      console.log(`🧪 Testing auto-accept with ${testRequest.user?.username}...`);
      
      try {
        await client.api.users('@me').relationships[testRequest.id].put({
          type: 1
        });
        console.log('✅ Manual accept test succeeded!');
        
        // Send welcome message
        try {
          const user = await client.users.fetch(testRequest.id);
          if (user) {
            await user.send('Hello! Thanks for the friend request! 👋');
            console.log('💬 Welcome message sent!');
          }
        } catch (msgError) {
          console.log('⚠️ Welcome message failed:', msgError.message);
        }
        
      } catch (error) {
        console.log('❌ Manual accept failed:', error.message);
        
        if (error.message.includes('CAPTCHA')) {
          console.log('🛡️ CAPTCHA required - expected behavior');
        }
      }
    }
    
    console.log('\n👀 Monitoring for new friend requests for 10 seconds...');
    
    setTimeout(async () => {
      console.log('\n✅ Test completed!');
      await client.destroy();
    }, 10000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await client.destroy();
  }
}

// Run test
triggerAcceptTest().catch(console.error);