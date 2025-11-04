import https from 'https';
import http from 'http';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { logger } from './utils/logger.js';
import { CONFIG } from './config/config.js';
import { validateFileType, validateUrl } from './security.js';
import { transcriptionService } from './services/TranscriptionService.js';
import { mediaCache } from './utils/MediaCache.js';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Downloads a file from a URL and converts it to base64 format for multimodal AI processing
 * @param {string} url - The file URL to download
 * @param {number} maxRedirects - Maximum number of redirects to follow (default: 5)
 * @returns {Promise<{base64: string, mimeType: string}>} Object containing base64 data and MIME type
 */
export async function downloadFileAsBase64(url, maxRedirects = 5) {
  // Validate URL format
  if (!validateUrl(url)) {
    throw new Error(`Invalid URL format: ${url}`);
  }

  // Check cache first
  const cacheKey = mediaCache.generateKey(url);
  const cachedData = await mediaCache.get(cacheKey);
  if (cachedData) {
    // Extract MIME type from cached data or use default
    const mimeType = 'image/jpeg'; // Default, should be stored with cache
    return {
      base64: cachedData.toString('base64'),
      mimeType
    };
  }

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;

    const makeRequest = (requestUrl, redirects = 0) => {
      protocol.get(requestUrl, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          if (redirects >= maxRedirects) {
            reject(new Error(`Too many redirects: ${redirects}`));
            return;
          }
          const redirectUrl = res.headers.location;
          if (!redirectUrl) {
            reject(new Error('Redirect without location header'));
            return;
          }
          // Validate redirect URL
          if (!validateUrl(redirectUrl)) {
            reject(new Error(`Invalid redirect URL: ${redirectUrl}`));
            return;
          }
          makeRequest(redirectUrl, redirects + 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${res.statusCode}`));
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', async () => {
          const buffer = Buffer.concat(chunks);
          const maxSize = CONFIG.media.maxFileSize;
          if (buffer.length > maxSize) {
            const { createBotError } = await import('./utils/errorHandler.js');
            reject(createBotError(
              `File too large: ${buffer.length} bytes (max ${maxSize})`,
              'FILE_TOO_LARGE',
              true,
              { fileSize: buffer.length, maxSize, url }
            ));
            return;
          }
          
          const mimeType = res.headers['content-type'] || 'image/jpeg';
          
          // Validate file type from MIME type and magic numbers
          const urlPath = new URL(url).pathname;
          const filename = urlPath.split('/').pop() || 'unknown';
          const validation = validateFileType(filename, mimeType, buffer);
          
          if (!validation.valid) {
            logger.warn(`File type validation failed: ${validation.reason}`, { url, mimeType });
            reject(new Error(`File type validation failed: ${validation.reason}`));
            return;
          }
          
          const base64 = buffer.toString('base64');
          
          // Cache the downloaded data
          await mediaCache.set(cacheKey, buffer);
          
          resolve({ base64, mimeType });
        });
      }).on('error', reject);
    };

    makeRequest(url);
  });
}

/**
 * Downloads an image from a URL and converts it to base64 format for multimodal AI processing
 * @param {string} url - The image URL to download
 * @param {number} maxRedirects - Maximum number of redirects to follow (default: 5)
 * @returns {Promise<{base64: string, mimeType: string}>} Object containing base64 data and MIME type
 */
export async function downloadImageAsBase64(url, maxRedirects = CONFIG.media.maxRedirects) {
  return downloadFileAsBase64(url, maxRedirects);
}

/**
 * Gets video duration and metadata using ffprobe
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<{duration: number, size: number}>} Video metadata
 */
export async function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to get video metadata: ${err.message}`));
        return;
      }

      const duration = metadata.format.duration;
      const size = metadata.format.size;

      resolve({ duration, size });
    });
  });
}

/**
 * Calculates optimal frame count and FPS based on video characteristics
 * @param {number} duration - Video duration in seconds
 * @param {number} fileSize - Video file size in bytes
 * @returns {{targetFrames: number, optimalFps: number}} Optimal frame count and FPS
 */
export function calculateVideoProcessingParams(duration, fileSize) {
  if (!duration || duration <= 0) {
    return { targetFrames: 16, optimalFps: 0.5 }; // Default fallback
  }

  // Base frame count on video duration with diminishing returns
  let targetFrames;
  if (duration <= 30) {
    // Short videos: high detail (2-3 frames per second)
    targetFrames = Math.min(64, Math.max(16, Math.floor(duration * 2.5)));
  } else if (duration <= 120) {
    // Medium videos: moderate detail (1-2 frames per second)
    targetFrames = Math.min(48, Math.max(24, Math.floor(duration * 0.8)));
  } else if (duration <= 600) {
    // Long videos: sparse sampling (0.5-1 frame per second)
    targetFrames = Math.min(64, Math.max(32, Math.floor(duration * 0.15)));
  } else {
    // Very long videos: minimal sampling (0.1-0.3 frames per second)
    targetFrames = Math.min(80, Math.max(40, Math.floor(duration * 0.08)));
  }

  // Adjust based on file size (larger files might have more complex content)
  if (fileSize > 50 * 1024 * 1024) { // > 50MB
    targetFrames = Math.min(96, Math.floor(targetFrames * 1.3)); // 30% more frames for large files
  } else if (fileSize < 5 * 1024 * 1024) { // < 5MB
    targetFrames = Math.max(12, Math.floor(targetFrames * 0.8)); // 20% fewer frames for small files
  }

  // Calculate FPS to achieve target frame count
  const optimalFps = targetFrames / duration;

  // Clamp FPS between reasonable bounds
  const minFps = 0.05; // Maximum 20 seconds between frames (for very long videos)
  const maxFps = 3.0;  // Maximum 3 frames per second (for very short/high-detail videos)
  const clampedFps = Math.max(minFps, Math.min(maxFps, optimalFps));

  // Recalculate target frames based on clamped FPS to ensure we don't exceed limits
  const finalTargetFrames = Math.min(96, Math.floor(clampedFps * duration));

  return {
    targetFrames: finalTargetFrames,
    optimalFps: clampedFps
  };
}

