/**
 * Check for incoming friend requests
 */

export const checkFriendRequestsTool = {
  name: 'check_friend_requests',
  description: 'Check for any incoming friend requests and get their details',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  }
};

export async function executeCheckFriendRequests(args, client) {
  try {
    if (!client) {
      return {
        success: false,
        error: 'Discord client not available'
      };
    }

    // Get all relationships
    const relationships = client.relationships.cache;
    const incomingRequests = [];

    // Filter for incoming friend requests (type 1)
    relationships.forEach((relationship, userId) => {
      if (relationship.type === 1) { // 1 = incoming friend request
        const user = relationship.user;
        incomingRequests.push({
          userId: userId,
          username: user?.username || 'Unknown',
          discriminator: user?.discriminator || '0000',
          displayName: user?.displayName || user?.username || 'Unknown',
          id: user?.id || userId,
          createdAt: relationship.createdAt || new Date(),
          mutualGuilds: user?.mutualGuilds?.size || 0,
          isBot: user?.bot || false
        });
      }
    });

    return {
      success: true,
      message: `Found ${incomingRequests.length} incoming friend request(s)`,
      requests: incomingRequests
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to check friend requests: ${error.message}`
    };
  }
}