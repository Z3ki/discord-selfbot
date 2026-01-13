# Maxwell Discord Selfbot - Project Overview

## What is Maxwell?

Maxwell is a sophisticated Discord selfbot that leverages advanced AI to provide intelligent, multimodal interactions within Discord servers and direct messages. Built with a focus on modularity, security, and performance, it integrates multiple AI providers with comprehensive tool capabilities for enhanced Discord automation.

## Core Architecture

### Modular Design

- **Dependency Injection**: Custom `DependencyContainer` for service management
- **Provider Pattern**: AI providers with automatic failover (NVIDIA NIM → Google Gemma)
- **Observer Pattern**: Discord event handling with extensible architecture
- **Strategy Pattern**: Multiple prompt building strategies for safe/unrestricted modes

### Key Components

- **Bot Service** (`services/Bot.js`): Main orchestrator with LRU caching and health monitoring
- **AI System** (`ai.js`, `providers.js`): Multi-provider AI with response caching and tool execution
- **Tool Executor** (`tools/ToolExecutor.js`): 5 tool categories with multi-round execution
- **Media Processor** (`media.js`): Multimodal content handling (text, images, videos, audio, GIFs)
- **Data Manager** (`services/DataManager.js`): Persistent JSON storage with atomic writes
- **Transcription Service** (`services/TranscriptionService.py`): Python-based Whisper integration

## AI Integration

### Providers

- **Primary**: NVIDIA NIM (OpenAI-compatible API with Llama models)
- **Fallback**: Google Gemma 3-27B-IT (multimodal support)
- **Caching**: LRU cache prevents redundant API calls (50-70% reduction)
- **Metadata**: Comprehensive extraction of token usage, safety ratings, and finish reasons

### Multimodal Support

- **Images**: JPEG, PNG, GIF, WebP, BMP with synchronous processing
- **Videos**: MP4, WebM, QuickTime, AVI with frame extraction and async analysis
- **Audio**: MP3, WAV, OGG, WebM, M4A, AAC, FLAC, Opus with Whisper transcription
- **GIFs**: Frame-by-frame processing with async follow-up

## Tool System (14 Tools)

### Communication Tools

- `send_dm`: Direct messaging with context management
- `update_context`: User preference and theme updates

### Discord Management Tools

- `investigate_user`: Comprehensive user profile analysis
- `change_presence`: Bot status and activity management
- `reaction_manager`: Add/remove reactions on messages
- `message_manager`: Message editing and management
- `invite_manager`: Server invite creation and management
- `leave_server`: Server departure functionality

### Information Tools

- `get_user_profile_complete`: Enhanced user profile retrieval
- `reason_complex`: Complex reasoning and analysis
- `wikipedia`: Information lookup with search fallback

### Relationship Tools

- `check_friend_requests`: Friend request monitoring
- `handle_friend_request`: Manual friend request processing

### System Tools

- `memory_inspect`: Conversation memory analysis and debugging

## Security & Privacy

### Access Control

- **Environment-Based Admin**: Permanent admin via `ADMIN_USER_ID`
- **Dynamic Admin Management**: Runtime admin addition/removal
- **Per-Server Controls**: Safe mode, prompts, and shell access per server
- **Rate Limiting**: 10 req/min per user with spam detection

### Data Protection

- **Local Storage**: All data in JSON files with atomic writes
- **No External Transmission**: Only AI API calls for processing
- **Input Validation**: XSS prevention, file type checking, URL validation
- **Audit Logging**: Comprehensive logging of all admin actions

## Memory Management

### LRU Caching

- **Channel Memories**: 50 channels, 18 messages each, 24-hour cleanup
- **DM Contexts**: 100 contexts with user preferences and themes
- **Response Cache**: Prevents redundant AI API calls
- **Memory Pools**: Efficient memory usage with buffer pools

### Persistence

- **Periodic Saves**: Every 10 minutes with graceful shutdown
- **Identity Protection**: Prevents AI self-confusion with strong markers
- **Dynamic Allocation**: Memory limits adjust based on conversation complexity

## Proactive Features

### Cognitive Loop

- **Daily Execution**: 12 PM analysis of recent conversations
- **Context Gathering**: Examines memories for engagement opportunities
- **Server-Specific Behavior**: Customizable per-server interaction patterns

### Health Monitoring

- **System Metrics**: Memory usage, API performance, error rates
- **Automatic Cleanup**: Log rotation, cache eviction, memory management
- **Performance Tracking**: Response times and cache hit rates

## Development & Deployment

### Prerequisites

- **Node.js 18+** with npm
- **Python 3.8+** with pip (for Whisper transcription)
- **FFmpeg** for media processing
- **Discord User Token** (⚠️ Selfbot - use at own risk)
- **AI API Keys**: Google AI Studio and/or NVIDIA NIM

### Installation

```bash
git clone <repository>
cd maxwell-selfbot
npm install
pip install torch faster-whisper
cp .env.example .env
# Configure .env with tokens and keys
npm start
```

### Configuration

```env
DISCORD_USER_TOKEN=your_token
GOOGLE_API_KEY=your_google_key
NVIDIA_NIM_API_KEY=optional_fallback
ADMIN_USER_ID=your_admin_id
LOG_LEVEL=info
```

### Development Workflow

- **Linting**: `npm run lint` (ESLint + Prettier)
- **Testing**: `npm test` (unit and integration tests)
- **Modularity**: Clear separation of concerns with dependency injection
- **Error Handling**: Comprehensive try-catch with graceful degradation
- **Logging**: Structured logging with multiple log files and rotation

## Performance Optimizations

### API Efficiency

- **Response Caching**: LRU cache for prompt/response pairs
- **Request Queuing**: Prevents rate limit violations
- **Stealth Features**: Human-like delays and random user agents
- **Batch Processing**: Optimized for multimodal content

### Memory Management

- **Automatic GC**: Forced garbage collection at 1GB usage
- **Cache Eviction**: Size and age-based cleanup
- **Buffer Pools**: Reusable buffers for frequent operations
- **Profiling**: Detailed memory usage tracking

## Recent Improvements

### Media Processing Optimization (2025-11-04)

- Synchronous image/sticker processing for immediate responses
- Asynchronous video/audio/GIF processing with follow-up messages
- Better user experience with faster visual content handling

### Memory Management & Performance (2025-11-02)

- 50-70% API call reduction through intelligent caching
- Enhanced identity protection preventing AI self-confusion
- Optimized memory truncation and prompt compression

### Tool Enhancements

- Wikipedia information tool with automatic search fallback
- Memory inspection tools for debugging and analysis
- Enhanced user profile and relationship management

## Future Roadmap

### High Priority

- Type safety migration to TypeScript
- Native tool calling (replace custom [TOOL] syntax)
- Confidence scoring with log probabilities
- Real-time presence tracking and analytics

### Medium Priority

- Advanced Discord API utilization (voice, moderation)
- Plugin system for extensibility
- Multi-instance architecture support
- Enhanced security with OAuth admin authentication

### Long Term

- Machine learning for behavior optimization
- Enterprise deployment options
- Advanced analytics dashboard
- Voice response generation

---

**Maxwell Selfbot** - Advanced AI-powered Discord automation with comprehensive multimodal support, robust security, and extensible tool architecture.
