import { adminManager } from '../../utils/adminManager.js';
import { logger } from '../../utils/logger.js';

/**
 * Tool for managing bot administrators
 */
export const adminManagerTool = {
  name: 'admin_manager',
  description: 'Add or remove bot administrators by Discord user ID',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'Discord user ID to add/remove as admin'
      },
      action: {
        type: 'string',
        description: 'Action to perform (add/remove/toggle/list/clear)',
        enum: ['add', 'remove', 'toggle', 'list', 'clear']
      }
    },
    required: ['action']
  }
};

/**
 * Execute admin management operations
 * @param {Object} args - Tool arguments
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Execution result
 */
export async function executeAdminManager(args, context = {}) {
  const { userId, action } = args;
  const { message, bot } = context;

  try {
    switch (action) {
      case 'toggle':
        if (!userId) {
          return {
            success: false,
            error: 'User ID is required for toggle action',
            usage: 'admin_manager action="toggle" userId="123456789012345678"'
          };
        }

        const result = adminManager.toggleAdmin(userId);
        
        if (result.success) {
          let response = `🔧 **Admin Management**\n\n`;
          response += `**User ID:** ${userId}\n`;
          response += `**Action:** ${result.action === 'added' ? '➕ Added' : '➖ Removed'}\n`;
          response += `**Status:** ${result.action === 'added' ? 'Now an admin' : 'No longer an admin'}\n`;
          response += `**Total Admins:** ${adminManager.getAdminCount()}`;
          
          return {
            success: true,
            message: response,
            data: result
          };
        } else {
          return {
            success: false,
            error: result.error,
            message: `❌ **Error:** ${result.error}`
          };
        }

      case 'add':
        if (!userId) {
          return {
            success: false,
            error: 'User ID is required for add action',
            usage: 'admin_manager action="add" userId="123456789012345678"'
          };
        }

        const addResult = adminManager.toggleAdmin(userId);
        if (addResult.success && addResult.action === 'added') {
          return {
            success: true,
            message: `➕ **Admin Added**\n\n**User ID:** ${userId}\n**Total Admins:** ${adminManager.getAdminCount()}`,
            data: addResult
          };
        } else if (addResult.success && addResult.action === 'removed') {
          return {
            success: false,
            error: 'User was already an admin and has been removed instead',
            message: `⚠️ **User was already admin** - removed instead\n\n**User ID:** ${userId}`
          };
        } else {
          return {
            success: false,
            error: addResult.error,
            message: `❌ **Error:** ${addResult.error}`
          };
        }

      case 'remove':
        if (!userId) {
          return {
            success: false,
            error: 'User ID is required for remove action',
            usage: 'admin_manager action="remove" userId="123456789012345678"'
          };
        }

        const removeResult = adminManager.toggleAdmin(userId);
        if (removeResult.success && removeResult.action === 'removed') {
          return {
            success: true,
            message: `➖ **Admin Removed**\n\n**User ID:** ${userId}\n**Total Admins:** ${adminManager.getAdminCount()}`,
            data: removeResult
          };
        } else if (removeResult.success && removeResult.action === 'added') {
          return {
            success: false,
            error: 'User was not an admin and has been added instead',
            message: `⚠️ **User was not admin** - added instead\n\n**User ID:** ${userId}`
          };
        } else {
          return {
            success: false,
            error: removeResult.error,
            message: `❌ **Error:** ${removeResult.error}`
          };
        }

      case 'list':
        const admins = adminManager.getAdmins();
        let listResponse = `👑 **Bot Administrators**\n\n`;
        listResponse += `**Total Admins:** ${admins.length}\n\n`;
        
        if (admins.length > 0) {
          listResponse += `**Admin IDs:**\n`;
          admins.forEach((adminId, index) => {
            listResponse += `${index + 1}. ${adminId}\n`;
          });
        } else {
          listResponse += `*No administrators configured*`;
        }

        return {
          success: true,
          message: listResponse,
          data: { admins, count: admins.length }
        };

      case 'clear':
        // This is a dangerous operation - should require confirmation
        if (!message || !message.author) {
          return {
            success: false,
            error: 'Clear operation requires user context for confirmation'
          };
        }

        const clearResult = adminManager.clearAdmins();
        return {
          success: true,
          message: `🚨 **All Admins Cleared**\n\n**Removed:** ${clearResult.count} admin(s)\n⚠️ **Warning:** No admins remain!`,
          data: clearResult
        };

      default:
        return {
          success: false,
          error: `Unknown action: ${action}`,
          usage: 'Available actions: add, remove, toggle, list, clear'
        };
    }

  } catch (error) {
    logger.error('Admin manager tool failed', { 
      error: error.message, 
      args, 
      userId: message?.author?.id 
    });

    return {
      success: false,
      error: 'Failed to execute admin management operation',
      details: error.message
    };
  }
}

export default {
  name: adminManagerTool.name,
  description: adminManagerTool.description,
  parameters: adminManagerTool.parameters,
  execute: executeAdminManager
};