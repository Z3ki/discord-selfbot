import { logger } from './utils/logger.js';
import { CONFIG } from './config/config.js';

// Stealth utilities for API requests
const apiStealth = {
  // Random user agents to mimic different browsers
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
  ],

  // Random accept headers
  acceptHeaders: [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'application/json, text/plain, */*',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  ],

  // Random accept-language headers
  acceptLanguages: [
    'en-US,en;q=0.9',
    'en-GB,en;q=0.9',
    'en-US,en;q=0.8,es;q=0.6',
    'en-US,en;q=0.9,fr;q=0.8'
  ],

  // Get random headers for API requests
  getRandomHeaders: () => ({
    'User-Agent': apiStealth.userAgents[Math.floor(Math.random() * apiStealth.userAgents.length)],
    'Accept': apiStealth.acceptHeaders[Math.floor(Math.random() * apiStealth.acceptHeaders.length)],
    'Accept-Language': apiStealth.acceptLanguages[Math.floor(Math.random() * apiStealth.acceptLanguages.length)],
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
  }),

  // Add random delays between API calls
  randomDelay: (min = 100, max = 500) => {
    if (!CONFIG.stealth.randomDelays) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
  },

  // Simulate human-like request patterns
  getRequestTiming: () => {
    const hour = new Date().getHours();
    // Slower during "sleep" hours (2am-8am)
    if (hour >= 2 && hour <= 8) {
      return Math.random() * 2000 + 1000; // 1-3 seconds
    }
    // Normal hours
    return Math.random() * 1000 + 500; // 0.5-1.5 seconds
  }
};

/**
 * Abstract base class for AI providers
 */
export class AIProvider {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.isAvailable = false;
  }

  /**
   * Initialize the provider
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Generate content using the provider
   * @param {string|object} _content - The content to generate from
   * @returns {Promise<object>} - The generated response with metadata
   */
  // eslint-disable-next-line no-unused-vars
  async generateContent(_content) {
    throw new Error('generateContent() must be implemented by subclass');
  }

  /**
   * Check if the provider is available
   * @returns {boolean}
   */
  isProviderAvailable() {
    return this.isAvailable;
  }
}

/**
 * Google AI Provider (Gemma 3-27B-IT)
 */
export class GoogleAIProvider extends AIProvider {
  constructor(config) {
    super('google', config);
    this.genAI = null;
    this.model = null;
  }

