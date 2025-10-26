import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.DISCORD_USER_TOKEN;

if (!BOT_TOKEN) {
  console.error('DISCORD_USER_TOKEN not found in environment variables');
  process.exit(1);
}

async function finalMonitor() {
  console.log('👀 Final friend request monitor...');
  console.log('🎯 Auto-accepting all incoming friend requests');
  
  const client = new Client();
  
  // Enhanced relationship handler
  client.on('relationshipAdd', async (relationship) => {
    console.log('🔔 RELATIONSHIP ADDED!');
    console.log('Raw relationship object:', relationship);
    
    const userId = relationship.id || relationship.userId || 'unknown';
    const type = relationship.type || 'unknown';
    const username = relationship.user?.username || 'unknown';
    
    console.log('Parsed data:', {
      userId,
      type,
      typeName: getRelationshipTypeName(type),
      username
    });

    if (type === 1) { // 1 = incoming friend request
      console.log('📬 INCOMING FRIEND REQUEST! Auto-accepting...');
      
      try {
        // Accept using multiple methods
        console.log('🔄 Method 1: API PUT...');
        await client.api.users('@me').relationships[userId].put({
          type: 1
        });
        console.log('✅ Method 1 succeeded!');
        
        // Send welcome message
        try {
          const user = await client.users.fetch(userId);
          if (user) {
            await user.send('Hello! Thanks for the friend request! 👋');
            console.log('💬 Welcome message sent!');
          }
        } catch (msgError) {
          console.log('⚠️ Welcome message failed:', msgError.message);
        }
        
      } catch (error) {
        console.error('❌ Auto-accept failed:', error.message);
        
        // Try fallback method
        try {
          console.log('🔄 Method 2: addFriend...');
          await client.relationships.addFriend(userId);
          console.log('✅ Method 2 succeeded!');
        } catch (fallbackError) {
          console.error('❌ All methods failed:', fallbackError.message);
        }
      }
    }
  });
  
  client.on('relationshipRemove', async (relationship) => {
    const userId = relationship.id || relationship.userId || 'unknown';
    const type = relationship.type || 'unknown';
    const username = relationship.user?.username || 'unknown';
    
    console.log('🗑️ RELATIONSHIP REMOVED:', {
      userId,
      type,
      typeName: getRelationshipTypeName(type),
      username
    });
  });
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Logged in and monitoring!');
    
    // Wait for ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Force refresh relationships
    console.log('🔄 Refreshing relationships...');
    await client.relationships.fetch();
    
    // Check current status
    console.log('\n📊 Current relationships:');
    const relationships = client.relationships.cache;
    console.log(`Total: ${relationships.size}`);
    
    relationships.forEach((rel, id) => {
      console.log(`  ${id}: Type ${rel.type} (${getRelationshipTypeName(rel.type)}) - ${rel.user?.username || 'Unknown'}`);
    });
    
    console.log('\n👀 Monitoring for 30 seconds...');
    
    // Set timeout
    setTimeout(async () => {
      console.log('\n⏰ Time\'s up! Final check...');
      
      // Final status check
      const finalRelationships = client.relationships.cache;
      console.log(`Final total: ${finalRelationships.size}`);
      
      finalRelationships.forEach((rel, id) => {
        console.log(`  ${id}: Type ${rel.type} (${getRelationshipTypeName(rel.type)}) - ${rel.user?.username || 'Unknown'}`);
      });
      
      console.log('\n🛑 Stopping monitor...');
      await client.destroy();
      console.log('✅ Done!');
      process.exit(0);
    }, 30000);
    
  } catch (error) {
    console.error('❌ Monitor failed:', error.message);
    process.exit(1);
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

// Run monitor
finalMonitor().catch(console.error);