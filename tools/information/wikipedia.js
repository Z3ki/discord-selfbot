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

      // First try direct page extracts (full content, not just intro)
      const encodedQuery = encodeURIComponent(query.replace(/\s+/g, '_'));
      const extractsUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&titles=${encodedQuery}&exintro=0&explaintext=1&exsectionformat=plain&format=json`;

      let response = await fetch(extractsUrl);
      if (response.ok) {
        const data = await response.json();
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        const page = pages[pageId];

        if (page.extract && pageId !== '-1') {
          let result = `**${page.title}**\n\n${page.extract}`;
          return result.substring(0, 4000); // Increased limit for more details
        }
      }

      // If direct page not found, try search
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`;
      response = await fetch(searchUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.query && data.query.search && data.query.search.length > 0) {
          const topResult = data.query.search[0];
          const pageExtractsUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&titles=${encodeURIComponent(topResult.title)}&exintro=0&explaintext=1&exsectionformat=plain&format=json`;
          const pageResponse = await fetch(pageExtractsUrl);
          if (pageResponse.ok) {
            const pageData = await pageResponse.json();
            const pages = pageData.query.pages;
            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];

            if (page.extract && pageId !== '-1') {
              let result = `**${page.title}** (searched for "${query}")\n\n${page.extract}`;
              return result.substring(0, 4000);
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