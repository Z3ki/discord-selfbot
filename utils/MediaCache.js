import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

export class MediaCache {
  constructor(
    cacheDir = './cache/media',
    maxSize = 100 * 1024 * 1024,
    maxAge = 24 * 60 * 60 * 1000
  ) {
    this.cacheDir = cacheDir;
    this.maxSize = maxSize; // 100MB default
    this.maxAge = maxAge; // 24 hours default
    this.indexFile = path.join(cacheDir, 'index.json');
    this.cacheIndex = new Map();

    this.ensureCacheDir();
    this.loadIndex();

    // Start cleanup interval
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // Clean every hour
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      logger.info('Created media cache directory', { path: this.cacheDir });
    }
  }

  loadIndex() {
    try {
      if (fs.existsSync(this.indexFile)) {
        const data = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
        this.cacheIndex = new Map(Object.entries(data));
        logger.debug('Loaded media cache index', {
          entries: this.cacheIndex.size,
        });
      }
    } catch (error) {
      logger.warn('Failed to load media cache index', { error: error.message });
      this.cacheIndex = new Map();
    }
  }

  saveIndex() {
    try {
      const data = Object.fromEntries(this.cacheIndex);
      fs.writeFileSync(this.indexFile, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Failed to save media cache index', {
        error: error.message,
      });
    }
  }

  generateKey(url, options = {}) {
    const hash = crypto.createHash('sha256');
    hash.update(url);

    // Include options in hash for different processing of same URL
    if (options.frameCount) hash.update(`frames:${options.frameCount}`);
    if (options.quality) hash.update(`quality:${options.quality}`);
    if (options.format) hash.update(`format:${options.format}`);

    return hash.digest('hex');
  }

  getFilePath(key) {
    return path.join(this.cacheDir, `${key}.cache`);
  }

  async get(key) {
    const entry = this.cacheIndex.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.delete(key);
      return null;
    }

    // Check if file exists
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      this.cacheIndex.delete(key);
      this.saveIndex();
      return null;
    }

    // Update access time
    entry.lastAccessed = Date.now();
    this.saveIndex();

    try {
      const data = fs.readFileSync(filePath);
      logger.debug('Media cache hit', { key, size: data.length });
      return data;
    } catch (error) {
      logger.warn('Failed to read cached media file', {
        key,
        error: error.message,
      });
      this.delete(key);
      return null;
    }
  }

  async set(key, data) {
    try {
      const filePath = this.getFilePath(key);

      // Check cache size limit
      await this.ensureSize(data.length);

      // Write file
      fs.writeFileSync(filePath, data);

      // Update index
      this.cacheIndex.set(key, {
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        size: data.length,
        filePath,
      });

      this.saveIndex();
      logger.debug('Media cached', { key, size: data.length });
      return true;
    } catch (error) {
      logger.error('Failed to cache media', { key, error: error.message });
      return false;
    }
  }

  delete(key) {
    try {
      const entry = this.cacheIndex.get(key);
      if (entry) {
        const filePath = this.getFilePath(key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        this.cacheIndex.delete(key);
        this.saveIndex();
        logger.debug('Media cache entry deleted', { key });
      }
    } catch (error) {
      logger.warn('Failed to delete cache entry', {
        key,
        error: error.message,
      });
    }
  }

  async ensureSize(newItemSize) {
    const currentSize = this.getCurrentSize();
    if (currentSize + newItemSize <= this.maxSize) {
      return; // Enough space
    }

    // Sort by last accessed time (LRU)
    const entries = Array.from(this.cacheIndex.entries())
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    let freedSpace = 0;
    for (const entry of entries) {
      this.delete(entry.key);
      freedSpace += entry.size;

      if (currentSize + newItemSize - freedSpace <= this.maxSize) {
        break;
      }
    }

    logger.info('Media cache cleanup completed', {
      freedSpace,
      entriesDeleted: entries.length,
    });
  }

  getCurrentSize() {
    return Array.from(this.cacheIndex.values()).reduce(
      (total, entry) => total + (entry.size || 0),
      0
    );
  }

  cleanup() {
    const now = Date.now();
    let deletedCount = 0;
    let freedSpace = 0;

    for (const [key, entry] of this.cacheIndex.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        const filePath = this.getFilePath(key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        freedSpace += entry.size || 0;
        this.cacheIndex.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.saveIndex();
      logger.info('Media cache cleanup completed', {
        deletedCount,
        freedSpace,
        totalEntries: this.cacheIndex.size,
      });
    }
  }

  clear() {
    try {
      // Delete all cache files
      for (const [key] of this.cacheIndex.entries()) {
        const filePath = this.getFilePath(key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Clear index
      this.cacheIndex.clear();
      this.saveIndex();

      logger.info('Media cache cleared');
    } catch (error) {
      logger.error('Failed to clear media cache', { error: error.message });
    }
  }

  getStats() {
    const totalSize = this.getCurrentSize();
    const entryCount = this.cacheIndex.size;

    return {
      entryCount,
      totalSize,
      totalSizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100,
      maxSizeMB: Math.round((this.maxSize / 1024 / 1024) * 100) / 100,
      usagePercent: Math.round((totalSize / this.maxSize) * 100),
      oldestEntry:
        entryCount > 0
          ? Math.min(
              ...Array.from(this.cacheIndex.values()).map((e) => e.timestamp)
            )
          : null,
      newestEntry:
        entryCount > 0
          ? Math.max(
              ...Array.from(this.cacheIndex.values()).map((e) => e.timestamp)
            )
          : null,
    };
  }
}

// Global cache instance
export const mediaCache = new MediaCache();
