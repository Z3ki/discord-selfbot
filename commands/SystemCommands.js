import { logger } from '../utils/logger.js';

/**
 * Handles debug commands
 */
export async function handleDebugCommand(message, args) {
  logger.debug('Debug command received', {
    args,
    user: message.author.username,
  });

  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      user: message.author.username,
      userId: message.author.id,
      args: args,
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    };

    return JSON.stringify(debugInfo, null, 2);
  } catch (error) {
    logger.error('Debug command failed', error);
    return 'Debug command failed: ' + error.message;
  }
}

/**
 * Handles info commands
 */
export async function handleInfoCommand(message, args) {
  logger.info('Info command received', { args, user: message.author.username });

  try {
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    // Calculate uptime in readable format
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    const uptimeString = `${uptimeHours}h ${uptimeMinutes}m`;

    // Memory in MB
    const memoryMB = {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
    };

    const infoText = `**Bot Information**

**System:**
- Bot: discord-selfbot v1.0.0
- Uptime: ${uptimeString}
- Memory Usage: ${memoryMB.heapUsed}MB / ${memoryMB.heapTotal}MB

**Timestamp:** ${new Date().toISOString()}`;

    return infoText;
  } catch (error) {
    logger.error('Info command failed', error);
    return 'Info command failed: ' + error.message;
  }
}

/**
 * Handles restart commands
 */
export async function handleRestartCommand(message, args) {
  logger.info('Restart command received', {
    args,
    user: message.author.username,
  });

  try {
    // Send restart message
    await message.reply('Restarting bot...');

    // Restart the process
    process.exit(0);
  } catch (error) {
    logger.error('Restart command failed', error);
    return 'Restart command failed: ' + error.message;
  }
}

/**
 * Handles refresh commands
 */
export async function handleRefreshCommand(message, args, bot) {
  logger.info('Refresh command received', {
    args,
    user: message.author.username,
  });

  try {
    if (!bot) {
      return 'Bot instance not available';
    }

    // Clear caches
    let clearedCaches = [];

    if (bot.channelMemories) {
      bot.channelMemories.clear();
      clearedCaches.push('channelMemories');
    }

    if (bot.dmContexts) {
      bot.dmContexts.clear();
      clearedCaches.push('dmContexts');
    }

    if (bot.dmOrigins) {
      bot.dmOrigins.clear();
      clearedCaches.push('dmOrigins');
    }

    // Reload data from disk after clearing
    await bot.loadData();
    clearedCaches.push('reloaded from disk');

    // Clear media cache
    const { mediaCache } = await import('../utils/MediaCache.js');
    mediaCache.clear();
    clearedCaches.push('mediaCache');

    logger.info('Caches cleared and reloaded', { clearedCaches });

    return `Refresh completed successfully. Cleared and reloaded: ${clearedCaches.join(', ')}`;
  } catch (error) {
    logger.error('Refresh command failed', error);
    return 'Refresh command failed: ' + error.message;
  }
}
