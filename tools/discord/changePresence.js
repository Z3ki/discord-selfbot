import { logger } from '../../utils/logger.js';

export const changePresenceTool = {
  name: 'change_presence',
  description: 'Change bot\'s Discord presence status and activity. Example: change_presence(presenceStatus="online", activityName="Playing games", activityType="Playing")',
  parameters: {
    type: 'object',
    properties: {
      presenceStatus: { type: 'string', description: 'Presence status: online, idle, dnd, or invisible' },
      activityName: { type: 'string', description: 'Activity text to display (e.g., "Playing games")' },
      activityType: { type: 'string', description: 'Activity type: Playing, Watching, Listening, Streaming, Competing' }
    },
    required: []
  },

  async execute(args, context) {
    try {
      const { client, message } = context;
      
// Check if client and client.user are available
    if (!client) {
      return 'Error: Discord client not available';
    }

    if (!client.user) {
      return 'Error: Bot user not available - client may not be fully initialized. Please wait a moment and try again.';
    }

    // Check if client is ready (use readyAt for discord.js-selfbot-v13)
    if (!client.readyAt) {
      return 'Error: Discord client not fully ready - please wait a moment and try again.';
    }

      // Set presence status
      if (args.presenceStatus) {
        const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
        if (!validStatuses.includes(args.presenceStatus)) {
          return `Invalid presence status. Must be one of: ${validStatuses.join(', ')}`;
        }
        try {
          client.user.setPresence({ status: args.presenceStatus });
        } catch (error) {
          logger.warn('Failed to set presence status:', error);
          return `Failed to set presence status: ${error.message}`;
        }
      }

      // Set activity
      if (args.activityName) {
        const activityTypeMap = {
          'Playing': 0,
          'Watching': 3,
          'Listening': 2,
          'Streaming': 1,
          'Competing': 5
        };

        const activityType = args.activityType 
          ? activityTypeMap[args.activityType] || 0
          : 0;

        try {
          client.user.setActivity(args.activityName, { type: activityType });
        } catch (error) {
          logger.warn('Failed to set activity:', error);
          return `Failed to set activity: ${error.message}`;
        }
      }

      const status = args.presenceStatus || (client.user && client.user.presence ? client.user.presence.status : 'unknown');
      const activity = args.activityName || 'None';
      const activityType = args.activityType || 'Playing';

      logger.info('Bot presence updated', { 
        status, 
        activity, 
        activityType,
        userId: message?.author?.id || 'unknown'
      });

      return `Presence updated: ${status}, ${activityType} ${activity}`;
    } catch (error) {
      logger.error('Error changing presence:', error);
      return `Error changing presence: ${error.message}`;
    }
   }
};

export async function executeChangePresence(args, client) {
  try {
    
    logger.debug('executeChangePresence called', { 
      args: JSON.stringify(args), 
      clientType: typeof client,
      clientExists: !!client,
      clientReady: client?.readyAt,
      clientUser: !!client?.user
    });

// Check if client and client.user are available
    if (!client) {
      logger.error('Client is null/undefined in executeChangePresence');
      return 'Error: Discord client not available';
    }

    if (!client.user) {
      return 'Error: Bot user not available - client may not be fully initialized. Please wait a moment and try again.';
    }

    // Check if client is ready (use readyAt for discord.js-selfbot-v13)
    if (!client.readyAt) {
      return 'Error: Discord client not fully ready - please wait a moment and try again.';
    }

    // Set presence status
    if (args.presenceStatus) {
      const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
      if (!validStatuses.includes(args.presenceStatus)) {
        return `Invalid presence status. Must be one of: ${validStatuses.join(', ')}`;
      }
      try {
        client.user.setPresence({ status: args.presenceStatus });
      } catch (error) {
        logger.warn('Failed to set presence status:', error);
        return `Failed to set presence status: ${error.message}`;
      }
    }

    // Set activity
    if (args.activityName) {
      const activityTypeMap = {
        'Playing': 0,
        'Watching': 3,
        'Listening': 2,
        'Streaming': 1,
        'Competing': 5
      };

      const activityType = args.activityType
        ? activityTypeMap[args.activityType] || 0
        : 0;

      try {
        client.user.setActivity(args.activityName, { type: activityType });
      } catch (error) {
        logger.warn('Failed to set activity:', error);
        return `Failed to set activity: ${error.message}`;
      }
    }

    const status = args.presenceStatus || (client.user && client.user.presence ? client.user.presence.status : 'unknown');
    const activity = args.activityName || 'None';
    const activityType = args.activityType || 'Playing';

    logger.info('Bot presence updated', {
      status,
      activity,
      activityType
    });

    return `Presence updated: ${status}, ${activityType} ${activity}`;
  } catch (error) {
    logger.error('Error changing presence:', error);
    return `Error changing presence: ${error.message}`;
  }
}