  async initialize() {
    try {
      if (!this.config.apiKey) {
        logger.warn('Google AI API key not provided, provider will be unavailable');
        return false;
      }

      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      this.genAI = new GoogleGenerativeAI(this.config.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: this.config.model || "models/gemma-3-27b-it",
        generationConfig: {
          temperature: this.config.temperature || 0.7
        }
      });
      this.isAvailable = true;
      logger.info('Google AI provider initialized successfully', { model: this.config.model });
      return true;
    } catch (error) {
      logger.error('Failed to initialize Google AI provider', { error: error.message });
      return false;
    }
  }

  async generateContent(content) {
    if (!this.isAvailable || !this.model) {
      throw new Error('Google AI provider is not available');
    }

    // Stealth: Add random delay before API call
    await apiStealth.randomDelay();

    // Ensure content is in the correct format for Google AI
    let formattedContent;
    if (typeof content === 'string') {
      formattedContent = [{ text: content }];
    } else if (Array.isArray(content)) {
      formattedContent = content;
    } else {
      formattedContent = [{ text: String(content) }];
    }

    const result = await this.model.generateContent(formattedContent);
    const response = result.response;
    const responseText = response.text();

    // Check for problematic responses that should trigger fallback
    const finishReason = response.candidates?.[0]?.finishReason;
    const hasEmptyText = !responseText || responseText.trim().length === 0;
    const hasProblematicFinish = finishReason === 'OTHER' || finishReason === 'SAFETY' || finishReason === 'RECITATION';

    if (hasEmptyText || hasProblematicFinish) {
      logger.warn('Google AI returned problematic response, triggering fallback', {
        finishReason,
        hasEmptyText,
        responseLength: responseText?.length || 0
      });
      throw new Error(`Google AI returned problematic response: finishReason=${finishReason}, emptyText=${hasEmptyText}`);
    }

    // Extract comprehensive information from Google AI response
    const fullResponse = {
      text: responseText,
      metadata: {
        provider: 'google',
        model: this.config.model,
        candidates: response.candidates?.length || 1,
        usage: response.usageMetadata ? {
          promptTokenCount: response.usageMetadata.promptTokenCount,
          candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
          totalTokenCount: response.usageMetadata.totalTokenCount
        } : null,
        safetyRatings: response.candidates?.[0]?.safetyRatings || null,
        finishReason: finishReason,
        // Additional Google AI specific data
        blocked: response.candidates?.[0]?.blocked || false,
        grounding: response.candidates?.[0]?.grounding || null,
        index: response.candidates?.[0]?.index || 0,
        timestamp: Date.now()
      },
      // Include full raw response for analysis (can be removed in production)
      rawResponse: {
        candidates: response.candidates,
        usageMetadata: response.usageMetadata,
        text: responseText
      }
    };

    return fullResponse;
  }

  async generateContentStream(content) {
    if (!this.isAvailable || !this.model) {
      throw new Error('Google AI provider is not available');
    }

    // Stealth: Add random delay before API call
    await apiStealth.randomDelay();

    // Ensure content is in the correct format for Google AI
    let formattedContent;
    if (typeof content === 'string') {
      formattedContent = [{ text: content }];
    } else if (Array.isArray(content)) {
      formattedContent = content;
    } else {
      formattedContent = [{ text: String(content) }];
    }

const streamResult = await this.model.generateContentStream(formattedContent);

    // Debug: log what we get from Google AI
    logger.debug('Google AI stream result analysis', {
      type: typeof streamResult,
      constructor: streamResult ? streamResult.constructor.name : 'null',
      hasAsyncIterator: streamResult && typeof streamResult[Symbol.asyncIterator] === 'function',
      hasStreamProperty: streamResult && typeof streamResult.stream === 'object',
      properties: streamResult ? Object.getOwnPropertyNames(streamResult) : []
    });

    // Google AI returns a stream object that may have different properties
    if (streamResult) {
      logger.debug('Using Google AI streaming');

      return {
        async *[Symbol.asyncIterator]() {
          try {
            // Try different ways Google AI might provide streaming
            let streamToUse = streamResult;

            // If it has a stream property, use that
            if (streamResult.stream && typeof streamResult.stream[Symbol.asyncIterator] === 'function') {
              streamToUse = streamResult.stream;
            }

            // If it's directly iterable, use it
            if (typeof streamResult[Symbol.asyncIterator] === 'function') {
              streamToUse = streamResult;
            }

            for await (const chunk of streamToUse) {
              // chunk is an EnhancedGenerateContentResponse
              const chunkText = chunk.text ? await chunk.text() : String(chunk);
              if (chunkText) {
                yield {
                  text: chunkText,
                  done: false
                };
              }
            }
            yield {
              text: '',
              done: true
            };
          } catch (streamError) {
            logger.warn('Google AI streaming failed during iteration', { error: streamError.message });
            // Return empty to signal end
            yield {
              text: '',
              done: true
            };
          }
        }
      };
    } else {
      // Fallback: try to get response as text
      logger.debug('Google AI streaming not available, using fallback - getting response as text');
      const response = await this.model.generateContent(formattedContent);
      const text = response.text();
      
      return {
        async *[Symbol.asyncIterator]() {
          if (text) {
            yield {
              text: text,
              done: false
            };
          }
          yield {
            text: '',
            done: true
          };
        }
      };
    }
  }
}

/**
 * NVIDIA NIM Provider (OpenAI-compatible API)
 */
