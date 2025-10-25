import fs from 'fs';
import { logger } from './utils/logger.js';
import { sendDM } from './utils/index.js';

const RATE_LIMIT_LOG = 'rate_limits.log';

// Queue system to prevent API flooding with enhancements
export class RequestQueue {
  constructor(rate = 1000, maxRetries = 5, backoffBase = 1000) { // 1000ms delay, 5 retries, 1s base backoff
    this.queues = new Map(); // channelId -> array of {task, userId, message, positionMessageId}
    this.processing = new Map(); // channelId -> boolean
    this.rate = rate;
    this.maxRetries = maxRetries;
    this.backoffBase = backoffBase;
    this.userLimits = new Map(); // userId -> { count, resetTime }
    this.limitWindow = 60000; // 1 minute
    this.maxRequestsPerWindow = 10; // 10 requests per minute per user

    // Spam detection
    this.spamHistory = new Map(); // userId -> array of {content, timestamp}
    this.spamWindow = 10000; // 10 seconds
    this.maxIdenticalMessages = 3; // Max identical messages in spam window
    this.maxMessagesInWindow = 5; // Max total messages in spam window

    // Subagent queue support
    this.subagentQueues = new Map(); // agentId -> { queue: [], processing: false, priorities: Map }
    this.subagentLimits = new Map(); // agentId -> { requestsPerMinute: number }

    // Stealth features
    this.stealthMode = false; // Disabled for faster responses
    this.lastProcessTime = new Map(); // channelId -> timestamp
    this.lastPositionUpdate = new Map(); // channelId -> timestamp
  }

  // Check if user is rate limited
  isUserRateLimited(userId) {
    const now = Date.now();
    const userData = this.userLimits.get(userId);
    if (!userData) return false;

    if (now > userData.resetTime) {
      // Reset window
      this.userLimits.delete(userId);
      return false;
    }

    return userData.count >= this.maxRequestsPerWindow;
  }

  // Record user request
  recordUserRequest(userId) {
    const now = Date.now();
    const resetTime = now + this.limitWindow;
    const userData = this.userLimits.get(userId) || { count: 0, resetTime };

    if (now > userData.resetTime) {
      userData.count = 1;
      userData.resetTime = resetTime;
    } else {
      userData.count++;
    }

    this.userLimits.set(userId, userData);
  }

