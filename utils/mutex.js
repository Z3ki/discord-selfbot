/**
 * Simple mutex implementation for preventing race conditions
 */
export class Mutex {
  constructor() {
    this._locked = false;
    this._queue = [];
  }

  /**
   * Acquire the mutex lock
   * @returns {Promise} Promise that resolves when lock is acquired
   */
  async acquire() {
    return new Promise((resolve) => {
      if (!this._locked) {
        this._locked = true;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }

  /**
   * Release the mutex lock
   */
  release() {
    if (this._queue.length > 0) {
      const nextResolve = this._queue.shift();
      nextResolve();
    } else {
      this._locked = false;
    }
  }

  /**
   * Execute a function with mutex protection
   * @param {Function} fn - Function to execute
   * @returns {Promise} Promise that resolves with function result
   */
  async withLock(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

/**
 * Map wrapper with mutex protection
 */
export class ConcurrentMap {
  constructor() {
    this._map = new Map();
    this._mutex = new Mutex();
  }

  async get(key) {
    return await this._mutex.withLock(() => this._map.get(key));
  }

  async set(key, value) {
    return await this._mutex.withLock(() => this._map.set(key, value));
  }

  async has(key) {
    return await this._mutex.withLock(() => this._map.has(key));
  }

  async delete(key) {
    return await this._mutex.withLock(() => this._map.delete(key));
  }

  async clear() {
    return await this._mutex.withLock(() => this._map.clear());
  }

  async size() {
    return await this._mutex.withLock(() => this._map.size);
  }

  async entries() {
    return await this._mutex.withLock(() => Array.from(this._map.entries()));
  }

  async keys() {
    return await this._mutex.withLock(() => Array.from(this._map.keys()));
  }

  async values() {
    return await this._mutex.withLock(() => Array.from(this._map.values()));
  }

  // For atomic operations on nested Maps
  async atomicUpdateNestedMap(mainKey, subKey, updateFn) {
    return await this._mutex.withLock(() => {
      let subMap = this._map.get(mainKey);
      if (!subMap) {
        subMap = new Map();
        this._map.set(mainKey, subMap);
      }
      return updateFn(subMap);
    });
  }
}
