import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.DISCORD_USER_TOKEN;

if (!BOT_TOKEN) {
  console.error('DISCORD_USER_TOKEN not found in environment variables');
  process.exit(1);
}

async function manualAcceptTest() {
  console.log('🔧 Manual friend request acceptance test...');
  
  const client = new Client();
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Logged in!');
    
    // Wait for ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get all relationships
    console.log('\n📊 Checking all relationships...');
    const relationships = await client.api.users('@me').relationships.get();
    
    const incomingRequests = relationships.filter(rel => rel.type === 1);
    console.log(`Found ${incomingRequests.length} incoming friend requests:`);
    
    for (const request of incomingRequests) {
      console.log(`  📬 ${request.user?.username} (${request.id})`);
      
      // Try to accept each one
      try {
        console.log(`🔄 Accepting friend request from ${request.user?.username}...`);
        
        await client.api.users('@me').relationships[request.id].put({
          type: 1
        });
        
        console.log(`✅ Accepted friend request from ${request.user?.username}!`);
        
        // Send welcome message
        try {
          const user = await client.users.fetch(request.id);
          if (user) {
            await user.send('Hello! Thanks for the friend request! 👋');
            console.log(`💬 Welcome message sent to ${request.user?.username}!`);
          }
        } catch (msgError) {
          console.log(`⚠️ Welcome message failed: ${msgError.message}`);
        }
        
      } catch (error) {
        console.log(`❌ Failed to accept ${request.user?.username}: ${error.message}`);
        
        if (error.message.includes('CAPTCHA')) {
          console.log(`🛡️ CAPTCHA required for ${request.user?.username}`);
        }
      }
    }
    
    console.log('\n✅ Manual accept test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.destroy();
  }
}

// Run test
manualAcceptTest().catch(console.error);