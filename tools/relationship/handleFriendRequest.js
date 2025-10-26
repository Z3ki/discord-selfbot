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
        // Check current relationship status
        const relationship = client.relationships.cache.get(userId);
        if (relationship) {
          switch (relationship.type) {
            case 1: // incoming friend request
              break; // proceed to accept
            case 2: // outgoing friend request
              return {
                success: false,
                error: `You have already sent a friend request to user ${userId}`,
                alreadySent: true
              };
            case 3: // friend
              return {
                success: true,
                message: `Already friends with user ${userId}`,
                alreadyFriends: true
              };
            case 4: // blocked
              return {
                success: false,
                error: `Cannot accept friend request from ${userId} - blocked relationship`,
                blocked: true
              };
            default:
              return {
                success: false,
                error: `Unknown relationship type ${relationship.type} with user ${userId}`
              };
          }
        } else {
          return {
            success: false,
            error: `No incoming friend request found from user ${userId}`
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
        // Check current relationship status
        const existingRelationship = client.relationships.cache.get(userId);
        if (existingRelationship) {
          switch (existingRelationship.type) {
            case 1: // incoming friend request
              break; // proceed to decline
            case 2: // outgoing friend request
              return {
                success: false,
                error: `Cannot decline outgoing friend request to user ${userId}`,
                alreadySent: true
              };
            case 3: // friend
              return {
                success: false,
                error: `Already friends with user ${userId} - cannot decline`,
                alreadyFriends: true
              };
            case 4: // blocked
              return {
                success: true,
                message: `User ${userId} is already blocked`,
                alreadyBlocked: true
              };
            default:
              return {
                success: false,
                error: `Unknown relationship type ${existingRelationship.type} with user ${userId}`
              };
          }
        } else {
          return {
            success: false,
            error: `No incoming friend request found from user ${userId}`
          };
        }
        
        // Decline friend request
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