/**
 * Extracts audio from a video file
 * @param {string} videoPath - Path to the video file
 * @param {string} outputPath - Path to save extracted audio
 * @returns {Promise<string>} Path to extracted audio file
 */
export async function extractVideoAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        '-vn',           // No video
        '-acodec', 'libmp3lame', // MP3 codec for compatibility
        '-ab', '128k',   // Audio bitrate
        '-ar', '44100',  // Sample rate
        '-ac', '2'       // Stereo
      ])
      .output(outputPath)
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (error) => {
        reject(new Error(`Failed to extract video audio: ${error.message}`));
      })
      .run();
  });
}

/**
 * Extracts frames from a video file with dynamically calculated parameters
 * @param {string} videoPath - Path to the video file
 * @param {string} outputDir - Directory to save extracted frames
 * @returns {Promise<{frameFiles: string[], actualFps: number, duration: number, targetFrames: number}>} Frame files and extraction metadata
 */
export function extractVideoFrames(videoPath, outputDir) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Get video metadata to calculate optimal parameters
        const metadata = await getVideoMetadata(videoPath);
        const { targetFrames, optimalFps } = calculateVideoProcessingParams(metadata.duration, metadata.size);

        logger.info(`Video: ${metadata.duration.toFixed(1)}s, ${Math.round(metadata.size/1024/1024)}MB - extracting ${targetFrames} frames at ${optimalFps.toFixed(2)} fps`);

        const framePattern = path.join(outputDir, 'frame_%03d.jpg');

        ffmpeg(videoPath)
          .outputOptions([
            '-vf', `fps=${optimalFps}`, // Dynamic FPS based on video characteristics
            '-q:v', '2',       // High quality JPEG
            '-frames:v', targetFrames.toString() // Dynamic frame count
          ])
          .output(framePattern)
          .on('end', async () => {
            try {
              // Get list of generated frame files
              const frameFiles = (await fs.promises.readdir(outputDir))
                .filter(file => file.startsWith('frame_') && file.endsWith('.jpg'))
                .sort()
                .map(file => path.join(outputDir, file));

              resolve({
                frameFiles,
                actualFps: optimalFps,
                duration: metadata.duration,
                targetFrames
              });
            } catch (error) {
              reject(new Error(`Failed to read extracted frames: ${error.message}`));
            }
          })
          .on('error', (error) => {
            reject(new Error(`Failed to extract video frames: ${error.message}`));
          })
          .run();
      } catch (error) {
        reject(new Error(`Failed to prepare video frame extraction: ${error.message}`));
      }
    })();
  });
}

/**
 * Extracts frames from a GIF file with limited frame count
 * @param {string} gifPath - Path to the GIF file
 * @param {string} outputDir - Directory to save extracted frames
 * @returns {Promise<string[]>} Array of paths to extracted frame images
 */
export async function extractGifFrames(gifPath, outputDir) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const framePattern = path.join(outputDir, 'gif_frame_%03d.png');
    
    ffmpeg(gifPath)
      .outputOptions([
        '-vsync', '0', // Preserve frame timing
        '-q:v', '2',       // High quality PNG
        '-frames:v', '8'    // Limit to maximum 8 frames for GIFs
      ])
      .output(framePattern)
      .on('end', async () => {
        try {
          // Get list of generated frame files
          const frameFiles = (await fs.promises.readdir(outputDir))
            .filter(file => file.startsWith('gif_frame_') && file.endsWith('.png'))
            .sort()
            .map(file => path.join(outputDir, file));
          
          resolve(frameFiles);
        } catch (error) {
          reject(new Error(`Failed to read extracted GIF frames: ${error.message}`));
        }
      })
      .on('error', (error) => {
        reject(new Error(`Failed to extract GIF frames: ${error.message}`));
      })
      .run();
  });
}

/**
 * Downloads a video file from URL and extracts frames and transcribes audio for multimodal AI processing
 * @param {string} url - The video URL to download
 * @param {number} maxRedirects - Maximum number of redirects to follow (default: 5)
 * @returns {Promise<{frames: Array<{base64: string, mimeType: string}>, transcription: string, fallbackText: string}>}
 */
