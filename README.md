# Maxwell Discord Selfbot

A sophisticated Discord selfbot powered by Google's Gemma AI model, featuring advanced reasoning capabilities, comprehensive tool integration, and intelligent conversation management.

## Disclaimer

**This is a selfbot. Selfbots violate Discord's Terms of Service. Use at your own risk. The developers are not responsible for any consequences of using this software.**

## Features

### AI-Powered Conversations
- Powered by Google's Gemma 3-27B-IT model (primary)
- Automatic fallback to NVIDIA NIM for reliability
- Multimodal support (images, videos, GIFs, stickers)
- Context-aware responses with conversation memory

### Advanced Tool System
- 15 consolidated tools for Discord interactions and system operations
- Comprehensive investigation and analysis tools
- Consolidated tool architecture for better maintainability

### System Intelligence
- Progressive reasoning display with brief indicators
- Full reasoning logged for detailed analysis
- Complexity assessment and adaptive processing

### Communication Tools
- Direct message management with context tracking
- User investigation and profile analysis
- Friend request handling
- Cross-server presence monitoring

### Discord Integration
- Consolidated reaction management (add, remove, get)
- Thread management (create, join, archive, leave)
- Message management (pin, unpin)
- Server analytics and member information
- Invite link management (create, join, get invites)
- Enhanced server joining with fallback methods

### System Tools
- Complex reasoning and analysis
- Server-specific and global prompt customization
- Health monitoring and diagnostics

## Audio Transcription
The bot includes a Python-based transcription service using OpenAI's Whisper model for processing audio messages and video audio tracks.

### Features
- Automatic audio extraction from videos
- Real-time transcription with language detection
- Integrated into AI conversations for multimodal understanding

### Requirements
- Python 3.8+
- torch
- faster-whisper
- CUDA-compatible GPU (optional, uses CPU fallback)

## Multimodal Support
The bot processes various media types for AI analysis:

### Supported Formats
- **Images**: JPEG, PNG, GIF, WebP, BMP
- **Videos**: MP4, WebM, QuickTime, AVI (with frame extraction and audio transcription)
- **Animated GIFs**: Frame-by-frame processing
- **Audio**: MP3, WAV, OGG, WebM, M4A, AAC, FLAC, Opus (with transcription)

### Processing Features
- Automatic media download and validation
- Video frame extraction with dynamic parameters
- Audio transcription using Whisper
- Base64 encoding for AI input
 - Security validation and file type checking

## Docker Shell Access

The bot includes optional Docker shell execution capabilities for advanced system operations.

### Features
- Execute Linux terminal commands in an isolated Docker container
- Network diagnostics (ping, traceroute, nslookup, dig)
- File operations and system information
- 10-second timeout protection for infinite commands
- Per-server access control (disabled by default)

### Security & Access Control
- **Disabled by default** for security
- **Per-server toggle** using `;shell` command (admin only)
- **No persistence** - settings reset on bot restart
- **Isolated execution** in Docker container
- **Timeout protection** prevents hanging commands

### Usage
1. Enable shell access: `;shell` (in the desired server)
2. AI can now execute commands like:
   - `ping example.com` - Network connectivity testing
   - `curl -I https://example.com` - HTTP header inspection
   - `ls -la /etc` - Directory listing
   - `ps aux | head -10` - Process information

### Requirements
- Docker installed and running on host system
- `mcp-shell` container available (auto-started by bot)
- Admin privileges to enable shell access

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- Python 3.8+ with pip
- FFmpeg (for media processing)
- Discord user token (⚠️ **Never share this**)

### Setup
1. Clone this repository
2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Install Python dependencies:
   ```bash
   pip install torch faster-whisper
   ```

4. Create a `.env` file:
   ```env
   DISCORD_USER_TOKEN=your_discord_user_token_here
   GOOGLE_API_KEY=your_google_ai_api_key_here
   NVIDIA_NIM_API_KEY=your_nvidia_api_key_here
   LOG_LEVEL=info
   ADMIN_USER_ID=your_admin_user_id_here
   ```

5. Start the bot:
   ```bash
   npm start
   ```

## Configuration

### Environment Variables

#### Required
- `DISCORD_USER_TOKEN`: Your Discord user token (required)
- `GOOGLE_API_KEY`: Google AI API key for primary AI (required)

