type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.isDevelopment && level === 'debug') {
      return; // Skip debug logs in production
    }

    const logEntry = this.formatMessage(level, message, data);
    
    switch (level) {
      case 'error':
        console.error(`[${logEntry.timestamp}] ERROR: ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`[${logEntry.timestamp}] WARN: ${message}`, data || '');
        break;
      case 'info':
        console.info(`[${logEntry.timestamp}] INFO: ${message}`, data || '');
        break;
      case 'debug':
        console.log(`[${logEntry.timestamp}] DEBUG: ${message}`, data || '');
        break;
    }
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }
}

export const logger = new Logger();