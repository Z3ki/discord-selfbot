import { logger } from './logger.js';

/**
 * Centralized error handling utility for better async error management
 */

export class BotError extends Error {
  constructor(message, code, isUserError = false, context = {}) {
    super(message);
    this.code = code;
    this.isUserError = isUserError;
    this.context = context;
    this.name = 'BotError';
  }
}

export class ErrorHandler {
  static categories = {
    NETWORK: 'network',
    DISCORD_API: 'discord_api',
    AI_PROVIDER: 'ai_provider',
    TOOL_EXECUTION: 'tool_execution',
    VALIDATION: 'validation',
    RATE_LIMIT: 'rate_limit',
    TIMEOUT: 'timeout',
    PERMISSION: 'permission',
    UNKNOWN: 'unknown',
  };

  /**
   * Categorize and handle errors with appropriate logging and user messages
   */
  static handleError(error, context = {}) {
    const category = this.categorizeError(error);
    const userMessage = this.getUserMessage(error, category);

    // Log with appropriate level and context
    this.logError(error, category, context);

    return {
      category,
      userMessage,
      technicalMessage: error.message,
      shouldRetry: this.shouldRetry(error, category),
      retryDelay: this.getRetryDelay(error, category),
    };
  }

  /**
   * Categorize error based on message and properties
   */
  static categorizeError(error, context = {}) {
    const message = error.message?.toLowerCase() || '';
    const code = error.code;

    // Discord API errors
    if (
      code === 50001 ||
      message.includes('missing access') ||
      message.includes('permission')
    ) {
      return this.categories.PERMISSION;
    }

    if (code === 50013 || message.includes('missing permissions')) {
      return this.categories.PERMISSION;
    }

    // Rate limiting
    if (
      code === 429 ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    ) {
      return this.categories.RATE_LIMIT;
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('enotfound')
    ) {
      return this.categories.NETWORK;
    }

    // Timeout errors
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      error.name === 'AbortError'
    ) {
      return this.categories.TIMEOUT;
    }

    // AI provider errors
    if (
      message.includes('ai') ||
      message.includes('model') ||
      message.includes('generation')
    ) {
      return this.categories.AI_PROVIDER;
    }

