import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import 'dotenv/config';
import {
  ProviderManager,
  GoogleAIProvider,
  NvidiaNIMProvider,
} from './providers.js';
import { CONFIG, validateConfig } from './config/config.js';
import { Bot } from './services/Bot.js';

import { logger } from './utils/logger.js';

// Clean old logs on startup
logger.cleanOldLogs();

// Validate configuration
validateConfig();

// Track all intervals and timeouts for cleanup
const intervals = new Set();
const timeouts = new Set();
let cronJob = null; // Track cron job for cleanup

(async () => {
  // Initialize AI providers
  const providerManager = new ProviderManager();

  // Register Google AI provider
  const googleProvider = new GoogleAIProvider({
    apiKey: CONFIG.ai.google.apiKey,
    model: CONFIG.ai.google.model,
  });
  providerManager.registerProvider(googleProvider);

  // Register NVIDIA NIM provider
  const nvidiaProvider = new NvidiaNIMProvider({
    apiKey: CONFIG.ai.nvidia.apiKey,
    baseURL: CONFIG.ai.nvidia.baseUrl,
    model: CONFIG.ai.nvidia.model,
    maxTokens: CONFIG.ai.nvidia.maxTokens,
    temperature: CONFIG.ai.nvidia.temperature,
  });
  providerManager.registerProvider(nvidiaProvider);

  // Set primary and fallback providers
  providerManager.setPrimaryProvider('nvidia-nim');
  providerManager.setFallbackProvider('google');

  // Initialize and start bot
  const bot = new Bot();
  await bot.initialize(providerManager);

  // Setup process-level stability handlers
  setupProcessHandlers(bot);

  await bot.start();

  // Schedule the proactive cognitive loop to run daily at 12:00 PM
  cronJob = cron.schedule('0 12 * * *', () => {
    logger.info('Executing daily proactive cognitive loop...');
    if (bot.isReady()) {
      bot.proactiveCognitiveLoop();
    } else {
      logger.warn('Bot not ready, skipping proactive cognitive loop.');
    }
  });

  logger.info('Scheduled daily proactive cognitive loop.');

  // Setup manual trigger for proactive loop using polling
  const tempDir = path.resolve(process.cwd(), 'temp');
  const triggerFile = path.join(tempDir, 'think.trigger');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const pollingInterval = setInterval(async () => {
    if (fs.existsSync(triggerFile)) {
      logger.info(
        'Manual trigger detected for proactive cognitive loop via polling.'
      );
      logger.debug('Bot ready status:', { isReady: bot.isReady() });

      if (bot.isReady()) {
        await bot.proactiveCognitiveLoop();
      } else {
        logger.warn(
          'Bot not ready, delaying proactive cognitive loop trigger via polling.'
        );
        // Retry after a short delay
        const retryTimeout = setTimeout(async () => {
          if (bot.isReady()) {
            await bot.proactiveCognitiveLoop();
          } else {
            logger.error(
              'Bot still not ready after delay, failed to trigger proactive cognitive loop via polling.'
            );
          }
        }, 5000);
        timeouts.add(retryTimeout);
      }

      // Clean up the trigger file
      try {
        fs.unlinkSync(triggerFile);
        logger.info('Cleaned up trigger file.');
      } catch (error) {
        logger.error('Failed to clean up trigger file:', error);
      }
    }
  }, 5000); // Check every 5 seconds

  intervals.add(pollingInterval);

  logger.info('Manual trigger polling is active.');
})();

function setupProcessHandlers(bot) {
  // Handle graceful shutdown
  const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    try {
      // Clear all intervals and timeouts to prevent memory leaks
      intervals.forEach((interval) => clearInterval(interval));
      timeouts.forEach((timeout) => clearTimeout(timeout));
      intervals.clear();
      timeouts.clear();

      // Stop cron jobs
      if (cronJob) {
        cronJob.stop();
      }

      await bot.shutdown();

      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', { error: error.message });
      process.exit(1);
    }
  };

  // Handle various shutdown signals
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGUSR1', () => gracefulShutdown('SIGUSR1'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
    });

    // Try to save data before exiting
    bot
      .saveData()
      .then(() => {
        process.exit(1);
      })
      .catch(() => {
        process.exit(1);
      });
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
      reason: reason?.message || reason,
      promise: promise.toString(),
    });
  });

  // Handle memory warnings
  process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') {
      logger.warn('Max listeners exceeded warning', {
        warning: warning.message,
      });
    } else {
      logger.warn('Process warning', { warning: warning.message });
    }
  });

  // Monitor memory usage
  const memoryInterval = setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    };

    // Log warning if memory usage is high
    if (memUsageMB.heapUsed > 500) {
      // 500MB threshold
      logger.warn('High memory usage detected', memUsageMB);
    }

    // Force garbage collection if memory is very high
    if (memUsageMB.heapUsed > 1000) {
      // 1GB threshold
      logger.warn(
        'Forcing garbage collection due to high memory usage',
        memUsageMB
      );
      if (global.gc) {
        global.gc();
      }
    }
  }, 300000); // Check every 5 minutes

  intervals.add(memoryInterval);
}
