import { logger } from './logger.js';
import { validateDiscordId } from '../security.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ADMIN_FILE = join(process.cwd(), 'data', 'admins.json');
const AUDIT_FILE = join(process.cwd(), 'data', 'admin_audit.json');

/**
 * Admin management system for controlling bot access
 */
class AdminManager {
  constructor() {
    this.admins = new Set();
    this.originalAdminId = null;
    this.lastAdminChange = 0;

    // Enhanced rate limiting per user
    this.userActionHistory = new Map(); // userId -> array of {timestamp, action}
    this.RATE_LIMIT_WINDOW = 60000; // 1 minute
    this.MAX_ACTIONS_PER_WINDOW = 5; // Max 5 admin actions per minute per user
    this.GLOBAL_RATE_LIMIT = 30000; // 30 seconds between any admin changes

    this.loadAdmins();
    this.loadAuditLog();

    // Always make environment admin permanent
    const permanentAdminId =
      process.env.ADMIN_USER_ID || process.env.DISCORD_USER_ID;
    if (permanentAdminId) {
      this.admins.add(permanentAdminId);
      this.originalAdminId = permanentAdminId;
      this.saveAdmins();
    }
  }

  /**
   * Load audit log from file
   */
  loadAuditLog() {
    try {
      if (existsSync(AUDIT_FILE)) {
        const data = readFileSync(AUDIT_FILE, 'utf8');
        this.auditLog = JSON.parse(data);
      } else {
        this.auditLog = [];
        this.saveAuditLog();
      }
    } catch (error) {
      logger.error('Failed to load audit log', { error: error.message });
      this.auditLog = [];
    }
  }

  /**
   * Save audit log to file
   */
  saveAuditLog() {
    try {
      // Keep only last 1000 audit entries
      const recentAudit = this.auditLog.slice(-1000);
      writeFileSync(AUDIT_FILE, JSON.stringify(recentAudit, null, 2));
    } catch (error) {
      logger.error('Failed to save audit log', { error: error.message });
    }
  }

