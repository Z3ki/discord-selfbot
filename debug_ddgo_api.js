import fetch from 'node-fetch';

async function debugDDGoAPI() {
  console.log('Testing DuckDuckGo API...\n');

  const query = 'javascript tutorial';
  const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

  console.log('Fetching:', searchUrl);

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response length:', text.length);
    console.log('\nFull response:');
    console.log(text);

    try {
      const data = JSON.parse(text);
      console.log('\nParsed JSON:');
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Failed to parse as JSON:', e.message);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugDDGoAPI().catch(console.error);
