import fs from 'fs';
import { logger } from './logger.js';

// Helper functions for ID validation
export function validateUserId(client, userId, context = 'operation') {
  if (!userId || typeof userId !== 'string') {
    throw new Error(
      `INVALID_USER_ID: User ID is required for ${context} and must be a string.`
    );
  }

  // Check if userId is actually a channel ID
  if (client && client.channels && client.channels.cache) {
    const channel = client.channels.cache.get(userId);
    if (channel) {
      throw new Error(
        `INVALID_USER_ID: ${userId} is a channel ID, not a user ID. You cannot perform user ${context} on channels. Use a user ID, username, display name, or mention (@user) instead.`
      );
    }
  }

  return true;
}

export function validateChannelId(client, channelId, context = 'operation') {
  if (!channelId || typeof channelId !== 'string') {
    throw new Error(
      `INVALID_CHANNEL_ID: Channel ID is required for ${context} and must be a string.`
    );
  }

  // Check if channelId is actually a user (not a channel)
  const channel = client.channels.cache.get(channelId);
  if (!channel) {
    // Try to see if it's a user ID instead
    const user = client.users.cache.get(channelId);
    if (user) {
      throw new Error(
        `INVALID_CHANNEL_ID: ${channelId} is a user ID, not a channel ID. You cannot perform channel ${context} on users. Use a channel ID instead.`
      );
    } else {
      throw new Error(
        `INVALID_CHANNEL_ID: ${channelId} is not a valid channel ID. Make sure the channel exists and the bot has access to it.`
      );
    }
  }

  return channel;
}

export async function sendDM(client, userIdentifier, content) {
  try {
    // Log that this is a selfbot attempting DM (which may not work)
    logger.info(
      'Attempting DM send from selfbot (may fail due to API restrictions)',
      { userIdentifier }
    );

    // Validate that userIdentifier is not a channel ID
    validateUserId(client, userIdentifier, 'DM sending');

    // Prevent selfbot from sending DMs to itself
    if (client.user && userIdentifier === client.user.id) {
      logger.warn('Prevented self-DM attempt', { userIdentifier });
      return null;
    }

    let user;

    // First try to get from cache
    user = client.users.cache.get(userIdentifier);

    if (!user) {
      // Try to fetch as user ID (only works for users in mutual servers or cached)
      try {
        user = await client.users.fetch(userIdentifier);
      } catch (idError) {
        logger.debug('User ID fetch failed, user may not be in mutual server', {
          userIdentifier,
        });
      }
    }

    if (!user) {
      // Try to resolve as username/display name from guild members
      logger.debug('Attempting username resolution from guilds', {
        userIdentifier,
      });

      // Iterate through all guilds to find the user
      for (const guild of client.guilds.cache.values()) {
        try {
          // Try to find by username (case insensitive)
          let member = guild.members.cache.find(
            (m) =>
              m.user.username.toLowerCase() === userIdentifier.toLowerCase()
          );

          // If not found, try display name
          if (!member) {
            member = guild.members.cache.find(
              (m) =>
                m.displayName.toLowerCase() === userIdentifier.toLowerCase()
            );
          }

          // If not found, try partial matches
          if (!member) {
            member = guild.members.cache.find(
              (m) =>
                m.user.username
                  .toLowerCase()
                  .includes(userIdentifier.toLowerCase()) ||
                m.displayName
                  .toLowerCase()
                  .includes(userIdentifier.toLowerCase())
            );
          }

          if (member) {
            user = member.user;
            logger.debug('User resolved via guild search', {
              userIdentifier,
              resolvedId: user.id,
              username: user.username,
              displayName: member.displayName,
              guildId: guild.id,
            });
            break;
          }
        } catch (guildError) {
          logger.warn('Error searching guild for user', {
            guildId: guild.id,
            error: guildError.message,
          });
        }
      }
    }

    if (!user) {
      logger.error(
        'Could not resolve user identifier - user must be in a mutual server with the bot',
        {
          userIdentifier,
          reason:
            'User not found in any guilds the bot is in. Selfbots can only DM users in shared servers.',
        }
      );
      return null;
    }

    // Attempt to send DM - try multiple approaches
    try {
      // Method 1: Direct send (like regular bots)
      try {
        const message = await user.send(content);
        logger.info('DM sent successfully via direct send', {
          userId: user.id,
        });
        return message;
      } catch (directError) {
        logger.debug('Direct send failed, trying DM channel approach', {
          userId: user.id,
          error: directError.message,
        });
      }

      // Method 2: Create DM channel then send (selfbot approach)
      const dmChannel = await user.createDM();
      if (dmChannel) {
        const message = await dmChannel.send(content);
        logger.info('DM sent successfully via DM channel', { userId: user.id });
        return message;
      } else {
        throw new Error('Could not create DM channel');
      }
    } catch (dmError) {
      // Handle various error types
      const errorCode = dmError.code || dmError.status;
      const isAccessError =
        errorCode === 50001 || dmError.message.includes('Missing Access');
      const isCaptchaError =
        errorCode === 500 ||
        dmError.message.includes('CAPTCHA') ||
        dmError.message.includes('captcha');

      if (isCaptchaError) {
        logger.warn(
          'DM blocked by CAPTCHA requirement - Discord anti-abuse protection',
          {
            userId: user.id,
            error: dmError.message,
            code: errorCode,
            suggestion:
              'Try sending DM from a regular bot account or wait and retry',
          }
        );
      } else if (isAccessError) {
        logger.warn(
          'DM access denied - selfbot restrictions or user privacy settings',
          {
            userId: user.id,
            error: dmError.message,
            code: errorCode,
          }
        );
      } else {
        logger.error(
          'DM sending failed - selfbots have limited DM capabilities',
          {
            userId: user.id,
            error: dmError.message,
            code: errorCode,
          }
        );
      }
      return null;
    }
  } catch (e) {
    logger.error(`Failed to send DM to ${userIdentifier}:`, e);
    return null;
  }
}

