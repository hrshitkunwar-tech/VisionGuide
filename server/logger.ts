
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export class ServerLogger {
  static log(level: LogLevel, context: string, message: string, meta?: any) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      ...(meta && { meta: this.sanitize(meta) }),
    };

    const output = JSON.stringify(entry);
    if (level === LogLevel.ERROR) {
      console.error(output);
    } else if (level === LogLevel.WARN) {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  private static sanitize(meta: any) {
    if (typeof meta !== 'object' || meta === null) return meta;
    try {
      const clean = { ...meta };
      if (clean.image?.base64) clean.image.base64 = '[TRUNCATED]';
      if (clean.base64) clean.base64 = '[TRUNCATED]';
      return clean;
    } catch (e) {
      return "[Unserializable Meta]";
    }
  }
}
