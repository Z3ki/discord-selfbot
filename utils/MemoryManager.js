import { logger } from './logger.js';
import { LRUCache } from './LRUCache.js';

/**
 * Advanced memory management utility for optimizing bot performance
 */

export class MemoryManager {
  constructor(options = {}) {
    this.options = {
      maxMemoryUsage: options.maxMemoryUsage || 500, // MB
      cleanupInterval: options.cleanupInterval || 300000, // 5 minutes
      gcThreshold: options.gcThreshold || 0.8, // 80% memory usage triggers GC
      ...options,
    };

    this.caches = new Map();
    this.timers = new Map();
    this.stats = {
      cleanups: 0,
      memoryFreed: 0,
      lastCleanup: Date.now(),
      gcCalls: 0,
    };

    // Start periodic cleanup
    this.startPeriodicCleanup();

    // Monitor memory usage
    this.startMemoryMonitoring();
  }

  /**
   * Create an optimized cache with automatic cleanup
   */
  createCache(name, maxSize, maxMemoryMB = 10) {
    const cache = new LRUCache(maxSize, maxMemoryMB);
    this.caches.set(name, cache);

    // Add metadata tracking
    cache.metadata = {
      name,
      createdAt: Date.now(),
      hits: 0,
      misses: 0,
      evictions: 0,
    };

    // Override get/set to track stats
    const originalGet = cache.get;
    const originalSet = cache.set;
    const originalDelete = cache.delete;

    cache.get = (key) => {
      const result = originalGet.call(cache, key);
      if (result !== undefined) {
        cache.metadata.hits++;
      } else {
        cache.metadata.misses++;
      }
      return result;
    };

    cache.set = (key, value) => {
      const existing = cache.get(key);
      const result = originalSet.call(cache, key, value);

      // Track evictions
      if (existing !== undefined && cache.get(key) === undefined) {
        cache.metadata.evictions++;
      }

      return result;
    };

    cache.delete = (key) => {
      const result = originalDelete.call(cache, key);
      return result;
    };

    return cache;
  }

  /**
   * Create a memory-efficient buffer pool
   */
  createBufferPool(name, bufferSize, poolSize = 10) {
    const pool = {
      name,
      bufferSize,
      available: [],
      inUse: new Set(),
      totalAllocated: 0,
      maxPoolSize: poolSize,
    };

    this.timers.set(name, pool);

    return {
      acquire: () => {
        let buffer;

        if (pool.available.length > 0) {
          buffer = pool.available.pop();
        } else if (pool.totalAllocated < pool.maxPoolSize) {
          buffer = Buffer.allocUnsafe(bufferSize);
          pool.totalAllocated++;
        } else {
          // Pool exhausted, create temporary buffer
          buffer = Buffer.allocUnsafe(bufferSize);
        }

        pool.inUse.add(buffer);
        return buffer;
      },

      release: (buffer) => {
        if (pool.inUse.has(buffer)) {
          pool.inUse.delete(buffer);

          // Clear buffer data for security
          buffer.fill(0);

          if (pool.available.length < pool.maxPoolSize) {
            pool.available.push(buffer);
          }
        }
      },

      clear: () => {
        pool.available.forEach((buffer) => buffer.fill(0));
        pool.available = [];
        pool.inUse.clear();
        pool.totalAllocated = 0;
      },
    };
  }

  /**
   * Optimize string memory usage
   */
  optimizeString(str) {
    if (typeof str !== 'string') return str;

    // Remove unnecessary whitespace
    const optimized = str.replace(/\s+/g, ' ').trim();

    // Use string interning for repeated strings
    if (optimized.length < 100) {
      return this.internString(optimized);
    }

    return optimized;
  }

