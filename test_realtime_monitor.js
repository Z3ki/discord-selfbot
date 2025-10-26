import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.DISCORD_USER_TOKEN;

if (!BOT_TOKEN) {
  console.error('DISCORD_USER_TOKEN not found in environment variables');
  process.exit(1);
}

async function realtimeMonitor() {
  console.log('👀 Real-time friend request monitor...');
  console.log('🎯 Will auto-accept any incoming friend requests');
  
  const client = new Client();
  
  // Set up the exact same handler as the main bot
  client.on('relationshipAdd', async (relationship) => {
    console.log('🔔 RELATIONSHIP ADDED EVENT!');
    console.log('Relationship object:', relationship);
    console.log('User ID:', relationship.id);
    console.log('Type:', relationship.type);
    console.log('Username:', relationship.user?.username);
    
    if (relationship.type === 1) { // 1 = incoming friend request
      console.log('📬 INCOMING FRIEND REQUEST DETECTED!');
      console.log(`From: ${relationship.user?.username} (${relationship.id})`);
      
      // Automatically accept the friend request
      try {
        console.log('✅ Attempting to auto-accept...');
        
        // Accept the friend request using API method
        await client.api.users('@me').relationships[relationship.id].put({
          type: 1
        });

        console.log('🎉 FRIEND REQUEST ACCEPTED!');
        console.log(`User: ${relationship.user?.username} (${relationship.id})`);

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
        
        if (error.message.includes('CAPTCHA')) {
          console.log('🛡️ CAPTCHA required - cannot auto-accept this request');
        }
      }
    }
  });
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Logged in and monitoring for friend requests!');
    
    // Wait for ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check current status
    console.log('\n📊 Current relationships:');
    const relationships = await client.api.users('@me').relationships.get();
    console.log(`Total: ${relationships.length}`);
    
    relationships.forEach(rel => {
      if (rel.type === 1) {
        console.log(`  📬 ${rel.user?.username} (${rel.id}) - Incoming Friend Request`);
      } else if (rel.type === 3) {
        console.log(`  👥 ${rel.user?.username} (${rel.id}) - Friend`);
      }
    });
    
    console.log('\n👀 Monitoring for new friend requests... (Press Ctrl+C to stop)');
    
    // Keep running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping monitor...');
      await client.destroy();
      console.log('✅ Logged out');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Monitor failed:', error.message);
    process.exit(1);
  }
}

// Run monitor
realtimeMonitor().catch(console.error);