import { logger } from './logger.js';
import { validateDiscordId } from '../security.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ADMIN_FILE = join(process.cwd(), 'data', 'admins.json');

/**
 * Admin management system for controlling bot access
 */
class AdminManager {
  constructor() {
    this.admins = new Set();
    this.loadAdmins();
  }

  /**
   * Load admins from file
   */
  loadAdmins() {
    try {
      if (existsSync(ADMIN_FILE)) {
        const data = readFileSync(ADMIN_FILE, 'utf8');
        const adminList = JSON.parse(data);
        this.admins = new Set(adminList);
        logger.info(`Loaded ${this.admins.size} admin(s) from file`);
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
      writeFileSync(ADMIN_FILE, JSON.stringify(adminList, null, 2));
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
   * @param {string} userId - Discord user ID to toggle
   * @returns {Object} Result with action taken and current status
   */
  toggleAdmin(userId) {
    // Validate the user ID
    if (!validateDiscordId(userId)) {
      return {
        success: false,
        error: 'Invalid Discord user ID format',
        action: null
      };
    }

    const wasAdmin = this.admins.has(userId);
    
    if (wasAdmin) {
      // Remove admin
      this.admins.delete(userId);
      this.saveAdmins();
      logger.info(`Removed admin: ${userId}`);
      
      return {
        success: true,
        action: 'removed',
        userId: userId,
        message: `Admin ${userId} has been removed`
      };
    } else {
      // Add admin
      this.admins.add(userId);
      this.saveAdmins();
      logger.info(`Added admin: ${userId}`);
      
      return {
        success: true,
        action: 'added',
        userId: userId,
        message: `Admin ${userId} has been added`
      };
    }
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
   * Remove all admins (emergency reset)
   * @returns {Object} Result
   */
  clearAdmins() {
    const count = this.admins.size;
    this.admins.clear();
    this.saveAdmins();
    logger.warn(`Cleared all ${count} admin(s)`);
    
    return {
      success: true,
      message: `Cleared ${count} admin(s)`,
      count: count
    };
  }
}

// Export singleton instance
export const adminManager = new AdminManager();
export default adminManager;