// DM Metadata functions
export async function saveDMMetadata(dmChannelId, metadata) {
  try {
    let dmMetadata = {};
    const filePath = './data-selfbot/dmMetadata.json';
    if (fs.existsSync(filePath)) {
      dmMetadata = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    }
    dmMetadata[dmChannelId] = metadata;
    await fs.promises.writeFile(filePath, JSON.stringify(dmMetadata, null, 2));
  } catch (error) {
    logger.error('Error saving DM metadata:', error);
  }
}

// User Context functions
export async function loadUserContext() {
  try {
    const filePath = './data-selfbot/userContext.json';
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      return new Map(Object.entries(data));
    }
  } catch (error) {
    logger.error('Error loading user context:', error);
  }
  return new Map();
}

export async function saveUserContext(userContext) {
  try {
    const data = Object.fromEntries(userContext);
    await fs.promises.writeFile(
      './data-selfbot/userContext.json',
      JSON.stringify(data, null, 2)
    );
  } catch (error) {
    logger.error('Error saving user context:', error);
  }
}

export async function getDMMetadata(dmChannelId) {
  try {
    const filePath = './data-selfbot/dmMetadata.json';
    if (fs.existsSync(filePath)) {
      const dmMetadata = JSON.parse(
        await fs.promises.readFile(filePath, 'utf8')
      );
      return dmMetadata[dmChannelId] || null;
    }
    return null;
  } catch (error) {
    logger.error('Error loading DM metadata:', error);
    return null;
  }
}

export async function removeDMMetadata(dmChannelId) {
  try {
    const filePath = './data-selfbot/dmMetadata.json';
    if (fs.existsSync(filePath)) {
      const dmMetadata = JSON.parse(
        await fs.promises.readFile(filePath, 'utf8')
      );
      delete dmMetadata[dmChannelId];
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(dmMetadata, null, 2)
      );
    }
  } catch (error) {
    logger.error('Error removing DM metadata:', error);
  }
}

// Persistence functions

// Atomic file write to prevent corruption from concurrent access
async function atomicWriteFile(filePath, data) {
  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random()}`;
  await fs.promises.writeFile(tempPath, data);
  await fs.promises.rename(tempPath, filePath);
}

export async function saveMapToJSON(map, filename) {
  try {
    const data = {};
    for (const [key, value] of map.entries()) {
      data[key] = value;
    }
    await atomicWriteFile(filename, JSON.stringify(data, null, 2));
  } catch (error) {
    logger.error(`Error saving ${filename}:`, error);
  }
}

export async function loadMapFromJSON(filename, map) {
  try {
    if (fs.existsSync(filename)) {
      const data = JSON.parse(await fs.promises.readFile(filename, 'utf8'));
      for (const [key, value] of Object.entries(data)) {
        map.set(key, value);
      }
    }
  } catch (error) {
    logger.error(`Error loading ${filename}:`, error);
  }
}

export async function saveSetToJSON(set, filename) {
  try {
    await fs.promises.writeFile(filename, JSON.stringify([...set], null, 2));
  } catch (error) {
    logger.error(`Error saving ${filename}:`, error);
  }
}

export async function loadSetFromJSON(filename, set) {
  try {
    if (fs.existsSync(filename)) {
      const data = JSON.parse(await fs.promises.readFile(filename, 'utf8'));
      for (const item of data) {
        set.add(item);
      }
    }
  } catch (error) {
    logger.error(`Error loading ${filename}:`, error);
  }
}
