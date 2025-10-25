import { logger } from './utils/logger.js';

/**
 * Security utilities for input validation and sanitization
 */

// Dangerous file extensions
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
  '.app', '.deb', '.rpm', '.dmg', '.pkg', '.msi', '.ps1', '.sh'
]);

// Allowed MIME types for media processing
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp3',
  'audio/m4a', 'audio/aac', 'audio/flac', 'audio/opus'
]);

// Allowlist of safe commands and patterns
const ALLOWED_COMMANDS = [
  // Basic system info
  'ls', 'pwd', 'whoami', 'date', 'uptime', 'uname', 'id', 'groups',
  // File operations (read-only)
  'cat', 'head', 'tail', 'less', 'more', 'wc', 'grep', 'find', 'locate',
  // System monitoring
  'ps', 'top', 'htop', 'df', 'du', 'free', 'lscpu', 'lsblk', 'lsusb',
  // Network tools (read-only)
  'ping', 'traceroute', 'nslookup', 'dig', 'netstat', 'ss', 'ip',
  // Development tools
  'node', 'npm', 'python', 'python3', 'git', 'gcc', 'make', 'cmake',
  // Text processing
  'echo', 'printf', 'sort', 'uniq', 'cut', 'awk', 'sed', 'tr',
  // Archive tools
  'tar', 'zip', 'unzip', 'gzip', 'gunzip'
];

const ALLOWED_PATTERNS = [
  // File paths
  /^[a-zA-Z0-9/._-]+$/,
  // Basic options
  /^-[a-zA-Z]$/,
  /^--[a-zA-Z-]+$/,
  // Numbers
  /^\d+$/,
  // Common combinations
  /^-[a-zA-Z]\s+[a-zA-Z0-9/._-]+$/
];

/**
 * Validates shell command using allowlist approach
 * @param {string} command - Command to validate
 * @returns {Object} Validation result with safe flag and reason
 */
