import { logger } from '../../utils/logger.js';

export const createMessageFileTool = {
  name: 'create_message_file',
  description:
    'Create a text file with content that is too long for Discord messages',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The content to write to the file',
      },
      filename: {
        type: 'string',
        description: 'Optional custom filename (will be sanitized)',
        default: null,
      },
      description: {
        type: 'string',
        description: 'Optional description of the file content',
        default: '',
      },
    },
    required: ['content'],
  },
  execute: async function (
    { content, filename, description = '' },
    { message }
  ) {
    try {
      // Import DataManager dynamically to avoid circular imports
      const { DataManager } = await import('../../services/DataManager.js');
      const dataManager = new DataManager('./data-selfbot');

      // Sanitize filename to prevent path traversal attacks
      let safeFilename;
      if (filename) {
        // Remove any path separators and dangerous characters
        safeFilename = filename
          .replace(/[/\\:*?"<>|]/g, '_') // Replace dangerous chars with underscore
          .replace(/\.\./g, '_') // Prevent directory traversal
          .replace(/^\.+/, '') // Remove leading dots
          .trim();

        // Ensure it ends with .txt
        if (!safeFilename.toLowerCase().endsWith('.txt')) {
          safeFilename += '.txt';
        }

        // Limit filename length
        if (safeFilename.length > 100) {
          safeFilename = safeFilename.substring(0, 96) + '.txt';
        }
      } else {
        // Generate default filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        safeFilename = `message_${timestamp}.txt`;
      }

      // Check content length (reasonable limit to prevent abuse)
      if (content.length > 10 * 1024 * 1024) {
        // 10MB limit
        return 'Error: Content is too large (maximum 10MB allowed)';
      }

      // Create file content with metadata
      const fileContent = [
        `// Created by Maxwell Selfbot`,
        `// Date: ${new Date().toISOString()}`,
        `// User: ${message.author.username} (${message.author.id})`,
        `// Channel: ${message.channel?.name || 'DM'} (${message.channel?.id || message.channelId})`,
        description ? `// Description: ${description}` : '',
        `// Content Length: ${content.length} characters`,
        '',
        content,
      ]
        .filter((line) => line !== '')
        .join('\n');

      // Save the file
      const filePath = dataManager.getFilePath(safeFilename);
      await dataManager.atomicWriteFile(filePath, fileContent);

      logger.info('Message file created', {
        filename: safeFilename,
        filePath,
        contentLength: content.length,
        userId: message.author.id,
        channelId: message.channel?.id || message.channelId,
      });

      return `✅ File created successfully!\n\n**Filename:** \`${safeFilename}\`\n**Location:** \`data-selfbot/${safeFilename}\`\n**Size:** ${content.length} characters\n\nYou can access this file in the bot's data directory. ${description ? `\n\n**Description:** ${description}` : ''}`;
    } catch (error) {
      logger.error('Error creating message file', {
        error: error.message,
        filename,
        contentLength: content?.length,
        userId: message?.author?.id,
      });

      return `❌ Error creating file: ${error.message}`;
    }
  },
};
