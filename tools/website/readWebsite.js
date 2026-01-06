export const readWebsiteTool = {
  name: 'read_website',
  description:
    'Read the HTML code of an existing website to understand its structure before making updates. Use this tool when you need to examine the current code of a website to make informed changes.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the website to read',
      },
    },
    required: ['name'],
  },
  execute: async (args, { logger }) => {
    try {
      const { name } = args;

      // Import WebsiteManager dynamically
      const { WebsiteManager } = await import(
        '../../services/WebsiteManager.js'
      );
      const websiteManager = new WebsiteManager();

      const website = await websiteManager.getWebsite(name);

      if (!website) {
        throw new Error(`Website "${name}" not found or has expired`);
      }

      logger.info('Website read successfully', {
        name,
        htmlLength: website.html?.length,
        hasHtml: !!website.html,
      });

      return {
        success: true,
        message: `Website "${name}" read successfully!`,
        name: website.name,
        html: website.html,
        description: website.description,
        createdAt: website.createdAt,
        updatedAt: website.updatedAt,
        expiresAt: website.expiresAt,
        url: website.url || `Website "${name}" exists and is accessible`,
      };
    } catch (error) {
      logger.error('Error in read_website tool', {
        error: error?.message || String(error) || 'Unknown error',
        stack: error?.stack,
        name: args.name,
      });
      throw error;
    }
  },
};
