"use strict";
/**
 * Simple logger utility for the agentic microservices system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor() {
        this.level = LogLevel.INFO;
    }
    setLevel(level) {
        this.level = level;
    }
    debug(message, ...args) {
        if (this.level <= LogLevel.DEBUG) {
            console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
        }
    }
    info(message, ...args) {
        if (this.level <= LogLevel.INFO) {
            console.info(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
        }
    }
    warn(message, ...args) {
        if (this.level <= LogLevel.WARN) {
            console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
        }
    }
    error(message, error, ...args) {
        if (this.level <= LogLevel.ERROR) {
            if (error instanceof Error) {
                console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error, ...args);
            }
            else {
                console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error, ...args);
            }
        }
    }
}
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map