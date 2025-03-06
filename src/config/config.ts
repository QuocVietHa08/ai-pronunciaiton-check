// Application configuration
export default {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    model: process.env.AI_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.1'),
  },
  google: {
    projectId: process.env.GOOGLE_PROJECT_ID,
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  app: {
    logsDir: process.env.LOGS_DIR || 'logs',
    dataDir: process.env.DATA_DIR || 'data',
  }
};