  // Log rate limit event
  async logRateLimit(userId, channelId, reason) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - User: ${userId}, Channel: ${channelId}, Reason: ${reason}\n`;
    try {
      await fs.promises.appendFile(RATE_LIMIT_LOG, logEntry);
    } catch (error) {
      logger.error('Failed to log rate limit event', { error: error.message });
    }
  }

  // Check if message is spam
  isSpam(userId, content) {
    const now = Date.now();
    const userHistory = this.spamHistory.get(userId) || [];

    // Clean old entries
    const recentHistory = userHistory.filter(entry => now - entry.timestamp < this.spamWindow);
    this.spamHistory.set(userId, recentHistory);

    // Check total messages in window
    if (recentHistory.length >= this.maxMessagesInWindow) {
      return true;
    }

    // Check identical messages
    const identicalCount = recentHistory.filter(entry => entry.content === content).length;
    if (identicalCount >= this.maxIdenticalMessages) {
      return true;
    }

    // Add current message to history
    recentHistory.push({ content, timestamp: now });
    this.spamHistory.set(userId, recentHistory);

    return false;
  }

  async add(channelId, task, userId = null, message = null) {
    // Check user limit
    if (userId && this.isUserRateLimited(userId)) {
      await this.logRateLimit(userId, channelId, 'User rate limit exceeded');
      throw new Error('User rate limit exceeded. Please wait before making more requests.');
    }

    // Check for spam
    const content = message?.content || '';
    if (userId && content && this.isSpam(userId, content)) {
      await this.logRateLimit(userId, channelId, 'Spam detected - identical/rapid messages');
      throw new Error('Spam detected. Please avoid sending identical messages rapidly.');
    }

    // Initialize queue for channel if not exists
    if (!this.queues.has(channelId)) {
      this.queues.set(channelId, []);
    }

    const queue = this.queues.get(channelId);

    // Calculate position (including currently processing if any)
    const position = queue.length + (this.processing.get(channelId) ? 1 : 0);

    let positionMessageId = null;

    // Send queue position message if message provided and not first in line
    if (message && position > 1) {
      try {
        const positionMessage = await message.reply(this.formatPositionMessage(position - 1));
        positionMessageId = positionMessage.id;
      } catch (error) {
        console.error('Failed to send queue position message:', error);
      }
    }

    // Add to queue
    queue.push({ task, userId, message, positionMessageId });

    // Update position messages for all queued items
    await this.updatePositionMessages(channelId);

    // Start processing if not already
    if (!this.processing.get(channelId)) {
      this.processQueue(channelId);
    }

    // Return a promise that resolves when this task is done
    return new Promise((resolve) => {
      // The task will resolve/reject when processed
      // For now, just resolve immediately since we don't need to wait
      resolve();
    });
  }

  async processQueue(channelId) {
    this.processing.set(channelId, true);

    const queue = this.queues.get(channelId);

    // Auto-clear spam if queue gets too long
    if (queue.length > 10) {
      this.clearSpamFromQueue(channelId, 1); // Remove all duplicates beyond the first
    }

    while (queue.length > 0) {
      const { task, userId, positionMessageId, message } = queue.shift();

      let attempts = 0;
      let delay = this.rate;

      // Stealth: Add random variation to delay
      if (this.stealthMode) {
        const randomVariation = Math.random() * 500 - 250; // ±250ms variation
        delay = Math.max(500, delay + randomVariation); // Minimum 500ms
      }

      while (attempts <= this.maxRetries) {
        try {
          if (userId) this.recordUserRequest(userId);
          
          // Stealth: Add small random delay before task execution
          if (this.stealthMode) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
          }
          
          await task();

          // Delete the position message since task is complete
          if (positionMessageId && message) {
            try {
              const positionMessage = await message.channel.messages.fetch(positionMessageId);
              await positionMessage.delete();
            } catch (error) {
              // Message might already be deleted, ignore
            }
          }

          // Stealth: Record last process time
          this.lastProcessTime.set(channelId, Date.now());
          break; // Success
        } catch (error) {
          attempts++;
          if (attempts > this.maxRetries) {
            await this.logRateLimit(userId || 'unknown', channelId, `Max retries exceeded: ${error.message}`);
            throw error;
          }

           // Exponential backoff with stealth variation
           delay = this.backoffBase * Math.pow(2, attempts - 1);
           if (this.stealthMode) {
             delay += Math.random() * 1000; // Add up to 1s random delay
           }
           logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempts}/${this.maxRetries})`);
           await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Update position messages after processing this item
      await this.updatePositionMessages(channelId);

      // Stealth: Variable delay between requests to appear more human
      let nextDelay = this.rate;
      if (this.stealthMode) {
        // Add random variation based on time of day (slower at night)
        const hour = new Date().getHours();
        const isNight = hour < 8 || hour > 22;
        const variation = isNight ? Math.random() * 2000 : Math.random() * 1000;
        nextDelay = Math.max(500, this.rate + variation);
      }
      await new Promise(resolve => setTimeout(resolve, nextDelay));
    }

    this.processing.set(channelId, false);
  }

  // Format position message with less frequent updates
  formatPositionMessage(position) {
    const dotStates = ['', '.', '..', '...'];
    const frame = Math.floor(Date.now() / 5000) % dotStates.length; // 5 second intervals
    const dots = dotStates[frame];

    if (position === 1) {
      return `Your message is next in queue!${dots}`;
    } else {
      return `Your message is queued. Position: ${position} in line${dots}`;
    }
  }

  // Update position messages for all queued items in a channel (throttled)
  async updatePositionMessages(channelId) {
    const now = Date.now();
    const lastUpdate = this.lastPositionUpdate.get(channelId) || 0;

    // Only update every 5 seconds to reduce API calls
    if (now - lastUpdate < 5000) return;

    this.lastPositionUpdate.set(channelId, now);

    const queue = this.queues.get(channelId);
    if (!queue || queue.length === 0) return;

    const processingOffset = this.processing.get(channelId) ? 1 : 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.positionMessageId && item.message) {
        const newPosition = i + processingOffset;
        if (newPosition > 0) { // Only update if still in queue
          try {
            const positionMessage = await item.message.channel.messages.fetch(item.positionMessageId);
            await positionMessage.edit(this.formatPositionMessage(newPosition));
          } catch (error) {
            // Message might be deleted, ignore
          }
        }
      }
    }
  }

  // Clear spam messages from queue (removes identical messages beyond threshold)
  clearSpamFromQueue(channelId, maxIdentical = 2) {
    const queue = this.queues.get(channelId);
    if (!queue) return 0;

    const contentCount = new Map();
    const toRemove = new Set();

    // Count occurrences of each content
    for (let i = 0; i < queue.length; i++) {
      const content = queue[i].message?.content || '';
      if (content) {
        contentCount.set(content, (contentCount.get(content) || 0) + 1);
        if (contentCount.get(content) > maxIdentical) {
          toRemove.add(i);
        }
      }
    }

    // Remove spam messages (in reverse order to maintain indices)
    const indicesToRemove = Array.from(toRemove).sort((a, b) => b - a);
    let removed = 0;

    for (const index of indicesToRemove) {
      const item = queue[index];
      // Delete position message if it exists
      if (item.positionMessageId && item.message) {
        try {
          item.message.channel.messages.fetch(item.positionMessageId).then(msg => msg.delete()).catch(() => {});
        } catch (error) {
          // Ignore errors
        }
      }
      queue.splice(index, 1);
      removed++;
    }

    logger.info(`Cleared ${removed} spam messages from queue in channel ${channelId}`);
    return removed;
  }

  // Subagent queue methods
  addSubagentTask(agentId, task, priority = 'NORMAL') {
    if (!this.subagentQueues.has(agentId)) {
      this.subagentQueues.set(agentId, {
        queue: [],
        processing: false,
        priorities: new Map([['HIGH', []], ['NORMAL', []], ['LOW', []]])
      });
    }

    const agentQueue = this.subagentQueues.get(agentId);
    // Normalize priority to uppercase
    const normalizedPriority = priority.toUpperCase();
    const priorityQueue = agentQueue.priorities.get(normalizedPriority);
    if (!priorityQueue) {
      // Fallback to NORMAL if invalid priority
      agentQueue.priorities.get('NORMAL').push(task);
    } else {
      priorityQueue.push(task);
    }

    if (!agentQueue.processing) {
      this.processSubagentQueue(agentId);
    }
  }

  async processSubagentQueue(agentId) {
    const agentQueue = this.subagentQueues.get(agentId);
    agentQueue.processing = true;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let task = null;

        // Process by priority: HIGH -> NORMAL -> LOW
        for (const priority of ['HIGH', 'NORMAL', 'LOW']) {
          const priorityQueue = agentQueue.priorities.get(priority);
          if (priorityQueue.length > 0) {
            task = priorityQueue.shift();
            break;
          }
        }

        if (!task) break;

        await task();
        await new Promise(resolve => setTimeout(resolve, this.rate));
      }
    } finally {
      agentQueue.processing = false;
    }
  }
}

// Global DM queue for broadcasting at 1 per second
export class GlobalDMQueue {
  constructor(client, rate = 1000) {
    this.client = client;
    this.queue = [];
    this.rate = rate;
    this.processing = false;
  }

  add(content, userIds) {
    this.queue.push({ content, userIds });
    this.process();
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const { content, userIds } = this.queue.shift();
      for (const userId of userIds) {
        try {
          await sendDM(this.client, userId, content);
        } catch (error) {
          console.error('Error sending DM:', error);
        }
      }
      await new Promise(resolve => setTimeout(resolve, this.rate));
    }
    this.processing = false;
  }
}