export async function processVideo(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;

    const makeRequest = (requestUrl, redirects = 0) => {
      protocol.get(requestUrl, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          if (redirects >= maxRedirects) {
            reject(new Error(`Too many redirects: ${redirects}`));
            return;
          }
          const redirectUrl = res.headers.location;
          if (!redirectUrl) {
            reject(new Error('Redirect without location header'));
            return;
          }
          makeRequest(redirectUrl, redirects + 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download video: ${res.statusCode}`));
          return;
        }

        // Create secure temporary directory
        const tempDir = mkdtempSync(path.join(tmpdir(), 'discord-selfbot-media-'));
        const videoPath = path.join(tempDir, `video_${Date.now()}.mp4`);
        const fileStream = fs.createWriteStream(videoPath);

        res.pipe(fileStream);

        fileStream.on('finish', async () => {
          fileStream.close();

          try {
            // Extract frames with dynamic parameters
            const framesDir = path.join(tempDir, `frames_${Date.now()}`);
            const frameResult = await extractVideoFrames(videoPath, framesDir);
            const { frameFiles, actualFps, duration, targetFrames } = frameResult;

            // Extract audio
            const audioPath = path.join(tempDir, `audio_${Date.now()}.mp3`);
            await extractVideoAudio(videoPath, audioPath);

            // Transcribe audio using Whisper
            logger.info(`Starting Whisper transcription for video audio: ${audioPath}`);
            const transcriptionResult = await transcriptionService.transcribe(audioPath);
            const transcription = transcriptionResult.transcription || 'No speech detected in video';

            // Convert frames to base64
            const frames = [];
            for (const framePath of frameFiles) {
              const frameBuffer = await fs.promises.readFile(framePath);
              const base64 = frameBuffer.toString('base64');
              frames.push({
                base64,
                mimeType: 'image/jpeg'
              });
            }

            // Clean up temporary files
            await fs.promises.unlink(videoPath);
            await fs.promises.unlink(audioPath);
            await Promise.all(frameFiles.map(file => fs.promises.unlink(file)));
            await fs.promises.rmdir(framesDir);

            const fallbackText = `**VIDEO MEDIA**: ${url} (${duration.toFixed(1)}s duration, ${actualFps.toFixed(2)} fps) - extracted ${frames.length}/${targetFrames} frames, audio transcription: "${transcription}"`;
            resolve({ frames, transcription, fallbackText });
          } catch (error) {
            // Clean up on error
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
            reject(error);
          }
        });

        fileStream.on('error', reject);
      }).on('error', reject);
    };

    makeRequest(url);
  });
}

/**
 * Downloads a GIF file from URL and extracts frames for multimodal AI processing
 * @param {string} url - The GIF URL to download
 * @param {number} maxRedirects - Maximum number of redirects to follow (default: 5)
 * @returns {Promise<{frames: Array<{base64: string, mimeType: string}>, fallbackText: string}>}
 */
export async function processGif(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;

    const makeRequest = (requestUrl, redirects = 0) => {
      protocol.get(requestUrl, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          if (redirects >= maxRedirects) {
            reject(new Error(`Too many redirects: ${redirects}`));
            return;
          }
          const redirectUrl = res.headers.location;
          if (!redirectUrl) {
            reject(new Error('Redirect without location header'));
            return;
          }
          makeRequest(redirectUrl, redirects + 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download GIF: ${res.statusCode}`));
          return;
        }

        // Create temporary file for GIF
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const gifPath = path.join(tempDir, `gif_${Date.now()}.gif`);
        const fileStream = fs.createWriteStream(gifPath);

        res.pipe(fileStream);

        fileStream.on('finish', async () => {
          fileStream.close();

          try {
            // Extract frames
            const framesDir = path.join(tempDir, `gif_frames_${Date.now()}`);
            const frameFiles = await extractGifFrames(gifPath, framesDir);

            // Convert frames to base64
            const frames = [];
            for (const framePath of frameFiles) {
              const frameBuffer = await fs.promises.readFile(framePath);
              const base64 = frameBuffer.toString('base64');
              frames.push({
                base64,
                mimeType: 'image/png'
              });
            }

            // Clean up temporary files
            await fs.promises.unlink(gifPath);
            await Promise.all(frameFiles.map(file => fs.promises.unlink(file)));
            await fs.promises.rmdir(framesDir);

            resolve({ frames, fallbackText: `**ANIMATED GIF MEDIA**: ${url} - extracted ${frames.length} frames` });
          } catch (error) {
            // Clean up on error
            if (fs.existsSync(gifPath)) fs.unlinkSync(gifPath);
            reject(error);
          }
        });

        fileStream.on('error', reject);
      }).on('error', reject);
    };

    makeRequest(url);
  });
}

/**
 * Downloads an audio file from URL and transcribes it using Whisper
 * @param {string} url - The audio URL to download and transcribe
 * @param {number} maxRedirects - Maximum number of redirects to follow (default: 5)
 * @returns {Promise<{transcription: string, fallbackText: string}>}
 */
