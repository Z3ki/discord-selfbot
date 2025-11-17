import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export class DataManager {
  constructor(dataDir = './data-selfbot') {
    this.dataDir = dataDir;
    this.ensureDataDir();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      logger.info('Created data directory', { path: this.dataDir });
    }
  }

  getFilePath(filename) {
    return path.join(this.dataDir, filename);
  }

  async atomicWriteFile(filePath, data) {
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random()}`;
    try {
      await fs.promises.writeFile(tempPath, data);
      await fs.promises.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if something went wrong
      try {
        await fs.promises.unlink(tempPath);
      } catch (unlinkError) {
        // Ignore unlink errors
      }
      throw error;
    }
  }

  async loadData(filename, defaultValue = new Map()) {
    try {
      const filePath = this.getFilePath(filename);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
        // If data is an array, return it as-is
        if (Array.isArray(data)) {
          logger.debug('Loaded array data from file', {
            filename,
            length: data.length,
          });
          return data;
        }
        const map = new Map();
        Object.entries(data).forEach(([key, value]) => {
          map.set(key, value);
        });
        logger.debug('Loaded data from file', {
          filename,
          entries: map.size,
          rawDataKeys: Object.keys(data).length,
          sampleKeys: Object.keys(data).slice(0, 3),
        });
        return map;
      }
    } catch (error) {
      logger.error('Error loading data', { filename, error: error.message });
    }
    return defaultValue;
  }

  async loadObject(filename, defaultValue = {}) {
    try {
      const filePath = this.getFilePath(filename);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
        logger.debug('Loaded object data from file', {
          filename,
          keys: Object.keys(data),
        });
        return data;
      }
    } catch (error) {
      logger.error('Error loading object data', {
        filename,
        error: error.message,
      });
    }
    return defaultValue;
  }

  async saveData(filename, data) {
    try {
      const filePath = this.getFilePath(filename);
      const serialized = {};

      // Check if this is an LRUCache (has cache property)
      if (data && data.cache instanceof Map) {
        for (const [key, value] of data.cache.entries()) {
          serialized[key] = value;
        }
      } else if (
        data instanceof Map ||
        (data && typeof data.entries === 'function')
      ) {
        logger.debug('Saving data with entries method', {
          filename,
          hasEntries: typeof data.entries === 'function',
          instanceofMap: data instanceof Map,
        });
        for (const [key, value] of data.entries()) {
          serialized[key] = value;
        }
        logger.debug('Data entries saved', {
          filename,
          savedKeys: Object.keys(serialized),
        });
      } else {
        logger.debug('Saving data with Object.assign', { filename });
        Object.assign(serialized, data);
      }

      await this.atomicWriteFile(filePath, JSON.stringify(serialized, null, 2));
      logger.debug('Saved data to file', {
        filename,
        entries: Object.keys(serialized).length,
      });
    } catch (error) {
      logger.error('Error saving data', { filename, error: error.message });
      throw error;
    }
  }

  // Memory cleanup methods
  async cleanupChannelMemories(
    channelMemories,
    maxMessages = 15,
    maxAge = 7 * 24 * 60 * 60 * 1000
  ) {
    // 7 days
    const now = Date.now();
    let totalCleaned = 0;

    for (const [channelId, messages] of channelMemories.entries()) {
      const originalLength = messages.length;

      // Remove old messages
      const filteredMessages = messages.filter(
        (msg) => now - msg.timestamp < maxAge
      );

      // Limit to maxMessages (keep most recent)
      if (filteredMessages.length > maxMessages) {
        filteredMessages.splice(0, filteredMessages.length - maxMessages);
      }

      channelMemories.set(channelId, filteredMessages);
      totalCleaned += originalLength - filteredMessages.length;
    }

    if (totalCleaned > 0) {
      logger.info('Cleaned up channel memories', {
        totalCleaned,
        channels: channelMemories.size,
      });
    }

    return totalCleaned;
  }

  async cleanupUserContext(userContext, maxAge = 30 * 24 * 60 * 60 * 1000) {
    // 30 days
    const now = Date.now();
    let totalCleaned = 0;

    for (const [userId, context] of userContext.entries()) {
      if (context.lastInteraction && now - context.lastInteraction > maxAge) {
        userContext.delete(userId);
        totalCleaned++;
      }
    }

    if (totalCleaned > 0) {
      logger.info('Cleaned up user context', { totalCleaned });
    }

    return totalCleaned;
  }

  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(usage.external / 1024 / 1024) + ' MB',
    };
  }

  async loadGlobalPrompt() {
    try {
      const filePath = path.join(process.cwd(), 'globalPrompt.txt');
      logger.debug('Loading global prompt', {
        filePath,
        exists: fs.existsSync(filePath),
        cwd: process.cwd(),
      });

      if (fs.existsSync(filePath)) {
        const content = await fs.promises.readFile(filePath, 'utf8');
        logger.debug('Global prompt loaded', {
          length: content.length,
          preview: content.substring(0, 100) + '...',
        });
        return content;
      } else {
        logger.warn('Global prompt file not found', { filePath });
      }
    } catch (error) {
      logger.error('Error loading global prompt', { error: error.message });
    }
    return '';
  }

  async saveGlobalPrompt(prompt) {
    try {
      const filePath = path.join(process.cwd(), 'globalPrompt.txt');
      await fs.promises.writeFile(filePath, prompt);
      logger.debug('Saved global prompt');
    } catch (error) {
      logger.error('Error saving global prompt', { error: error.message });
      throw error;
    }
  }

  async loadChannelMemory(channelId) {
    try {
      const memories = await this.loadData('channelMemories.json', new Map());
      return memories.get(channelId) || [];
    } catch (error) {
      logger.error('Error loading channel memory:', error);
      return [];
    }
  }

  /**
   * Retrieves context about the bot itself.
   * @returns {object} An object containing self-context.
   */
  getSelfContext() {
    return {
      name: 'Maxwell',
      userId: process.env.DISCORD_USER_ID,
      coreObjective:
        'To be a helpful, curious, and engaging AI assistant.',
    };
  }

  /**
   * Gathers recent messages from all channel memories within a given timeframe.
   * @param {number} timeValue - The numeric value of the time unit.
   * @param {string} timeUnit - The unit of time (e.g., 'hours', 'days').
   * @returns {Promise<Array>} A sorted array of recent messages.
   */
  async getRecentHistory(timeValue, timeUnit) {
    const now = Date.now();
    let cutoff;

    switch (timeUnit) {
      case 'hours':
        cutoff = now - timeValue * 60 * 60 * 1000;
        break;
      case 'days':
        cutoff = now - timeValue * 24 * 60 * 60 * 1000;
        break;
      default:
        cutoff = now - 24 * 60 * 60 * 1000; // Default to 1 day
    }

    const allMemories = await this.loadData('channelMemories.json', new Map());
    let recentMessages = [];

    for (const [channelId, messages] of allMemories.entries()) {
      if (Array.isArray(messages)) {
        const recent = messages
          .filter((msg) => msg.timestamp >= cutoff)
          .map((msg) => ({
            ...msg,
            content: msg.message, // Standardize content field
            authorId: msg.user, // Standardize author field
            channelId: channelId, // Add channelId to each message
          }));
        recentMessages.push(...recent);
      }
    }

    // Sort by timestamp ascending
    recentMessages.sort((a, b) => a.timestamp - b.timestamp);

    // Limit to the most recent 100 messages to keep prompts manageable
    if (recentMessages.length > 100) {
      recentMessages = recentMessages.slice(recentMessages.length - 100);
    }

    logger.info(
      `Gathered ${recentMessages.length} recent messages from the last ${timeValue} ${timeUnit}.`
    );
    return recentMessages;
  }
}
