import express, { Express } from 'express';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { initializePronunciationRules } from './services/dataService';

// Initialize app
const app: Express = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Korean Pronunciation Analysis API is running' });
});

// Error handling middleware
// app.use(errorHandler);

// Initialize data and services
const initialize = async () => {
  try {
    await initializePronunciationRules();
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
};

initialize();

export default app;