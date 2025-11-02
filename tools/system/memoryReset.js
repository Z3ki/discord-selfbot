export const memoryResetTool = {
  name: 'memory_reset',
  description: 'Reset/clear conversation memory for current channel or DM',
  parameters: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        enum: ['channel', 'dm', 'all'],
        description: 'Scope of memory reset: channel (current), dm (current DM), all (all memories)',
        default: 'channel'
      },
      confirm: {
        type: 'boolean',
        description: 'Must be true to confirm reset',
        default: false
      }
    },
    required: ['confirm']
  },
  execute: async function({ scope = 'channel', confirm = false }, message, client, channelMemories, dmOrigins) {
    if (!confirm) {
      return 'Memory reset cancelled - I need confirmation to proceed. Please use confirm=true.';
    }

    let resetCount = 0;

    if (scope === 'all') {
      // Clear all channel memories
      for (const [channelId, memories] of channelMemories.entries()) {
        if (memories.length > 0) {
          channelMemories.set(channelId, []);
          resetCount++;
        }
      }
      return `I have cleared all my conversation memories across ${resetCount} channels and DMs.`;
    }

    const channelId = message.channel?.id || message.channelId;
    const isDM = message.channel?.type === 'DM' || message.channel?.type === 1;

    if (scope === 'dm' && !isDM) {
      return 'I cannot reset DM memory because this is not a DM channel.';
    }

    if (scope === 'channel' && isDM) {
      return 'I cannot reset channel memory because this is a DM. Please use scope="dm" instead.';
    }

    if (channelMemories.has(channelId)) {
      const oldLength = channelMemories.get(channelId).length;
      channelMemories.set(channelId, []);
      resetCount = oldLength;
    }

    const scopeText = scope === 'dm' ? 'DM' : 'channel';
    return `I have cleared my conversation memory for this ${scopeText}.`;
  }
};