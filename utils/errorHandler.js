import { logger } from './logger.js';

export class BotError extends Error {
  constructor(message, code, isUserError = false, context = {}) {
    super(message);
    this.code = code;
    this.isUserError = isUserError;
    this.context = context;
    this.name = 'BotError';
  }
}

export function handleError(error, context = {}) {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: error.code,
    context,
    timestamp: new Date().toISOString()
  };

  if (error.isUserError) {
    logger.warn('User error handled', errorInfo);
    return { success: false, message: error.message };
  } else {
    logger.error('System error occurred', errorInfo);
    return { success: false, message: 'An internal error occurred. Please try again.' };
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

export function createBotError(message, code, isUserError = false, context = {}) {
  return new BotError(message, code, isUserError, context);
}