/**
 * Handle friend requests - accept, decline, or ignore incoming friend requests
 */

export const handleFriendRequestTool = {
  name: 'handle_friend_request',
  description: 'Handle incoming friend requests by accepting, declining, or ignoring them',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Action to take: accept, decline, or ignore'
      },
      userId: {
        type: 'string',
        description: 'Discord user ID of the friend request sender'
      }
    },
    required: ['action', 'userId']
  }
};

export async function executeHandleFriendRequest(args, client) {
  try {
    const { action, userId } = args;
    if (!action || !userId) {
      return {
        success: false,
        error: 'Missing required parameters: action and userId'
      };
    }

    const validActions = ['accept', 'decline', 'ignore'];
    if (!validActions.includes(action)) {
      return {
        success: false,
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`
      };
    }

    if (!client) {
      return {
        success: false,
        error: 'Discord client not available'
      };
    }

    let result;
    
    switch (action) {
      case 'accept': {
        // Check if already friends
        const relationship = client.relationships.cache.get(userId);
        if (relationship && relationship.type === 3) { // 3 = friend
          return {
            success: true,
            message: `Already friends with user ${userId}`,
            alreadyFriends: true
          };
        }
        
        // Accept friend request
        try {
          result = await client.relationships.addFriend(userId);
          return {
            success: true,
            message: `Accepted friend request from user ${userId}`,
            result: result
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to accept friend request: ${error.message}`
          };
        }
      }
        
      case 'decline': {
        // Check if already friends
        const existingRelationship = client.relationships.cache.get(userId);
        if (existingRelationship && existingRelationship.type === 3) { // 3 = friend
          return {
            success: true,
            message: `Already friends with user ${userId} - cannot decline`,
            alreadyFriends: true
          };
        }
        
        // Decline/ignore friend request
        try {
          result = await client.relationships.delete(userId);
          return {
            success: true,
            message: `Declined friend request from user ${userId}`,
            result: result
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to decline friend request: ${error.message}`
          };
        }
      }
        
      case 'ignore': {
        // Simply ignore (no action needed)
        return {
          success: true,
          message: `Ignoring friend request from user ${userId}`
        };
      }
        
      default:
        return {
          success: false,
          error: 'Unknown action'
        };
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to handle friend request: ${error.message}`
    };
  }
}