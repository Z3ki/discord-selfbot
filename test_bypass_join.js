import { Client } from 'discord.js-selfbot-v13';
import { config } from 'dotenv';

config();

const client = new Client();

client.on('ready', async () => {
  console.log('Bot is ready, attempting bypass methods...');
  
  const inviteCode = 'bYUQkGjvH';
  
  // Method 1: Try direct API call
  try {
    console.log('🔄 Method 1: Direct API call...');
    const result1 = await client.api.invites(inviteCode).get();
    console.log('Invite info:', result1);
    
    if (result1.guild) {
      console.log('🚪 Attempting to join via API...');
      const joinResult1 = await client.api.invites(inviteCode).post();
      console.log('Join result 1:', joinResult1);
    }
  } catch (error1) {
    console.log('❌ Method 1 failed:', error1.message);
  }
  
  // Method 2: Try REST API
  try {
    console.log('🔄 Method 2: REST API...');
    const result2 = await client.rest.post(`/invites/${inviteCode}`);
    console.log('Join result 2:', result2);
  } catch (error2) {
    console.log('❌ Method 2 failed:', error2.message);
  }
  
  // Method 3: Try alternative endpoint
  try {
    console.log('🔄 Method 3: Alternative endpoint...');
    const result3 = await client.api.invites[inviteCode].post();
    console.log('Join result 3:', result3);
  } catch (error3) {
    console.log('❌ Method 3 failed:', error3.message);
  }
  
  // Method 4: Try with different parameters
  try {
    console.log('🔄 Method 4: With parameters...');
    const result4 = await client.acceptInvite(inviteCode, { 
      bypassVerification: true,
      skipCaptcha: true 
    });
    console.log('Join result 4:', result4);
  } catch (error4) {
    console.log('❌ Method 4 failed:', error4.message);
  }
  
  // Method 5: Try webhook approach
  try {
    console.log('🔄 Method 5: Webhook approach...');
    const result5 = await client.fetchInvite(inviteCode);
    console.log('Fetched invite:', result5);
    
    if (result5.guild) {
      console.log('🚪 Attempting to join guild directly...');
      // This might not work but worth trying
      const joinResult5 = await client.guilds.join(result5.guild.id);
      console.log('Direct guild join result:', joinResult5);
    }
  } catch (error5) {
    console.log('❌ Method 5 failed:', error5.message);
  }
  
  // Check current servers after all attempts
  setTimeout(() => {
    console.log('\n📊 Current servers after all attempts:');
    client.guilds.cache.forEach(guild => {
      console.log(`  🏠 ${guild.name} (${guild.id})`);
    });
    process.exit(0);
  }, 3000);
});

client.login(process.env.DISCORD_USER_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
  process.exit(1);
});