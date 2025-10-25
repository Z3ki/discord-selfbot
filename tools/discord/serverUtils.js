export const serverUtilsTool = {
  name: 'server_utils',
  description: 'Get comprehensive server and channel information',
  parameters: {
    type: 'object',
    properties: {
      action: { 
        type: 'string', 
        enum: ['server_info', 'channel_info', 'member_list'],
        description: 'Action to perform: server_info, channel_info, or member_list'
      },
      channelId: { 
        type: 'string', 
        description: 'Channel ID for channel_info action' 
      },
      serverId: { 
        type: 'string', 
        description: 'Server ID for server_info (optional, defaults to current server)' 
      }
    },
    required: ['action']
  }
};

export async function executeServerUtils(args, client, message) {
  try {
    switch (args.action) {
      case 'server_info':
        return await getServerInfo(args, client, message);
      case 'channel_info':
        if (!args.channelId) {
          return 'Error: channelId is required for channel_info action';
        }
        return await getChannelInfo(args, client);
      case 'member_list':
        return await getMemberList(args, client, message);
      default:
        return 'Error: Invalid action. Use server_info, channel_info, or member_list';
    }
  } catch (error) {
    return `Failed to get server information: ${error.message}`;
  }
}

async function getServerInfo(args, client, message) {
  let guild;
  
  if (args.serverId) {
    guild = client.guilds.cache.get(args.serverId);
  } else if (message.guild) {
    guild = message.guild;
  }
  
  if (!guild) return 'Server not found or not in a server';

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
}

async function getChannelInfo(args, client) {
  const { validateChannelId } = await import('../../utils/index.js');
  const channel = validateChannelId(client, args.channelId, 'channel info lookup');

  if (!channel) return 'Channel not found';
  
  let info = `Channel: ${channel.name || 'Unknown'}
ID: ${channel.id}
Type: ${channel.type}
Created: ${channel.createdAt ? channel.createdAt.toLocaleDateString() : 'Unknown'}
Topic: ${channel.topic || 'None'}
Position: ${channel.position || 'Unknown'}`;

  // Add channel-specific information
  if (channel.type === 'GUILD_TEXT') {
    info += `

Text Channel Settings:
NSFW: ${channel.nsfw ? 'Yes' : 'No'}
Rate Limit: ${channel.rateLimitPerUser || 0}s
Last Message ID: ${channel.lastMessageId || 'None'}
Last Pin: ${channel.lastPinTimestamp ? new Date(channel.lastPinTimestamp).toLocaleDateString() : 'None'}
Default Archive Duration: ${channel.defaultAutoArchiveDuration || 'Unknown'}min
Permission Overwrites: ${channel.permissionOverwrites?.cache.size || 0}`;
  }

  if (channel.type === 'GUILD_VOICE') {
    info += `

Voice Channel Settings:
Bitrate: ${channel.bitrate || 64000}bps
User Limit: ${channel.userLimit || 'Unlimited'}
RTC Region: ${channel.rtcRegion || 'Auto'}
Video Quality: ${channel.videoQualityMode || 'Auto'}`;
  }

  if (channel.type === 'DM') {
    info += `

DM Settings:
Recipient: ${channel.recipient ? `${channel.recipient.tag} (${channel.recipient.id})` : 'Unknown'}`;
  }

  // Add guild information if it's a guild channel
  if (channel.guild) {
    info += `

Guild Information:
Guild: ${channel.guild.name} (${channel.guild.id})
Category: ${channel.parent ? channel.parent.name : 'None'}`;
  }

  return info;
}

async function getMemberList(args, client, message) {
  let guild;
  
  if (args.serverId) {
    guild = client.guilds.cache.get(args.serverId);
  } else if (message.guild) {
    guild = message.guild;
  }
  
  if (!guild) return 'Server not found or not in a server';

  try {
    await guild.members.fetch();
    const members = guild.members.cache;
    
    const totalMembers = members.size;
    const onlineMembers = members.filter(m => m.presence?.status === 'online').size;
    const idleMembers = members.filter(m => m.presence?.status === 'idle').size;
    const dndMembers = members.filter(m => m.presence?.status === 'dnd').size;
    const botMembers = members.filter(m => m.user.bot).size;
    const humanMembers = totalMembers - botMembers;

    // Get top members by join date and roles
    const recentMembers = members
      .sort((a, b) => b.joinedAt - a.joinedAt)
      .slice(0, 10)
      .map(m => `${m.user.tag} (joined ${m.joinedAt?.toLocaleDateString()})`)
      .join('\n');

    const highRoleMembers = members
      .filter(m => m.roles.highest.position > 0)
      .sort((a, b) => b.roles.highest.position - a.roles.highest.position)
      .slice(0, 10)
      .map(m => `${m.user.tag} - ${m.roles.highest.name}`)
      .join('\n');

    return `Member List for ${guild.name}:

**Summary:**
Total: ${totalMembers} (${humanMembers} humans, ${botMembers} bots)
Online: ${onlineMembers} | Idle: ${idleMembers} | DND: ${dndMembers}
Offline: ${totalMembers - onlineMembers - idleMembers - dndMembers}

**Recent Members (last 10):**
${recentMembers}

**Members with Highest Roles (top 10):**
${highRoleMembers}

**Member Count by Status:**
Online: ${onlineMembers}
Idle: ${idleMembers}
Do Not Disturb: ${dndMembers}
Offline: ${totalMembers - onlineMembers - idleMembers - dndMembers}
Bots: ${botMembers}`;
  } catch (error) {
    return `Failed to fetch member list: ${error.message}`;
  }
}