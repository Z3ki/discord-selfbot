export const getUserProfileCompleteTool = {
  name: 'get_user_profile_complete',
  description: 'Get complete user profile information including banner image URL, accent color, Discord badges, Nitro subscription status, and premium features. Provides detailed profile customization data and subscription information. SELFBOT LIMITATIONS: Can only profile users in mutual servers. Bio access is heavily restricted - typically only available for the bot\'s own profile due to Discord API limitations. Use this when you need to know about a user\'s profile appearance, badges, or premium status.',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User identifier: ID, username, display name, or mention' }
    },
    required: ['userId']
  }
};

export async function executeGetUserProfileComplete(args, client, message) {
  try {
    // Validate that args.userId is not a channel ID
    const { validateUserId } = await import('../../utils/index.js');
    validateUserId(client, args.userId, 'user profile lookup');

    let userId;
    try {
      // Reuse the resolveUserId function from investigateUser
      const { resolveUserId } = await import('./investigateUser.js');
      userId = await resolveUserId(args.userId, client, message);
    } catch (error) {
      return `Error: ${error.message}`;
    }

    let user;
    try {
      user = await client.users.fetch(userId).catch(() => {
        return client.users.cache.get(userId) || null;
      });
    } catch (error) {
      return `Could not fetch user: ${userId}`;
    }

    if (!user) {
      return `User not found: ${userId}`;
    }

    // Get comprehensive profile data
    const profileData = {
      basic: {
        username: user.username,
        discriminator: user.discriminator,
        tag: user.tag,
        id: user.id,
        createdAt: user.createdAt ? user.createdAt.toLocaleDateString() : 'Unknown',
        accountAge: user.createdAt ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0
      },
      appearance: {
        avatar: user.displayAvatarURL({ size: 128 }),
        avatarDecoration: user.avatarDecoration ? 'Has decoration' : 'None',
        banner: user.banner ? `Has banner (${user.banner})` : 'No banner',
        accentColor: user.accentColor || 'None',
        hexAccentColor: user.hexAccentColor || 'None'
      },
      status: {
        bot: user.bot,
        system: user.system,
        verified: user.verified,
        mfaEnabled: user.mfaEnabled,
        flags: user.flags ? user.flags.toArray().join(', ') : 'None'
      },
      nitro: {
        premiumType: user.premiumType || 'None',
        premiumSince: user.premiumSince ? user.premiumSince.toLocaleDateString() : 'Never'
      }
    };

    let info = `Complete User Profile: ${profileData.basic.username}

Basic Information:
Username: ${profileData.basic.username}
Discriminator: ${profileData.basic.discriminator}
Tag: ${profileData.basic.tag}
ID: ${profileData.basic.id}
Created: ${profileData.basic.createdAt} (${profileData.basic.accountAge} days ago)

Appearance:
Avatar: ${profileData.appearance.avatar}
Avatar Decoration: ${profileData.appearance.avatarDecoration}
Banner: ${profileData.appearance.banner}
Accent Color: ${profileData.appearance.accentColor}
Hex Accent Color: ${profileData.appearance.hexAccentColor}

Account Status:
Bot: ${profileData.status.bot ? 'Yes' : 'No'}
System: ${profileData.status.system ? 'Yes' : 'No'}
Verified: ${profileData.status.verified ? 'Yes' : 'No'}
MFA Enabled: ${profileData.status.mfaEnabled ? 'Yes' : 'No'}
Flags: ${profileData.status.flags}

Nitro Status:
Premium Type: ${profileData.nitro.premiumType}
Premium Since: ${profileData.nitro.premiumSince}

Bio: Bio not accessible via selfbot API`;

    // Add member-specific info if in a guild
    if (message.guild) {
      try {
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (member) {
          info += `

Guild Member Info (${message.guild.name}):
Nickname: ${member.nickname || 'None'}
Display Name: ${member.displayName}
Joined: ${member.joinedAt ? member.joinedAt.toLocaleDateString() : 'Unknown'}
Roles: ${member.roles.cache.size} total
Premium Since: ${member.premiumSince ? member.premiumSince.toLocaleDateString() : 'Never'}
Communication Disabled: ${member.communicationDisabledUntil ? `Until ${member.communicationDisabledUntil.toLocaleDateString()}` : 'No'}`;

          // Voice state
          if (member.voice?.channel) {
            info += `
Voice State:
Channel: ${member.voice.channel.name}
Self Mute: ${member.voice.selfMute ? 'Yes' : 'No'}
Self Deaf: ${member.voice.selfDeaf ? 'Yes' : 'No'}
Server Mute: ${member.voice.serverMute ? 'Yes' : 'No'}
Server Deaf: ${member.voice.serverDeaf ? 'Yes' : 'No'}
Streaming: ${member.voice.streaming ? 'Yes' : 'No'}
Video: ${member.voice.selfVideo ? 'Yes' : 'No'}`;
          }
        }
      } catch (error) {
        // Ignore member fetch errors
      }
    }

    info += `

Last Updated: ${new Date().toLocaleString()}`;

    return info;
  } catch (error) {
    return `Failed to get complete user profile: ${error.message}`;
  }
}