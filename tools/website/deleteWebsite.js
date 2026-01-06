export const deleteWebsiteTool = {
  name: 'delete_website',
  description: 'Delete an existing website.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the website to delete',
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

      const success = await websiteManager.deleteWebsite(name);

      if (!success) {
        throw new Error(`Website "${name}" not found`);
      }

      logger.info('Website deleted successfully', { name });

      return {
        success: true,
        message: `Website "${name}" has been deleted.`,
        name,
      };
    } catch (error) {
      logger.error('Error in delete_website tool', {
        error: error?.message || String(error) || 'Unknown error',
        stack: error?.stack,
      });
      throw error;
    }
  },
};
