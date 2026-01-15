import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';

export const createMessageFileTool = {
  name: 'create_message_file',
  description:
    'Send content as a text file attachment when it is too long for Discord messages. Automatically includes the original LLM response for context.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The content to send as a file attachment',
      },
      filename: {
        type: 'string',
        description: 'Optional custom filename (will be sanitized)',
        default: null,
      },
      description: {
        type: 'string',
        description: 'Optional description to include in the message',
        default: '',
      },
    },
    required: ['content'],
  },
  execute: async function (
    { content, filename, description = '' },
    { message, llmResponse }
  ) {
    // Set default llmResponse if not provided
    const capturedLlmResponse = llmResponse || '';
    try {
      // Create temp directory if it doesn't exist
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

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
      const fileSections = [
        `// Created by Maxwell Selfbot`,
        `// Date: ${new Date().toISOString()}`,
        `// User: ${message.author.username} (${message.author.id})`,
        `// Channel: ${message.channel?.name || 'DM'} (${message.channel?.id || message.channelId})`,
        description ? `// Description: ${description}` : '',
        `// Content Length: ${content.length} characters`,
        '',
        '====================================',
        'CONTENT:',
        '====================================',
        '',
        content,
      ];

      const fileContent = fileSections.join('\n');

      // Create temporary file
      const tempFilePath = path.join(tempDir, safeFilename);
      await fs.promises.writeFile(tempFilePath, fileContent, 'utf8');

      logger.info('Message file created for sending', {
        filename: safeFilename,
        tempFilePath,
        contentLength: content.length,
        userId: message.author.id,
        channelId: message.channel?.id || message.channelId,
      });

      try {
        // Send the file as an attachment
        const isDM =
          message.channel?.type === 'DM' || message.channel?.type === 1;
        const attachment = {
          files: [
            {
              attachment: tempFilePath,
              name: safeFilename,
            },
          ],
        };

        let messageText = capturedLlmResponse || '';

        if (isDM) {
          await message.channel.send({ content: messageText, ...attachment });
        } else {
          await message.reply({ content: messageText, ...attachment });
        }

        // Clean up temp file after sending
        setTimeout(() => {
          try {
            fs.unlinkSync(tempFilePath);
            logger.debug('Cleaned up temporary file', { tempFilePath });
          } catch (cleanupError) {
            logger.warn('Failed to clean up temporary file', {
              tempFilePath,
              error: cleanupError.message,
            });
          }
        }, 5000); // Clean up after 5 seconds

        logger.info('File sent successfully as Discord attachment', {
          filename: safeFilename,
          contentLength: content.length,
          userId: message.author.id,
          channelId: message.channel?.id || message.channelId,
        });

        // Return null to prevent normal response processing
        // The file has been sent directly as a Discord message
        return null;
      } catch (sendError) {
        logger.error('Error sending file attachment', {
          error: sendError.message,
          filename: safeFilename,
          userId: message.author.id,
        });

        // Clean up temp file on send failure
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }

        return `❌ Error sending file: ${sendError.message}`;
      }
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
