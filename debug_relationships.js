import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.DISCORD_USER_TOKEN;

if (!BOT_TOKEN) {
  console.error('DISCORD_USER_TOKEN not found in environment variables');
  process.exit(1);
}

async function debugRelationships() {
  console.log('🔍 Debugging relationship structure...');
  
  const client = new Client();
  
  try {
    // Login the bot
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Successfully logged in');
    
    // Wait for everything to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check all relationships
    console.log('\n📊 Debugging relationship objects...');
    const relationships = client.relationships.cache;
    console.log(`Total relationships: ${relationships.size}`);
    
    let count = 0;
    relationships.forEach((relationship, userId) => {
      count++;
      console.log(`\n--- Relationship ${count} ---`);
      console.log(`User ID: ${userId}`);
      console.log(`Relationship object:`, relationship);
      console.log(`Relationship type:`, relationship.type);
      console.log(`Relationship constructor:`, relationship.constructor.name);
      console.log(`Relationship keys:`, Object.keys(relationship));
      
      if (relationship.user) {
        console.log(`User object:`, relationship.user);
        console.log(`Username: ${relationship.user.username}#${relationship.user.discriminator}`);
      }
      
      // Only show first 3 to avoid spam
      if (count >= 3) {
        console.log('\n... (showing first 3 relationships only)');
        return;
      }
    });
    
    console.log('\n✅ Debug completed!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
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

// Run the debug
debugRelationships().catch(console.error);