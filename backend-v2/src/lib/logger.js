"use strict";
// Logger centralizado para toda a aplicação
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class Logger {
    constructor() {
        this.isDev = process.env.NODE_ENV !== "production";
    }
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` ${JSON.stringify(context)}` : "";
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
    }
    sanitizeContext(context) {
        if (!context)
            return undefined;
        const sanitized = {};
        const sensitiveKeys = ["password", "token", "secret", "key", "authorization"];
        for (const [key, value] of Object.entries(context)) {
            const lowerKey = key.toLowerCase();
            if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
                sanitized[key] = "***REDACTED***";
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    info(message, context) {
        console.log(this.formatMessage("info", message, this.sanitizeContext(context)));
    }
    warn(message, context) {
        console.warn(this.formatMessage("warn", message, this.sanitizeContext(context)));
    }
    error(message, error, context) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error(this.formatMessage("error", `${message}: ${errorMessage}`, {
            ...this.sanitizeContext(context),
            ...(errorStack && this.isDev ? { stack: errorStack } : {}),
        }));
    }
    debug(message, context) {
        if (this.isDev) {
            console.log(this.formatMessage("debug", message, this.sanitizeContext(context)));
        }
    }
}
exports.logger = new Logger();
