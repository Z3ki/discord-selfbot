import fs from 'fs';
import { logger } from './utils/logger.js';

const HEALTH_LOG_FILE = 'health.log';

/**
 * Collects current health metrics for the bot
 * @param {Client} client - Discord client instance
 * @returns {Object} Health metrics object
 */
export function getHealthMetrics(client) {
  const uptime = process.uptime();
  const memory = process.memoryUsage();

  // Calculate uptime in readable format
  const uptimeHours = Math.floor(uptime / 3600);
  const uptimeMinutes = Math.floor((uptime % 3600) / 60);
  const uptimeString = `${uptimeHours}h ${uptimeMinutes}m`;

  // Memory in MB
  const memoryMB = {
    heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
  };

  // Last error (simplified - in real impl, track errors)
  const lastError = 'None'; // Placeholder

  // API latency (simplified ping)
  const apiLatency = client ? client.ws.ping : 'Unknown';

  // Get performance stats from AI module
  const performanceStats = {
    memoryUsage: 'N/A',
    totalResponses: 'N/A',
    cacheHitRate: 'N/A',
    averageResponseTime: 'N/A',
  };

  return {
    uptime: uptimeString,
    memory: memoryMB,
    lastError,
    apiLatency,
    performance: performanceStats,
  };
}

/**
 * Logs health metrics to file
 * @param {Object} metrics - Health metrics
 */
export async function logHealthMetrics(metrics) {
  try {
    const timestamp = new Date().toISOString();
    const perf = metrics.performance;
    const logEntry = `${timestamp} - Uptime: ${metrics.uptime}, Memory: ${perf.memoryUsage}, API Latency: ${metrics.apiLatency}ms, Responses: ${perf.totalResponses}, Cache Hit Rate: ${perf.cacheHitRate}, Avg Response Time: ${perf.averageResponseTime}\n`;

    await fs.promises.appendFile(HEALTH_LOG_FILE, logEntry);
  } catch (error) {
    logger.error('Failed to write health metrics', { error: error.message });
  }
}

/**
 * Checks if user has admin permissions for health command
 * @param {Message} message - Discord message
 * @returns {boolean}
 */
export function hasHealthPermission(message) {
  const adminIds = process.env.ADMIN_USER_ID
    ? process.env.ADMIN_USER_ID.split(',').map((id) => id.trim())
    : [];
  return adminIds.length > 0 && adminIds.includes(message.author.id);
}
