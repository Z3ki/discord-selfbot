import 'dotenv/config';
import { ProviderManager, GoogleAIProvider, NvidiaNIMProvider } from './providers.js';
import { CONFIG, validateConfig } from './config/config.js';
import { Bot } from './services/Bot.js';
import { transcriptionService } from './services/TranscriptionService.js';
import { logger } from './utils/logger.js';

// Clean old logs on startup
// logger.cleanOldLogs();

// Validate configuration
validateConfig();

(async () => {
  // Initialize AI providers
  const providerManager = new ProviderManager();

  // Register Google AI provider
  const googleProvider = new GoogleAIProvider({
    apiKey: CONFIG.ai.google.apiKey,
    model: CONFIG.ai.google.model
  });
  providerManager.registerProvider(googleProvider);

  // Register NVIDIA NIM provider
  const nvidiaProvider = new NvidiaNIMProvider({
    apiKey: CONFIG.ai.nvidia.apiKey,
    baseURL: CONFIG.ai.nvidia.baseUrl,
    model: CONFIG.ai.nvidia.model,
    maxTokens: CONFIG.ai.nvidia.maxTokens,
    temperature: CONFIG.ai.nvidia.temperature
  });
  providerManager.registerProvider(nvidiaProvider);



  // Set primary and fallback providers
  providerManager.setPrimaryProvider('nvidia-nim');
  providerManager.setFallbackProvider('google');

  // Start transcription service
  try {
    await transcriptionService.start();
    logger.info('Transcription service started successfully');
  } catch (error) {
    logger.error('Failed to start transcription service:', error);
    // Continue without transcription service
  }

  // Initialize and start bot
  const bot = new Bot();
  await bot.initialize(providerManager);
  
  // Setup process-level stability handlers
  setupProcessHandlers(bot);
  
  await bot.start();
})();

function setupProcessHandlers(bot) {
  // Handle graceful shutdown
  const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    try {
      await bot.shutdown();
      await transcriptionService.stop();
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
      stack: error.stack 
    });
    
    // Try to save data before exiting
    bot.saveData().then(() => {
      process.exit(1);
    }).catch(() => {
      process.exit(1);
    });
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { 
      reason: reason?.message || reason,
      promise: promise.toString()
    });
  });

  // Handle memory warnings
  process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') {
      logger.warn('Max listeners exceeded warning', { warning: warning.message });
    } else {
      logger.warn('Process warning', { warning: warning.message });
    }
  });

  // Monitor memory usage
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    // Log warning if memory usage is high
    if (memUsageMB.heapUsed > 500) { // 500MB threshold
      logger.warn('High memory usage detected', memUsageMB);
    }
    
    // Force garbage collection if memory is very high
    if (memUsageMB.heapUsed > 1000) { // 1GB threshold
      logger.warn('Forcing garbage collection due to high memory usage', memUsageMB);
      if (global.gc) {
        global.gc();
      }
    }
  }, 300000); // Check every 5 minutes
}
