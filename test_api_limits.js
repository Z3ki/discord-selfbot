import { GoogleAIProvider } from './providers.js';
import { NvidiaNIMProvider } from './providers.js';
import { CONFIG } from './config/config.js';

async function testAPILimits() {
  console.log('Testing AI provider output limits...\n');

  // Test Google AI
  console.log('Testing Google AI Provider...');
  const googleProvider = new GoogleAIProvider(CONFIG.ai.google);
  await googleProvider.initialize();

  if (googleProvider.isProviderAvailable()) {
    try {
      const testPrompt =
        'Generate a very long HTML page with detailed content about a fictional universe. Make it at least 5000 words long with multiple sections, characters, and descriptions. Include complex HTML structure with CSS styling.';

      console.log('Sending long generation request to Google AI...');
      const startTime = Date.now();
      const response = await googleProvider.generateContent(testPrompt);
      const endTime = Date.now();

      console.log(`Google AI Response:`);
      console.log(`- Length: ${response.text.length} characters`);
      console.log(
        `- Tokens used: ${response.metadata?.usage?.totalTokenCount || 'N/A'}`
      );
      console.log(`- Time taken: ${(endTime - startTime) / 1000}s`);
      console.log(`- First 200 chars: ${response.text.substring(0, 200)}...`);
      console.log(
        `- Last 200 chars: ...${response.text.substring(response.text.length - 200)}`
      );

      if (response.text.length > 10000) {
        console.log('✅ Google AI successfully generated long response!');
      } else {
        console.log('⚠️ Google AI response was shorter than expected');
      }
    } catch (error) {
      console.log(`❌ Google AI test failed: ${error.message}`);
    }
  } else {
    console.log('❌ Google AI provider not available');
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test NVIDIA NIM
  console.log('Testing NVIDIA NIM Provider...');
  const nvidiaProvider = new NvidiaNIMProvider(CONFIG.ai.nvidia);
  await nvidiaProvider.initialize();

  if (nvidiaProvider.isProviderAvailable()) {
    try {
      const testPrompt =
        'Create a comprehensive encyclopedia entry about quantum physics. Make it extremely detailed with mathematical formulas, historical context, modern applications, and future implications. Aim for at least 8000 words.';

      console.log('Sending long generation request to NVIDIA NIM...');
      const startTime = Date.now();
      const response = await nvidiaProvider.generateContent(testPrompt);
      const endTime = Date.now();

      console.log(`NVIDIA NIM Response:`);
      console.log(`- Length: ${response.text.length} characters`);
      console.log(
        `- Tokens used: ${response.metadata?.usage?.total_tokens || 'N/A'}`
      );
      console.log(`- Time taken: ${(endTime - startTime) / 1000}s`);
      console.log(`- First 200 chars: ${response.text.substring(0, 200)}...`);
      console.log(
        `- Last 200 chars: ...${response.text.substring(response.text.length - 200)}`
      );

      if (response.text.length > 10000) {
        console.log('✅ NVIDIA NIM successfully generated long response!');
      } else {
        console.log('⚠️ NVIDIA NIM response was shorter than expected');
      }
    } catch (error) {
      console.log(`❌ NVIDIA NIM test failed: ${error.message}`);
    }
  } else {
    console.log('❌ NVIDIA NIM provider not available');
  }

  console.log('\nTest completed.');
}

// Run the test
testAPILimits().catch(console.error);
