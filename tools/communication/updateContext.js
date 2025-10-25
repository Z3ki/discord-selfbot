import { loadUserContext, saveUserContext } from '../../utils/index.js';
import { logger } from '../../utils/logger.js';
import { validateUserId } from '../../utils/index.js';

export const updateContextTool = {
  name: 'update_context',
  description: 'Update user context information for better personalized responses',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      preferences: { type: 'string' },
      themes: { type: 'array', items: { type: 'string' } }
    },
    required: ['userId']
  },

  async execute(args, context) {
    try {
      const { client, message } = context;
      // Validate that args.userId is not a channel ID
      validateUserId(client, args.userId, 'context updating');

      const userContext = await loadUserContext();
      const user = await client.users.fetch(args.userId).catch(() => null);
      const displayName = user ? user.displayName || user.username : 'Unknown';

      const userContextData = userContext.get(args.userId) || {
        preferences: '',
        themes: [],
        displayName: displayName,
        lastInteraction: Date.now(),
        interactionCount: 0
      };

      // Update display name if it changed
      if (userContextData.displayName !== displayName) {
        userContextData.displayName = displayName;
      }

      if (args.preferences) userContextData.preferences = args.preferences;
      if (args.themes) userContextData.themes = args.themes;
      userContextData.lastInteraction = Date.now();
      userContextData.interactionCount = (userContextData.interactionCount || 0) + 1;

      userContext.set(args.userId, userContextData);
      await saveUserContext(userContext);

      logger.info('User context updated', { 
        userId: args.userId,
        preferences: args.preferences,
        themes: args.themes
      });

      return 'User context updated successfully';
    } catch (error) {
      logger.error('Error updating user context:', error);
      return `Error updating user context: ${error.message}`;
    }
   }
};

export async function executeUpdateContext(args, client) {
  try {
    // Validate that args.userId is not a channel ID
    if (client && args.userId) {
      validateUserId(client, args.userId, 'context updating');
    }

    const userContext = await loadUserContext();
    const context = userContext.get(args.userId) || {
      preferences: '',
      themes: [],
      lastInteraction: Date.now(),
      interactionCount: 0
    };

    if (args.preferences) context.preferences = args.preferences;
    if (args.themes) context.themes = args.themes;
    context.lastInteraction = Date.now();
    context.interactionCount = (context.interactionCount || 0) + 1;

    userContext.set(args.userId, context);
    await saveUserContext(userContext);

    logger.info('User context updated', {
      userId: args.userId,
      preferences: args.preferences,
      themes: args.themes
    });

    return 'User context updated successfully';
  } catch (error) {
    logger.error('Error updating user context:', error);
    return `Error updating user context: ${error.message}`;
  }
}