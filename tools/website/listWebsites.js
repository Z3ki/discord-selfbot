export const listWebsitesTool = {
  name: 'list_websites',
  description: 'List all existing websites created by the bot.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (args, { logger }) => {
    try {
      // Import WebsiteManager dynamically
      const { WebsiteManager } = await import(
        '../../services/WebsiteManager.js'
      );
      const websiteManager = new WebsiteManager();

      const websites = await websiteManager.listWebsites();

      logger.info('Websites listed', { count: websites.length });

      return {
        success: true,
        websites,
        count: websites.length,
      };
    } catch (error) {
      logger.error('Error in list_websites tool', {
        error: error?.message || String(error) || 'Unknown error',
        stack: error?.stack,
      });
      throw error;
    }
  },
};
