import { logger } from '../../utils/logger.js';

export const wikipediaInfoTool = {
  name: 'wikipedia_info',
  description: 'Get up-to-date information from Wikipedia. Useful for checking current facts, biographies, events, and general knowledge. Example: wikipedia_info(query="President of the United States") for current president info.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query or Wikipedia article title (e.g., "latest presidents", "COVID-19", "Albert Einstein")'
      }
    },
    required: ['query']
  },

  async execute(args, context) {
    try {
      const { query } = args;

      // First try direct page summary
      const encodedQuery = encodeURIComponent(query.replace(/\s+/g, '_'));
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedQuery}`;

      let response = await fetch(summaryUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.extract) {
          let result = `**${data.title}**\n\n${data.extract}`;
          if (data.description) {
            result = `**${data.title}**\n*${data.description}*\n\n${data.extract}`;
          }
          return result.substring(0, 2000); // Limit length
        }
      }

      // If direct page not found, try search
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`;
      response = await fetch(searchUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.query && data.query.search && data.query.search.length > 0) {
          const topResult = data.query.search[0];
          const pageUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topResult.title)}`;
          const pageResponse = await fetch(pageUrl);
          if (pageResponse.ok) {
            const pageData = await pageResponse.json();
            if (pageData.extract) {
              let result = `**${pageData.title}** (searched for "${query}")\n\n${pageData.extract}`;
              if (pageData.description) {
                result = `**${pageData.title}** (searched for "${query}")\n*${pageData.description}*\n\n${pageData.extract}`;
              }
              return result.substring(0, 2000);
            }
          }
          // Fallback to search snippet
          return `**${topResult.title}** (searched for "${query}")\n\n${topResult.snippet.replace(/<[^>]*>/g, '')}`;
        }
      }

      return `No information found for "${query}" on Wikipedia. Try a different search term or check spelling.`;

    } catch (error) {
      logger.error('Error fetching Wikipedia info:', error);
      return `Error fetching information: ${error.message}`;
    }
  }
};