export async function processAudio(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;

    const makeRequest = async (requestUrl, redirects = 0) => {
      protocol.get(requestUrl, async (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          if (redirects >= maxRedirects) {
            reject(new Error(`Too many redirects: ${redirects}`));
            return;
          }
          const redirectUrl = res.headers.location;
          if (!redirectUrl) {
            reject(new Error('Redirect without location header'));
            return;
          }
          makeRequest(redirectUrl, redirects + 1);
          return;
        }

        if (res.statusCode !== 200) {
          const { createBotError } = await import('./utils/errorHandler.js');
          reject(createBotError(
            `Failed to download audio: ${res.statusCode}`,
            'AUDIO_DOWNLOAD_FAILED',
            true,
            { statusCode: res.statusCode, url }
          ));
          return;
        }

        // Create temporary file for audio
        const tempDir = CONFIG.media.tempDir;
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const audioPath = path.join(tempDir, `audio_${Date.now()}.tmp`);
        const fileStream = fs.createWriteStream(audioPath);

        res.pipe(fileStream);

        fileStream.on('finish', async () => {
          fileStream.close();

          try {
            // Transcribe audio using Whisper
            logger.info(`Starting Whisper transcription for audio file: ${audioPath}`);

            // Transcribe audio using persistent transcription service
            const result = await transcriptionService.transcribe(audioPath);
            const transcription = result.transcription;

            // Clean up original audio file
            if (fs.existsSync(audioPath)) {
              await fs.promises.unlink(audioPath);
            }

            const transcriptText = transcription || 'No speech detected in audio';
            logger.info(`Whisper transcription completed: ${transcriptText.substring(0, 100)}...`);

            resolve({
              transcription: transcriptText,
              fallbackText: `**AUDIO MEDIA**: ${url} - "${transcriptText}"`
            });
          } catch (error) {
            // Clean up on error
            if (fs.existsSync(audioPath)) {
              await fs.promises.unlink(audioPath);
            }
            logger.error(`Audio transcription failed for ${url}:`, error);
            reject(new Error(`Audio transcription failed: ${error.message}`));
          }
        });

        fileStream.on('error', reject);
      }).on('error', reject);
    };

    makeRequest(url);
  });
}

/**
 * Legacy function for backward compatibility - redirects to processMessageMedia
 * @param {Message} message - Discord message object
 * @returns {Promise<{hasMedia: boolean, multimodalContent: Array, fallbackText: string}>}
 */
export async function processMessageImages(message) {
  return processMessageMedia(message);
}

/**
  * Processes Discord message attachments, stickers, videos, and GIFs to extract and prepare media data for multimodal AI
 * @param {Message} message - Discord message object
 * @param {boolean} asyncProcessing - If true, process media asynchronously and send follow-up messages
 * @returns {Promise<{hasMedia: boolean, multimodalContent: Array, fallbackText: string}>}
 */