#### Optional
- `DISCORD_USER_ID`: Your Discord user ID (auto-detected from token)
- `GOOGLE_AI_MODEL`: Google AI model (default: models/gemma-3-27b-it)
- `NVIDIA_NIM_API_KEY`: NVIDIA NIM API key for fallback AI
- `NVIDIA_NIM_BASE_URL`: NVIDIA NIM endpoint (default: https://integrate.api.nvidia.com/v1)
- `NVIDIA_NIM_MODEL`: NVIDIA NIM model (default: google/gemma-3-27b-it)
- `NVIDIA_NIM_MAX_TOKENS`: Max tokens for NVIDIA (default: 32768)
- `NVIDIA_NIM_TEMPERATURE`: Temperature for NVIDIA (default: 0.7)
- `ADMIN_USER_ID`: User ID with admin privileges (auto-detected from token)
- `LOG_LEVEL`: Logging verbosity (info/warn/error/debug)

## Usage

### Basic Commands
- `;help` - Show all available commands
- `;debug` - Show debug information and system status
- `;functions` - List all available tools
- `;info` - Get bot information
- `;health` - Show system health (admin only)
- `;restart` - Restart the bot (admin only)
- `;refresh` - Refresh bot state
- `;servers` - List all servers the bot is in
- `;blacklist` - Manage blacklisted servers (admin only)
- `;shell` - Toggle Docker shell access (admin only)
- `;prompt` - Set server-specific or global AI prompt
- `;nvidia` - Toggle NVIDIA AI provider
- `;testqueue` - Test queue system


### Prompt Commands
- `;prompt <text>` - Set server-specific prompt (default behavior)
- `;prompt all <text>` - Set global prompt across all servers
- `;prompt clear <text>` - Clear memory + set server prompt
- `;prompt clear all <text>` - Clear memory + set global prompt
- `;prompt` - View current server and global prompts

### System Commands
- Use `TOOL: reason_complex problem="..." type="..."` for complex analysis
- Use `TOOL: docker_exec command="ping example.com"` for shell commands (when shell access enabled)
- Use `TOOL: send_friend_request userId="..."` to send friend requests
- Use `TOOL: investigate_user userId="..."` to investigate users

### AI Interaction
The bot responds to:
- Direct mentions (@bot)
- Replies to bot messages
- Direct messages

### Prompt System
The bot supports server-specific and global prompts:

#### Server-Specific Prompts
- `;prompt <text>` - Sets a prompt for the current server only
- Affects all conversations in that server
- Overrides global prompt when set
- Stored per-server in `data-selfbot/serverPrompts.json`

#### Global Prompts
- `;prompt all <text>` - Sets a prompt across all servers
- `;prompt <text>` in DMs also sets global prompt
- Used as fallback when no server prompt is set
- Stored in `globalPrompt.txt`

#### Memory Management
- `;prompt clear <text>` - Clears channel memory + sets server prompt
- `;prompt clear all <text>` - Clears channel memory + sets global prompt
- Memory clearing affects the current channel only

### Tool Usage
Tools are invoked automatically by the AI or manually:
```
TOOL: send_dm userId="123456" content="Hello!" reason="Greeting"
TOOL: docker_exec command="ping example.com"
TOOL: reason_complex problem="Solve x^2 + 2x + 1 = 0" type="math"
TOOL: investigate_user userId="123456789"
```

## Tool Categories

### Communication (2 tools)
- `send_dm` - Send direct messages with context tracking
- `update_context` - Update user context for personalized responses

### Discord Integration (7 tools)
- `reaction_manager` - Add, remove, and get reactions
- `message_manager` - Pin/unpin messages, thread management
- `server_utils` - Server info, channel info, member lists
- `invite_manager` - Create/join invites, get server invites
- `get_server_list` - List all servers bot is in
- `leave_server` - Leave specified servers
- `change_presence` - Change bot presence status

### Investigation (2 tools)
- `investigate_user` - Comprehensive user analysis (public data only)
- `get_user_profile_complete` - Full profile information (public data only)



### System (2 tools)
- `reason_complex` - Complex reasoning and analysis
- `docker_exec` - Execute shell commands in Docker container (when shell access enabled)

### Relationships (3 tools)
- `check_friend_requests` - Check incoming friend requests
- `handle_friend_request` - Accept or decline friend requests
- `send_friend_request` - Send friend requests to users

## Architecture

### Core Components
- **Bot Service**: Main orchestrator with data persistence and stability features
- **AI System**: Multi-provider AI with automatic failover (Google Gemini + NVIDIA NIM)
- **Tool Executor**: Modular tool system with 14 consolidated tools
- **Reasoning System**: Progressive thinking with logging
- **Memory System**: LRU-cached conversation context with automatic cleanup
- **Queue System**: Request management with rate limiting and spam detection
- **Media Processor**: Multimodal content handling (images, videos, audio, GIFs)
- **Transcription Service**: Python-based Whisper audio processing
- **Security Layer**: Command validation, file type checking, and rate limiting

### Data Persistence
- JSON-based storage in `data-selfbot/` directory
- LRU caches for memory efficiency (50 channels, 100 DM contexts)
- Server-specific and global prompt storage
- Automatic cleanup and memory management
- Conversation history and user contexts
- Cross-session continuity with periodic saving

### Logging System
- Structured logging with rotation
- Multiple log levels and files
- Performance monitoring and debugging
- Reasoning activity logs

## Security & Privacy

### Data Handling
- All data stored locally in JSON files
- No external data transmission except API calls to Google/NVIDIA
- Sensitive information never logged
- Environment variables for secrets
- File type validation and command allowlisting
- Investigation tools only access public user data (no MFA, verification status, or private info)

### API Safety
- Rate limiting and request queuing (10 req/min per user)
- Automatic failover between AI providers
- Timeout protection and error handling
- Resource usage monitoring and quotas
- Input sanitization and XSS prevention

## Troubleshooting

### Common Issues
- **Invalid token**: Check `DISCORD_USER_TOKEN` in .env
- **API errors**: Verify Google AI and NVIDIA keys
- **Rate limiting**: Wait for cooldown or reduce usage
- **Memory issues**: Check `;health` command
- **Transcription fails**: Ensure Python dependencies are installed
- **Media processing errors**: Check FFmpeg installation and file permissions

### Logs
Check logs in the `logs/` directory (created automatically):
- `bot.log` - General activity
- `errors.log` - Error messages
- `reasoning.log` - Reasoning activity
- `debug.log` - Debug information
- `health.log` - Health metrics
- `rate_limits.log` - Rate limiting events

### Performance
- Monitor with `;health` command
- Check memory usage and API calls
- Review logs for bottlenecks
- Adjust configuration as needed

## Development

### Project Structure
```
maxwell-selfbot/
├── services/                 # Core services (Bot, DataManager, TranscriptionService)
├── tools/                    # Tool modules and executor
│   ├── communication/        # DM and context tools
│   ├── discord/             # Discord interaction tools
│   ├── investigation/       # User analysis tools
│   ├── relationship/        # Friend management tools
│   └── system/              # System and calculation tools
│       ├── dockerExec.js    # Docker shell execution tool
│       ├── reasonComplex.js # Complex reasoning tool
├── utils/                    # Utilities and helpers
├── config/                   # Configuration management
├── logs/                     # Log files (created automatically)
├── data-selfbot/            # Persistent data (created automatically)
├── cache/                    # Media cache (created automatically)
├── handlers.js              # Discord event handlers
├── ai.js                    # AI processing logic
├── providers.js             # AI provider implementations
├── prompts.js               # Prompt construction
├── media.js                 # Multimodal processing
├── queues.js                # Queue management system
├── health.js                # Health monitoring
├── security.js              # Security utilities
├── subagentCoordinator.js   # Subagent management
├── apiResourceManager.js    # API quota management
├── transcription_service.py # Python audio transcription
├── bot.js                   # Main entry point
├── globalPrompt.txt         # Global AI prompt
├── .env.example             # Environment variables template
├── .eslintrc.cjs            # ESLint configuration
├── .gitignore               # Git ignore rules
├── API_CAPABILITIES.md      # API capabilities documentation
├── DISCORD_API_CAPABILITIES.md # Discord API capabilities
└── README.md                # This file
```

### Adding Tools
1. Create tool file in appropriate `tools/` subdirectory
2. Export tool definition with name, description, parameters
3. Add execution function to `ToolExecutor.js`
4. Register tool in `tools/index.js`
5. Update documentation
6. Consider consolidating similar functionality into existing tools

### Code Quality
- Run `npm run lint` for ESLint checking
- Follow existing patterns and conventions
- Add proper error handling
- Test thoroughly before deployment

## License

This project is provided as-is without warranty. Use at your own risk.

## Contributing

Contributions are welcome. Please ensure code quality and follow the existing architecture patterns.

## Support

For issues or questions, please check the logs and configuration first. Ensure all environment variables are set correctly.
