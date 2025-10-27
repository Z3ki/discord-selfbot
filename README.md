very shitty code that is vibe coded. 


# Maxwell Discord Selfbot

A sophisticated Discord selfbot powered by Google's Gemma 3-27B-IT AI model with NVIDIA NIM fallback, featuring advanced reasoning capabilities, comprehensive tool integration, multimodal support, and intelligent conversation management.

## ⚠️ Disclaimer

**This is a selfbot. Selfbots violate Discord's Terms of Service. Use at your own risk. The developers are not responsible for any consequences of using this software.**

## 🌟 Key Features

### 🤖 Advanced AI System
- **Primary AI**: Google Gemma 3-27B-IT model with multimodal capabilities
- **Fallback AI**: NVIDIA NIM with automatic failover for reliability
- **Multi-Round Tool Execution**: AI can execute multiple sequential tools in a single conversation
- **Progressive Reasoning**: Configurable display modes (brief/full) with detailed logging
- **Context-Aware Responses**: LRU-cached conversation memory with automatic cleanup

### 🔧 Comprehensive Tool System (16 Tools)
- **Communication Tools**: Direct messaging, user context management
- **Discord Management**: Reactions, messages, threads, invites, server utilities
- **System Tools**: Complex reasoning, Docker shell execution (optional)
- **Relationship Tools**: Friend request management and monitoring

### 🎯 Multimodal Support
- **Images**: JPEG, PNG, GIF, WebP, BMP with AI analysis
- **Videos**: MP4, WebM, QuickTime, AVI with frame extraction
- **Audio**: MP3, WAV, OGG, WebM, M4A, AAC, FLAC, Opus with Whisper transcription
- **Animated GIFs**: Frame-by-frame processing

### 🛡️ Security & Privacy
- **Admin Management**: Environment-based permanent admin system
- **Per-Server Controls**: Shell access, safe mode, and prompts per server
- **Rate Limiting**: Built-in protection against API abuse
- **Local Data Storage**: All data stored locally with JSON persistence

### 📊 Advanced Features
- **Docker Shell Access**: Optional isolated command execution
- **Server-Specific Prompts**: Custom AI behavior per server
- **Safe Mode**: Family-friendly response toggles
- **Health Monitoring**: Real-time system metrics and diagnostics
- **Reasoning Logs**: Detailed AI thinking process tracking

## 📋 Table of Contents

- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Tool System](#-tool-system)
- [Commands](#-commands)
- [Architecture](#-architecture)
- [Security](#-security--privacy)
- [Troubleshooting](#-troubleshooting)
- [Development](#-development)

## 🚀 Installation

### Prerequisites
- **Node.js 18+** with npm
- **Python 3.8+** with pip
- **FFmpeg** for media processing
- **Docker** (optional, for shell access)
- **Discord user token** (⚠️ Never share this)

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd maxwell-selfbot
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   pip install torch faster-whisper
   ```

4. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Start the bot**
   ```bash
   npm start
   ```

### Docker Setup (Optional)

For shell access functionality, ensure Docker is running:
```bash
# Start Docker daemon
sudo systemctl start docker
sudo systemctl enable docker

# Test Docker installation
docker --version
```

## ⚙️ Configuration

### Required Environment Variables

Create a `.env` file with these required settings:

```env
# Discord Configuration
DISCORD_USER_TOKEN=your_discord_user_token_here

# AI Configuration
GOOGLE_API_KEY=your_google_ai_api_key_here

# Admin Configuration
ADMIN_USER_ID=your_admin_user_id_here
```

### Optional Configuration

```env
# Discord User ID (auto-detected from token if not provided)
DISCORD_USER_ID=your_discord_user_id_here

# AI Model Settings
GOOGLE_AI_MODEL=models/gemma-3-27b-it
GOOGLE_AI_TEMPERATURE=0.7

# NVIDIA NIM Fallback (Optional)
NVIDIA_NIM_API_KEY=your_nvidia_api_key_here
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_NIM_MODEL=google/gemma-3-27b-it
NVIDIA_NIM_MAX_TOKENS=32768
NVIDIA_NIM_TEMPERATURE=0.7

# Logging
LOG_LEVEL=info  # debug, info, warn, error
```

### Getting Required Values

**Discord User Token:**
1. Open Discord in browser
2. Press `Ctrl+Shift+I` (DevTools)
3. Go to Application → Local Storage → discord.com
4. Copy the value of `token`

**Google AI API Key:**
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create new API key
3. Copy the key

**User ID:**
1. Enable Developer Mode in Discord settings
2. Right-click your profile → Copy User ID

## 📖 Usage

### Basic Interaction

The bot responds to:
- **Direct mentions**: `@bot your message`
- **Replies**: Replying to bot messages
- **Direct messages**: Any DM sent to the bot

### Media Processing

Simply send messages with attachments:
- **Images**: Automatically analyzed by AI
- **Videos**: Frame extraction + audio transcription
- **Audio files**: Transcribed using Whisper
- **GIFs**: Processed frame by frame

### Tool Usage

Tools can be invoked by the AI automatically or manually:

```
TOOL: send_dm userId="123456789" content="Hello!" reason="Greeting"
TOOL: docker_exec command="ping example.com" timeout="10"
TOOL: reason_complex problem="Solve x^2 + 2x + 1 = 0" type="math"
```

## 🛠️ Tool System

### Available Tools (16 Total)

#### Communication Tools
- **`send_dm`**: Send direct messages with context tracking
- **`update_context`**: Update user context for personalized responses

#### Discord Management Tools
- **`reaction_manager`**: Add, remove, and get reactions
- **`message_manager`**: Pin/unpin messages, thread management
- **`server_utils`**: Server info, channel info, member lists
- **`invite_manager`**: Create/join invites, get server invites
- **`get_server_list`**: List all servers bot is in
- **`leave_server`**: Leave specified servers
- **`change_presence`**: Change bot presence status

#### System Tools
- **`reason_complex`**: Complex reasoning and analysis
- **`docker_exec`**: Execute shell commands in Docker (when enabled)

#### Relationship Tools
- **`check_friend_requests`**: Check incoming friend requests (read-only)
- **`handle_friend_request`**: Accept/decline friend requests (manual)
- **`send_friend_request`**: Send friend requests to users

### Multi-Round Execution

The AI can execute multiple tools in sequence:
1. Investigate a user profile
2. Send them a personalized DM
3. Update their context for future interactions

All sequential tool calls edit the same Discord message for a clean experience.

## 🎮 Commands

### Basic Commands
- `;help` - Show all available commands
- `;debug` - Show debug information and system status
- `;functions` - List all available tools
- `;info` - Get bot information
- `;health` - Show system health (admin only)
- `;restart` - Restart the bot (admin only)
- `;refresh <type>` - Clear data (memories/context/dm/all)
- `;servers` - List all servers the bot is in
- `;blacklist` - Manage blacklisted servers (admin only)
- `;testqueue` - Test queue system

### Admin Management
- `;admin add <userId>` - Add user as administrator
- `;admin remove <userId>` - Remove admin from user
- `;admin toggle <userId>` - Toggle admin status
- `;admin list` - Show all administrators
- `;admin clear` - Remove all admins

### AI & Prompt Management
- `;prompt <text>` - Set server-specific prompt
- `;prompt all <text>` - Set global prompt across all servers
- `;prompt clear <text>` - Clear memory + set server prompt
- `;prompt clear all <text>` - Clear memory + set global prompt
- `;prompt` - View current server and global prompts
- `;nvidia <msg>` - Send message to NVIDIA AI provider
- `;reasoning-log` - View recent reasoning activity logs
- `;reasoning-mode brief` - Set reasoning display to brief mode
- `;safemode` - Toggle safe mode for family-friendly responses

### System Features
- `;shell` - Toggle Docker shell access (admin only, disabled by default)

### Command Examples

**Enable Shell Access:**
```
;shell  # In server or DM to enable/disable
```

**Set Custom Prompt:**
```
;prompt You are a helpful assistant specializing in programming
;prompt all You are a helpful assistant for all servers
```

**Admin Management:**
```
;admin add 123456789012345678
;admin list
;admin remove 123456789012345678
```

## 🏗️ Architecture

### Core Components

#### Bot Service (`services/Bot.js`)
- Main orchestrator with stability features
- LRU-cached memory management (50 channels, 100 DM contexts)
- Automatic reconnection with exponential backoff
- Periodic data saving and memory cleanup

#### AI System (`providers.js`, `ai.js`)
- Multi-provider AI with automatic failover
- Google Gemma 3-27B-IT (primary) + NVIDIA NIM (fallback)
- Enhanced response metadata extraction
- Stealth features for API requests

#### Tool Executor (`tools/ToolExecutor.js`)
- 16 consolidated tools across 4 categories
- Multi-round execution with shared message editing
- Live progress updates for long-running operations
- Dynamic tool availability based on permissions

#### Media Processor (`media.js`)
- Multimodal content handling (images, videos, audio, GIFs)
- Automatic download and validation
- Frame extraction and audio transcription
- Base64 encoding for AI input

#### Transcription Service (`services/TranscriptionService.py`)
- Persistent Python-based Whisper service
- Real-time audio transcription
- Video audio track extraction
- Language detection and processing

### Data Persistence

#### Storage Structure
```
data-selfbot/
├── channelMemories.json     # Channel conversation history
├── dmContexts.json          # DM conversation contexts
├── dmOrigins.json          # DM origin tracking
├── serverPrompts.json      # Server-specific prompts
├── safeModeServers.json    # Safe mode settings per server
├── blacklist.json          # Blacklisted servers
└── globalPrompt.txt        # Global AI prompt
```

#### Memory Management
- **LRU Caches**: Automatic cleanup of old data
- **Channel Memories**: Last 50 messages per channel
- **DM Contexts**: User preferences and conversation history
- **Cross-Session Continuity**: Periodic data saving every 10 minutes

### Logging System

#### Log Files (`logs/`)
- `bot.log` - General activity and events
- `errors.log` - Error messages and stack traces
- `reasoning.log` - AI reasoning activity with timestamps
- `debug.log` - Detailed debugging information
- `health.log` - System health metrics
- `rate_limits.log` - Rate limiting events

#### Features
- Structured logging with rotation
- Performance monitoring and debugging
- Reasoning activity tracking
- Automatic log cleanup (7 days)

## 🔒 Security & Privacy

### Data Protection
- **Local Storage Only**: All data stored locally in JSON files
- **No External Transmission**: Only API calls to Google/NVIDIA for AI processing
- **Environment Variables**: Sensitive configuration via .env file
- **File Type Validation**: Security checking for all uploaded media
- **Public Data Only**: Investigation tools access only public user information

### Access Control
- **Environment-Based Admin**: Permanent admin via `ADMIN_USER_ID` environment variable
- **Per-Server Settings**: Shell access, safe mode, and prompts configurable per server
- **Rate Limiting**: Built-in protection against API abuse (10 req/min per user)
- **Command Validation**: Input sanitization and XSS prevention

### Docker Shell Security
- **Disabled by Default**: Shell access must be explicitly enabled per server/DM
- **Isolated Execution**: Commands run in isolated Docker container
- **AI-Controlled Timeouts**: Automatic timeout selection prevents hanging commands
- **No Persistence**: Shell access settings reset on bot restart
- **Admin Only**: Only administrators can enable shell access

## 🔧 Troubleshooting

### Common Issues

#### Bot Won't Start
```bash
# Check Discord token
echo $DISCORD_USER_TOKEN

# Validate configuration
node -e "console.log(process.env.DISCORD_USER_TOKEN ? 'Token set' : 'Token missing')"
```

#### API Errors
- **Google AI**: Verify `GOOGLE_API_KEY` is valid and has quota
- **NVIDIA NIM**: Check `NVIDIA_NIM_API_KEY` and service availability
- **Rate Limits**: Wait for cooldown or reduce usage frequency

#### Media Processing Issues
```bash
# Check FFmpeg installation
ffmpeg -version

# Test Python dependencies
python3 -c "import torch; import faster_whisper; print('Dependencies OK')"
```

#### Memory Issues
- Use `;health` command to check system status
- Monitor memory usage in logs
- Restart bot if memory usage exceeds 1GB

### Log Analysis

#### Viewing Logs
```bash
# Recent bot activity
tail -f logs/bot.log

# Error messages
tail -f logs/errors.log

# Reasoning activity
tail -f logs/reasoning.log

# System health
tail -f logs/health.log
```

#### In-Di scord Commands
- `;reasoning-log` - View recent AI reasoning activity
- `;health` - Check system health and metrics
- `;debug` - Show debug information and status

### Performance Optimization

#### Memory Management
- LRU caches automatically clean old entries
- Periodic garbage collection every 5 minutes
- Memory warnings at 500MB usage, forced GC at 1GB

#### API Usage
- Automatic failover between providers
- Request queuing and rate limiting
- Stealth features to avoid detection

## 🛠️ Development

### Project Structure
```
maxwell-selfbot/
├── services/                 # Core services
│   ├── Bot.js               # Main bot orchestrator
│   ├── DataManager.js       # Data persistence
│   └── TranscriptionService.py # Audio transcription
├── tools/                    # Tool system (16 tools)
│   ├── communication/        # DM and context tools
│   ├── discord/             # Discord interaction tools
│   ├── relationship/        # Friend management tools
│   ├── system/              # System and calculation tools
│   ├── ToolExecutor.js     # Tool execution engine
│   └── index.js            # Tool registry
├── utils/                    # Utilities and helpers
│   ├── logger.js           # Structured logging
│   ├── LRUCache.js         # Memory management
│   ├── adminManager.js     # Admin management
│   └── errorHandler.js     # Error handling
├── config/                   # Configuration management
├── handlers.js              # Discord event handlers
├── ai.js                    # AI processing logic
├── providers.js             # AI provider implementations
├── prompts.js               # Prompt construction
├── media.js                 # Multimodal processing
├── queues.js                # Queue management
├── health.js                # Health monitoring
├── bot.js                   # Main entry point
├── .env.example             # Environment template
└── README.md                # This file
```

### Adding New Tools

1. **Create Tool File**
```javascript
// tools/category/newTool.js
export const newTool = {
  name: 'new_tool',
  description: 'Description of what this tool does',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter description' }
    },
    required: ['param1']
  }
};

export async function executeNewTool(args, client, message) {
  // Tool implementation
  return 'Tool result';
}
```

2. **Register Tool**
```javascript
// tools/index.js
import { newTool } from './category/newTool.js';

export const tools = [
  // ... existing tools
  newTool
];
```

3. **Add Execution Logic**
```javascript
// tools/ToolExecutor.js
case 'new_tool':
  return await executeNewTool(args, client, message);
```

### Code Quality

#### Linting
```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

#### Testing
```bash
# Run tests
npm test

# Run specific test
npm run test:unit
```

#### Best Practices
- Follow existing patterns and conventions
- Add comprehensive error handling
- Include detailed logging for debugging
- Test thoroughly before deployment
- Update documentation for new features

### API Integration

#### Adding New AI Providers
1. Extend `AIProvider` class in `providers.js`
2. Implement `initialize()` and `generateContent()` methods
3. Register in `ProviderManager`
4. Update configuration in `config/config.js`

#### Enhanced Metadata Extraction
The bot extracts comprehensive metadata from AI responses:
- Token usage breakdown
- Safety ratings and finish reasons
- Response timing and provider information
- Raw response data for analysis

See `API_CAPABILITIES.md` for detailed information about available API features.

## 🐛 Bug Fixes & Improvements

### Recent Fixes

#### Friend Request Auto-Accept Removal (2025-10-27)
**Problem**: Automatic friend request acceptance was causing CAPTCHA loops and excessive bot restarts.

**Symptoms**:
- Bot repeatedly hit CAPTCHA requirements when accepting friend requests
- Multiple restarts triggered by failed auto-accept attempts
- PM2 showed hundreds of restarts due to CAPTCHA failures
- Debug logs showed "CAPTCHA_SOLVER_NOT_IMPLEMENTED" errors

**Solution**:
- **Removed Auto-Accept**: Completely removed automatic friend request acceptance functionality
- **Manual Control Only**: Friend requests now require manual handling via tools
- **Stability Improvement**: Eliminated CAPTCHA-triggered restart loops
- **Cleaner Logs**: Removed CAPTCHA error spam from logs

**Files Modified**:
- `handlers.js` - Removed `processFriendRequest` function and `relationshipAdd` event handler
- `README.md` - Updated documentation to reflect manual-only friend request handling

**Impact**: Bot stability significantly improved with elimination of CAPTCHA loops and reduced restart frequency.

#### AI Self-Confusion Bug (2025-10-27)
**Problem**: AI was confusing itself with its own past responses, engaging in conversations with itself instead of focusing on current user.

**Symptoms**:
- AI would reference its own previous messages as if they were from another person
- Conversation history showed AI talking to itself
- Identity confusion between current user and bot's past responses

**Solution**:
- **Enhanced Memory Filtering**: Bot messages are now filtered out of conversation history by default to prevent self-reference
- **Clear Message Labeling**: Added distinction between `USER_MESSAGE` and `BOT_RESPONSE` in memory text
- **Improved Context Rules**: Updated conversation history instructions to prevent identity confusion
- **Smart Reply Handling**: Bot messages are only included when directly replying to a bot message
- **Debug Logging**: Added comprehensive logging for bot message filtering

**Files Modified**:
- `ai.js` - Enhanced memory filtering and message labeling
- `prompts.js` - Updated conversation history rules

**Impact**: AI now maintains clear separation between its own responses and user input, eliminating self-confusion behavior.

## 📄 License

This project is provided as-is without warranty. Use at your own risk.

## 🤝 Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns and conventions
- All tests pass
- Documentation is updated for new features
- Security considerations are addressed

## 📞 Support

For issues or questions:
1. Check logs in the `logs/` directory
2. Verify all environment variables are set correctly
3. Use `;health` and `;debug` commands for diagnostics
4. Review this README for configuration details

---

**Maxwell Selfbot** - Advanced AI-powered Discord automation with comprehensive tool integration and multimodal support.
