// Logger centralizado para toda a aplicação

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDev = process.env.NODE_ENV !== "production";

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    const sanitized: LogContext = {};
    const sensitiveKeys = ["password", "token", "secret", "key", "authorization"];

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
        sanitized[key] = "***REDACTED***";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage("info", message, this.sanitizeContext(context)));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage("warn", message, this.sanitizeContext(context)));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(
      this.formatMessage("error", `${message}: ${errorMessage}`, {
        ...this.sanitizeContext(context),
        ...(errorStack && this.isDev ? { stack: errorStack } : {}),
      })
    );
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDev) {
      console.log(this.formatMessage("debug", message, this.sanitizeContext(context)));
    }
  }
}

export const logger = new Logger();
