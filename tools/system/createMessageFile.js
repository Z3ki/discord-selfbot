import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';

/**
 * Enhanced input validation
 */
function validateUserInput(input, maxLength = 4000, allowEmpty = false) {
  if (!allowEmpty && (!input || input.trim() === '')) {
    return { valid: false, error: 'Input cannot be empty' };
  }

  if (typeof input !== 'string') {
    return { valid: false, error: 'Invalid input type' };
  }

  if (input.length > maxLength) {
    return {
      valid: false,
      error: `Input exceeds maximum length of ${maxLength} characters`,
    };
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /javascript:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
    /onclick=/i,
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      return {
        valid: false,
        error: 'Input contains potentially dangerous content',
      };
    }
  }

  return { valid: true, sanitized: input.trim() };
}

/**
 * Sanitize filename to prevent path traversal attacks
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename: must be a non-empty string');
  }

  // Normalize path first to resolve any traversal attempts
  const normalized = path.normalize(filename);

  // Check if normalized path tries to escape current directory
  if (normalized.includes('..') || normalized.startsWith('/')) {
    throw new Error('Invalid filename: path traversal detected');
  }

  // Extract just the basename to prevent directory traversal
  const basename = path.basename(normalized);

  // Only allow alphanumeric, underscore, hyphen, and dot
  const cleanName = basename.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Limit length and ensure it doesn't start with dot
  const finalName = cleanName
    .substring(0, 50)
    .replace(/^\./, '_')
    .toLowerCase();

  if (!finalName) {
    throw new Error(
      'Invalid filename: resulted in empty string after sanitization'
    );
  }

  return finalName;
}

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
      // Validate content
      const contentValidation = validateUserInput(content, 10000000); // 10MB limit
      if (!contentValidation.valid) {
        return `Error: Invalid content - ${contentValidation.error}`;
      }

      // Validate filename if provided
      if (filename) {
        const filenameValidation = validateUserInput(filename, 100);
        if (!filenameValidation.valid) {
          return `Error: Invalid filename - ${filenameValidation.error}`;
        }
      }

      // Validate description
      const descriptionValidation = validateUserInput(description, 1000, true);
      if (!descriptionValidation.valid) {
        return `Error: Invalid description - ${descriptionValidation.error}`;
      }
      // Create temp directory if it doesn't exist
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Sanitize filename to prevent path traversal attacks
      let safeFilename;
      if (filename) {
        try {
          safeFilename = sanitizeFilename(filename);
        } catch (sanitizeError) {
          logger.warn('Filename sanitization failed, using default', {
            originalFilename: filename,
            error: sanitizeError.message,
          });
          // Generate default filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          safeFilename = `message_${timestamp}.txt`;
        }

        // Ensure it ends with .txt
        if (!safeFilename.toLowerCase().endsWith('.txt')) {
          safeFilename += '.txt';
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
          await message.channel.send(
            messageText
              ? { content: messageText, ...attachment }
              : { ...attachment }
          );
        } else {
          await message.reply(
            messageText
              ? { content: messageText, ...attachment }
              : { ...attachment }
          );
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