export class NvidiaNIMProvider extends AIProvider {
  constructor(config) {
    super('nvidia-nim', config);
    this.baseURL = config.baseURL || 'https://integrate.api.nvidia.com/v1';
    this.model = config.model || 'google/gemma-3-27b-it';
  }

  async initialize() {
    try {
      if (!this.config.apiKey) {
        logger.warn('NVIDIA NIM API key not provided, provider will be unavailable');
        return false;
      }

      // Test the connection with a simple request
      const response = await fetch(`${this.baseURL}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`NVIDIA NIM API test failed: ${response.status} ${response.statusText}`);
      }

      this.isAvailable = true;
      logger.info('NVIDIA NIM provider initialized successfully', {
        baseURL: this.baseURL,
        model: this.model
      });
      return true;
    } catch (error) {
      logger.error('Failed to initialize NVIDIA NIM provider', { error: error.message });
      return false;
    }
  }

  async generateContent(content) {
    if (!this.isAvailable) {
      throw new Error('NVIDIA NIM provider is not available');
    }

    // Stealth: Add random delay before API call
    await apiStealth.randomDelay();

    try {
      const messages = [];

      // Handle different content types
      if (typeof content === 'string') {
        messages.push({
          role: 'user',
          content: content
        });
      } else if (Array.isArray(content)) {
        // Handle multimodal content (images, etc.) - convert to string format for NVIDIA NIM
        let contentString = '';
        for (const part of content) {
          if (part.text) {
            contentString += part.text;
          } else if (part.inlineData) {
            // Convert images to base64 img tags
            const mimeType = part.inlineData.mimeType || 'image/png';
            const base64Data = part.inlineData.data;
            contentString += ` <img src="data:${mimeType};base64,${base64Data}" />`;
          }
        }
        messages.push({
          role: 'user',
          content: contentString || 'Please analyze the attached media.'
        });
      } else if (content.parts) {
        // Handle Google AI style content
        const textParts = content.parts.filter(part => part.text).map(part => part.text).join('');
        const imageParts = content.parts.filter(part => part.inlineData);

        if (imageParts.length > 0) {
          // Convert images to NVIDIA NIM format with base64 img tags
          let contentString = textParts || 'What is shown in this image?';

          for (const imagePart of imageParts) {
            // Extract MIME type and base64 data
            const mimeType = imagePart.inlineData.mimeType || 'image/png';
            const base64Data = imagePart.inlineData.data;

            // Add image to content
            contentString += ` <img src="data:${mimeType};base64,${base64Data}" />`;
          }

          messages.push({
            role: 'user',
            content: contentString
          });
        } else {
          messages.push({
            role: 'user',
            content: textParts
          });
        }
      }

       // Stealth: Add random headers to mimic browser requests
       const headers = {
         'Authorization': `Bearer ${this.config.apiKey}`,
         'Content-Type': 'application/json',
         ...apiStealth.getRandomHeaders()
       };

       const response = await fetch(`${this.baseURL}/chat/completions`, {
         method: 'POST',
         headers: headers,
         body: JSON.stringify({
           model: this.model,
           messages: messages,
           max_tokens: Math.min(this.config.maxTokens || 32768, 120000),
           temperature: this.config.temperature || 0.7
         })
       });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NVIDIA NIM API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response choices returned from NVIDIA NIM');
      }

      // Extract comprehensive information from NVIDIA NIM response
      const fullResponse = {
        text: data.choices[0].message.content,
        metadata: {
          provider: 'nvidia-nim',
          model: data.model || this.model,
          usage: data.usage ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens
          } : null,
          finish_reason: data.choices[0].finish_reason,
          created: data.created,
          id: data.id,
          // Additional NVIDIA NIM specific data
          object: data.object,
          choices_count: data.choices?.length || 0,
          system_fingerprint: data.system_fingerprint,
          timestamp: Date.now()
        },
        // Include full raw response for analysis (can be removed in production)
        rawResponse: data
      };
      return fullResponse;

    } catch (error) {
      logger.error('NVIDIA NIM generation failed', { error: error.message });
      throw error;
    }
  }

  async generateContentStream(content) {
    if (!this.isAvailable) {
      throw new Error('NVIDIA NIM provider is not available');
    }

    // Stealth: Add random delay before API call
    await apiStealth.randomDelay();

    try {
      const messages = [];

      // Handle different content types (same as generateContent)
      if (typeof content === 'string') {
        messages.push({
          role: 'user',
          content: content
        });
      } else if (Array.isArray(content)) {
        // Handle multimodal content (images, etc.) - convert to string format for NVIDIA NIM
        let contentString = '';
        for (const part of content) {
          if (part.text) {
            contentString += part.text;
          } else if (part.inlineData) {
            // Convert images to base64 img tags
            const mimeType = part.inlineData.mimeType || 'image/png';
            const base64Data = part.inlineData.data;
            contentString += ` <img src="data:${mimeType};base64,${base64Data}" />`;
          }
        }
        messages.push({
          role: 'user',
          content: contentString || 'Please analyze the attached media.'
        });
      } else if (content.parts) {
        // Handle Google AI style content
        const textParts = content.parts.filter(part => part.text).map(part => part.text).join('');
        const imageParts = content.parts.filter(part => part.inlineData);

        if (imageParts.length > 0) {
          // Convert images to NVIDIA NIM format with base64 img tags
          let contentString = textParts || 'What is shown in this image?';

          for (const imagePart of imageParts) {
            // Extract MIME type and base64 data
            const mimeType = imagePart.inlineData.mimeType || 'image/png';
            const base64Data = imagePart.inlineData.data;

            // Add image to content
            contentString += ` <img src="data:${mimeType};base64,${base64Data}" />`;
          }

          messages.push({
            role: 'user',
            content: contentString
          });
        } else {
          messages.push({
            role: 'user',
            content: textParts
          });
        }
      }

       // Stealth: Add random headers to mimic browser requests
       const headers = {
         'Authorization': `Bearer ${this.config.apiKey}`,
         'Content-Type': 'application/json',
         ...apiStealth.getRandomHeaders()
       };

       const response = await fetch(`${this.baseURL}/chat/completions`, {
         method: 'POST',
         headers: headers,
         body: JSON.stringify({
           model: this.model,
           messages: messages,
           max_tokens: Math.min(this.config.maxTokens || 32768, 120000),
           temperature: this.config.temperature || 0.7,
           stream: true  // Enable streaming
         })
       });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NVIDIA NIM streaming API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Return an async generator that yields chunks from the stream
      return {
        async *[Symbol.asyncIterator]() {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') continue;

                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                      yield {
                        text: content,
                        done: false
                      };
                    }
                  } catch (e) {
                    // Ignore parsing errors for incomplete chunks
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

          yield {
            text: '',
            done: true
          };
        }
      };

    } catch (error) {
      logger.error('NVIDIA NIM streaming failed', { error: error.message });
      throw error;
    }
  }
}

/**
 * Provider Manager - handles multiple AI providers with fallback
 */
export class ProviderManager {
  constructor() {
    this.providers = new Map();
    this.primaryProvider = null;
    this.fallbackProvider = null;
  }

  /**
   * Register a provider
   * @param {AIProvider} provider
   */
  registerProvider(provider) {
    this.providers.set(provider.name, provider);
    logger.info('Provider registered', { name: provider.name });
  }

  /**
   * Set the primary provider
   * @param {string} providerName
   */
  setPrimaryProvider(providerName) {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider ${providerName} not registered`);
    }
    this.primaryProvider = this.providers.get(providerName);
    logger.info('Primary provider set', { name: providerName });
  }

