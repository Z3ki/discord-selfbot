import { search } from 'duck-duck-scrape';

async function testWebSearch() {
  try {
    const results = await search('Node.js web scraping', { limit: 5 });
    console.log('Web search results:');
    results.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title} - ${result.url}`);
      console.log(`   ${result.description}`);
    });
  } catch (error) {
    console.error('Error during web search:', error);
  }
}

testWebSearch();
