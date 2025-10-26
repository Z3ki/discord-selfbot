import { downloadImageAsBase64 } from './media.js';

const realImageUrl = 'https://cdn.discordapp.com/attachments/1155296120826765384/1431814615716593734/image.png?ex=68fec8c6&is=68fd7746&hm=72a8f0f61ddc074045250aa691448a397f87313371a46e6dc783ccf64c0982c8&';

async function testRealImage() {
  try {
    console.log('Testing real Discord image URL...');
    console.log('URL:', realImageUrl);
    
    const result = await downloadImageAsBase64(realImageUrl);
    console.log('Success! Image data:');
    console.log('- MIME type:', result.mimeType);
    console.log('- Base64 length:', result.base64.length);
    console.log('- First 100 chars of base64:', result.base64.substring(0, 100) + '...');
    
  } catch (error) {
    console.error('Failed to process image:', error.message);
    console.error('Full error:', error);
  }
}

testRealImage();