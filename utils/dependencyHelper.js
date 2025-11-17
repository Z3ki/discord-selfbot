/**
 * Helper utility to access dependencies from tools and services
 * Provides a clean interface to the dependency container
 */
import { container } from '../services/DependencyContainer.js';

/**
 * Get the Discord client instance
 * @returns {Client} Discord client
 */
export function getClient() {
  return container.resolve('client');
}

/**
 * Get the bot instance
 * @returns {Bot} Bot instance
 */
export function getBot() {
  return container.resolve('bot');
}

/**
 * Get the configuration
 * @returns {Object} Configuration object
 */
export function getConfig() {
  return container.resolve('config');
}

/**
 * Get the logger instance
 * @returns {Object} Logger instance
 */
export function getLogger() {
  return container.resolve('logger');
}

/**
 * Get the data manager instance
 * @returns {DataManager} Data manager instance
 */
export function getDataManager() {
  return container.resolve('dataManager');
}

/**
 * Register a new dependency
 * @param {string} name - Dependency name
 * @param {Function|Object} dependency - Dependency factory or instance
 * @param {boolean} singleton - Whether to treat as singleton
 */
export function registerDependency(name, dependency, singleton = false) {
  container.register(name, dependency, singleton);
}

/**
 * Resolve any dependency by name
 * @param {string} name - Dependency name
 * @returns {*} Dependency instance
 */
export function resolveDependency(name) {
  return container.resolve(name);
}
