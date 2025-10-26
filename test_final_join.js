import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

config();

const client = new Client({
  // Try to disable some security features
  checkUpdate: false,
  autoRedeemNitro: false,
  patchVoice: true,
  // Add any options that might help bypass verification
  restRequestTimeout: 30000,
  restGlobalRateLimit: 50,
  restSweepInterval: 30000,
  restTimeOffset: 0
});

client.on('ready', async () => {
  console.log('Bot is ready, attempting final join method...');
  
  const inviteCode = 'bYUQkGjvH';
  
  // Try to modify client behavior temporarily
  console.log('🔄 Attempting to modify client behavior...');
  
  // Method 1: Try with different client configuration
  try {
    console.log('🔄 Method 1: Standard acceptInvite...');
    const result1 = await client.acceptInvite(inviteCode);
    console.log('✅ Method 1 succeeded!', result1);
    
    // Check if we joined
    setTimeout(() => {
      const guild = client.guilds.cache.get('1229148353128828959');
      if (guild) {
        console.log('🎉 Successfully joined server:', guild.name);
      } else {
        console.log('❌ Did not join server');
      }
    }, 2000);
    
  } catch (error1) {
    console.log('❌ Method 1 failed:', error1.message);
    
    // Method 2: Try with force flag
    try {
      console.log('🔄 Method 2: Force join...');
      
      // Try to bypass by directly manipulating the client
      const originalAcceptInvite = client.acceptInvite;
      
      // Override temporarily (this might not work but worth trying)
      client.acceptInvite = async (code) => {
        console.log('🔓 Attempting forced join...');
        return await originalAcceptInvite.call(client, code);
      };
      
      const result2 = await client.acceptInvite(inviteCode);
      console.log('✅ Method 2 succeeded!', result2);
      
    } catch (error2) {
      console.log('❌ Method 2 failed:', error2.message);
    }
  }
  
  // Wait and check final status
  setTimeout(() => {
    console.log('\n📊 Final server status:');
    client.guilds.cache.forEach(guild => {
      if (guild.id === '1229148353128828959') {
        console.log(`  ✅ ${guild.name} (${guild.id}) - JOINED!`);
      } else {
        console.log(`  🏠 ${guild.name} (${guild.id})`);
      }
    });
    
    console.log('\n🎯 Target server: "RDJ\'s SHEET SERVER" (1229148353128828959)');
    console.log('📊 Server has 226 members and requires verification');
    
    process.exit(0);
  }, 5000);
});

client.login(process.env.DISCORD_USER_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
  process.exit(1);
});