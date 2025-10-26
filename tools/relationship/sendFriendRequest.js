/**
 * Send friend requests to users
 */

export const sendFriendRequestTool = {
  name: 'send_friend_request',
  description: 'Send a friend request to a Discord user by their user ID or username#discriminator',
  parameters: {
    type: 'object',
    properties: {
      user: {
        type: 'string',
        description: 'Discord user ID or username#discriminator (e.g., "username#1234")'
      }
    },
    required: ['user']
  }
};

export async function executeSendFriendRequest(args, client) {
  try {
    const { user } = args;
    if (!user) {
      return {
        success: false,
        error: 'Missing required parameter: user'
      };
    }

    if (!client) {
      return {
        success: false,
        error: 'Discord client not available'
      };
    }

    // Check if already friends
    let userId = user;
    
    // If it's a username#discriminator format, we need to resolve it to a user ID
    if (user.includes('#')) {
      try {
        const fetchedUser = await client.users.fetch(user, { force: false });
        if (!fetchedUser) {
          return {
            success: false,
            error: `User ${user} not found`
          };
        }
        userId = fetchedUser.id;
      } catch (error) {
        return {
          success: false,
          error: `Failed to fetch user ${user}: ${error.message}`
        };
      }
    }

    // Check existing relationship
    const existingRelationship = client.relationships.cache.get(userId);
    if (existingRelationship) {
      switch (existingRelationship.type) {
        case 1: // incoming friend request
          return {
            success: false,
            error: `User ${user} has already sent you a friend request. Use handle_friend_request to accept it.`,
            alreadyHasRequest: true,
            requestType: 'incoming'
          };
        case 2: // outgoing friend request
          return {
            success: false,
            error: `You have already sent a friend request to ${user}`,
            alreadySent: true
          };
        case 3: // friend
          return {
            success: false,
            error: `You are already friends with ${user}`,
            alreadyFriends: true
          };
        case 4: // blocked
          return {
            success: false,
            error: `You have blocked ${user} or they have blocked you`,
            blocked: true
          };
      }
    }

    // Send friend request
    try {
      let result;
      
      // Try API approach first (bypasses security confirmation)
      try {
        result = await client.api.users('@me').relationships[userId].put({
          type: 1
        });
      } catch (apiError) {
        // If API fails, try standard method
        try {
          result = await client.relationships.addFriend(userId);
        } catch (standardError) {
          // If both fail, throw the most relevant error
          if (standardError.message.includes('Risky action')) {
            throw new Error('Friend request requires manual confirmation due to Discord security');
          } else if (apiError.message.includes('CAPTCHA')) {
            throw new Error('CAPTCHA required - please try again later');
          } else {
            throw standardError;
          }
        }
      }
      
      return {
        success: true,
        message: `Friend request sent to ${user}`,
        userId: userId,
        result: result
      };
    } catch (error) {
      // Handle common Discord API errors
      if (error.message.includes('Unknown user')) {
        return {
          success: false,
          error: `User ${user} not found or invalid user ID`
        };
      }
      if (error.message.includes('Already sent')) {
        return {
          success: false,
          error: `Friend request already sent to ${user}`,
          alreadySent: true
        };
      }
      if (error.message.includes('blocked')) {
        return {
          success: false,
          error: `Cannot send friend request to ${user} - you may be blocked`
        };
      }
      return {
        success: false,
        error: `Failed to send friend request: ${error.message}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to send friend request: ${error.message}`
    };
  }
}