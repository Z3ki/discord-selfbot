import fs from 'fs';
import { processMessageMedia } from './media.js';
import { ProviderManager } from './providers.js';
import { CONFIG } from './config/config.js';

// Simple test image - a 100x100 red square (clearly visible)
const testImageBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAA7KSURBVHic7Z15kBxVFIaf/M7t7Z0RBEUJBBwSBBiACJgYyN+YOHh4uLg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHhYWFg4OHh<|code_suffix|>AAABJRU5ErkJggg==';

function createTestImage() {
  // Create a simple image file from base64
  const buffer = Buffer.from(testImageBase64, 'base64');
  fs.writeFileSync('./test_vision_image.png', buffer);
  console.log(
    'Test Southwest Airlines logo test image created: test_vision_image.png'
  );

  return buffer;
}

async function testImageProcessing() {
  console.log('=== Testing Image Processing Pipeline ===');

  try {
    // Use a simple, reliable test image
    const testImageUrl = 'https://httpbin.org/image/png'; // Simple PNG test image

    // Simulate Discord attachment object
    const mockAttachment = {
      url: testImageUrl,
      contentType: 'image/png',
      size: 5000, // estimated size
      name: 'test_image.png',
    };

    // Mock message object
    const mockMessage = {
      attachments: new Map([['test_attachment', mockAttachment]]),
      content: 'What do you see in this image?',
      author: { id: 'test_user', username: 'testuser' },
      channel: { id: 'test_channel', type: 0 },
    };

    console.log('1. Testing processMessageMedia...');

    // Test media processing
    const mediaResult = await processMessageMedia(mockMessage);
    console.log('Media processing result:', {
      hasMedia: mediaResult.hasMedia,
      multimodalContentLength: mediaResult.multimodalContent?.length || 0,
      hasAudioTranscription: mediaResult.hasAudioTranscription,
      fallbackText: mediaResult.fallbackText,
    });

    if (
      mediaResult.multimodalContent &&
      mediaResult.multimodalContent.length > 0
    ) {
      const imageContent = mediaResult.multimodalContent[0];
      console.log('Image content structure:', {
        hasInlineData: !!imageContent.inlineData,
        mimeType: imageContent.inlineData?.mimeType,
        dataSize: imageContent.inlineData?.data?.length,
      });

      // If we have actual image data, test with AI
      if (imageContent.inlineData && imageContent.inlineData.data) {
        console.log('2. Testing AI provider with image...');

        // Initialize provider manager
        const providerManager = new ProviderManager();

        // Register providers (using existing config)
        const { GoogleAIProvider } = await import('./providers.js');
        const googleProvider = new GoogleAIProvider({
          apiKey: CONFIG.ai.google.apiKey,
          model: CONFIG.ai.google.model,
        });
        providerManager.registerProvider(googleProvider);
        providerManager.setPrimaryProvider('google');

        // Build test prompt
        const testPrompt = {
          text: 'Please describe exactly what you see in this image. Be very specific about the colors and shapes.',
        };

        // Combine with image content
        const multimodalPrompt = [testPrompt, ...mediaResult.multimodalContent];

        console.log('3. Sending to AI provider...');

        // Test with AI provider
        const response =
          await providerManager.generateContent(multimodalPrompt);

        console.log('=== AI RESPONSE ===');
        console.log('Response:', response.text || response);
        console.log('Provider:', response.metadata?.provider);
        console.log('Model:', response.metadata?.model);

        return response;
      } else {
        console.log('No valid image data found - skipping AI test');
      }
    }

    console.log('Test completed - image processing result available');
    return null;
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testImageProcessing()
    .then(() => {
      console.log('=== Test completed successfully ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('=== Test failed ===', error);
      process.exit(1);
    });
}

export { testImageProcessing, createTestImage };
