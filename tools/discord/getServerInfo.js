export const getServerInfoTool = {
  name: 'get_server_info',
  description: 'Get information about the server',
  parameters: {
    type: 'object',
    properties: {}
  }
};

export async function executeGetServerInfo(args, message) {
  try {
    const guild = message.guild;
    if (!guild) return 'Not in a server';

    // Enhanced channel breakdown
    const channels = guild.channels.cache;
    const textChannels = channels.filter(c => c.type === 'GUILD_TEXT').size;
    const voiceChannels = channels.filter(c => c.type === 'GUILD_VOICE').size;
    const stageChannels = channels.filter(c => c.type === 'GUILD_STAGE_VOICE').size;
    const forumChannels = channels.filter(c => c.type === 'GUILD_FORUM').size;
    const newsChannels = channels.filter(c => c.type === 'GUILD_NEWS').size;
    const categories = channels.filter(c => c.type === 'GUILD_CATEGORY').size;

    // Role analytics
    const roles = guild.roles.cache;
    const adminRoles = roles.filter(r => r.permissions.has('ADMINISTRATOR')).size;
    const modRoles = roles.filter(r => r.permissions.has('KICK_MEMBERS') || r.permissions.has('BAN_MEMBERS')).size;
    const managedRoles = roles.filter(r => r.managed).size;

    // Emoji and sticker counts
    const emojis = guild.emojis.cache;
    const totalEmojis = emojis.size;
    const animatedEmojis = emojis.filter(e => e.animated).size;

    // Member analytics (basic)
    const members = guild.members.cache;
    const onlineMembers = members.filter(m => m.presence?.status === 'online').size;
    const botMembers = members.filter(m => m.user.bot).size;

    const info = `Server: ${guild.name}
ID: ${guild.id}
Owner: <@${guild.ownerId}>
Members: ${guild.memberCount || 'Unknown'} total (${botMembers} bots, ${onlineMembers} online)
Max Members: ${guild.maxMembers || 'Unknown'}
Created: ${guild.createdAt ? guild.createdAt.toLocaleDateString() : 'Unknown'} (${guild.createdAt ? Math.floor((Date.now() - guild.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0} days ago)
Description: ${guild.description || 'None'}

Channels Breakdown:
Total: ${channels.size}
Text: ${textChannels} | Voice: ${voiceChannels} | Stage: ${stageChannels}
Forum: ${forumChannels} | News: ${newsChannels} | Categories: ${categories}

Channel Details:
${channels.filter(c => c.type === 'GUILD_TEXT').map(c => `${c.name}: NSFW=${c.nsfw}, Position=${c.position}, RateLimit=${c.rateLimitPerUser}s`).slice(0, 5).join('\n')}
${channels.size > 5 ? `... and ${channels.size - 5} more channels` : ''}

Roles Analytics:
Total: ${roles.size} (${managedRoles} managed by integrations)
Admin Roles: ${adminRoles} | Mod Roles: ${modRoles}
Highest Role: ${roles.highest?.name || 'None'} (Position: ${roles.highest?.position || 0})

Emojis & Stickers:
Emojis: ${totalEmojis} total (${animatedEmojis} animated)
Stickers: ${guild.stickers.cache.size}

Premium Status:
Tier: ${guild.premiumTier || 'NONE'}
Boosts: ${guild.premiumSubscriptionCount || 0}
Booster Role: ${guild.roles.premiumSubscriberRole?.name || 'None'}

Server Features: ${guild.features.length > 0 ? guild.features.slice(0, 10).join(', ') + (guild.features.length > 10 ? '...' : '') : 'None'}

Security & Verification:
Verification Level: ${guild.verificationLevel || 'NONE'}
NSFW Level: ${guild.nsfwLevel || 'DEFAULT'}
Content Filter: ${guild.explicitContentFilter || 'DISABLED'}
MFA Level: ${guild.mfaLevel || 'NONE'}

Special Channels:
AFK Channel: ${guild.afkChannelId ? `<#${guild.afkChannelId}> (${guild.afkTimeout}s timeout)` : 'None'}
System Channel: ${guild.systemChannelId ? `<#${guild.systemChannelId}>` : 'None'}
Rules Channel: ${guild.rulesChannelId ? `<#${guild.rulesChannelId}>` : 'None'}
Public Updates: ${guild.publicUpdatesChannelId ? `<#${guild.publicUpdatesChannelId}>` : 'None'}

External Features:
Vanity URL: ${guild.vanityURLCode ? `discord.gg/${guild.vanityURLCode}` : 'None'}
Widget: ${guild.widgetEnabled ? 'Enabled' : 'Disabled'}
Discoverable: ${guild.features.includes('DISCOVERABLE') ? 'Yes' : 'No'}
Community: ${guild.features.includes('COMMUNITY') ? 'Yes' : 'No'}`;

    return info;
  } catch (error) {
    return 'Failed to get server info: ' + error.message;
  }
}