export function validateShellCommand(command) {
  if (!command || typeof command !== 'string') {
    return { safe: false, reason: 'Invalid command format' };
  }

  const trimmedCommand = command.trim();
  
  // Check for encoded dangerous commands
  try {
    const decoded = Buffer.from(command, 'base64').toString();
    if (decoded !== command) {
      logger.warn(`Encoded command blocked: ${command}`, { 
        decoded: decoded,
        userId: 'unknown' 
      });
      return { 
        safe: false, 
        reason: 'Encoded commands are not allowed' 
      };
    }
  } catch (error) {
    // Invalid base64, continue with normal validation
  }

  // Check for command substitution
  if (/`[^`]*`|\$\([^)]*\)/.test(trimmedCommand)) {
    logger.warn(`Command substitution blocked: ${command}`, { 
      userId: 'unknown' 
    });
    return { 
      safe: false, 
      reason: 'Command substitution is not allowed' 
    };
  }

  // Check for pipes and redirects (restrictive)
  if (/[|&><]/.test(trimmedCommand)) {
    logger.warn(`Command with pipes/redirects blocked: ${command}`, { 
      userId: 'unknown' 
    });
    return { 
      safe: false, 
      reason: 'Pipes and redirects are not allowed' 
    };
  }

  // Split command into parts
  const parts = trimmedCommand.split(/\s+/);
  const baseCommand = parts[0];

  // Check if base command is in allowlist
  if (!ALLOWED_COMMANDS.includes(baseCommand)) {
    logger.warn(`Command not in allowlist: ${baseCommand}`, { 
      command: trimmedCommand,
      userId: 'unknown' 
    });
    return { 
      safe: false, 
      reason: `Command '${baseCommand}' is not allowed` 
    };
  }

  // Validate all arguments
  for (let i = 1; i < parts.length; i++) {
    const arg = parts[i];
    let isValidArg = false;

    // Check against allowed patterns
    for (const pattern of ALLOWED_PATTERNS) {
      if (pattern.test(arg)) {
        isValidArg = true;
        break;
      }
    }

    // Allow common safe arguments
    if (arg.startsWith('-') || /^\d+$/.test(arg) || /^[a-zA-Z0-9/._-]+$/.test(arg)) {
      isValidArg = true;
    }

    if (!isValidArg) {
      logger.warn(`Invalid argument blocked: ${arg}`, { 
        command: trimmedCommand,
        argument: arg,
        userId: 'unknown' 
      });
      return { 
        safe: false, 
        reason: `Argument '${arg}' is not allowed` 
      };
    }
  }

  logger.debug(`Command allowed: ${trimmedCommand}`, { 
    userId: 'unknown' 
  });

  return { safe: true, reason: 'Command is allowed' };
}

/**
 * Sanitizes user input for logging and display
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // eslint-disable-line no-control-regex
    .replace(/[\r\n]/g, ' ') // Replace newlines with spaces
    .trim()
    .substring(0, 500); // Limit length
}

// Magic numbers for file type validation
const MAGIC_NUMBERS = {
  // Images
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'image/bmp': [0x42, 0x4D],
  
  // Videos
  'video/mp4': [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70],
  'video/webm': [0x1A, 0x45, 0xDF, 0xA3],
  'video/quicktime': [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70],
  'video/x-msvideo': [0x52, 0x49, 0x46, 0x46],
  
  // Audio
  'audio/mpeg': [0x49, 0x44, 0x33],
  'audio/wav': [0x52, 0x49, 0x46, 0x46],
  'audio/ogg': [0x4F, 0x67, 0x67, 0x53],
  
  // Documents
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'text/plain': [] // No specific magic number for text files
};

/**
 * Validates file type using magic numbers
 * @param {Buffer} fileBuffer - File buffer to check
 * @param {string} expectedMimeType - Expected MIME type
 * @returns {Object} Validation result
 */
export function validateFileWithMagicNumbers(fileBuffer, expectedMimeType) {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length < 4) {
    return { valid: false, reason: 'Invalid file buffer' };
  }

  if (!expectedMimeType || typeof expectedMimeType !== 'string') {
    return { valid: false, reason: 'Invalid MIME type' };
  }

  const magicNumbers = MAGIC_NUMBERS[expectedMimeType];
  if (!magicNumbers) {
    // If no magic numbers defined for this type, allow it but log
    logger.debug(`No magic numbers defined for MIME type: ${expectedMimeType}`);
    return { valid: true, reason: 'No magic number validation available' };
  }

  // For text files, we can't validate with magic numbers
  if (magicNumbers.length === 0) {
    return { valid: true, reason: 'Text file type' };
  }

  // Check magic numbers
  for (let i = 0; i < magicNumbers.length; i++) {
    if (fileBuffer[i] !== magicNumbers[i]) {
      logger.warn(`Magic number mismatch for ${expectedMimeType}`, {
        expected: magicNumbers.map(b => `0x${b.toString(16).toUpperCase()}`).join(' '),
        actual: Array.from(fileBuffer.slice(0, magicNumbers.length))
          .map(b => `0x${b.toString(16).toUpperCase()}`).join(' ')
      });
      return { 
        valid: false, 
        reason: `Magic number mismatch for ${expectedMimeType}` 
      };
    }
  }

  return { valid: true, reason: 'Magic numbers match' };
}

/**
 * Validates file type for media processing with magic number checking
 * @param {string} filename - Filename to validate
 * @param {string} mimeType - MIME type of the file
 * @param {Buffer} fileBuffer - Optional file buffer for magic number validation
 * @returns {Object} Validation result
 */
export function validateFileType(filename, mimeType, fileBuffer = null) {
  if (!filename || typeof filename !== 'string') {
    return { valid: false, reason: 'Invalid filename' };
  }

  const extension = filename.toLowerCase().split('.').pop();
  
  // Check for dangerous extensions
  if (DANGEROUS_EXTENSIONS.has(`.${extension}`)) {
    logger.warn(`Dangerous file type blocked: ${filename}`, { 
      extension,
      mimeType 
    });
    return { 
      valid: false, 
      reason: `Dangerous file extension: .${extension}` 
    };
  }

  // Check MIME type if provided
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    logger.warn(`Unsupported MIME type: ${mimeType}`, { 
      filename,
      mimeType 
    });
    return { 
      valid: false, 
      reason: `Unsupported MIME type: ${mimeType}` 
    };
  }

  // Additional validation with magic numbers if buffer is provided
  if (fileBuffer && mimeType) {
    const magicNumberResult = validateFileWithMagicNumbers(fileBuffer, mimeType);
    if (!magicNumberResult.valid) {
      return magicNumberResult;
    }
  }

  return { valid: true, reason: 'File type appears safe' };
}

/**
 * Validates Discord user ID format
 * @param {string} userId - User ID to validate
 * @returns {boolean} True if valid Discord snowflake ID
 */
export function validateDiscordId(userId) {
  if (!userId || typeof userId !== 'string') {
    return false;
  }

  // Discord snowflake IDs are numeric and between 17-19 digits
  return /^\d{17,19}$/.test(userId);
}

/**
 * Sanitizes content for Discord messages
 * @param {string} content - Content to sanitize
 * @returns {string} Sanitized content
 */
export function sanitizeDiscordContent(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  return content
    .replace(/@everyone/g, '@\u200Beveryone') // Break @everyone mentions
    .replace(/@here/g, '@\u200Bhere') // Break @here mentions
    .replace(/<@&\d+>/g, '') // Remove role mentions
    .substring(0, 2000); // Discord message limit
}

/**
 * Validates URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

/**
 * Rate limiting validation
 * @param {Map} rateLimitMap - Rate limit tracking map
 * @param {string} userId - User ID
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Object} Rate limit result
 */
export function checkRateLimit(rateLimitMap, userId, maxRequests = 10, windowMs = 60000) {
  if (!rateLimitMap || !userId) {
    return { allowed: false, reason: 'Invalid rate limit parameters' };
  }

  const now = Date.now();
  const userRequests = rateLimitMap.get(userId) || [];

  // Remove old requests outside the time window
  const validRequests = userRequests.filter(time => now - time < windowMs);

  if (validRequests.length >= maxRequests) {
    const oldestRequest = Math.min(...validRequests);
    const resetTime = oldestRequest + windowMs;
    const timeToReset = Math.ceil((resetTime - now) / 1000);

    return { 
      allowed: false, 
      reason: `Rate limit exceeded. Try again in ${timeToReset} seconds.`,
      resetTime
    };
  }

  // Add current request
  validRequests.push(now);
  rateLimitMap.set(userId, validRequests);

  return { 
    allowed: true, 
    reason: 'Request allowed',
    remaining: maxRequests - validRequests.length
  };
}

export default {
  validateShellCommand,
  sanitizeInput,
  validateFileType,
  validateDiscordId,
  sanitizeDiscordContent,
  validateUrl,
  checkRateLimit
};