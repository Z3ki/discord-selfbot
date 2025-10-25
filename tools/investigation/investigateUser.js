import fs from 'fs';
import { validateUserId } from '../../utils/index.js';
import { logger } from '../../utils/logger.js';

// Helper function to resolve user identifier (ID or username) to user ID
export async function resolveUserId(identifier, client, message) {
  // Check for mention format <@id> or <@!id>
  const mentionMatch = identifier.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return mentionMatch[1];
  }

  // If it's already a numeric ID, return it
  if (/^\d+$/.test(identifier)) {
    return identifier;
  }

  // Otherwise, search for username/display name in the guild
  if (message.guild) {
    try {
      const member = message.guild.members.cache.find(m =>
        m.user.username.toLowerCase() === identifier.toLowerCase() ||
        (m.displayName && m.displayName.toLowerCase() === identifier.toLowerCase()) ||
        m.user.tag.toLowerCase() === identifier.toLowerCase()
      );
      if (member) {
        return member.id;
      }
    } catch (error) {
      logger.error('Error resolving user:', { error: error.message });
        }
      }
}

export const investigateUserTool = {
  name: 'investigate_user',
  description: 'Comprehensive user investigation tool that provides detailed information about any Discord user. Returns: Basic user info (username, display name, ID, bot status, verification status, account creation date, account age); Profile details (bio, pronouns, accent color, banner URL, avatar URL, avatar decoration); Account security (MFA/2FA status, verification status); Server membership details (nickname, display name, roles count, join date, display color); Administrative access levels and permissions breakdown; Message activity statistics (total messages found, channels checked, recent activity); And additional insights about user status and capabilities. SELFBOT LIMITATIONS: Can only investigate users in mutual servers. Bio access heavily restricted. Use this when you need to know about a user\'s profile, status, permissions, or activity. Accepts user ID, username, display name, or Discord mention.',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User identifier to investigate. Can be: numeric user ID, username (case-insensitive), display name, or Discord mention format (@user). The tool will automatically resolve the identifier to a user ID and fetch all available information.' }
    },
    required: ['userId']
  }
};

