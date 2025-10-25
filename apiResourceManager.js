export class APIResourceManager {
  constructor(maxRequestsPerMinute = 60, maxRequestsPerHour = 1000) {
    this.usage = new Map(); // agentId -> { minute: count, hour: count, lastReset: timestamp }
    this.quotas = new Map(); // agentId -> { perMinute: number, perHour: number }
    this.globalLimits = { perMinute: maxRequestsPerMinute, perHour: maxRequestsPerHour };
    this.resetInterval = setInterval(() => this.resetCounters(), 60000); // Reset every minute
  }

  canMakeRequest(agentId = 'main') {
    const now = Date.now();
    const agentUsage = this.usage.get(agentId) || { minute: 0, hour: 0, lastReset: now };

    // Check agent-specific quotas
    const agentQuota = this.quotas.get(agentId) || this.globalLimits;

    if (agentUsage.minute >= agentQuota.perMinute || agentUsage.hour >= agentQuota.perHour) {
      return false;
    }

    return true;
  }

  recordRequest(agentId = 'main') {
    const agentUsage = this.usage.get(agentId) || { minute: 0, hour: 0, lastReset: Date.now() };
    agentUsage.minute++;
    agentUsage.hour++;
    this.usage.set(agentId, agentUsage);
  }

  setAgentQuota(agentId, perMinute, perHour) {
    this.quotas.set(agentId, { perMinute, perHour });
  }

  resetCounters() {
    const now = Date.now();
    for (const [, usage] of this.usage) {
      if (now - usage.lastReset >= 60000) {
        usage.minute = 0;
        usage.lastReset = now;
      }
    }
  }

  getUsageStats(agentId = null) {
    if (agentId) {
      return this.usage.get(agentId) || { minute: 0, hour: 0, lastReset: Date.now() };
    }

    const stats = {};
    for (const [id, usage] of this.usage) {
      stats[id] = usage;
    }
    return stats;
  }

  cleanup() {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
    }
  }
}