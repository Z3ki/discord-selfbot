import { search } from 'duck-duck-scrape';

export const webSearchTool = {
  name: 'web_search',
  description:
    'TOOL: Performs a web search using DuckDuckGo and returns relevant results. Use this when you need to search the internet for information, current events, or general knowledge. INPUT: query (search term) and limit (number of results, default 5). OUTPUT: JSON with search results including titles, URLs, and descriptions.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to perform on the web',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default 5, max 10)',
        default: 5,
        maximum: 10,
      },
    },
    required: ['query'],
  },
  execute: async (args, { logger }) => {
    let query,
      limit = 5;

    try {
      ({ query, limit = 5 } = args);

      if (limit > 10) limit = 10; // Cap at 10

      logger.info('Performing web search', { query, limit });

      const results = await search(query, { limit });

      const formattedResults = results.results.map((result) => ({
        title: result.title,
        url: result.url,
        description: result.description,
      }));

      logger.info('Web search completed', {
        query,
        resultCount: formattedResults.length,
      });

      return {
        success: true,
        query,
        results: formattedResults,
      };
    } catch (error) {
      logger.error('Web search failed', {
        error: error?.message || String(error),
        query,
        limit,
      });
      throw error;
    }
  },
};
