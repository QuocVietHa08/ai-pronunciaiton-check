import fs from 'fs';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private level: LogLevel;
  private logFile: string;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
    this.logFile = path.join(logsDir, `app_${new Date().toISOString().split('T')[0]}.log`);
  }

  private log(level: LogLevel, levelName: string, message: string, data?: any): void {
    if (level <= this.level) {
      const timestamp = new Date().toISOString();
      const formattedData = data ? ` - ${JSON.stringify(data)}` : '';
      const logMessage = `[${timestamp}] [${levelName}] ${message}${formattedData}`;
      
      // Log to console
      console.log(logMessage);
      
      // Log to file
      fs.appendFileSync(this.logFile, logMessage + '\n');
    }
  }

  public error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, 'ERROR', message, data);
  }

  public warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, 'WARN', message, data);
  }

  public info(message: string, data?: any): void {
    this.log(LogLevel.INFO, 'INFO', message, data);
  }

  public debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, data);
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Create and export logger instance
export const logger = new Logger(
  process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG
);