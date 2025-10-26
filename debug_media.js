// Debug script to test message structure and media processing
import { processMessageMedia } from './media.js';

// Mock message object similar to what Discord sends
const mockMessage = {
  id: '123456789',
  content: 'Test message with image',
  author: {
    id: '987654321',
    username: 'testuser'
  },
  channel: {
    id: '1155296120826765384',
    send: async () => {}
  },
  attachments: new Map([
    ['1', {
      id: '1',
      url: 'https://example.com/test.jpg',
      contentType: 'image/jpeg',
      width: 800,
      height: 600
    }]
  ]),
  stickers: new Map()
};

// Mock context
const mockContext = {
  client: {
    channels: {
      cache: new Map([
        ['1155296120826765384', {
          send: async () => {}
        }]
      ])
    }
  },
  providerManager: {},
  channelMemories: new Map(),
  dmOrigins: new Map(),
  globalPrompt: 'test',
  lastPrompt: '',
  lastResponse: '',
  lastToolCalls: [],
  lastToolResults: [],
  apiResourceManager: {}
};

console.log('Testing message structure:');
console.log('Message ID:', mockMessage.id);
console.log('Channel ID:', mockMessage.channel?.id);
console.log('Has channel object:', !!mockMessage.channel);
console.log('Attachments size:', mockMessage.attachments.size);

// Test the media processing
async function testMediaProcessing() {
  try {
    console.log('\nTesting media processing...');
    const result = await processMessageMedia(mockMessage, false, mockContext);
    console.log('Media processing result:', result);
  } catch (error) {
    console.error('Media processing error:', error);
  }
}

testMediaProcessing();