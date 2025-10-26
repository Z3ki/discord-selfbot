import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.DISCORD_USER_TOKEN;

if (!BOT_TOKEN) {
  console.error('DISCORD_USER_TOKEN not found in environment variables');
  process.exit(1);
}

async function checkRelationshipStatus() {
  console.log('📊 Checking current relationship status...');
  
  const client = new Client();
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await client.login(BOT_TOKEN);
    console.log('✅ Logged in!');
    
    // Wait for ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get all relationships
    const relationships = await client.api.users('@me').relationships.get();
    console.log(`\n📋 Total relationships: ${relationships.length}`);
    
    const friends = relationships.filter(rel => rel.type === 3);
    const incoming = relationships.filter(rel => rel.type === 1);
    const outgoing = relationships.filter(rel => rel.type === 2);
    const blocked = relationships.filter(rel => rel.type === 4);
    
    console.log(`\n👥 Friends (${friends.length}):`);
    friends.forEach(rel => {
      console.log(`  ✅ ${rel.user?.username} (${rel.id})`);
    });
    
    console.log(`\n📬 Incoming Friend Requests (${incoming.length}):`);
    incoming.forEach(rel => {
      console.log(`  📬 ${rel.user?.username} (${rel.id})`);
    });
    
    console.log(`\n📤 Outgoing Friend Requests (${outgoing.length}):`);
    outgoing.forEach(rel => {
      console.log(`  📤 ${rel.user?.username} (${rel.id})`);
    });
    
    console.log(`\n🚫 Blocked Users (${blocked.length}):`);
    blocked.forEach(rel => {
      console.log(`  🚫 ${rel.user?.username} (${rel.id})`);
    });
    
    console.log('\n✅ Relationship status check completed!');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    await client.destroy();
  }
}

// Run check
checkRelationshipStatus().catch(console.error);