    // Tool execution errors
    if (
      context.toolName ||
      message.includes('tool') ||
      message.includes('execution')
    ) {
      return this.categories.TOOL_EXECUTION;
    }

    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required')
    ) {
      return this.categories.VALIDATION;
    }

    return this.categories.UNKNOWN;
  }

  /**
   * Get user-friendly message based on error category
   */
  static getUserMessage(error, category) {
    switch (category) {
      case this.categories.PERMISSION:
        return "I don't have permission to perform that action. This is normal for selfbots.";

      case this.categories.RATE_LIMIT:
        return "I'm being rate limited. Please wait a moment and try again.";

      case this.categories.NETWORK:
        return "I'm having trouble connecting to the service. Please check your internet connection.";

      case this.categories.TIMEOUT:
        return 'The operation took too long to complete. Please try again.';

      case this.categories.AI_PROVIDER:
        return 'The AI service is currently unavailable. Please try again later.';

      case this.categories.TOOL_EXECUTION:
        return 'I encountered an issue while executing that command. Please try again.';

      case this.categories.VALIDATION:
        return 'The provided information is invalid. Please check your input and try again.';

      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  /**
   * Log error with appropriate level and context
   */
  static logError(error, category, context) {
    const logData = {
      category,
      message: error.message,
      code: error.code,
      stack: error.stack,
      ...context,
    };

    switch (category) {
      case this.categories.PERMISSION:
        logger.warn('Permission error', logData);
        break;

      case this.categories.RATE_LIMIT:
        logger.warn('Rate limit error', logData);
        break;

      case this.categories.NETWORK:
      case this.categories.AI_PROVIDER:
        logger.error('Service error', logData);
        break;

      case this.categories.TIMEOUT:
        logger.warn('Timeout error', logData);
        break;

      case this.categories.TOOL_EXECUTION:
        logger.error('Tool execution error', logData);
        break;

      case this.categories.VALIDATION:
        logger.warn('Validation error', logData);
        break;

      default:
        logger.error('Unknown error', logData);
    }
  }

  /**
   * Determine if error is retryable
   */
  static shouldRetry(error, category) {
    switch (category) {
      case this.categories.RATE_LIMIT:
      case this.categories.NETWORK:
      case this.categories.TIMEOUT:
      case this.categories.AI_PROVIDER:
        return true;

      case this.categories.PERMISSION:
      case this.categories.VALIDATION:
        return false;

      case this.categories.TOOL_EXECUTION:
        return (
          !error.message.includes('invalid') &&
          !error.message.includes('not found')
        );

      default:
        return false;
    }
  }

  /**
   * Get retry delay in milliseconds
   */
  static getRetryDelay(error, category) {
    switch (category) {
      case this.categories.RATE_LIMIT: {
        // Extract retry-after from rate limit error if available
        const retryAfter = error.retryAfter || error.headers?.['retry-after'];
        if (retryAfter) {
          return parseInt(retryAfter) * 1000;
        }
        return 5000; // Default 5 seconds for rate limits
      }

      case this.categories.NETWORK:
        return 2000; // 2 seconds for network issues

      case this.categories.TIMEOUT:
        return 3000; // 3 seconds for timeouts

      case this.categories.AI_PROVIDER:
        return 1000; // 1 second for AI provider issues

      case this.categories.TOOL_EXECUTION:
        return 1000; // 1 second for tool execution issues

      default:
        return 0;
    }
  }

  /**
   * Execute async function with error handling and retry logic
   */
  static async executeWithRetry(
    asyncFn,
    context = {},
    maxRetries = 3,
    customErrorHandler = null
  ) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await asyncFn();
      } catch (error) {
        lastError = error;
        const errorInfo = this.handleError(error, context);

        // Use custom error handler if provided
        if (customErrorHandler) {
          const customResult = await customErrorHandler(
            errorInfo,
            attempt,
            maxRetries
          );
          if (customResult.shouldStop) {
            throw error;
          }
        }

        // Don't retry non-retryable errors
        if (!errorInfo.shouldRetry || attempt === maxRetries) {
          throw error;
        }

        // Wait before retry
        if (errorInfo.retryDelay > 0) {
          await this.delay(errorInfo.retryDelay);
        }

        logger.debug('Retrying operation', {
          attempt,
          maxRetries,
          category: errorInfo.category,
          delay: errorInfo.retryDelay,
        });
      }
    }

    throw lastError;
  }

  /**
   * Execute multiple async operations with error isolation
   */
  static async executeWithErrorIsolation(
    operations,
    context = {},
    continueOnError = true
  ) {
    const results = [];
    const errors = [];

    for (let i = 0; i < operations.length; i++) {
      try {
        const result = await operations[i]();
        results.push({ success: true, result, index: i });
      } catch (error) {
        const errorInfo = this.handleError(error, {
          ...context,
          operationIndex: i,
        });
        errors.push({ error: errorInfo, index: i });
        results.push({ success: false, error: errorInfo, index: i });

        if (!continueOnError) {
          throw error;
        }
      }
    }

    return { results, errors };
  }

  /**
   * Create a timeout promise
   */
  static createTimeoutPromise(
    timeoutMs,
    timeoutMessage = 'Operation timed out'
  ) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(timeoutMessage);
        error.name = 'TimeoutError';
        reject(error);
      }, timeoutMs);
    });
  }

  /**
   * Execute with timeout
   */
  static async executeWithTimeout(asyncFn, timeoutMs, timeoutMessage) {
    return Promise.race([
      asyncFn(),
      this.createTimeoutPromise(timeoutMs, timeoutMessage),
    ]);
  }

  /**
   * Delay utility
   */
  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a circuit breaker for fail-fast behavior
   */
  static createCircuitBreaker(
    asyncFn,
    options = {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 10000,
    }
  ) {
    let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    let failures = 0;
    let nextAttempt = 0;

    return async (...args) => {
      const now = Date.now();

      // Check if we should attempt to reset
      if (state === 'OPEN' && now >= nextAttempt) {
        state = 'HALF_OPEN';
        logger.debug('Circuit breaker transitioning to HALF_OPEN');
      }

      // Fail fast if circuit is open
      if (state === 'OPEN') {
        throw new Error(
          'Circuit breaker is OPEN - service temporarily unavailable'
        );
      }

      try {
        const result = await asyncFn(...args);

        // Reset on success
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failures = 0;
          logger.debug('Circuit breaker reset to CLOSED');
        }

        return result;
      } catch (error) {
        failures++;

        // Open circuit if threshold reached
        if (failures >= options.failureThreshold) {
          state = 'OPEN';
          nextAttempt = now + options.resetTimeout;
          logger.warn('Circuit breaker opened', {
            failures,
            threshold: options.failureThreshold,
            resetTimeout: options.resetTimeout,
          });
        }

        throw error;
      }
    };
  }
}

// Legacy error handling functions for backward compatibility
export function handleError(error, context = {}) {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: error.code,
    context,
    timestamp: new Date().toISOString(),
  };

  if (error.isUserError) {
    logger.warn('User error handled', errorInfo);
    return { success: false, message: error.message };
  } else {
    logger.error('System error occurred', errorInfo);
    return {
      success: false,
      message: 'An internal error occurred. Please try again.',
    };
  }
}

export function withErrorHandling(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleError(error, { ...context, function: fn.name });
    }
  };
}
