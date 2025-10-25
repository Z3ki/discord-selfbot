this is the shitty code that i made with ai and everything that you will see its the ai's fault not mine 🥰

# Discord Selfbot

A sophisticated Discord selfbot powered by Google's Gemma 3-27B-IT AI model, featuring advanced reasoning capabilities, tool integration, and intelligent conversation management.

## Disclaimer

**This is a selfbot. Selfbots violate Discord's Terms of Service. Use at your own risk. The developers are not responsible for any consequences of using this software.**

## Features

### AI-Powered Conversations
- Powered by Google's Gemma 3-27B-IT model
- Automatic fallback to NVIDIA NIM for reliability
- Multimodal support (images, videos, GIFs, stickers)
- Context-aware responses with conversation memory

### Advanced Tool System
- 40+ integrated tools for Discord interactions
- Real-time reasoning with progressive thinking display
- Shell command execution with approval system
- Comprehensive investigation and analysis tools

### Intelligent Reasoning
- Progressive reasoning display with brief indicators
- Full reasoning logged for detailed analysis
- Specialized reasoning for code, math, logic, and more
- Complexity assessment and adaptive processing

### Communication Tools
- Direct message management with context tracking
- User investigation and profile analysis
- Friend request handling
- Cross-server presence monitoring

### Discord Integration
- Thread management (create, join, archive)
- Message management (pin, reactions, permissions)
- Server analytics and member information
- Invite link management

### System Tools
- Mathematical calculations
- Shell command execution (with manual approval)
- Prompt customization
- Health monitoring and diagnostics

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- Discord user token (⚠️ **Never share this**)

### Setup
1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file:
    ```env
    DISCORD_USER_TOKEN=your_discord_user_token_here
    GOOGLE_API_KEY=your_google_ai_api_key_here
    NVIDIA_NIM_API_KEY=your_nvidia_api_key_here
    LOG_LEVEL=info
    ADMIN_USER_ID=your_admin_user_id_here
    ```

4. Start the bot:
   ```bash
   npm start
   ```

## Configuration

### Environment Variables
- `DISCORD_USER_TOKEN`: Your Discord user token (required, user ID auto-detected)
- `GOOGLE_API_KEY`: Google AI API key for primary AI (required)
- `NVIDIA_NIM_API_KEY`: NVIDIA NIM API key for fallback AI (optional)
- `ADMIN_USER_ID`: Admin user ID for restricted commands (optional, defaults to token user)
- `LOG_LEVEL`: Logging verbosity (info/warn/error/debug)

### Optional Configuration
- `ADMIN_USER_ID`: User ID with admin privileges
- `STEALTH_ENABLED`: Enable stealth features (default: false)
- `LOG_LEVEL`: Set logging level
- `NVIDIA_NIM_BASE_URL`: Custom NVIDIA NIM endpoint
- `NVIDIA_NIM_MODEL`: Custom NVIDIA NIM model

## Usage

### Basic Commands
- `;help` - Show all available commands
- `;info` - Get bot information
- `;health` - Show system health (admin only)
- `;restart` - Restart the bot (admin only)
- `;blacklist` - Manage blacklisted servers (admin only)

### Reasoning Commands
- `;reasoning-mode brief` - Set reasoning display mode
- Use `TOOL: reason_complex problem="..." type="..."` for complex analysis

### AI Interaction
The bot responds to:
- Direct mentions (@bot)
- Replies to bot messages
- Direct messages

### Tool Usage
Tools are invoked automatically by the AI or manually:
```
TOOL: send_dm userId="123456" content="Hello!" reason="Greeting"
TOOL: calculate expression="2 + 2"
TOOL: reason_complex problem="Solve x^2 + 2x + 1 = 0" type="math"
```

## Tool Categories

### Communication (2 tools)
- `send_dm` - Send direct messages with context tracking
- `update_context` - Update user context for personalized responses

### Discord Integration (22 tools)
- Message management (pin, reactions, threads)
- Server information and analytics
- Permission checking and user investigation
- Invite and member management
- Server blacklisting for ignored responses

### Investigation (2 tools)
- `investigate_user` - Comprehensive user analysis
- `get_user_profile_complete` - Full profile information

### System (3 tools)
- `calculate` - Mathematical expression evaluation
- `reason_complex` - Advanced reasoning and analysis
- `set_prompt` - Customize AI behavior

## Architecture

### Core Components
- **Bot Service**: Main orchestrator with data persistence
- **AI System**: Multi-provider AI with automatic failover
- **Tool Executor**: Modular tool system with 40+ tools
- **Reasoning Engine**: Progressive thinking with logging
- **Memory System**: Conversation context and user data

### Data Persistence
- JSON-based storage in `data-selfbot/` directory
- Automatic cleanup and memory management
- Conversation history and user contexts
- Cross-session continuity

### Logging System
- Structured logging with rotation
- Multiple log levels and files
- Performance monitoring and debugging
- Reasoning activity logs

## Security & Privacy

### Data Handling
- All data stored locally in JSON files
- No external data transmission except API calls
- Sensitive information never logged
- Environment variables for secrets

### API Safety
- Rate limiting and request queuing
- Automatic failover between AI providers
- Timeout protection and error handling
- Resource usage monitoring

## Troubleshooting

### Common Issues
- **Invalid token**: Check `DISCORD_USER_TOKEN` in .env
- **API errors**: Verify Google AI and NVIDIA keys
- **Rate limiting**: Wait for cooldown or reduce usage
- **Memory issues**: Check `;health` command

### Logs
Check logs in the `logs/` directory:
- `bot.log` - General activity
- `errors.log` - Error messages
- `reasoning.log` - Reasoning activity
- `debug.log` - Debug information

### Performance
- Monitor with `;health` command
- Check memory usage and API calls
- Review logs for bottlenecks
- Adjust configuration as needed

## Development

### Project Structure
```
discord-selfbot/
├── services/          # Core services (Bot, DataManager)
├── tools/            # Tool modules and executor
├── utils/            # Utilities and helpers
├── config/           # Configuration management
├── logs/             # Log files
├── data-selfbot/     # Persistent data
├── handlers.js       # Discord event handlers
├── ai.js            # AI processing logic
├── prompts.js       # Prompt construction
├── media.js         # Multimodal processing
└── bot.js           # Main entry point
```

### Adding Tools
1. Create tool file in appropriate `tools/` subdirectory
2. Export tool definition with name, description, parameters
3. Add execution function to `ToolExecutor.js`
4. Register in `tools/index.js`
5. Update documentation

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
