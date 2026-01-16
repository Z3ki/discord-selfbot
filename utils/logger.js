import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sanitizeTokens, sanitizeObject } from './tokenSanitizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Logger {
  constructor() {
    this.logDir = join(__dirname, '..', 'logs');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  // Sanitize sensitive information for logging
  sanitizeForLogging(input) {
    // Use the comprehensive token sanitizer
    return sanitizeTokens(input);
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const sanitizedMessage = this.sanitizeForLogging(message);

    // Use comprehensive object sanitization for metadata
    const sanitizedMeta = sanitizeObject(meta);

    const metaStr =
      Object.keys(sanitizedMeta).length > 0
        ? ` ${JSON.stringify(sanitizedMeta)}`
        : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${sanitizedMessage}${metaStr}`;
  }

  writeToFile(filename, content) {
    const filepath = join(this.logDir, filename);
    fs.appendFileSync(filepath, content + '\n');
  }

  info(message, meta = {}) {
    const formatted = this.formatMessage('info', message, meta);
    console.log(formatted);
    this.writeToFile('bot.log', formatted);
  }

  warn(message, meta = {}) {
    const formatted = this.formatMessage('warn', message, meta);
    console.warn('\x1b[33m%s\x1b[0m', formatted);
    this.writeToFile('bot.log', formatted);
  }

  error(message, meta = {}) {
    const formatted = this.formatMessage('error', message, meta);
    console.error('\x1b[31m%s\x1b[0m', formatted);
    this.writeToFile('bot.log', formatted);
    this.writeToFile('errors.log', formatted);
  }

  debug(message, meta = {}) {
    const formatted = this.formatMessage('debug', message, meta);
    console.log('\x1b[36m%s\x1b[0m', formatted);
    this.writeToFile('debug.log', formatted);
  }

  // Delete all log files on startup
  cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      files.forEach((file) => {
        const filepath = join(this.logDir, file);
        fs.unlinkSync(filepath);
        this.info(`Deleted log file: ${file}`);
      });
    } catch (error) {
      this.error('Error deleting logs:', { error: error.message });
    }
  }
}

export const logger = new Logger();
