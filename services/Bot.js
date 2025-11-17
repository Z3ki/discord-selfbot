import pkg from 'discord.js-selfbot-v13';
const { Client } = pkg;
import { RequestQueue, GlobalDMQueue } from '../queues.js';
import { APIResourceManager } from '../apiResourceManager.js';

import { setupHandlers } from '../handlers.js';
import { generateResponse, elicitProactiveThought } from '../ai.js';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config/config.js';
import { DataManager } from './DataManager.js';
import { LRUCache } from '../utils/LRUCache.js';
import { container } from './DependencyContainer.js';

export class Bot {
  constructor() {
    this.client = null;
    this.dataManager = new DataManager('./data-selfbot');
    this.requestQueue = new RequestQueue(0); // No delay for instant responses
    this.globalDMQueue = null;
    this.apiResourceManager = new APIResourceManager();

    this.providerManager = null;

    // Data structures with LRU cache for memory management
    this.channelMemories = new LRUCache(CONFIG.limits.maxMemoryChannels || 50);
    this.dmContexts = new LRUCache(CONFIG.limits.maxDMContexts || 100);
    this.dmOrigins = new LRUCache(CONFIG.limits.maxDMOrigins || 100);

    // Stability features
    this.isShuttingDown = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000; // 5 seconds
    this.heartbeatInterval = null;
    this.lastHeartbeat = Date.now();

    // Data persistence timing
    this.lastSaveTime = Date.now();
    this.lastMemoryCleanupTime = Date.now();

    // Debug variables
    this.globalPrompt = [''];
    this.lastPrompt = [''];
    this.lastResponse = [''];
    this.lastToolCalls = [[]];
    this.lastToolResults = [[]];

    // Server-specific prompts
    this.serverPrompts = new Map();

    // Safe mode settings per server
    this.safeModeServers = new Map();

    // Shell access settings per server (default: off)
    this.shellAccessServers = new Map();

    // Shell access for DMs (default: off)
    this.shellAccessDMs = false;

    // Blacklist for servers
    this.blacklist = new Set();

    this.ready = false;
  }

  async initialize(providerManager) {
    this.providerManager = providerManager;

    // Initialize AI providers
    await this.providerManager.initializeProviders();

    // Initialize Discord client
    this.client = new Client({
      intents: [
        'Guilds',
        'GuildMembers',
        'GuildMessages',
        'DirectMessages',
        'MessageContent',
      ],
      checkUpdate: false,
      restTimeOffset: 0, // No delays
      restRequestTimeout: 30000,
      restGlobalRateLimit: 50,
      restSweepInterval: 60000,
      failIfNotExists: false,
      // Stealth: No presence or invisible status to avoid detection
      presence: {
        status: 'online',
        activities: [],
      },
    });

    // Register dependencies in container
    container.register('client', this.client, true);
    container.register('bot', this, true);
    container.register('config', CONFIG, true);
    container.register('logger', logger, true);
    container.register('dataManager', this.dataManager, true);

    // Initialize queues and managers with stealth settings
    this.globalDMQueue = new GlobalDMQueue(this.client);
    this.requestQueue.stealthMode = CONFIG.stealth.enabled;

    // Load data
    await this.loadData();

    // Setup stability event handlers
    this.setupStabilityHandlers();

    // Setup handlers
    this.setupEventHandlers();

    // Register slash commands
    await this.registerCommands();

    // Start heartbeat monitoring
    this.startHeartbeat();

    logger.info('Bot initialized successfully');
  }