  /**
   * Set the fallback provider
   * @param {string} providerName
   */
  setFallbackProvider(providerName) {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider ${providerName} not registered`);
    }
    this.fallbackProvider = this.providers.get(providerName);
    logger.info('Fallback provider set', { name: providerName });
  }

  /**
   * Initialize all registered providers
   */
  async initializeProviders() {
    const initPromises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        await provider.initialize();
        logger.info('Provider initialized successfully', { name: provider.name });
      } catch (error) {
        logger.error('Provider initialization failed', { name: provider.name, error: error.message });
      }
    });

    await Promise.allSettled(initPromises);
  }

  /**
   * Generate content using primary provider with fallback
   * @param {string|object} content
   * @param {number} maxRetries
   * @returns {Promise<string|object>} - Returns enhanced response object or string for backward compatibility
   */
  contentHasImages(content) {
    if (Array.isArray(content)) {
      return content.some(part => part.inlineData || (part.parts && part.parts.some(p => p.inlineData)));
    }
    return false;
  }

  async generateContent(content, maxRetries = 3) {
    let triedPrimary = false;
    let triedFallback = false;

    // Check if content contains images - prefer Google AI for multimodal content
    const hasImages = this.contentHasImages(content);
    const preferredProvider = hasImages && this.fallbackProvider?.name === 'google' ? this.fallbackProvider : this.primaryProvider;
    const secondaryProvider = hasImages && this.fallbackProvider?.name === 'google' ? this.primaryProvider : this.fallbackProvider;

    logger.debug('Content analysis for provider selection', {
      hasImages,
      preferredProvider: preferredProvider?.name,
      secondaryProvider: secondaryProvider?.name
    });

    // Try preferred provider first (Google for images, primary otherwise)
    if (preferredProvider && preferredProvider.isProviderAvailable()) {
      const isPrimary = preferredProvider === this.primaryProvider;
      triedPrimary = isPrimary;
      triedFallback = !isPrimary;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.debug('Attempting preferred provider', { provider: preferredProvider.name, attempt, maxRetries, hasImages });
          const result = await preferredProvider.generateContent(content);
          logger.debug('Preferred provider succeeded', { provider: preferredProvider.name });
          return result;
        } catch (error) {
          logger.warn('Preferred provider failed', {
            provider: preferredProvider.name,
            attempt,
            maxRetries,
            hasImages,
            error: error.message
          });
          if (attempt === maxRetries) break;
        }
      }
    }

    // Try secondary provider if preferred failed
    if (secondaryProvider && secondaryProvider.isProviderAvailable()) {
      const isPrimary = secondaryProvider === this.primaryProvider;
      triedPrimary = triedPrimary || isPrimary;
      triedFallback = triedFallback || !isPrimary;
      triedPrimary = true;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.debug('Attempting primary provider', { provider: this.primaryProvider.name, attempt, maxRetries });
          const result = await this.primaryProvider.generateContent(content);
          logger.debug('Primary provider succeeded', { provider: this.primaryProvider.name });
          return result;
        } catch (error) {
          logger.warn('Primary provider failed, trying fallback', {
            primary: this.primaryProvider.name,
            attempt,
            maxRetries,
            error: error.message
          });
          if (attempt < maxRetries) {
            // Stealth: Use random timing instead of fixed exponential backoff
            const delay = CONFIG.stealth.randomDelays ?
              apiStealth.getRequestTiming() :
              1000 * attempt;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }

    // Try fallback provider with retries
    if (this.fallbackProvider && this.fallbackProvider.isProviderAvailable()) {
      triedFallback = true;
      logger.info('Switching to fallback provider due to primary failure', {
        primary: this.primaryProvider?.name || 'none',
        fallback: this.fallbackProvider.name
      });
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.debug('Attempting fallback provider', { provider: this.fallbackProvider.name, attempt, maxRetries });
          const result = await this.fallbackProvider.generateContent(content);
          logger.info('Fallback provider succeeded', { provider: this.fallbackProvider.name });
          return result;
        } catch (error) {
          logger.warn('Fallback provider attempt failed', {
            fallback: this.fallbackProvider.name,
            attempt,
            maxRetries,
            error: error.message
          });

          if (attempt < maxRetries) {
            // Stealth: Use random timing instead of fixed exponential backoff
            const delay = CONFIG.stealth.randomDelays ?
              apiStealth.getRequestTiming() :
              1000 * attempt;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }

    // If both preferred and secondary fail, try other available providers
    for (const [name, provider] of this.providers) {
      if ((provider === preferredProvider && triedPrimary) || (provider === secondaryProvider && triedFallback)) {
        continue; // Already tried these
      }

      if (!provider.isProviderAvailable()) {
        continue;
      }

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.debug('Trying alternative provider', { name, attempt, maxRetries });
          return await provider.generateContent(content);
        } catch (error) {
          logger.warn('Alternative provider attempt failed', {
            name,
            attempt,
            maxRetries,
            error: error.message
          });

          if (attempt < maxRetries) {
            // Stealth: Use random timing instead of fixed exponential backoff
            const delay = CONFIG.stealth.randomDelays ?
              apiStealth.getRequestTiming() :
              1000 * attempt;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }

    throw new Error('All AI providers failed to generate content');
  }

  /**
   * Get provider status information
   * @returns {object}
   */
  getStatus() {
    const status = {};
    for (const [name, provider] of this.providers) {
      status[name] = {
        available: provider.isProviderAvailable(),
        type: provider.constructor.name
      };
    }
    return {
      providers: status,
      primary: this.primaryProvider?.name || null,
      fallback: this.fallbackProvider?.name || null
    };
  }

  /**
   * Generate streaming content using primary provider with fallback
   * @param {string|Array} content - The content to generate from
   * @param {number} maxRetries - Maximum number of retries per provider
   * @returns {AsyncGenerator} - Stream of content chunks
   */
  async generateContentStream(content, maxRetries = 3) {
    let triedPrimary = false;
    let triedFallback = false;

    // Try secondary provider
    if (secondaryProvider && secondaryProvider.isProviderAvailable()) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.debug('Attempting secondary provider', { provider: secondaryProvider.name, attempt, maxRetries, hasImages });
          const result = await secondaryProvider.generateContent(content);
          logger.debug('Secondary provider succeeded', { provider: secondaryProvider.name });
          return result;
        } catch (error) {
          logger.warn('Secondary provider failed', {
            provider: secondaryProvider.name,
            attempt,
            maxRetries,
            hasImages,
            error: error.message
          });
          if (attempt === maxRetries) break;
        }
      }
    }

    // Try fallback provider with retries
    if (this.fallbackProvider && this.fallbackProvider.isProviderAvailable() && this.fallbackProvider.generateContentStream) {
      triedFallback = true;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.debug('Using fallback provider for streaming', { name: this.fallbackProvider.name, attempt, maxRetries });
          const stream = await this.fallbackProvider.generateContentStream(content);
          return stream;
        } catch (error) {
          logger.warn('Fallback provider streaming attempt failed', {
            fallback: this.fallbackProvider.name,
            attempt,
            maxRetries,
            error: error.message
          });

          if (attempt < maxRetries) {
            // Stealth: Use random timing instead of fixed exponential backoff
            const delay = CONFIG.stealth.randomDelays ?
              apiStealth.getRequestTiming() :
              1000 * attempt;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }

    // If both fail, try other available providers
    for (const [name, provider] of this.providers) {
      if ((provider === this.primaryProvider && triedPrimary) || (provider === this.fallbackProvider && triedFallback)) {
        continue; // Already tried these
      }

      if (!provider.isProviderAvailable() || !provider.generateContentStream) {
        continue;
      }

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.debug('Trying alternative provider for streaming', { name, attempt, maxRetries });
          const stream = await provider.generateContentStream(content);
          return stream;
        } catch (error) {
          logger.warn('Alternative provider streaming attempt failed', {
            name,
            attempt,
            maxRetries,
            error: error.message
          });

          if (attempt < maxRetries) {
            // Stealth: Use random timing instead of fixed exponential backoff
            const delay = CONFIG.stealth.randomDelays ?
              apiStealth.getRequestTiming() :
              1000 * attempt;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }

    throw new Error('All AI providers failed to generate streaming content');
  }
}