  /**
   * String interning for memory efficiency
   */
  internString(str) {
    if (!this.stringInterns) {
      this.stringInterns = new Map();
    }

    const existing = this.stringInterns.get(str);
    if (existing) return existing;

    this.stringInterns.set(str, str);
    return str;
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats() {
    const memUsage = process.memoryUsage();

    return {
      heapUsed: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotal: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
      external: Math.round((memUsage.external / 1024 / 1024) * 100) / 100,
      arrayBuffers:
        Math.round((memUsage.arrayBuffers / 1024 / 1024) * 100) / 100,
      usagePercent:
        (memUsage.heapUsed / 1024 / 1024 / this.options.maxMemoryUsage) * 100,
      caches: this.getCacheStats(),
      buffers: this.getBufferStats(),
      ...this.stats,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stats = {};

    for (const [name, cache] of this.caches) {
      const metadata = cache.metadata || {};
      stats[name] = {
        size: cache.size,
        maxSize: cache.maxSize,
        memoryUsage: cache.memoryUsage || 0,
        hits: metadata.hits || 0,
        misses: metadata.misses || 0,
        evictions: metadata.evictions || 0,
        hitRate: metadata.hits
          ? ((metadata.hits / (metadata.hits + metadata.misses)) * 100).toFixed(
              2
            )
          : 0,
      };
    }

    return stats;
  }

  /**
   * Get buffer pool statistics
   */
  getBufferStats() {
    const stats = {};

    for (const [name, pool] of this.timers) {
      if (pool.bufferSize) {
        stats[name] = {
          available: pool.available.length,
          inUse: pool.inUse.size,
          totalAllocated: pool.totalAllocated,
          maxPoolSize: pool.maxPoolSize,
          bufferSize: pool.bufferSize,
        };
      }
    }

    return stats;
  }

  /**
   * Perform garbage collection if needed
   */
  performGC() {
    const memStats = this.getMemoryStats();

    if (memStats.usagePercent > this.options.gcThreshold * 100) {
      logger.info('Performing garbage collection', {
        usagePercent: memStats.usagePercent,
        threshold: this.options.gcThreshold * 100,
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.stats.gcCalls++;

        const afterGC = this.getMemoryStats();
        this.stats.memoryFreed += memStats.heapUsed - afterGC.heapUsed;

        logger.info('Garbage collection completed', {
          before: memStats.heapUsed,
          after: afterGC.heapUsed,
          freed: memStats.heapUsed - afterGC.heapUsed,
        });
      }
    }
  }

  /**
   * Cleanup old data from caches
   */
  cleanup() {
    const startTime = Date.now();
    let totalCleaned = 0;

    // Cleanup caches
    for (const [, cache] of this.caches) {
      const sizeBefore = typeof cache.size === 'number' ? cache.size : 0;

      // Remove expired entries if cache supports TTL
      if (cache.cleanup && typeof cache.cleanup === 'function') {
        cache.cleanup();
      }

      // If cache is too large, remove least recently used items
      if (
        typeof cache.size === 'number' &&
        cache.size > (cache.maxSize || 0) * 0.9
      ) {
        const itemsToRemove = Math.floor(cache.size * 0.2);
        for (let i = 0; i < itemsToRemove; i++) {
          const key = cache.keys().next().value;
          if (key) cache.delete(key);
        }
      }

      const sizeAfter = typeof cache.size === 'number' ? cache.size : 0;
      totalCleaned += sizeBefore - sizeAfter;
    }

    // Cleanup string interns
    if (this.stringInterns && this.stringInterns.size > 10000) {
      const entries = Array.from(this.stringInterns.entries());
      // Keep only the most recently used (simple heuristic)
      this.stringInterns.clear();
      entries.slice(-5000).forEach(([key, value]) => {
        this.stringInterns.set(key, value);
      });
      totalCleaned += entries.length - 5000;
    }

    // Update stats
    this.stats.cleanups++;
    this.stats.lastCleanup = Date.now();

    const duration = Date.now() - startTime;
    logger.info('Memory cleanup completed', {
      duration,
      itemsCleaned: totalCleaned,
      memoryStats: this.getMemoryStats(),
    });

    return totalCleaned;
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
      this.performGC();
    }, this.options.cleanupInterval);
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    this.monitorInterval = setInterval(() => {
      const stats = this.getMemoryStats();

      if (stats.usagePercent > 90) {
        logger.warn('High memory usage detected', {
          usagePercent: stats.usagePercent,
        });

        // Emergency cleanup
        this.cleanup();
        this.performGC();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Create memory-efficient object pool
   */
  createObjectPool(name, createFn, resetFn, maxSize = 50) {
    const pool = {
      name,
      available: [],
      inUse: new Set(),
      createFn,
      resetFn,
      maxSize,
      totalCreated: 0,
    };

    this.timers.set(name, pool);

    return {
      acquire: (...args) => {
        let obj;

        if (pool.available.length > 0) {
          obj = pool.available.pop();
        } else if (pool.totalCreated < pool.maxSize) {
          obj = pool.createFn(...args);
          pool.totalCreated++;
        } else {
          // Pool exhausted, create temporary object
          obj = pool.createFn(...args);
        }

        pool.inUse.add(obj);
        return obj;
      },

      release: (obj) => {
        if (pool.inUse.has(obj)) {
          pool.inUse.delete(obj);

          // Reset object state
          if (pool.resetFn) {
            pool.resetFn(obj);
          }

          if (pool.available.length < pool.maxSize) {
            pool.available.push(obj);
          }
        }
      },

      clear: () => {
        pool.available = [];
        pool.inUse.clear();
        pool.totalCreated = 0;
      },
    };
  }

  /**
   * Optimize array memory usage
   */
  optimizeArray(arr) {
    if (!Array.isArray(arr)) return arr;

    // Remove undefined and null values
    const filtered = arr.filter((item) => item !== undefined && item !== null);

    // If array is mostly empty, use sparse array
    if (filtered.length < arr.length * 0.5) {
      return new Array(...filtered);
    }

    return filtered;
  }

  /**
   * Compress large objects for storage
   */
  compressObject(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;

    try {
      // Simple JSON compression for now
      const json = JSON.stringify(obj);
      if (json.length > 1024) {
        return {
          __compressed: true,
          data: json,
        };
      }
      return obj;
    } catch (error) {
      return obj;
    }
  }

  /**
   * Decompress objects from storage
   */
  decompressObject(obj) {
    if (obj && typeof obj === 'object' && obj.__compressed) {
      try {
        return JSON.parse(obj.data);
      } catch (error) {
        return obj;
      }
    }
    return obj;
  }

  /**
   * Shutdown memory manager
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    // Clear all caches
    for (const cache of this.caches.values()) {
      cache.clear();
    }

    // Clear all buffer pools
    for (const pool of this.timers.values()) {
      if (pool.clear) {
        pool.clear();
      }
    }

    this.caches.clear();
    this.timers.clear();

    if (this.stringInterns) {
      this.stringInterns.clear();
    }

    logger.info('Memory manager shutdown completed');
  }
}

// Global memory manager instance
export const memoryManager = new MemoryManager();
