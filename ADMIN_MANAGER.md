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

Use the `admin_manager` tool with the following actions:

#### Toggle Admin Status
```
TOOL: admin_manager action="toggle" userId="123456789012345678"
```
- Adds the user if not admin
- Removes the user if already admin

#### Add Admin
```
TOOL: admin_manager action="add" userId="123456789012345678"
```
- Adds the user as admin
- Returns error if already admin

#### Remove Admin
```
TOOL: admin_manager action="remove" userId="123456789012345678"
```
- Removes admin status
- Returns error if not admin

#### List Admins
```
TOOL: admin_manager action="list"
```
- Shows all current administrators
- Displays total count

#### Clear All Admins
```
TOOL: admin_manager action="clear"
```
- ⚠️ **Dangerous**: Removes all admins
- Requires user context for confirmation

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
- `tools/system/adminManager.js` - Discord tool integration
- `admin_cli.js` - Command-line interface
- `data/admins.json` - Persistent admin storage

## Security Features

- **ID Validation**: Only accepts valid Discord snowflake IDs (17-19 digits)
- **File Permissions**: Admin data stored in secure data directory
- **Logging**: All admin changes are logged
- **Error Handling**: Graceful handling of invalid inputs

## Examples

### Adding an Admin
```
User: Make 123456789012345678 an admin
Bot: 🔧 **Admin Management**

**User ID:** 123456789012345678
**Action:** ➕ Added
**Status:** Now an admin
**Total Admins:** 1
```

### Removing an Admin
```
User: Remove 123456789012345678 as admin
Bot: 🔧 **Admin Management**

**User ID:** 123456789012345678
**Action:** ➖ Removed
**Status:** No longer an admin
**Total Admins:** 0
```

### Listing Admins
```
User: Show all admins
Bot: 👑 **Bot Administrators**

**Total Admins:** 2

**Admin IDs:**
1. 123456789012345678
2. 987654321098765432
```

## Integration

The admin manager integrates with the existing tool system:

1. **Tool Registry**: Automatically registered in `tools/index.js`
2. **Category**: Listed under SYSTEM tools
3. **Parameters**: Validated using the tool parameter system
4. **Context**: Access to message and bot context for security

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