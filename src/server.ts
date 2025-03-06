// Load environment variables first, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { logger } from './utils/logger';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  logger.info(`Korean Pronunciation Analysis API listening on port ${port}`);
});