  async loadData() {
    // Load data into existing LRU caches
    const channelMemoriesData = await this.dataManager.loadData(
      'channelMemories.json'
    );
    const dmContextsData = await this.dataManager.loadData('dmContexts.json');
    const dmOriginsData = await this.dataManager.loadData('dmOrigins.json');

    // Clear existing caches
    this.channelMemories.clear();
    this.dmContexts.clear();
    this.dmOrigins.clear();

    // Populate existing LRU caches with loaded data (skip internal properties)
    for (const [key, value] of channelMemoriesData) {
      if (key !== 'maxSize' && key !== 'cache') {
        this.channelMemories.set(key, value);
      }
    }
    for (const [key, value] of dmContextsData) {
      if (key !== 'maxSize' && key !== 'cache') {
        this.dmContexts.set(key, value);
      }
    }
    for (const [key, value] of dmOriginsData) {
      if (key !== 'maxSize' && key !== 'cache') {
        this.dmOrigins.set(key, value);
      }
    }

    this.globalPrompt[0] = await this.dataManager.loadGlobalPrompt();

    // Load server prompts
    const serverPromptsData =
      await this.dataManager.loadData('serverPrompts.json');
    for (const [key, value] of serverPromptsData) {
      if (key !== 'maxSize' && key !== 'cache') {
        this.serverPrompts.set(key, value);
      }
    }

    // Load blacklist
    const blacklistData = await this.dataManager.loadData('blacklist.json');
    if (Array.isArray(blacklistData)) {
      this.blacklist = new Set(blacklistData);
    } else {
      this.blacklist = new Set();
    }

    // Load safe mode servers
    const safeModeData = await this.dataManager.loadData(
      'safeModeServers.json'
    );
    logger.debug('SAFE MODE LOAD DEBUG', {
      safeModeData: safeModeData,
      type: typeof safeModeData,
      isMap: safeModeData instanceof Map,
      size: safeModeData instanceof Map ? safeModeData.size : 'N/A',
    });

    // DataManager.loadData() already returns a Map, so use it directly
    if (safeModeData instanceof Map) {
      this.safeModeServers = safeModeData;
      logger.info('SAFE MODE LOAD SUCCESS', {
        size: this.safeModeServers.size,
        keys: Array.from(this.safeModeServers.keys()),
      });
    } else {
      this.safeModeServers = new Map();
      logger.debug('SAFE MODE LOAD - using empty map (invalid data type)');
    }

    // Load shell access servers (default: off, so no need to load - stays empty)
    // Shell access is intentionally not persisted per user request

    logger.info('Data loaded into existing LRU caches', {
      channelMemories: this.channelMemories.size(),
      dmContexts: this.dmContexts.size(),
      dmOrigins: this.dmOrigins.size(),
      blacklistedServers: this.blacklist.size,
    });
  }

  setupStabilityHandlers() {
    // Handle disconnections
    this.client.on('disconnect', () => {
      logger.warn('Bot disconnected from Discord');
      if (!this.isShuttingDown) {
        this.handleReconnect();
      }
    });

    // Handle connection errors
    this.client.on('error', (error) => {
      logger.error('Discord client error', {
        error: error.message,
        stack: error.stack,
      });
      if (!this.isShuttingDown && error.code === 'ECONNRESET') {
        this.handleReconnect();
      }
    });

    // Handle rate limits
    this.client.on('rateLimit', (rateLimitInfo) => {
      logger.warn('Rate limit hit', {
        timeout: rateLimitInfo.timeout,
        limit: rateLimitInfo.limit,
        method: rateLimitInfo.method,
        path: rateLimitInfo.path,
      });
    });

    // Handle invalid sessions
    this.client.on('invalidSession', () => {
      logger.warn('Invalid session detected');
      if (!this.isShuttingDown) {
        this.handleReconnect();
      }
    });

    // Handle resume events
    this.client.on('resumed', () => {
      logger.info('Bot session resumed');
      this.reconnectAttempts = 0;
      this.lastHeartbeat = Date.now();
    });

    // Handle ready event
    this.client.on('ready', async () => {
      logger.info('Bot is ready and connected (stealth mode)');
      this.reconnectAttempts = 0;
      this.lastHeartbeat = Date.now();
      this.ready = true;

      // Set online status
      try {
        await this.client.user.setPresence({
          status: 'online',
          activities: [],
        });
      } catch (err) {
        logger.warn('Failed to set online status', { error: err.message });
      }
    });
  }

  isReady() {
    return this.ready;
  }

  setupEventHandlers() {
    logger.debug('About to call setupHandlers', {
      bot: !!this,
      botType: typeof this,
      hasServerPrompts: this?.serverPrompts?.size > 0,
      serverPromptsSize: this?.serverPrompts?.size || 0,
    });
    setupHandlers(
      this.client,
      this.requestQueue,
      this.apiResourceManager,
      this.channelMemories,
      this.dmContexts,
      this.dmOrigins,

      this.globalDMQueue,
      this.globalPrompt,
      this.lastPrompt,
      this.lastResponse,
      this.lastToolCalls,
      this.lastToolResults,
      (message) =>
        generateResponse(
          message,
          this.providerManager,
          this.channelMemories,
          this.dmOrigins,

          this.client,
          this.globalPrompt,
          this.lastPrompt,
          this.lastResponse,
          this.lastToolCalls,
          this.lastToolResults,
          this.apiResourceManager,
          this
        ),
      this.providerManager,
      this // Pass bot instance
    );
  }

  async registerCommands() {
    // Selfbots don't support slash commands, so always skip registration
    logger.info('Skipping slash command registration (selfbot mode)');
  }

