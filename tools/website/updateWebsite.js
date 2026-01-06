export const updateWebsiteTool = {
  name: 'update_website',
  description:
    'Update an existing website with new HTML code. IMPORTANT: Always read the existing website code first using the read_website tool to understand the current structure before making updates. Provide the complete updated HTML code.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the website to update',
      },
      html: {
        type: 'string',
        description:
          'Complete updated HTML code for the website. Should be based on the existing code structure.',
      },
      description: {
        type: 'string',
        description: 'Updated description of the website',
      },
    },
    required: ['name', 'html'],
  },
  execute: async (args, { logger }) => {
    try {
      const { name, html, description = '' } = args;

      // NO VALIDATION - Complete freedom for any HTML content
      // Allow any HTML structure - no restrictions

      // NO RESTRICTIONS - Maximum freedom for website updates
      if (html.length > 1000000) {
        logger.info('Large website update - maximum freedom enabled', {
          name,
          length: html.length,
        });
      }

      // Check if HTML appears to be truncated (missing closing tags)
      const openTags = (html.match(/<[^/][^>]*>/g) || []).length;
      const closeTags = (html.match(/<\/[^>]+>/g) || []).length;
      if (openTags > closeTags && !html.includes('</html>')) {
        logger.warn('HTML appears to be truncated, attempting to fix', {
          name,
          openTags,
          closeTags,
          hasClosingHtml: html.includes('</html>'),
        });

        // Try to add missing closing tags if the HTML looks incomplete
        let fixedHtml = html;
        if (!fixedHtml.includes('</body>')) {
          fixedHtml += '\n</body>';
        }
        if (!fixedHtml.includes('</html>')) {
          fixedHtml += '\n</html>';
        }

        logger.info('Fixed truncated HTML by adding missing closing tags', {
          name,
          originalLength: html.length,
          fixedLength: fixedHtml.length,
        });

        // Use the fixed HTML
        args.html = fixedHtml;
      }

      // Import WebsiteManager dynamically
      const { WebsiteManager } = await import(
        '../../services/WebsiteManager.js'
      );
      const websiteManager = new WebsiteManager();

      const website = await websiteManager.updateWebsite(
        name,
        html,
        description
      );

      // Import config to get base URL
      const { CONFIG } = await import('../../config/config.js');
      const baseUrl = CONFIG.website.baseUrl;

      logger.info('Website updated successfully', { name });

      return {
        success: true,
        message: `Website "${name}" updated successfully!`,
        url: `${baseUrl}/bot/${name}`,
        expiresAt: website.expiresAt,
        description,
      };
    } catch (error) {
      logger.error('Error in update_website tool', {
        error: error?.message || String(error) || 'Unknown error',
        stack: error?.stack,
      });
      throw error;
    }
  },
};
