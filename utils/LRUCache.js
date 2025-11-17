export class LRUCache {
  constructor(maxSize = 100, memoryLimitMB = 50) {
    this.maxSize = maxSize;
    this.memoryLimit = memoryLimitMB * 1024 * 1024;
    this.lastCleanup = Date.now();
    this.cache = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      // Update existing
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);

    // Proactive cleanup if memory pressure is high
    if (this.shouldCleanup()) {
      this.proactiveCleanup();
    }
  }

  shouldCleanup() {
    const now = Date.now();
    const timeSinceCleanup = now - this.lastCleanup;

    // Check memory usage and time since last cleanup
    const memoryUsage = this.getMemoryUsage();
    return memoryUsage > this.memoryLimit * 0.8 || timeSinceCleanup > 300000; // 5 minutes
  }

  proactiveCleanup() {
    // Remove 10% of oldest entries when approaching limit (less aggressive)
    const entriesToRemove = Math.floor(this.size() * 0.1);
    for (let i = 0; i < entriesToRemove; i++) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.lastCleanup = Date.now();
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.cache.keys());
  }

  values() {
    return Array.from(this.cache.values());
  }

  entries() {
    return Array.from(this.cache.entries());
  }

  // Get memory usage estimate
  getMemoryUsage() {
    let totalSize = 0;
    for (const [key, value] of this.cache) {
      totalSize += this.estimateSize(key) + this.estimateSize(value);
    }
    return totalSize;
  }

  estimateSize(obj) {
    if (obj === null || obj === undefined) return 0;

    switch (typeof obj) {
      case 'string':
        return obj.length * 2; // UTF-16
      case 'number':
        return 8;
      case 'boolean':
        return 4;
      case 'object':
        if (Array.isArray(obj)) {
          return (
            obj.length * 8 +
            obj.reduce((sum, item) => sum + this.estimateSize(item), 0)
          );
        }

        try {
          // For Maps and complex objects, use sampling
          if (obj instanceof Map) {
            let size = obj.size * 16; // Overhead per entry
            let sampled = 0;
            for (const [key, value] of obj.entries()) {
              if (sampled >= 10) break; // Sample first 10 entries
              size += this.estimateSize(key) + this.estimateSize(value);
              sampled++;
            }
            return size * (obj.size / Math.max(sampled, 1)); // Extrapolate
          }

          // For plain objects, sample properties
          const keys = Object.keys(obj);
          let size = keys.length * 16; // Overhead per property
          const sampleSize = Math.min(keys.length, 10);
          for (let i = 0; i < sampleSize; i++) {
            size +=
              this.estimateSize(keys[i]) + this.estimateSize(obj[keys[i]]);
          }
          return size * (keys.length / Math.max(sampleSize, 1));
        } catch {
          return 100; // Fallback
        }
      default:
        return 50; // Fallback for other types
    }
  }
}
