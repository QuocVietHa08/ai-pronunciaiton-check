import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log error details
  logger.error('Error caught by error handler:', { 
    error: err.message,
    stack: err.stack,
    path: req.path
  });
  
  // Check if it's a known operational error
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    });
  }
  
  // Handle unknown errors
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};