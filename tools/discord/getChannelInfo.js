export const getChannelInfoTool = {
  name: 'get_channel_info',
  description: 'Get information about a channel',
  parameters: {
    type: 'object',
    properties: {
      channelId: { type: 'string' }
    },
    required: ['channelId']
  }
};

export async function executeGetChannelInfo(args, client) {
  try {
    // Validate that args.channelId is actually a channel ID, not a user ID
    const { validateChannelId } = await import('../../utils/index.js');
    const channel = validateChannelId(client, args.channelId, 'channel info lookup');

    // No need to fetch again since validateChannelId already confirmed it exists
    // const channel = await client.channels.fetch(args.channelId);
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
  } catch (error) {
    return 'Failed to get channel info: ' + error.message;
  }
}