  /**
   * Add entry to audit log
   */
  async addToAuditLog(executorId, action, details = {}) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      executorId: executorId,
      action: action,
      details: details,
      adminCount: this.admins.size,
    };

    this.auditLog.push(auditEntry);
    this.saveAuditLog();

    logger.warn('Admin action logged', auditEntry);
  }

  /**
   * Check if user is rate limited for admin actions
   */
  isRateLimited(userId) {
    const now = Date.now();
    const userHistory = this.userActionHistory.get(userId) || [];

    // Clean old entries (older than rate limit window)
    const validActions = userHistory.filter(
      (action) => now - action.timestamp < this.RATE_LIMIT_WINDOW
    );

    this.userActionHistory.set(userId, validActions);

    // Check if user exceeded rate limit
    if (validActions.length >= this.MAX_ACTIONS_PER_WINDOW) {
      return {
        limited: true,
        reason: `Too many admin actions (${validActions.length}). Maximum ${this.MAX_ACTIONS_PER_WINDOW} per ${this.RATE_LIMIT_WINDOW / 1000} seconds.`,
        resetTime:
          Math.min(...validActions.map((a) => a.timestamp)) +
          this.RATE_LIMIT_WINDOW,
      };
    }

    return { limited: false };
  }

  /**
   * Record an admin action for rate limiting
   */
  recordAdminAction(userId, action) {
    const now = Date.now();
    const userHistory = this.userActionHistory.get(userId) || [];
    userHistory.push({ timestamp: now, action });
    this.userActionHistory.set(userId, userHistory);
  }

  /**
   * Load admins from file
   */
  loadAdmins() {
    try {
      if (existsSync(ADMIN_FILE)) {
        const data = readFileSync(ADMIN_FILE, 'utf8');
        const adminList = JSON.parse(data);

        // Filter and validate admin IDs
        const validAdmins = adminList.filter((adminId) => {
          if (typeof adminId !== 'string') return false;

          // Handle comma-separated IDs (legacy format)
          if (adminId.includes(',')) {
            const ids = adminId.split(',').filter((id) => id.trim());
            ids.forEach((id) => {
              if (validateDiscordId(id.trim())) {
                this.admins.add(id.trim());
              }
            });
            return false; // Don't add the original comma-separated string
          }

          return validateDiscordId(adminId);
        });

        // Add valid individual admin IDs
        validAdmins.forEach((adminId) => this.admins.add(adminId));

        logger.info(`Loaded ${this.admins.size} admin(s) from file`);

        // Save cleaned admin list if we filtered anything
        if (
          this.admins.size !== adminList.length ||
          adminList.some((id) => typeof id !== 'string' || id.includes(','))
        ) {
          this.saveAdmins();
          logger.info('Cleaned and saved admin list');
        }
      } else {
        // Create empty admin file if it doesn't exist
        this.saveAdmins();
        logger.info('Created new admin file');
      }
    } catch (error) {
      logger.error('Failed to load admins file', { error: error.message });
      this.admins = new Set();
    }
  }

  /**
   * Save admins to file
   */
  saveAdmins() {
    try {
      const adminList = Array.from(this.admins);
      const data = JSON.stringify(adminList, null, 2);

      // Save with secure file permissions (owner read/write only)
      writeFileSync(ADMIN_FILE, data, { mode: 0o600 });
      logger.debug(`Saved ${adminList.length} admin(s) to file`);
    } catch (error) {
      logger.error('Failed to save admins file', { error: error.message });
    }
  }

  /**
   * Check if a user is an admin
   * @param {string} userId - Discord user ID
   * @returns {boolean} True if user is admin
   */
  isAdmin(userId) {
    return this.admins.has(userId);
  }

  /**
   * Toggle admin status for a user
   * @param {string} requesterId - Discord user ID making request
   * @param {string} userId - Discord user ID to toggle
   * @returns {Object} Result with action taken and current status
   */
  async toggleAdmin(requesterId, userId) {
    // Enhanced rate limiting check
    const rateLimitCheck = this.isRateLimited(requesterId);
    if (rateLimitCheck.limited) {
      await this.addToAuditLog(requesterId, 'RATE_LIMITED', {
        userId: userId,
        reason: rateLimitCheck.reason,
        resetTime: rateLimitCheck.resetTime,
      });
      return {
        success: false,
        error: rateLimitCheck.reason,
        resetTime: rateLimitCheck.resetTime,
      };
    }

    // Global rate limiting
    const now = Date.now();
    if (
      this.lastAdminChange &&
      now - this.lastAdminChange < this.GLOBAL_RATE_LIMIT
    ) {
      const timeRemaining = Math.ceil(
        (this.GLOBAL_RATE_LIMIT - (now - this.lastAdminChange)) / 1000
      );
      await this.addToAuditLog(requesterId, 'GLOBAL_RATE_LIMITED', {
        userId: userId,
        timeRemaining: timeRemaining,
      });
      return {
        success: false,
        error: `Admin changes are rate limited. Please wait ${timeRemaining} seconds.`,
      };
    }

    // Validate requester is admin AND is original admin
    if (!this.isAdmin(requesterId) || requesterId !== this.getOriginalAdmin()) {
      await this.addToAuditLog(requesterId, 'UNAUTHORIZED_ACCESS_ATTEMPT', {
        targetUserId: userId,
        reason:
          'Non-admin or non-original admin attempted to modify permissions',
      });
      return {
        success: false,
        error: 'Only original administrator can modify admin permissions',
      };
    }

    // Validate the user ID
    if (!validateDiscordId(userId)) {
      return {
        success: false,
        error: 'Invalid Discord user ID format',
      };
    }

    // Prevent removing permanent admin
    const permanentAdminId =
      process.env.ADMIN_USER_ID || process.env.DISCORD_USER_ID;
    if (userId === permanentAdminId) {
      return {
        success: false,
        error: 'Cannot remove permanent administrator',
      };
    }

    const wasAdmin = this.admins.has(userId);
    const action = wasAdmin ? 'remove' : 'add';

    // Record action for rate limiting
    this.recordAdminAction(requesterId, action);
    this.lastAdminChange = now;

    if (wasAdmin) {
      // Remove admin
      this.admins.delete(userId);
      this.saveAdmins();

      await this.addToAuditLog(requesterId, 'ADMIN_REMOVED', {
        targetUserId: userId,
        previousAdminCount: this.admins.size + 1,
        newAdminCount: this.admins.size,
      });

      return {
        success: true,
        action: 'removed',
        userId: userId,
        message: `Admin ${userId} has been removed`,
      };
    } else {
      // Add admin
      this.admins.add(userId);
      this.saveAdmins();

      await this.addToAuditLog(requesterId, 'ADMIN_ADDED', {
        targetUserId: userId,
        previousAdminCount: this.admins.size - 1,
        newAdminCount: this.admins.size,
      });

      return {
        success: true,
        action: 'added',
        userId: userId,
        message: `Admin ${userId} has been added`,
      };
    }
  }

  /**
   * Get the original admin ID (first admin from environment)
   * @returns {string|null} Original admin ID
   */
  getOriginalAdmin() {
    return this.originalAdminId;
  }

  /**
   * Log admin actions for audit purposes (legacy method - now uses addToAuditLog)
   * @param {string} executorId - Who performed the action
   * @param {string} action - Action performed
   * @param {string} targetUserId - Target user ID
   */
  async logAdminAction(executorId, action, targetUserId) {
    await this.addToAuditLog(executorId, action, { targetUserId });
  }

  /**
   * Get list of all admins
   * @returns {Array} Array of admin user IDs
   */
  getAdmins() {
    return Array.from(this.admins);
  }

  /**
   * Get admin count
   * @returns {number} Number of admins
   */
  getAdminCount() {
    return this.admins.size;
  }

  /**
   * Clear all admins (emergency reset)
   * @param {string} requesterId - Discord user ID making request
   * @returns {Object} Result
   */
  async clearAdmins(requesterId = null) {
    // Validate requester is admin AND is original admin
    if (
      requesterId &&
      (!this.isAdmin(requesterId) || requesterId !== this.getOriginalAdmin())
    ) {
      await this.addToAuditLog(requesterId, 'UNAUTHORIZED_CLEAR_ADMINS', {
        reason: 'Non-admin or non-original admin attempted to clear all admins',
      });
      return {
        success: false,
        error: 'Only original administrator can clear all admins',
      };
    }

    const count = this.admins.size;
    this.admins.clear();

    // Always restore permanent admin
    const permanentAdminId =
      process.env.ADMIN_USER_ID || process.env.DISCORD_USER_ID;
    if (permanentAdminId) {
      this.admins.add(permanentAdminId);
    }
    this.saveAdmins();

    // Clear rate limiting history
    this.userActionHistory.clear();

    await this.addToAuditLog(requesterId || 'UNKNOWN', 'ADMINS_CLEARED', {
      clearedCount: count,
      permanentAdminRestored: !!permanentAdminId,
      finalAdminCount: this.admins.size,
    });

    logger.warn(`Cleared all ${count} admin(s), restored permanent admin`, {
      requesterId,
    });

    return {
      success: true,
      message: `Cleared ${count} admin(s), permanent admin cannot be removed`,
      count: count,
    };
  }

  /**
   * Get recent audit log entries
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Array of recent audit entries
   */
  getAuditLog(limit = 50) {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get rate limit status for a user
   * @param {string} userId - Discord user ID
   * @returns {Object} Rate limit status
   */
  getRateLimitStatus(userId) {
    const rateLimitCheck = this.isRateLimited(userId);
    const userHistory = this.userActionHistory.get(userId) || [];
    const recentActions = userHistory.filter(
      (action) => Date.now() - action.timestamp < this.RATE_LIMIT_WINDOW
    );

    return {
      isRateLimited: rateLimitCheck.limited,
      reason: rateLimitCheck.reason,
      resetTime: rateLimitCheck.resetTime,
      recentActionCount: recentActions.length,
      maxActionsPerWindow: this.MAX_ACTIONS_PER_WINDOW,
      windowSize: this.RATE_LIMIT_WINDOW,
      globalRateLimitActive:
        this.lastAdminChange &&
        Date.now() - this.lastAdminChange < this.GLOBAL_RATE_LIMIT,
    };
  }
}

// Export singleton instance
export const adminManager = new AdminManager();
export default adminManager;
