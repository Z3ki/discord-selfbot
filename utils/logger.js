import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
  sanitizeForLogging(str) {
    if (!str || typeof str !== 'string') return str;
    
    let sanitized = str;
    
    // Discord bot tokens (more comprehensive pattern)
    sanitized = sanitized.replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}/g, '[REDACTED_TOKEN]');
    
    // Discord user tokens (different format)
    sanitized = sanitized.replace(/[A-Za-z0-9_-]{59,}/g, '[REDACTED_USER_TOKEN]');
    
    // API keys (common patterns)
    sanitized = sanitized.replace(/['"]?[A-Za-z0-9_-]{20,}['"]?(\s*:\s*['"]?[A-Za-z0-9_-]{20,}['"]?)/g, '[REDACTED_API_KEY]');

    // Passwords in JSON
    sanitized = sanitized.replace(/(['"]password['"]:\s*['"])[^'"]*(['"])/gi, '$1[REDACTED_PASSWORD]$2');

    // Authorization headers
    sanitized = sanitized.replace(/(authorization:\s*[Bb]earer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED_BEARER]');

    // Email addresses (optional, for privacy)
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');
    
    return sanitized;
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const sanitizedMessage = this.sanitizeForLogging(message);
    const sanitizedMeta = {};
    for (const [key, value] of Object.entries(meta)) {
      sanitizedMeta[key] = this.sanitizeForLogging(String(value));
    }
    const metaStr = Object.keys(sanitizedMeta).length > 0 ? ` ${JSON.stringify(sanitizedMeta)}` : '';
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
      files.forEach(file => {
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