export async function processMessageMedia(message, asyncProcessing = false, context = {}) {
  let multimodalContent = [];
  let hasMedia = false;
  let fallbackText = '';
  let audioTranscription = '';

   // If async processing is enabled, start background processing for heavy media
   // but process stickers and images synchronously for immediate AI response
   if (asyncProcessing) {
     // Process stickers and images synchronously first
     let syncMultimodalContent = [];
     let syncFallbackText = '';

     // Process stickers synchronously
     if (message.stickers && message.stickers.size > 0) {
       const stickers = Array.from(message.stickers.values());
       logger.debug(`Processing ${stickers.length} stickers synchronously`);

       for (const sticker of stickers) {
         try {
           logger.debug(`Sticker data:`, {
             id: sticker.id,
             name: sticker.name,
             format: sticker.format,
             url: sticker.url,
             hasUrl: !!sticker.url
           });

           const stickerUrl = sticker.url;
           if (stickerUrl && sticker.format !== 'LOTTIE') {
             logger.debug(`Attempting to download sticker: ${stickerUrl}`);
             const imageData = await downloadImageAsBase64(stickerUrl);
             if (imageData) {
               syncMultimodalContent.push({
                 inlineData: {
                   mimeType: imageData.mimeType,
                   data: imageData.base64
                 }
               });
               syncFallbackText += `**STICKER MEDIA**: "${sticker.name}" (${sticker.format} format) `;
               logger.debug(`Successfully processed sticker: ${sticker.name}`);
             }
           } else {
             const fallback = `**STICKER MEDIA**: "${sticker.name}" (ID: ${sticker.id}, format: ${sticker.format})`;
             syncMultimodalContent.push({ text: fallback });
             syncFallbackText += fallback + ' ';
           }
         } catch (error) {
           logger.error(`Failed to download sticker ${sticker.name}:`, error);
           const fallback = `**STICKER MEDIA**: "${sticker.name}" (ID: ${sticker.id}, format: ${sticker.format})`;
           syncMultimodalContent.push({ text: fallback });
           syncFallbackText += fallback + ' ';
         }
       }
     }

     // Process images synchronously
     if (message.attachments && message.attachments.size > 0) {
       const attachmentsArray = Array.from(message.attachments.values());
       logger.debug(`Processing ${attachmentsArray.length} attachments synchronously for images`);

       for (const attachment of attachmentsArray) {
         if (!attachment.contentType) {
           logger.warn('Skipping attachment without contentType');
           continue;
         }

         try {
           if (attachment.contentType.startsWith('image/') && attachment.contentType !== 'image/gif') {
             // Process static images synchronously
             logger.debug(`Processing image attachment synchronously: ${attachment.url}`);
             const imageData = await downloadImageAsBase64(attachment.url);
             if (imageData) {
               syncMultimodalContent.push({
                 inlineData: {
                   mimeType: imageData.mimeType,
                   data: imageData.base64
                 }
               });
               syncFallbackText += `**IMAGE MEDIA**: ${attachment.contentType} static image `;
               logger.debug(`Successfully processed image synchronously: ${attachment.url}`);
             } else {
               logger.warn(`Failed to download image synchronously: ${attachment.url}`);
               syncFallbackText += `**IMAGE MEDIA**: ${attachment.contentType} image (download failed) `;
             }
           }
         } catch (error) {
           logger.error(`Failed to process image attachment synchronously ${attachment.url}:`, error);
           syncFallbackText += `**IMAGE MEDIA**: ${attachment.contentType} image (processing failed) `;
         }
       }
     }
    
    // Extract channel ID before async processing to avoid reference loss
    const channelId = message.channel?.id || message.channelId;
    if (channelId) {
      logger.debug('Starting async media processing', { 
        channelId,
        attachmentCount: message.attachments?.size || 0,
        stickerCount: message.stickers?.size || 0
      });
      processMediaAsync(message, context);
    } else {
      logger.warn('Skipping async media processing - no channel ID available', { 
        hasChannel: !!message.channel,
        hasChannelId: !!message.channelId,
        messageKeys: Object.keys(message)
      });
    }
    // Return sticker and image data immediately, process other media (videos, GIFs, audio) in background
    return {
      hasMedia: (message.attachments && message.attachments.size > 0) || (message.stickers && message.stickers.size > 0),
      multimodalContent: syncMultimodalContent,
      fallbackText: syncFallbackText || '**MEDIA PROCESSING**: Analyzing remaining attachments in background...',
      audioTranscription: ''
    };
  }

    // Process Tenor URLs in message content
    const tenorRegex = /https?:\/\/tenor\.com\/view\/[^/\s]+\/(\d+)/g;
    let match;
    while ((match = tenorRegex.exec(message.content)) !== null) {
      hasMedia = true;
      fallbackText += `**GIF MEDIA**: Tenor animated GIF from ${match[0]} `;
      // Note: Full processing would require Tenor API key to fetch GIF data
    }

   // Process attachments
   if (message.attachments.size > 0) {
    const attachmentsArray = Array.from(message.attachments.values());
    
for (const attachment of attachmentsArray) {
        logger.debug(`Processing attachment:`, { 
          id: attachment.id,
          url: attachment.url,
          contentType: attachment.contentType,
          size: attachment.size
        });
        
        if (!attachment.contentType) {
          logger.warn('Skipping attachment without contentType');
          continue;
        }

        try {
          if (attachment.contentType.startsWith('image/')) {
            // Process static images
            hasMedia = true;
            logger.debug(`Processing image attachment: ${attachment.url}`);
            const imageData = await downloadImageAsBase64(attachment.url);
            if (imageData) {
              multimodalContent.push({
                inlineData: {
                  mimeType: imageData.mimeType,
                  data: imageData.base64
                }
              });
              fallbackText += `**IMAGE MEDIA**: ${attachment.contentType} static image `;
              logger.debug(`Successfully processed image: ${attachment.url}`);
            } else {
              logger.warn(`Failed to download image: ${attachment.url}`);
              fallbackText += `**IMAGE MEDIA**: ${attachment.contentType} image (download failed) `;
            }
          } else if (attachment.contentType.startsWith('video/')) {
          // Process videos with error handling (frames + audio transcription)
          hasMedia = true;
          try {
            const videoData = await processVideo(attachment.url);

            // Add extracted frames to multimodal content (limit to prevent API errors and context overload)
            const maxFrames = Math.min(videoData.frames.length, 32); // Increased for better video analysis
            for (let i = 0; i < maxFrames; i++) {
              const frame = videoData.frames[i];
              multimodalContent.push({
                inlineData: {
                  mimeType: frame.mimeType,
                  data: frame.base64
                }
              });
            }

            // Add transcription as text content for AI processing
            if (videoData.transcription && videoData.transcription.trim()) {
              audioTranscription += videoData.transcription + ' ';
              multimodalContent.push({
                text: `**VIDEO AUDIO TRANSCRIPTION**: ${videoData.transcription}`
              });
            }

            fallbackText += videoData.fallbackText + ' ';
           } catch (videoError) {
             logger.error(`Video processing failed for ${attachment.url}:`, videoError);
             // Fallback to text description
            const fallback = `**VIDEO MEDIA**: ${attachment.contentType} video (processing failed: ${videoError.message})`;
            multimodalContent.push({ text: fallback });
            fallbackText += fallback + ' ';
          }
        } else if (attachment.contentType === 'image/gif') {
           // Process GIFs with error handling
           hasMedia = true;
           try {
             const gifData = await processGif(attachment.url);

             // Add extracted frames to multimodal content (limit to prevent context overload)
             const maxGifFrames = Math.min(gifData.frames.length, 6); // Reduced to prevent context bloat
             for (let i = 0; i < maxGifFrames; i++) {
               const frame = gifData.frames[i];
               multimodalContent.push({
                 inlineData: {
                   mimeType: frame.mimeType,
                   data: frame.base64
                 }
               });
             }

             fallbackText += `**ANIMATED GIF MEDIA**: ${gifData.frames.length} frames extracted `;
            } catch (gifError) {
              logger.error(`GIF processing failed for ${attachment.url}:`, gifError);
              // Fallback to text description
             const fallback = `**ANIMATED GIF MEDIA**: Processing failed (${gifError.message})`;
             multimodalContent.push({ text: fallback });
             fallbackText += fallback + ' ';
           }
         } else if (attachment.contentType.startsWith('audio/')) {
           // Process audio files with speech-to-text transcription
           hasMedia = true;
           try {
             const audioData = await processAudio(attachment.url);

             // Store transcription for prompt inclusion
             if (audioData.transcription && audioData.transcription.trim()) {
               audioTranscription += audioData.transcription + ' ';
             }

             // Add transcription as text content for AI processing
             multimodalContent.push({
               text: `**AUDIO TRANSCRIPTION**: ${audioData.transcription}`
             });

             fallbackText += audioData.fallbackText + ' ';
           } catch (audioError) {
             logger.error(`Audio processing failed for ${attachment.url}:`, audioError);
             // Fallback to text description
             const fallback = `**AUDIO MEDIA**: ${attachment.contentType} file (transcription failed: ${audioError.message})`;
             multimodalContent.push({ text: fallback });
             fallbackText += fallback + ' ';
           }
         }
       } catch (error) {
         logger.error(`Failed to process media ${attachment.url}:`, error);
         // Fallback to text description if processing fails
        let fallback = `**UNKNOWN MEDIA**: ${attachment.contentType} file from ${attachment.url}`;
        if (attachment.width && attachment.height) {
          fallback += ` (${attachment.width}x${attachment.height} resolution)`;
        }
        multimodalContent.push({ text: fallback });
        fallbackText += fallback + ' ';
      }
    }
  }

// Process stickers
    if (message.stickers && message.stickers.size > 0) {
      hasMedia = true;
      const stickers = Array.from(message.stickers.values());
      logger.debug(`Processing ${stickers.length} stickers`);

      for (const sticker of stickers) {
        try {
          logger.debug(`Sticker data:`, { 
            id: sticker.id, 
            name: sticker.name, 
            format: sticker.format, 
            url: sticker.url,
            hasUrl: !!sticker.url 
          });
          
          // Discord stickers have a URL that can be downloaded
          const stickerUrl = sticker.url;
          if (stickerUrl && sticker.format !== 'LOTTIE') {
            // Only process PNG/APNG stickers as images, LOTTIE stickers are JSON
            logger.debug(`Attempting to download sticker: ${stickerUrl}`);
            const imageData = await downloadImageAsBase64(stickerUrl);
            if (imageData) {
              multimodalContent.push({
                inlineData: {
                  mimeType: imageData.mimeType,
                  data: imageData.base64
                }
              });
              fallbackText += `**STICKER MEDIA**: "${sticker.name}" (${sticker.format} format) `;
              logger.debug(`Successfully processed sticker: ${sticker.name}`);
            } else {
              logger.debug(`Failed to get image data for sticker: ${sticker.name}`);
            }
          } else {
            // Fallback for LOTTIE stickers or if no URL available
            const fallback = `**STICKER MEDIA**: "${sticker.name}" (ID: ${sticker.id}, format: ${sticker.format})`;
            multimodalContent.push({ text: fallback });
            fallbackText += fallback + ' ';
            logger.debug(`Using fallback for sticker: ${sticker.name} (no URL or LOTTIE format)`);
          }
         } catch (error) {
          logger.error(`Failed to download sticker ${sticker.name}:`, error);
          // Fallback to text description if download fails
         const fallback = `**STICKER MEDIA**: "${sticker.name}" (ID: ${sticker.id}, format: ${sticker.format})`;
         multimodalContent.push({ text: fallback });
         fallbackText += fallback + ' ';
        }
      }
    }

// Safety check: Limit total images to prevent API errors and context overload (model max: 32 media items)
   if (multimodalContent.length > 32) {
     logger.warn(`Too many images (${multimodalContent.length}), truncating to prevent API errors and context overload`);
     multimodalContent = multimodalContent.slice(0, 32);
    fallbackText += `**SYSTEM NOTE**: Media processing limited to 32 items to prevent API errors and context overload `;
   }

  return { hasMedia, multimodalContent, fallbackText: fallbackText.trim(), audioTranscription: audioTranscription.trim() };
}

