import crypto from 'crypto';
import { logger } from './logger.js';

class TokenManager {
  constructor() {
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    this.sessionTimeout = parseInt(process.env.SESSION_TIMEOUT) || 3600;
    this.sessions = new Map();
  }

  encryptToken(token) {
    if (!this.encryptionKey) {
      logger.warn('No encryption key provided, storing token in plain text');
      return token;
    }

    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      logger.error('Token encryption failed', { error: error.message });
      throw new Error('Failed to encrypt token');
    }
  }

  decryptToken(encryptedToken) {
    if (!this.encryptionKey) {
      return encryptedToken;
    }

    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encryptedToken, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      logger.error('Token decryption failed', { error: error.message });
      throw new Error('Failed to decrypt token');
    }
  }

  validateToken(token) {
    if (!token) {
      return { valid: false, error: 'No token provided' };
    }

    if (typeof token !== 'string') {
      return { valid: false, error: 'Token must be a string' };
    }

    if (token.length < 50) {
      return { valid: false, error: 'Token too short' };
    }

    if (!token.startsWith('mfa_') && !token.startsWith('[')) {
      return { valid: false, error: 'Invalid token format' };
    }

    return { valid: true };
  }

  createSession(userId, token) {
    const validation = this.validateToken(token);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const sessionId = crypto.randomBytes(32).toString('hex');
    const encryptedToken = this.encryptToken(token);

    this.sessions.set(sessionId, {
      userId,
      token: encryptedToken,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    });

    logger.info('Session created', { userId, sessionId });
    return sessionId;
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const now = Date.now();
    if (now - session.lastAccessed > this.sessionTimeout * 1000) {
      this.sessions.delete(sessionId);
      logger.info('Session expired', { sessionId });
      return null;
    }

    session.lastAccessed = now;
    return {
      userId: session.userId,
      token: this.decryptToken(session.token),
    };
  }

  destroySession(sessionId) {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.info('Session destroyed', { sessionId });
    }
    return deleted;
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessed > this.sessionTimeout * 1000) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up expired sessions', { count: cleaned });
    }
    return cleaned;
  }
}

export const tokenManager = new TokenManager();