export async function executeInvestigateUser(args, client, message) {
  try {
    // Validate that args.userId is not a channel ID
    validateUserId(client, args.userId, 'user investigation');
  } catch (error) {
    return error.message.replace('INVALID_USER_ID: ', 'ERROR: ');
  }

  let userId;
  try {
    userId = await resolveUserId(args.userId, client, message);
  } catch (error) {
    return `Error: ${error.message}`;
  }
  let user;
    let info = `User Investigation for ${userId}\n\n`;

  // Fetch user info
  let userBio = 'No bio set';
  let banner = 'None';
  let userFlags = 'None';
  let pronouns = 'None';
  let premiumType = 'None';
  try {
    // Try different methods to fetch user in selfbot
    user = await client.users.fetch(userId).catch(async () => {
      // Fallback: try to get user from cache or other methods
      return client.users.cache.get(userId) || null;
    });

    if (user) {
      // Get bio from user.bio property (available in selfbot)
      if (user.bio && user.bio !== 'No bio' && user.bio.trim()) {
        userBio = user.bio;
      } else {
        userBio = 'No bio set';
      }

      // Get additional profile data
      if (user.pronouns) {
        pronouns = user.pronouns;
      }

      if (user.premiumType !== null && user.premiumType !== undefined) {
        // Discord premium types: 0 = None, 1 = Nitro Classic, 2 = Nitro, 3 = Nitro Basic
        const premiumTypes = ['None', 'Nitro Classic', 'Nitro', 'Nitro Basic'];
        premiumType = premiumTypes[user.premiumType] || `Unknown (${user.premiumType})`;
      }
    }
  } catch (error) {
    user = null;
  }

  if (user) {
    // Calculate account age
    const accountAge = user.createdAt ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    info += `Basic User Info:
Username: ${user.username}
Display Name: ${user.displayName || 'None'}
Tag: ${user.tag}
ID: ${user.id}
Bot: ${user.bot ? 'Yes' : 'No'}
Verified: ${user.verified ? 'Yes' : 'No'}
Account Age: ${accountAge} days (${user.createdAt ? user.createdAt.toLocaleDateString() : 'Unknown'})

Bio: ${userBio}
Pronouns: ${pronouns}

Profile Details:
Accent Color: ${user.hexAccentColor || 'None'}
Banner: ${banner}
Avatar: ${user.displayAvatarURL({ size: 128 })}
Avatar Decoration: ${user.avatarDecoration ? 'Has decoration' : 'None'}

Account Flags: ${userFlags}
System: ${user.system ? 'Yes' : 'No'}
MFA Enabled: ${user.mfaEnabled ? 'Yes' : 'No'}`;

    // Add presence/status information (limited in selfbot context)
    try {
      const presence = client.presences?.cache.get(userId);
      if (presence) {
        info += `\n\nCurrent Status:
Status: ${presence.status || 'Unknown'}
Client Status: ${Object.entries(presence.clientStatus || {}).map(([client, status]) => `${client}: ${status}`).join(', ') || 'None'}`;

        // Activities
        if (presence.activities && presence.activities.length > 0) {
          info += `\nActivities: ${presence.activities.length}`;
          presence.activities.slice(0, 3).forEach((activity, index) => {
            info += `\n  ${index + 1}. ${activity.name || 'Unknown'} (${activity.type || 'Unknown'})`;
            if (activity.details) info += ` - ${activity.details}`;
            if (activity.state) info += ` - ${activity.state}`;
          });
          if (presence.activities.length > 3) {
            info += `\n  ... and ${presence.activities.length - 3} more`;
          }
        } else {
          info += `\nActivities: None`;
        }
      } else {
        info += `\n\nCurrent Status: Not available (selfbot limitation - presence data only cached for recent interactions)`;
      }
     } catch (error) {
       info += `\n\nCurrent Status: Error fetching presence`;
     }
  } else {
    info += `User Info: Unable to fetch user details\n`;
    info += `This may be because:\n`;
    info += `  - User is not in any mutual servers\n`;
    info += `  - Selfbot lacks permission to access user data\n`;
    info += `  - User ID is invalid or user doesn't exist\n`;
    info += `User ID provided: ${userId}\n\n`;

    // Still try to get presence if available (very limited in selfbot)
    try {
      const presence = client.presences?.cache.get(userId);
      if (presence) {
        info += `Limited Status Info Available (selfbot cached data only):\n`;
        info += `Status: ${presence.status || 'Unknown'}\n`;
        if (presence.activities && presence.activities.length > 0) {
          info += `Current Activity: ${presence.activities[0].name || 'Unknown'}\n`;
        }
      } else {
        info += `No cached presence data available for this user.\n`;
      }
    } catch (error) {
      // Ignore presence errors
    }
  }

  // Check guild member info if in a guild
  if (message.guild) {
    try {
      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (member) {
        // Calculate member age in guild
        const memberAge = member.joinedAt ? Math.floor((Date.now() - member.joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        info += `\n\nMember Info (in ${message.guild.name}):
Nickname: ${member.nickname || 'None'}
Display Name: ${member.displayName}
Display Color: #${member.displayColor.toString(16).padStart(6, '0')}
Joined: ${member.joinedAt ? member.joinedAt.toLocaleDateString() : 'Unknown'} (${memberAge} days ago)
Roles: ${member.roles.cache.size} total`;

        // List important roles
        const importantRoles = member.roles.cache
          .filter(role => role.name !== '@everyone')
          .sort((a, b) => b.position - a.position)
          .slice(0, 5)
          .map(role => role.name)
          .join(', ');
        if (importantRoles) {
          info += `\nKey Roles: ${importantRoles}`;
        }

        info += `\nTop Role: ${member.roles.highest.name} (Position: ${member.roles.highest.position})`;

        // Handle permissions (may not be available in selfbot mode)
        try {
          const permissions = member.permissions.toArray();
          info += `\nPermissions: ${permissions.slice(0, 8).join(', ')}${permissions.length > 8 ? '...' : ''}`;
        } catch (error) {
          info += `\nPermissions: Not available (selfbot limitations)`;
        }

        info += `\nPremium: ${member.premiumSince ? `Since ${member.premiumSince.toLocaleDateString()}` : 'No'}
Communication Disabled: ${member.communicationDisabledUntil ? `Until ${member.communicationDisabledUntil.toLocaleDateString()}` : 'No'}`;

        // Voice state details
        if (member.voice?.channel) {
          info += `\n\nVoice State:
Channel: ${member.voice.channel.name}
Server Deafened: ${member.voice.deaf ? 'Yes' : 'No'}
Server Muted: ${member.voice.mute ? 'Yes' : 'No'}
Self Deafened: ${member.voice.selfDeaf ? 'Yes' : 'No'}
Self Muted: ${member.voice.selfMute ? 'Yes' : 'No'}
Streaming: ${member.voice.streaming ? 'Yes' : 'No'}
Video: ${member.voice.selfVideo ? 'Yes' : 'No'}`;
        } else {
          info += `\nVoice Channel: Not in voice`;
        }
      }
    } catch (error) {
      info += '\n\n❌ Member info: Could not fetch member details';
    }
  }

  // Fetch recent messages directly from Discord channels
  try {
    let userMessages = [];
    let totalMessageCount = 0;
    let channelsChecked = 0;
    let channelsWithMessages = new Set();

    // Get all text channels the bot has access to
    if (!client.user) {
      info += `\n\n• Recent Activity: Not available (client user not initialized)`;
      return info;
    }
    
    const allChannels = client.channels.cache.filter(channel =>
      channel.type === 0 && // TEXT CHANNEL
      channel.permissionsFor(client.user).has('ViewChannel') &&
      channel.permissionsFor(client.user).has('ReadMessageHistory')
    );

    // Limit to prevent excessive API calls (check up to 20 channels)
    const channelsToCheck = Array.from(allChannels.values()).slice(0, 20);

    for (const channel of channelsToCheck) {
      try {
        channelsChecked++;
        // Fetch last 100 messages from each channel
        const messages = await channel.messages.fetch({ limit: 100 });
        const userChannelMessages = messages.filter(msg =>
          msg.author.id === userId &&
          !msg.author.bot // Exclude bot messages
        );

        if (userChannelMessages.size > 0) {
          channelsWithMessages.add(channel.id);
          totalMessageCount += userChannelMessages.size;

          // Collect recent messages (up to 5 per channel for summary)
          const recentFromChannel = Array.from(userChannelMessages.values())
            .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
            .slice(0, 5)
            .map(msg => ({
              content: msg.content,
              timestamp: msg.createdTimestamp,
              channel: channel.name,
              channelId: channel.id
            }));

          userMessages.push(...recentFromChannel);
        }
      } catch (error) {
        // Skip channels we can't access
        continue;
      }
    }

    // Sort all collected messages by timestamp (most recent first)
    userMessages.sort((a, b) => b.timestamp - a.timestamp);

    // Keep only the 15 most recent messages total
    userMessages = userMessages.slice(0, 15);

    info += `\n\nMessage Activity (Live Data):
Total Messages Found: ${totalMessageCount}
Channels Checked: ${channelsChecked}
Channels with User Messages: ${channelsWithMessages.size}`;

    if (userMessages.length > 0) {
      info += `\nMost Recent Messages:`;
      userMessages.forEach((msg, index) => {
        const content = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '');
        const date = new Date(msg.timestamp).toLocaleString();
        const channelName = msg.channel || 'Unknown Channel';
        info += `\n  ${index + 1}. "${content}" (${date} in #${channelName})`;
      });
    } else {
      info += `\nRecent Messages: None found in recent channel history`;
    }

    // Also show data from memory as fallback/supplement
    try {
      const channelMemories = JSON.parse(await fs.promises.readFile('data-selfbot/channelMemories.json', 'utf8'));
      let memoryMessageCount = 0;
      for (const messages of Object.values(channelMemories)) {
        for (const msg of messages) {
          if (msg.user.includes(userId) || msg.user.includes(user?.username || '')) {
            memoryMessageCount++;
          }
        }
      }
      if (memoryMessageCount > 0) {
        info += `\nAdditional Messages in Bot Memory: ${memoryMessageCount}`;
      }
    } catch (e) {
      // Ignore memory read errors
    }

  } catch (e) {
    info += '\n\nMessage Activity: Error fetching live data';
  }

    // Additional statistics and insights
    try {
      info += `\n\nAdditional Insights:`;

      // Check if user is the server owner
      if (message.guild && message.guild.ownerId === userId) {
        info += `\nServer Owner: Yes`;
      }

      // Check if user has administrative permissions
      if (message.guild) {
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (member) {
          try {
            const hasAdmin = member.permissions.has('Administrator');
            const hasManageGuild = member.permissions.has('ManageGuild');
            const hasManageRoles = member.permissions.has('ManageRoles');
            const hasManageChannels = member.permissions.has('ManageChannels');
            const hasKickMembers = member.permissions.has('KickMembers');
            const hasBanMembers = member.permissions.has('BanMembers');
            const hasManageMessages = member.permissions.has('ManageMessages');

            let adminLevel = 'Limited';
            if (hasAdmin) adminLevel = 'Full Administrator';
            else if (hasManageGuild) adminLevel = 'Server Manager';
            else if (hasManageRoles || hasManageChannels) adminLevel = 'Channel/Role Manager';
            else if (hasKickMembers || hasBanMembers || hasManageMessages) adminLevel = 'Moderation Access';

            info += `\nAdministrative Access: ${adminLevel}`;

            // Detailed permissions breakdown
            const keyPermissions = [];
            if (hasAdmin) keyPermissions.push('Administrator');
            if (hasManageGuild) keyPermissions.push('Manage Server');
            if (hasManageRoles) keyPermissions.push('Manage Roles');
            if (hasManageChannels) keyPermissions.push('Manage Channels');
            if (hasManageMessages) keyPermissions.push('Manage Messages');
            if (hasKickMembers) keyPermissions.push('Kick Members');
            if (hasBanMembers) keyPermissions.push('Ban Members');
            if (member.permissions.has('MentionEveryone')) keyPermissions.push('Mention @everyone');
            if (member.permissions.has('UseExternalEmojis')) keyPermissions.push('Use External Emojis');
            if (member.permissions.has('AttachFiles')) keyPermissions.push('Attach Files');

            if (keyPermissions.length > 0) {
              info += `\nKey Permissions: ${keyPermissions.slice(0, 5).join(', ')}${keyPermissions.length > 5 ? '...' : ''}`;
            }

            // Member status in guild
            info += `\nMember Since: ${member.joinedAt ? member.joinedAt.toLocaleDateString() : 'Unknown'}`;
            const memberAge = member.joinedAt ? Math.floor((Date.now() - member.joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
            info += ` (${memberAge} days ago)`;

            // Premium/boost status
            if (member.premiumSince) {
              info += `\nServer Booster: Yes (since ${member.premiumSince.toLocaleDateString()})`;
            }

            // Voice activity
            if (member.voice?.channel) {
              info += `\nCurrently in Voice: ${member.voice.channel.name}`;
              if (member.voice.selfMute) info += ' (muted)';
              if (member.voice.selfDeaf) info += ' (deafened)';
              if (member.voice.streaming) info += ' (streaming)';
            }
          } catch (error) {
            info += `\nAdministrative Access: Not available (selfbot limitations)`;
          }
        }
      }

      // Account verification status (only available for the bot's own account)
    if (user && client.user) {
        if (user.id === client.user.id) {
          // These properties are only accessible for the bot's own account
          info += `\nEmail Verified: ${user.verified ? 'Yes' : 'Unknown'}`;
          info += `\nMFA Enabled: ${user.mfaEnabled ? 'Yes' : 'No'}`;
        }
        // Premium data is available for all users
        info += `\nPremium Type: ${premiumType}`;
        if (user.premiumSince) {
          info += `\nPremium Since: ${user.premiumSince.toLocaleDateString()}`;
        }
      }

      // Cross-server presence (if available)
      try {
        const presence = client.presences?.cache.get(userId);
        if (presence) {
          info += `\nCurrent Status: ${presence.status || 'Unknown'}`;
          if (presence.activities && presence.activities.length > 0) {
            const primaryActivity = presence.activities[0];
            info += `\nActivity: ${primaryActivity.name || 'Unknown'}`;
            if (primaryActivity.type) info += ` (${primaryActivity.type})`;
            if (primaryActivity.details) info += ` - ${primaryActivity.details}`;
          }
        }
      } catch (error) {
        // Presence might not be available
      }
    } catch (error) {
      info += `\n\nAdditional Insights: Error gathering data`;
    }

    // Check if user has administrative permissions
    if (message.guild) {
      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (member) {
        try {
          const hasAdmin = member.permissions.has('Administrator');
          const hasManageGuild = member.permissions.has('ManageGuild');
          const hasManageRoles = member.permissions.has('ManageRoles');
          const hasManageChannels = member.permissions.has('ManageChannels');
          const hasKickMembers = member.permissions.has('KickMembers');
          const hasBanMembers = member.permissions.has('BanMembers');
          const hasManageMessages = member.permissions.has('ManageMessages');

          let adminLevel = 'Limited';
          if (hasAdmin) adminLevel = 'Full Administrator';
          else if (hasManageGuild) adminLevel = 'Server Manager';
          else if (hasManageRoles || hasManageChannels) adminLevel = 'Channel/Role Manager';
          else if (hasKickMembers || hasBanMembers || hasManageMessages) adminLevel = 'Moderation Access';

          info += `\n• Administrative Access: ${adminLevel}`;

          // Detailed permissions breakdown
          const keyPermissions = [];
          if (hasAdmin) keyPermissions.push('Administrator');
          if (hasManageGuild) keyPermissions.push('Manage Server');
          if (hasManageRoles) keyPermissions.push('Manage Roles');
          if (hasManageChannels) keyPermissions.push('Manage Channels');
          if (hasManageMessages) keyPermissions.push('Manage Messages');
          if (hasKickMembers) keyPermissions.push('Kick Members');
          if (hasBanMembers) keyPermissions.push('Ban Members');
          if (member.permissions.has('MentionEveryone')) keyPermissions.push('Mention @everyone');
          if (member.permissions.has('UseExternalEmojis')) keyPermissions.push('Use External Emojis');

          if (keyPermissions.length > 0) {
          info += `\n• Key Permissions: ${keyPermissions.slice(0, 5).join(', ')}${keyPermissions.length > 5 ? '...' : ''}`;
        }

        // Member status in guild
        info += `\n• Member Since: ${member.joinedAt ? member.joinedAt.toLocaleDateString() : 'Unknown'}`;
        const memberAge = member.joinedAt ? Math.floor((Date.now() - member.joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        info += ` (${memberAge} days ago)`;

        // Premium/boost status
        if (member.premiumSince) {
          info += `\n• Server Booster: Yes (since ${member.premiumSince.toLocaleDateString()})`;
        }

        // Voice activity
        if (member.voice?.channel) {
          info += `\n• Currently in Voice: ${member.voice.channel.name}`;
          if (member.voice.selfMute) info += ' (muted)';
          if (member.voice.selfDeaf) info += ' (deafened)';
          if (member.voice.streaming) info += ' (streaming)';
        }
        } catch (error) {
          info += `\n• Administrative Access: Not available (selfbot limitations)`;
        }
      }
    }

    // Account verification status
    if (user) {
      info += `\n• Email Verified: ${user.verified ? 'Yes' : 'Unknown'}`;
      info += `\n• MFA Enabled: ${user.mfaEnabled ? 'Yes' : 'No'}`;
    }

    // Cross-server presence (if available)
    try {
      const presence = client.presences?.cache.get(userId);
      if (presence) {
        info += `\n• Current Status: ${presence.status || 'Unknown'}`;
        if (presence.activities && presence.activities.length > 0) {
          const primaryActivity = presence.activities[0];
          info += `\n• Activity: ${primaryActivity.name || 'Unknown'}`;
          if (primaryActivity.type) info += ` (${primaryActivity.type})`;
          if (primaryActivity.details) info += ` - ${primaryActivity.details}`;
        }
      }
    } catch (error) {
      // Presence might not be available
    }

  return info;
}