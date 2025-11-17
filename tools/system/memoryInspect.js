export const memoryInspectTool = {
  name: 'memory_inspect',
  description: 'Inspect current conversation memory for debugging',
  parameters: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        enum: ['channel', 'dm', 'summary'],
        description:
          'Scope of inspection: channel (current), dm (current DM), summary (stats only)',
        default: 'channel',
      },
      limit: {
        type: 'number',
        description:
          'Maximum number of messages to show (for channel/dm scope)',
        default: 5,
        minimum: 1,
        maximum: 20,
      },
    },
  },
  execute: async function (
    { scope = 'channel', limit = 5 },
    message,
    client,
    channelMemories,
    dmOrigins
  ) {
    const channelId = message.channel?.id || message.channelId;
    const isDM = message.channel?.type === 'DM' || message.channel?.type === 1;

    if (scope === 'summary') {
      const totalChannels = channelMemories.size;
      let totalMessages = 0;
      let oldestMessage = null;
      let newestMessage = null;

      for (const memories of channelMemories.values()) {
        totalMessages += memories.length;
        if (memories.length > 0) {
          const first = memories[0];
          const last = memories[memories.length - 1];
          if (!oldestMessage || first.timestamp < oldestMessage.timestamp) {
            oldestMessage = first;
          }
          if (!newestMessage || last.timestamp > newestMessage.timestamp) {
            newestMessage = last;
          }
        }
      }

      return `Memory Summary:
- Total channels/DMs: ${totalChannels}
- Total messages: ${totalMessages}
- Oldest message: ${oldestMessage ? new Date(oldestMessage.timestamp).toLocaleString() : 'None'}
- Newest message: ${newestMessage ? new Date(newestMessage.timestamp).toLocaleString() : 'None'}
- Average per channel: ${totalChannels > 0 ? (totalMessages / totalChannels).toFixed(1) : 0}`;
    }

    if (scope === 'dm' && !isDM) {
      return 'Cannot inspect DM memory - this is not a DM channel.';
    }

    if (scope === 'channel' && isDM) {
      return 'Cannot inspect channel memory - this is a DM. Use scope="dm" instead.';
    }

    const memories = channelMemories.get(channelId) || [];
    if (memories.length === 0) {
      return `No messages in ${scope} memory.`;
    }

    const recentMessages = memories.slice(-limit);
    const summary = recentMessages
      .map((msg, index) => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const user =
          msg.user.length > 30 ? msg.user.substring(0, 30) + '...' : msg.user;
        const content =
          msg.message.length > 100
            ? msg.message.substring(0, 100) + '...'
            : msg.message;
        return `${index + 1}. [${time}] ${user}: ${content}`;
      })
      .join('\n');

    const scopeText = scope === 'dm' ? 'DM' : 'channel';
    return `Recent ${scope} memory (${recentMessages.length}/${memories.length} messages):\n${summary}`;
  },
};