/**
 * Processes media asynchronously in the background and sends follow-up messages
 * @param {Message} message - Discord message object
 */
async function processMediaAsync(message, context) {
  try {
    // Store message and channel IDs to avoid issues with async processing
    const messageId = message?.id;
    const channelId = message.channel?.id || message.channelId; // Try both channel.id and channelId
    const client = context?.client;

    // Validate required data before proceeding
    if (!messageId || !channelId || !client) {
      logger.error('Async media processing failed - missing required data', { 
        hasMessageId: !!messageId, 
        hasChannelId: !!channelId, 
        hasClient: !!client 
      });
      return;
    }

    logger.debug('Starting async media processing with valid data', { 
      messageId, 
      channelId,
      hasAttachments: message.attachments?.size > 0,
      hasStickers: message.stickers?.size > 0
    });

    let multimodalContent = [];
    let hasMedia = false;
    let fallbackText = '';
    let audioTranscription = '';

    // Process Tenor URLs in message content
    const tenorRegex = /https?:\/\/tenor\.com\/view\/[^/\s]+\/(\d+)/g;
    let match;
    while ((match = tenorRegex.exec(message.content)) !== null) {
      hasMedia = true;
      fallbackText += `**GIF MEDIA**: Tenor animated GIF from ${match[0]} `;
    }

    // Process attachments
    logger.debug('Processing attachments in async function', { 
      attachmentCount: message.attachments?.size || 0,
      attachments: Array.from(message.attachments?.values() || []).map(a => ({ 
        id: a.id, 
        url: a.url, 
        contentType: a.contentType,
        size: a.size 
      }))
    });
    
    if (message.attachments && message.attachments.size > 0) {
      const attachmentsArray = Array.from(message.attachments.values());

      for (const attachment of attachmentsArray) {
        if (!attachment.contentType) continue;

        try {
          if (attachment.contentType.startsWith('image/')) {
            // Process static images
            hasMedia = true;
            logger.debug(`Processing image attachment`, { 
              url: attachment.url, 
              contentType: attachment.contentType,
              size: attachment.size 
            });
            
            const imageData = await downloadImageAsBase64(attachment.url);
            if (imageData) {
              multimodalContent.push({
                inlineData: {
                  mimeType: imageData.mimeType,
                  data: imageData.base64
                }
              });
              fallbackText += `**IMAGE MEDIA**: ${attachment.contentType} static image `;
              logger.debug(`Successfully processed image`, { 
                mimeType: imageData.mimeType,
                dataSize: imageData.base64.length 
              });
            } else {
              logger.error(`Failed to download image`, { url: attachment.url });
              fallbackText += `**IMAGE MEDIA**: ${attachment.contentType} image (download failed) `;
            }
          } else if (attachment.contentType.startsWith('video/')) {
            // Process videos with error handling (frames + audio transcription)
            hasMedia = true;
            try {
              const videoData = await processVideo(attachment.url);

              // Add extracted frames to multimodal content (limit to prevent API errors and context overload)
              const maxFrames = Math.min(videoData.frames.length, 32); // Increased for better video analysis
              for (let i = 0; i < maxFrames; i++) {
                const frame = videoData.frames[i];
                multimodalContent.push({
                  inlineData: {
                    mimeType: frame.mimeType,
                    data: frame.base64
                  }
                });
              }

              // Add transcription as text content for AI processing
              if (videoData.transcription && videoData.transcription.trim()) {
                audioTranscription += videoData.transcription + ' ';
                multimodalContent.push({
                  text: `**VIDEO AUDIO TRANSCRIPTION**: ${videoData.transcription}`
                });
              }

              fallbackText += videoData.fallbackText + ' ';
             } catch (videoError) {
               logger.error(`Video processing failed for ${attachment.url}:`, videoError);
               // Fallback to text description
              const fallback = `**VIDEO MEDIA**: ${attachment.contentType} video (processing failed: ${videoError.message})`;
              multimodalContent.push({ text: fallback });
              fallbackText += fallback + ' ';
            }
          } else if (attachment.contentType === 'image/gif') {
             // Process GIFs with error handling
             hasMedia = true;
             try {
               const gifData = await processGif(attachment.url);

               // Add extracted frames to multimodal content (limit to prevent context overload)
               const maxGifFrames = Math.min(gifData.frames.length, 6); // Reduced to prevent context bloat
               for (let i = 0; i < maxGifFrames; i++) {
                 const frame = gifData.frames[i];
                 multimodalContent.push({
                   inlineData: {
                     mimeType: frame.mimeType,
                     data: frame.base64
                   }
                 });
               }

               fallbackText += `**ANIMATED GIF MEDIA**: ${gifData.frames.length} frames extracted `;
              } catch (gifError) {
                logger.error(`GIF processing failed for ${attachment.url}:`, gifError);
                // Fallback to text description
               const fallback = `**ANIMATED GIF MEDIA**: Processing failed (${gifError.message})`;
               multimodalContent.push({ text: fallback });
               fallbackText += fallback + ' ';
             }
           } else if (attachment.contentType.startsWith('audio/')) {
             // Process audio files with speech-to-text transcription
             hasMedia = true;
             try {
               const audioData = await processAudio(attachment.url);

               // Store transcription for prompt inclusion
               if (audioData.transcription && audioData.transcription.trim()) {
                 audioTranscription += audioData.transcription + ' ';
               }

               // Add transcription as text content for AI processing
               multimodalContent.push({
                 text: `**AUDIO TRANSCRIPTION**: ${audioData.transcription}`
               });

               fallbackText += audioData.fallbackText + ' ';
             } catch (audioError) {
               logger.error(`Audio processing failed for ${attachment.url}:`, audioError);
               // Fallback to text description
               const fallback = `**AUDIO MEDIA**: ${attachment.contentType} file (transcription failed: ${audioError.message})`;
               multimodalContent.push({ text: fallback });
               fallbackText += fallback + ' ';
             }
           }
         } catch (error) {
           logger.error(`Failed to process media ${attachment.url}:`, error);
           // Fallback to text description if processing fails
          let fallback = `**UNKNOWN MEDIA**: ${attachment.contentType} file from ${attachment.url}`;
          if (attachment.width && attachment.height) {
            fallback += ` (${attachment.width}x${attachment.height} resolution)`;
          }
          multimodalContent.push({ text: fallback });
          fallbackText += fallback + ' ';
        }
      }
    }

    // Process stickers
    if (message.stickers && message.stickers.size > 0) {
      hasMedia = true;
      const stickers = Array.from(message.stickers.values());
      logger.debug(`Processing ${stickers.length} stickers`);

      for (const sticker of stickers) {
        try {
          logger.debug(`Sticker data:`, { 
            id: sticker.id, 
            name: sticker.name, 
            format: sticker.format, 
            url: sticker.url,
            hasUrl: !!sticker.url 
          });
          
          // Discord stickers have a URL that can be downloaded
          const stickerUrl = sticker.url;
          if (stickerUrl && sticker.format !== 'LOTTIE') {
            // Only process PNG/APNG stickers as images, LOTTIE stickers are JSON
            logger.debug(`Attempting to download sticker: ${stickerUrl}`);
            const imageData = await downloadImageAsBase64(stickerUrl);
            if (imageData) {
              multimodalContent.push({
                inlineData: {
                  mimeType: imageData.mimeType,
                  data: imageData.base64
                }
              });
              fallbackText += `**STICKER MEDIA**: "${sticker.name}" (${sticker.format} format) `;
              logger.debug(`Successfully processed sticker: ${sticker.name}`);
            } else {
              logger.debug(`Failed to get image data for sticker: ${sticker.name}`);
            }
          } else {
            // Fallback for LOTTIE stickers or if no URL available
            const fallback = `**STICKER MEDIA**: "${sticker.name}" (ID: ${sticker.id}, format: ${sticker.format})`;
            multimodalContent.push({ text: fallback });
            fallbackText += fallback + ' ';
            logger.debug(`Using fallback for sticker: ${sticker.name} (no URL or LOTTIE format)`);
          }
         } catch (error) {
          logger.error(`Failed to download sticker ${sticker.name}:`, error);
          // Fallback to text description if download fails
         const fallback = `**STICKER MEDIA**: "${sticker.name}" (ID: ${sticker.id}, format: ${sticker.format})`;
         multimodalContent.push({ text: fallback });
         fallbackText += fallback + ' ';
        }
      }
    }

    // Safety check: Limit total images to prevent API errors and context overload (model max: 32 media items)
    if (multimodalContent.length > 32) {
      logger.warn(`Too many images (${multimodalContent.length}), truncating to prevent API errors and context overload`);
      multimodalContent = multimodalContent.slice(0, 32);
      fallbackText += `**SYSTEM NOTE**: Media processing limited to 32 items to prevent API errors and context overload `;
    }

    // Send follow-up message with processed media analysis
    if (hasMedia && multimodalContent.length > 0) {
      try {
        // Import the AI processing function
        const { generateResponse } = await import('./ai.js');

        // Create a follow-up message with media analysis
        const followUpMessage = {
          id: message.id,
          content: `**MEDIA ANALYSIS COMPLETE**: ${fallbackText.trim()}\n\nPlease analyze the attached media and provide insights.`,
          author: message.author,
          channel: {
            id: channelId,
            type: message.channel?.type || 'unknown'
          },
          attachments: new Map(), // Clear attachments since they're processed
          stickers: new Map() // Clear stickers since they're processed
        };

        // Add audio transcription to the follow-up message if available
        if (audioTranscription.trim()) {
          followUpMessage.content += `\n\n**Audio Transcription**: ${audioTranscription}`;
        }

        // Generate AI response with processed media
        const mediaAnalysis = await generateResponse(
          followUpMessage,
          context.providerManager,
          context.channelMemories,
          context.dmOrigins,
          context.client,
          context.globalPrompt,
          context.lastPrompt,
          context.lastResponse,
          context.lastToolCalls,
          context.lastToolResults,
          context.apiResourceManager,
          context.bot || null
        );

        if (mediaAnalysis) {
          try {
            const channel = client.channels.cache.get(channelId);
            if (channel) {
              await channel.send({ content: `**Media Analysis**: ${mediaAnalysis}`, reply: { messageReference: messageId } });
              logger.info('Sent media analysis follow-up message', { channelId });
            } else {
              logger.warn('Cannot send media analysis - channel not found in cache', { channelId });
            }
          } catch (replyError) {
            logger.error('Failed to send media analysis reply', { error: replyError.message });
            // Try alternative method
            try {
              const channel = client.channels.cache.get(channelId);
              if (channel) {
                await channel.send(`**Media Analysis**: ${mediaAnalysis}`);
              }
            } catch (altError) {
              logger.error('Failed to send media analysis via alternative method', { error: altError.message });
            }
          }
        }
      } catch (error) {
        logger.error('Failed to send media analysis follow-up', { error: error.message });
        try {
          const channel = client.channels.cache.get(channelId);
          if (channel) {
            await channel.send({ content: `**Media Processing Error**: ${error.message}`, reply: { messageReference: messageId } });
          } else {
            logger.warn('Cannot send media processing error - channel not found in cache', { channelId });
          }
        } catch (replyError) {
          logger.error('Failed to send error message', { error: replyError.message });
          // Try alternative method
          try {
            const channel = client.channels.cache.get(channelId);
            if (channel) {
              await channel.send(`**Media Processing Error**: ${error.message}`);
            }
          } catch (altError) {
            logger.error('Failed to send error message via alternative method', { error: altError.message });
          }
        }
      }
    }

  } catch (error) {
    logger.error('Async media processing failed', { error: error.message });
  }
}