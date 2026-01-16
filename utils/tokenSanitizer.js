/**
 * Token Sanitization Utility
 *
 * This utility helps prevent sensitive tokens from being exposed in logs
 * by detecting and replacing various types of tokens and API keys.
 */

/**
 * Discord Bot Token Pattern
 * Discord tokens follow the pattern: [base64_encoded_id].[base64_encoded_timestamp].[hmac_hash]
 * Where the hash contains alphanumeric characters, underscores, and hyphens
 */
const DISCORD_TOKEN_PATTERN =
  /([a-zA-Z0-9_-]{24,})\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27}/g;

/**
 * Generic API Key Patterns
 * Common patterns for various API keys and tokens
 */
const API_KEY_PATTERNS = [
  // Bearer tokens
  /Bearer\s+([a-zA-Z0-9._-]{20,})/gi,
  // Authorization headers
  /Authorization:\s*([a-zA-Z0-9._-]{20,})/gi,
  // Generic API keys (32+ characters)
  /(['"`]?[a-zA-Z0-9_-]{32,}['"`]?)/g,
  // Hex API keys (32+ hex characters)
  /([a-fA-F0-9]{32,})/g,
  // UUID patterns
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi,
  // JWT tokens
  /eyJ[a-zA-Z0-9._-]*\.eyJ[a-zA-Z0-9._-]*\.[a-zA-Z0-9._-]*/g,
];

/**
 * Password patterns
 * Common password field patterns
 */
const PASSWORD_PATTERNS = [
  /password[":\s=]+([^\s,}]+)/gi,
  /passwd[":\s=]+([^\s,}]+)/gi,
  /pwd[":\s=]+([^\s,}]+)/gi,
  /secret[":\s=]+([^\s,}]+)/gi,
];

/**
 * Environment variable patterns
 * Common sensitive environment variable references
 */
const ENV_PATTERNS = [/process\.env\.[A-Z_]+/g, /\${[A-Z_]+}/g];

/**
 * URL patterns that might contain sensitive parameters
 */
const URL_PATTERNS = [/(\?|&)(token|key|secret|password|auth)=[^&\s]+/gi];

/**
 * Main sanitization function
 *
 * @param {string} input - The string to sanitize
 * @returns {string} - The sanitized string
 */
export function sanitizeTokens(input) {
  if (typeof input !== 'string') {
    return String(input);
  }

  let sanitized = input;

  // Sanitize Discord tokens
  sanitized = sanitized.replace(
    DISCORD_TOKEN_PATTERN,
    '[REDACTED_DISCORD_TOKEN]'
  );

  // Sanitize API keys
  API_KEY_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, (match, ...groups) => {
      // For patterns with capture groups, only replace the sensitive part
      if (groups.length > 0 && groups[0]) {
        return match.replace(groups[0], '[REDACTED_API_KEY]');
      }
      return '[REDACTED_API_KEY]';
    });
  });

  // Sanitize passwords
  PASSWORD_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, (match, ...groups) => {
      if (groups.length > 0 && groups[0]) {
        return match.replace(groups[0], '[REDACTED_PASSWORD]');
      }
      return match.replace(/[^\s=:}]+/, '[REDACTED_PASSWORD]');
    });
  });

  // Sanitize environment variables
  ENV_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[REDACTED_ENV_VAR]');
  });

  // Sanitize URL parameters
  URL_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '$1$2=[REDACTED]');
  });

  return sanitized;
}

/**
 * Check if a string contains sensitive information
 *
 * @param {string} input - The string to check
 * @returns {boolean} - True if sensitive info is detected
 */
export function containsSensitiveInfo(input) {
  if (typeof input !== 'string') {
    return false;
  }

  // Check Discord tokens
  if (DISCORD_TOKEN_PATTERN.test(input)) {
    return true;
  }

  // Check API keys
  for (const pattern of API_KEY_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  // Check passwords
  for (const pattern of PASSWORD_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  // Check environment variables
  for (const pattern of ENV_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  // Check URL parameters
  for (const pattern of URL_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitize an object recursively
 *
 * @param {any} obj - The object to sanitize
 * @returns {any} - The sanitized object
 */
export function sanitizeObject(obj) {
  if (typeof obj === 'string') {
    return sanitizeTokens(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Also check if the key itself is sensitive
      const isSensitiveKey = /password|secret|token|key|auth|credential/i.test(
        key
      );

      if (isSensitiveKey && typeof value === 'string') {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Create a sanitization wrapper for any function that returns sensitive data
 *
 * @param {Function} fn - The function to wrap
 * @returns {Function} - The wrapped function
 */
export function createSanitizedFunction(fn) {
  return function (...args) {
    try {
      const result = fn.apply(this, args);

      // Handle async functions
      if (result && typeof result.then === 'function') {
        return result.then(sanitizeObject);
      }

      // Handle synchronous functions
      return sanitizeObject(result);
    } catch (error) {
      // Also sanitize errors
      error.message = sanitizeTokens(error.message);
      if (error.stack) {
        error.stack = sanitizeTokens(error.stack);
      }
      throw error;
    }
  };
}

/**
 * Common sensitive field names to always redact
 */
export const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /credential/i,
  /api[_-]?key/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /private[_-]?key/i,
  /client[_-]?secret/i,
  /oauth[_-]?token/i,
  /bearer[_-]?token/i,
];

/**
 * Check if a field name is sensitive
 *
 * @param {string} fieldName - The field name to check
 * @returns {boolean} - True if the field is sensitive
 */
export function isSensitiveField(fieldName) {
  if (typeof fieldName !== 'string') {
    return false;
  }

  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(fieldName));
}

export default {
  sanitizeTokens,
  containsSensitiveInfo,
  sanitizeObject,
  createSanitizedFunction,
  isSensitiveField,
  SENSITIVE_FIELD_PATTERNS,
};
