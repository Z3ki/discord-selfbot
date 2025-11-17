# Project Overview

This is a sophisticated Discord selfbot named "Maxwell" that uses AI to interact with users and perform various tasks. It's built with Node.js and utilizes multiple AI providers, including NVIDIA NIM and Google Gemma, with a fallback system. The bot supports multimodal input (text, images, videos, audio) and has a rich set of tools for interacting with Discord, the system, and more.

**Key Technologies:**

- **Backend:** Node.js
- **AI Providers:** NVIDIA NIM, Google Gemma
- **Discord Interaction:** `discord.js-selfbot-v13`
- **Configuration:** `dotenv`
- **Linting & Formatting:** ESLint, Prettier

**Architecture:**

The project has a modular architecture with a clear separation of concerns:

- `bot.js`: The main entry point of the application. It initializes the AI providers, the transcription service, and the bot itself.
- `services/Bot.js`: The core of the bot, responsible for managing the Discord client, data persistence, and event handling.
- `handlers.js`: Contains the logic for handling commands and messages.
- `ai.js`: Manages the interaction with the AI providers, including prompt construction and tool execution.
- `providers.js`: Implements the communication with the different AI providers (NVIDIA NIM, Google Gemma).
- `tools/`: Contains the definitions of the various tools the bot can use.
- `config/config.js`: Manages the bot's configuration using environment variables.
- `data-selfbot/`: Stores the bot's data, such as conversation history and user contexts.

# Building and Running

**Prerequisites:**

- Node.js 18+
- Python 3.8+
- FFmpeg
- Docker (optional)

**Installation:**

1.  Clone the repository.
2.  Install Node.js dependencies: `npm install`
3.  Install Python dependencies: `pip install torch faster-whisper`
4.  Create a `.env` file from the `.env.example` and fill in the required values (Discord token, API keys, etc.).

**Running the bot:**

- Start the bot: `npm start`

**Running tests:**

- Run all tests: `npm test`
- Run unit tests: `npm test:unit`

# Development Conventions

- **Coding Style:** The project uses ESLint and Prettier to enforce a consistent coding style.
- **Linting:** Run `npm run lint` to check for linting errors.
- **Formatting:** Run `npm run format` to automatically format the code.
- **Modularity:** The code is organized into modules with specific responsibilities.
- **Error Handling:** The bot includes robust error handling and graceful shutdown mechanisms.
- **Logging:** The project uses a logger (`utils/logger.js`) to provide detailed information about the bot's activity.
- **Configuration:** All configuration is managed through environment variables.
- **Data Persistence:** The bot's data is stored locally in JSON files in the `data-selfbot/` directory.
- **Tool System:** New tools can be added by creating a new file in the `tools/` directory and registering it in `tools/index.js`.
