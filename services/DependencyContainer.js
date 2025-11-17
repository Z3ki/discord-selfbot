/**
 * Dependency Injection Container
 * Provides centralized dependency management to reduce global state
 */
export class DependencyContainer {
  constructor() {
    this.dependencies = new Map();
    this.singletons = new Map();
  }

  /**
   * Register a dependency
   * @param {string} name - Dependency name
   * @param {Function|Object} dependency - Dependency factory or instance
   * @param {boolean} singleton - Whether to treat as singleton
   */
  register(name, dependency, singleton = false) {
    this.dependencies.set(name, { dependency, singleton });
  }

  /**
   * Resolve a dependency
   * @param {string} name - Dependency name
   * @returns {*} Dependency instance
   */
  resolve(name) {
    const dep = this.dependencies.get(name);
    if (!dep) {
      throw new Error(`Dependency '${name}' not found`);
    }

    if (dep.singleton) {
      if (!this.singletons.has(name)) {
        const instance =
          typeof dep.dependency === 'function'
            ? dep.dependency(this)
            : dep.dependency;
        this.singletons.set(name, instance);
      }
      return this.singletons.get(name);
    }

    return typeof dep.dependency === 'function'
      ? dep.dependency(this)
      : dep.dependency;
  }

  /**
   * Check if dependency exists
   * @param {string} name - Dependency name
   * @returns {boolean}
   */
  has(name) {
    return this.dependencies.has(name);
  }

  /**
   * Clear all dependencies (mainly for testing)
   */
  clear() {
    this.dependencies.clear();
    this.singletons.clear();
  }
}

// Global container instance
export const container = new DependencyContainer();
