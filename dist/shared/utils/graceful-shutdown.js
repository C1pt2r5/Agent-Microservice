"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gracefulShutdown = gracefulShutdown;
const logger_1 = require("./logger");
function gracefulShutdown(cleanup) {
    let isShuttingDown = false;
    const shutdown = async (signal) => {
        if (isShuttingDown) {
            logger_1.logger.warn(`Received ${signal} during shutdown, forcing exit...`);
            process.exit(1);
        }
        isShuttingDown = true;
        logger_1.logger.info(`Received ${signal}, starting graceful shutdown...`);
        try {
            // Set a timeout for graceful shutdown
            const shutdownTimeout = setTimeout(() => {
                logger_1.logger.error('Graceful shutdown timeout, forcing exit...');
                process.exit(1);
            }, 30000); // 30 seconds timeout
            await cleanup();
            clearTimeout(shutdownTimeout);
            logger_1.logger.info('Graceful shutdown completed');
            process.exit(0);
        }
        catch (error) {
            logger_1.logger.error('Error during graceful shutdown:', error instanceof Error ? error : new Error(String(error)));
            process.exit(1);
        }
    };
    // Handle different shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // Nodemon restart
}
//# sourceMappingURL=graceful-shutdown.js.map