module.exports = {
  apps: [
    {
      name: 'discord-selfbot',
      script: 'bot.js',
      env: {
        // All environment variables should be set in .env file
        // DO NOT hardcode secrets here
      },
    },
  ],
};
