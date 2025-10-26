import { processMessageMedia } from './media.js';

// Mock message with real Discord image URL
const mockMessage = {
  id: '123456789',
  content: 'Test message with real image',
  author: {
    id: '987654321',
    username: 'testuser'
  },
  channel: {
    id: '1155296120826765384',
    send: async () => {},
    reply: async () => {}
  },
  attachments: new Map([
    ['1', {
      id: '1',
      url: 'https://cdn.discordapp.com/attachments/1155296120826765384/1431814615716593734/image.png?ex=68fec8c6&is=68fd7746&hm=72a8f0f61ddc074045250aa691448a397f87313371a46e6dc783ccf64c0982c8&',
      contentType: 'image/png',
      size: 230177
    }]
  ]),
  stickers: new Map()
};

// Mock context with minimal required properties
const mockContext = {
  client: {
    user: {
      displayName: 'TestBot',
      username: 'testbot',
      presence: {
        status: 'online',
        activities: []
      }
    },
    channels: {
      cache: new Map([
        ['1155296120826765384', {
          send: async () => {},
          reply: async () => {}
        }]
      ])
    }
  },
  providerManager: {
    generateContent: async () => 'Mock AI response'
  },
  channelMemories: new Map(),
  dmOrigins: new Map(),
  globalPrompt: ['test prompt'],
  lastPrompt: '',
  lastResponse: '',
  lastToolCalls: [],
  lastToolResults: [],
  apiResourceManager: {}
};

console.log('Testing SYNCHRONOUS real image processing...');

// Test synchronous processing (no async)
async function testSyncRealMediaProcessing() {
  try {
    console.log('Processing real image SYNCHRONOUSLY...');
    const result = await processMessageMedia(mockMessage, false, mockContext);
    console.log('Media processing result:');
    console.log('- Has media:', result.hasMedia);
    console.log('- Multimodal content length:', result.multimodalContent.length);
    console.log('- Fallback text:', result.fallbackText);
    console.log('- Audio transcription:', result.audioTranscription);
    
    if (result.multimodalContent.length > 0) {
      console.log('- First media item type:', result.multimodalContent[0].inlineData ? 'inlineData' : 'text');
      if (result.multimodalContent[0].inlineData) {
        console.log('- MIME type:', result.multimodalContent[0].inlineData.mimeType);
        console.log('- Data length:', result.multimodalContent[0].inlineData.data.length);
      }
    }
    
  } catch (error) {
    console.error('Media processing error:', error);
  }
}

testSyncRealMediaProcessing();