  async saveData() {
    try {
      await this.dataManager.saveData(
        'channelMemories.json',
        this.channelMemories
      );
      await this.dataManager.saveData('dmContexts.json', this.dmContexts);
      await this.dataManager.saveData('dmOrigins.json', this.dmOrigins);

      // Also save dmMetadata and userContext periodically
      const { loadUserContext, saveUserContext } = await import(
        '../utils/index.js'
      );
      // dmMetadata is saved immediately, but to ensure it's saved, we can reload and save
      // For userContext, save it
      const userContext = await loadUserContext();
      await saveUserContext(userContext);

      await this.dataManager.saveGlobalPrompt(this.globalPrompt[0]);
      await this.dataManager.saveData(
        'blacklist.json',
        Array.from(this.blacklist)
      );

      // Save server prompts and safe mode settings
      await this.dataManager.saveData('serverPrompts.json', this.serverPrompts);
      if (this.safeModeServers) {
        const safeModeObject = Object.fromEntries(
          this.safeModeServers.entries()
        );
        await this.dataManager.saveData('safeModeServers.json', safeModeObject);
      }

      logger.info('Data saved successfully');
    } catch (error) {
      logger.error('Error saving data', { error: error.message });
    }
  }

  async start() {
    try {
      logger.info('Attempting to connect to Discord...');
      await this.client.login(CONFIG.discord.token);
      logger.info('Bot started successfully');
    } catch (error) {
      logger.error('Failed to start bot', {
        error: error.message,
        code: error.code,
      });

      if (error.code === 'TOKEN_INVALID') {
        logger.error(
          'Discord token is invalid. Please check your DISCORD_USER_TOKEN in .env'
        );
        throw error;
      }

      // Try to reconnect for other errors
      if (!this.isShuttingDown) {
        await this.handleReconnect();
      } else {
        throw error;
      }
    }
  }

  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached. Shutting down...');
      process.exit(1);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    logger.warn(
      `Attempting to reconnect in ${delay / 1000} seconds (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      if (this.client.ws && this.client.ws.readyState === 1) {
        logger.info('Connection already established');
        this.reconnectAttempts = 0;
        return;
      }

      await this.client.login(CONFIG.discord.token);
      logger.info('Reconnection successful');
      this.reconnectAttempts = 0;
    } catch (error) {
      logger.error('Reconnection failed', {
        error: error.message,
        attempt: this.reconnectAttempts,
      });
      if (!this.isShuttingDown) {
        setTimeout(() => this.handleReconnect(), 1000);
      }
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - this.lastHeartbeat;

      // Check if connection is stale (no heartbeat for 5 minutes)
      if (
        timeSinceLastHeartbeat > 5 * 60 * 1000 &&
        this.client.ws?.readyState === 1
      ) {
        logger.warn('Connection appears stale, attempting reconnection...');
        this.client.destroy();
        this.handleReconnect();
        return;
      }

      // Memory cleanup and monitoring (every 5 minutes)
      const timeSinceLastCleanup = now - this.lastMemoryCleanupTime;
      if (timeSinceLastCleanup >= 5 * 60 * 1000) {
        // Every 5 minutes
        await this.performMemoryCleanup();
        this.lastMemoryCleanupTime = now;
      }

      // Periodic data saving (every 10 minutes)
      const timeSinceLastSave = now - this.lastSaveTime;
      if (timeSinceLastSave >= 10 * 60 * 1000) {
        // Every 10 minutes
        try {
          await this.saveData();
          this.lastSaveTime = now;
          logger.info('Periodic data save completed');
        } catch (error) {
          logger.error('Failed to save data periodically', {
            error: error.message,
          });
        }
      }

      // Keep presence invisible for stealth - no status updates
      // Only update if we need to appear online briefly
      if (
        this.client.ws?.readyState === 1 &&
        !this.isShuttingDown &&
        Math.random() < 0.01
      ) {
        // 1% chance
        try {
          await this.client.user.setPresence({
            status: 'idle', // Less suspicious than online
            activities: [], // No activities
          });

          // Return to invisible after 30 seconds
          setTimeout(async () => {
            if (!this.isShuttingDown) {
              try {
                await this.client.user.setPresence({
                  status: 'invisible',
                  activities: [],
                });
              } catch (err) {
                // Ignore errors
              }
            }
          }, 30000);
        } catch (err) {
          // Ignore presence update errors
        }
      }
    }, 60000); // Check every minute
  }

  async performMemoryCleanup() {
    try {
      // LRU caches automatically handle cleanup, but we can force garbage collection
      const channelMemoryUsage = this.channelMemories.getMemoryUsage();
      const dmContextUsage = this.dmContexts.getMemoryUsage();
      const dmOriginsUsage = this.dmOrigins.getMemoryUsage();

      // Get memory usage
      const memoryUsage = process.memoryUsage();

      // Log memory status
      logger.debug('Memory status', {
        channelMemoryUsage,
        dmContextUsage,
        dmOriginsUsage,
        totalChannels: this.channelMemories.size(),
        totalDMContexts: this.dmContexts.size(),
        totalDMOrigins: this.dmOrigins.size(),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      });

      // Alert if memory usage is high
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 200) {
        // Alert if using more than 200MB
        logger.warn('High memory usage detected', {
          heapUsed: Math.round(heapUsedMB) + 'MB',
          totalChannels: this.channelMemories.size(),
          totalDMContexts: this.dmContexts.size(),
          totalDMOrigins: this.dmOrigins.size(),
        });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          logger.debug('Forced garbage collection due to high memory usage');
        }
      }
    } catch (error) {
      logger.error('Error during memory cleanup', { error: error.message });
    }
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async proactiveCognitiveLoop() {
    logger.info('Starting proactive cognitive loop...');
    try {
      // 1. Observe: Gather context from the last 24 hours
      const allRecentHistory = await this.dataManager.getRecentHistory(1, 'days');
      const selfContext = this.dataManager.getSelfContext();
      const globalPrompt = this.globalPrompt[0];

      if (allRecentHistory.length === 0) {
        logger.info('No recent history to analyze. Skipping proactive thought.');
        return;
      }

      const allProactiveThoughts = [];

      // Iterate through each guild the bot is in
      for (const [guildId, guild] of this.client.guilds.cache) {
        const serverPrompt = this.serverPrompts.get(guildId) || null;

        // Filter history relevant to this specific guild
        const guildRecentHistory = allRecentHistory.filter(msg => {
          // Check if the message is from a channel within this guild
          const channel = this.client.channels.cache.get(msg.channelId);
          return channel && channel.guildId === guildId;
        });

        if (guildRecentHistory.length === 0) {
          logger.debug(`No recent history for guild ${guild.name} (${guildId}). Skipping proactive thought for this guild.`);
          continue;
        }

        logger.info(`Eliciting proactive thought for guild ${guild.name} (${guildId})...`);
        const thoughtsForGuild = await elicitProactiveThought(
          guildRecentHistory,
          selfContext,
          this.providerManager,
          globalPrompt,
          serverPrompt
        );
        allProactiveThoughts.push(...thoughtsForGuild);
      }

      // 3. Act: Execute the thought(s)
      if (allProactiveThoughts.length > 0) {
        logger.info(`AI decided to perform ${allProactiveThoughts.length} action(s) across all guilds.`);
        for (const actionObject of allProactiveThoughts) {
          if (actionObject.action === 'send_message' && actionObject.channelId && actionObject.content) {
            logger.info(`AI decided to send a message to channel ${actionObject.channelId}`);
            try {
              const targetChannel = await this.client.channels.fetch(actionObject.channelId);
              if (targetChannel && targetChannel.isText()) {
                await targetChannel.send(actionObject.content);
                logger.info('Successfully sent proactive message.');
              } else {
                logger.warn(`Could not find or send to channel ${actionObject.channelId}. It might not be a text channel or is inaccessible.`);
              }
            } catch (channelError) {
              logger.error(`Error sending message to channel ${actionObject.channelId}:`, channelError);
            }
          } else {
            logger.warn('AI returned an unrecognized or incomplete action object:', actionObject);
          }
        }
      } else {
        logger.info('AI decided to take no action across all guilds.');
      }
    } catch (error) {
      logger.error('Error during proactive cognitive loop:', error);
    }
  }

  async shutdown() {
    this.isShuttingDown = true;
    logger.info('Shutting down bot...');

    // Stop heartbeat monitoring
    this.stopHeartbeat();

    // Save data with retry logic
    let saveAttempts = 0;
    const maxSaveAttempts = 3;

    while (saveAttempts < maxSaveAttempts) {
      try {
        await this.saveData();
        break;
      } catch (error) {
        saveAttempts++;
        logger.error(
          `Failed to save data (attempt ${saveAttempts}/${maxSaveAttempts})`,
          { error: error.message }
        );

        if (saveAttempts >= maxSaveAttempts) {
          logger.error(
            'Failed to save data after maximum attempts. Some data may be lost.'
          );
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // Gracefully destroy client
    if (this.client && this.client.ws) {
      try {
        this.client.destroy();
        logger.info('Discord client destroyed gracefully');
      } catch (error) {
        logger.error('Error destroying Discord client', {
          error: error.message,
        });
      }
    }

    logger.info('Bot shutdown complete');
  }
}
