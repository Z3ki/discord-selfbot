import pkg from 'discord.js-selfbot-v13';
const { Client } = pkg;
import { RequestQueue, GlobalDMQueue } from '../queues.js';
import { APIResourceManager } from '../apiResourceManager.js';

import { setupHandlers } from '../handlers.js';
import { generateResponse } from '../ai.js';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config/config.js';
import { DataManager } from './DataManager.js';
import { LRUCache } from '../utils/LRUCache.js';

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

    // Debug variables
    this.globalPrompt = [''];
    this.lastPrompt = [''];
    this.lastResponse = [''];
    this.lastToolCalls = [[]];
    this.lastToolResults = [[]];

    // Blacklist for servers
    this.blacklist = new Set();
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
        activities: []
      }
    });

    // Make client globally available for tools
    global.client = this.client;
    global.bot = this;

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
    const channelMemoriesData = await this.dataManager.loadData('channelMemories.json');
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

    // Load blacklist
    const blacklistData = await this.dataManager.loadData('blacklist.json');
    if (Array.isArray(blacklistData)) {
      this.blacklist = new Set(blacklistData);
    } else {
      this.blacklist = new Set();
    }

    logger.info('Data loaded into existing LRU caches', {
      channelMemories: this.channelMemories.size(),
      dmContexts: this.dmContexts.size(),
      dmOrigins: this.dmOrigins.size(),
      blacklistedServers: this.blacklist.size
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
      logger.error('Discord client error', { error: error.message, stack: error.stack });
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
        path: rateLimitInfo.path 
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
      
      // Set online status
      try {
        await this.client.user.setPresence({
          status: 'online',
          activities: []
        });
      } catch (err) {
        logger.warn('Failed to set online status', { error: err.message });
      }
    });
  }

  setupEventHandlers() {
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
      (message) => generateResponse(
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
        this.subagentCoordinator
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
      await this.dataManager.saveData('channelMemories.json', this.channelMemories);
      await this.dataManager.saveData('dmContexts.json', this.dmContexts);
      await this.dataManager.saveData('dmOrigins.json', this.dmOrigins);

      // Also save dmMetadata and userContext periodically
      const { loadUserContext, saveUserContext } = await import('../utils/index.js');
      // dmMetadata is saved immediately, but to ensure it's saved, we can reload and save
      // For userContext, save it
      const userContext = await loadUserContext();
      await saveUserContext(userContext);

      await this.dataManager.saveGlobalPrompt(this.globalPrompt[0]);
      await this.dataManager.saveData('blacklist.json', Array.from(this.blacklist));
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
      logger.error('Failed to start bot', { error: error.message, code: error.code });
      
      if (error.code === 'TOKEN_INVALID') {
        logger.error('Discord token is invalid. Please check your DISCORD_USER_TOKEN in .env');
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
    
    logger.warn(`Attempting to reconnect in ${delay / 1000} seconds (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
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
      logger.error('Reconnection failed', { error: error.message, attempt: this.reconnectAttempts });
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
      if (timeSinceLastHeartbeat > 5 * 60 * 1000 && this.client.ws?.readyState === 1) {
        logger.warn('Connection appears stale, attempting reconnection...');
        this.client.destroy();
        this.handleReconnect();
        return;
      }
      
       // Memory cleanup and monitoring (every 5 minutes)
       if (now % (5 * 60 * 1000) < 60000) { // Roughly every 5 minutes
         await this.performMemoryCleanup();
       }

       // Periodic data saving (every 10 minutes)
       if (now % (10 * 60 * 1000) < 60000) { // Roughly every 10 minutes
         try {
           await this.saveData();
           logger.info('Periodic data save completed');
         } catch (error) {
           logger.error('Failed to save data periodically', { error: error.message });
         }
       }
      
      // Keep presence invisible for stealth - no status updates
      // Only update if we need to appear online briefly
      if (this.client.ws?.readyState === 1 && !this.isShuttingDown && Math.random() < 0.01) { // 1% chance
        try {
          await this.client.user.setPresence({
            status: 'idle', // Less suspicious than online
            activities: [] // No activities
          });
          
          // Return to invisible after 30 seconds
          setTimeout(async () => {
            if (!this.isShuttingDown) {
              try {
                await this.client.user.setPresence({
                  status: 'invisible',
                  activities: []
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
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
      });
      
      // Alert if memory usage is high
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 200) { // Alert if using more than 200MB
        logger.warn('High memory usage detected', {
          heapUsed: Math.round(heapUsedMB) + 'MB',
          totalChannels: this.channelMemories.size(),
          totalDMContexts: this.dmContexts.size(),
          totalDMOrigins: this.dmOrigins.size()
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
        logger.error(`Failed to save data (attempt ${saveAttempts}/${maxSaveAttempts})`, { error: error.message });
        
        if (saveAttempts >= maxSaveAttempts) {
          logger.error('Failed to save data after maximum attempts. Some data may be lost.');
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Gracefully destroy client
    if (this.client && this.client.ws) {
      try {
        this.client.destroy();
        logger.info('Discord client destroyed gracefully');
      } catch (error) {
        logger.error('Error destroying Discord client', { error: error.message });
      }
    }
    
    logger.info('Bot shutdown complete');
  }
}