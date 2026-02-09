
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
}

class ExtensionLogger {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 100;

  log(level: LogLevel, context: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data: this.sanitizeData(data),
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.MAX_LOGS) this.logs.pop();

    const consoleMethod = level === LogLevel.ERROR ? 'error' : level === LogLevel.WARN ? 'warn' : 'log';
    console[consoleMethod](`[${entry.timestamp}] [${level}] [${context}] ${message}`, data || '');
  }

  private sanitizeData(data: any): any {
    if (!data) return data;
    // Remove heavy image data from logs to keep them readable
    const clone = JSON.parse(JSON.stringify(data));
    if (clone.image?.base64) clone.image.base64 = '<base64_data_truncated>';
    return clone;
  }

  getLogs() {
    return this.logs;
  }
}

export const logger = new ExtensionLogger();
