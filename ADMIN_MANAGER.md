# Admin Manager

The Admin Manager provides a secure way to manage bot administrators through Discord commands and CLI tools.

## Features

- **Toggle Admin Status**: Add or remove admins by Discord user ID
- **List Admins**: View all current administrators
- **Persistent Storage**: Admin list saved to `data/admins.json`
- **Validation**: Validates Discord user ID format
- **Security**: Only allows proper Discord snowflake IDs

## Usage

### Discord Bot Commands

#### Method 1: Direct Commands (Recommended)
Use `;admin` command with the following actions:

#### Initial Setup (First Admin)
```
;admin add <your_user_id>
```
- Only works when no admins exist
- Sets yourself as the first administrator

#### Add Admin
```
;admin add <user_id>
```
- Adds user as admin
- Error if already admin

#### Remove Admin
```
;admin remove <user_id>
```
- Removes admin status
- Error if not admin

#### Toggle Admin Status
```
;admin toggle <user_id>
```
- Adds user if not admin
- Removes user if already admin

#### List Admins
```
;admin list
```
- Shows all current administrators
- Displays total count

#### Clear All Admins
```
;admin clear
```
- **Dangerous**: Removes all admins
- Only existing admins can use



### CLI Tool

Use the command-line interface for quick admin management:

```bash
# Toggle admin status
node admin_cli.js 123456789012345678

# List all admins
node admin_cli.js list

# Clear all admins
node admin_cli.js clear
```

## File Structure

- `utils/adminManager.js` - Core admin management logic
- `handlers.js` - Discord command integration
- `admin_cli.js` - Command-line interface
- `data/admins.json` - Persistent admin storage

## Security Features

- **ID Validation**: Only accepts valid Discord snowflake IDs (17-19 digits)
- **File Permissions**: Admin data stored in secure data directory
- **Logging**: All admin changes are logged
- **Error Handling**: Graceful handling of invalid inputs

## Examples

### Initial Setup (First Admin)
```
User: ;admin add 123456789012345678
Bot: **First Admin Setup Complete!**

**User ID:** 123456789012345678
**Status:** Now an admin

You can now use all admin commands including managing other admins.
```

### Adding an Admin
```
User: ;admin add 987654321098765432
Bot: **Admin Added**

**User ID:** 987654321098765432
**Total Admins:** 2
```

### Removing an Admin
```
User: ;admin remove 987654321098765432
Bot: **Admin Removed**

**User ID:** 987654321098765432
**Total Admins:** 1
```

### Toggling Admin Status
```
User: ;admin toggle 987654321098765432
Bot: **Admin Status Toggled**

**User ID:** 987654321098765432
**Action:** removed
**Status:** No longer an admin
**Total Admins:** 1
```

### Listing Admins
```
User: ;admin list
Bot: **Bot Administrators**

**Total Admins:** 1

**Admin IDs:**
1. 123456789012345678
```

### Non-Admin Access Denied
```
User: ;admin list
Bot: Access denied. Only existing administrators can manage admin access.

Initial Setup: If no admins exist, use `;admin add <your_user_id>` to set yourself as the first admin.
```

## Integration

The admin manager integrates with the bot's command system:

1. **Command Handler**: Integrated in `handlers.js`
2. **Direct Commands**: Uses `;admin` prefix instead of tool system
3. **Parameters**: Validated using Discord ID format checking
4. **Context**: Access to message and bot context for security
5. **Storage**: Persistent admin data in `data/admins.json`

## Error Handling

Common errors and their meanings:

- **Invalid Discord user ID format**: User ID must be 17-19 digits
- **User ID is required**: Must provide userId for add/remove/toggle actions
- **Unknown action**: Action must be one of: add, remove, toggle, list, clear

## Logging

All admin operations are logged with:
- Timestamp
- User ID (if available)
- Action performed
- Success/failure status

This provides an audit trail for admin changes.