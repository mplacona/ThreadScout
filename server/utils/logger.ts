type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
  service?: string;
}

class ServerLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, message: string, data?: unknown, service?: string): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      service,
    };
  }

  private log(level: LogLevel, message: string, data?: unknown, service?: string): void {
    if (!this.isDevelopment && level === 'debug') {
      return; // Skip debug logs in production
    }

    const logEntry = this.formatMessage(level, message, data, service);
    const prefix = service ? `[${service}]` : '';
    
    switch (level) {
      case 'error':
        console.error(`[${logEntry.timestamp}] ${prefix} ERROR: ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`[${logEntry.timestamp}] ${prefix} WARN: ${message}`, data || '');
        break;
      case 'info':
        console.info(`[${logEntry.timestamp}] ${prefix} INFO: ${message}`, data || '');
        break;
      case 'debug':
        console.log(`[${logEntry.timestamp}] ${prefix} DEBUG: ${message}`, data || '');
        break;
    }
  }

  error(message: string, data?: unknown, service?: string): void {
    this.log('error', message, data, service);
  }

  warn(message: string, data?: unknown, service?: string): void {
    this.log('warn', message, data, service);
  }

  info(message: string, data?: unknown, service?: string): void {
    this.log('info', message, data, service);
  }

  debug(message: string, data?: unknown, service?: string): void {
    this.log('debug', message, data, service);
  }

  // Service-specific loggers
  scan = {
    info: (message: string, data?: unknown) => this.info(message, data, 'SCAN'),
    debug: (message: string, data?: unknown) => this.debug(message, data, 'SCAN'),
    warn: (message: string, data?: unknown) => this.warn(message, data, 'SCAN'),
    error: (message: string, data?: unknown) => this.error(message, data, 'SCAN'),
  };

  agent = {
    info: (message: string, data?: unknown) => this.info(message, data, 'AGENT'),
    debug: (message: string, data?: unknown) => this.debug(message, data, 'AGENT'),
    warn: (message: string, data?: unknown) => this.warn(message, data, 'AGENT'),
    error: (message: string, data?: unknown) => this.error(message, data, 'AGENT'),
  };

  reddit = {
    info: (message: string, data?: unknown) => this.info(message, data, 'REDDIT'),
    debug: (message: string, data?: unknown) => this.debug(message, data, 'REDDIT'),
    warn: (message: string, data?: unknown) => this.warn(message, data, 'REDDIT'),
    error: (message: string, data?: unknown) => this.error(message, data, 'REDDIT'),
  };
}

export const logger = new ServerLogger();