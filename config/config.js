import { config } from 'dotenv';
import { logger } from '../utils/logger.js';
config();

export const CONFIG = {
  discord: {
    token: process.env.DISCORD_USER_TOKEN || process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_USER_ID || (() => {
      const token = process.env.DISCORD_USER_TOKEN || process.env.DISCORD_TOKEN;
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length >= 1) {
            const decoded = Buffer.from(parts[0], 'base64').toString('utf8');
            return decoded;
          }
        } catch (e) {
          logger.warn('Failed to decode user ID from token', { error: e.message });
        }
      }
      return process.env.DISCORD_USER_ID;
    })(),
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent', 'DirectMessages', 'GuildPresences']
  },
  ai: {
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
      model: process.env.GOOGLE_AI_MODEL || 'models/gemma-3-27b-it',
      temperature: parseFloat(process.env.GOOGLE_AI_TEMPERATURE) || 0.7
    },
    nvidia: {
      apiKey: process.env.NVIDIA_NIM_API_KEY,
      baseUrl: process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
      model: process.env.NVIDIA_NIM_MODEL || 'google/gemma-3-27b-it',
       maxTokens: parseInt(process.env.NVIDIA_NIM_MAX_TOKENS) || 32768,
      temperature: parseFloat(process.env.NVIDIA_NIM_TEMPERATURE) || 0.5
    }
  },
  admin: {
    userId: process.env.DISCORD_USER_ID
  },
  limits: {
    maxMemoryMessages: 30, // Reduced from 50 for better memory management
    maxMemoryChannels: 50, // LRU cache limit for channel memories
    maxDMContexts: 100, // LRU cache limit for DM contexts
    maxDMOrigins: 100, // LRU cache limit for DM origins
    maxShellHistory: 20,
    apiTimeout: 30000,
    maxImages: 15,
    maxVideoFrames: 8,
    maxGifFrames: 6
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxLogAge: 7 // days
  },
  stealth: {
    enabled: false, // Disabled
    typingDelay: false, // No typing simulation
    randomDelays: false, // No random delays
    invisibleStatus: false // Don't stay invisible
  }
};

export function validateConfig() {
  const required = ['GOOGLE_API_KEY'];
  const optional = ['NVIDIA_NIM_API_KEY'];
  const discordTokenRequired = !process.env.DISCORD_TOKEN && !process.env.DISCORD_USER_TOKEN;

  const missing = [];
  if (discordTokenRequired) missing.push('DISCORD_TOKEN or DISCORD_USER_TOKEN');
  missing.push(...required.filter(key => !process.env[key]));

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Log optional API keys status
  optional.forEach(key => {
    if (process.env[key]) {
      logger.info(`Optional API key found: ${key}`);
    } else {
      logger.warn(`Optional API key missing: ${key} - fallback provider may not work`);
    }
  });

  // Validate numeric values
  if (isNaN(CONFIG.ai.nvidia.maxTokens) || CONFIG.ai.nvidia.maxTokens <= 0) {
    throw new Error('NVIDIA_NIM_MAX_TOKENS must be a positive number');
  }

  if (isNaN(CONFIG.ai.nvidia.temperature) || CONFIG.ai.nvidia.temperature < 0 || CONFIG.ai.nvidia.temperature > 2) {
    throw new Error('NVIDIA_NIM_TEMPERATURE must be between 0 and 2');
  }

  logger.info('Configuration validated successfully');
}