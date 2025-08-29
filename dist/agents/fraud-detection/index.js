"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fraud_detection_agent_1 = require("./fraud-detection-agent");
const logger_1 = require("../../shared/utils/logger");
const graceful_shutdown_1 = require("../../shared/utils/graceful-shutdown");
const index_1 = require("../../index");
async function main() {
    try {
        logger_1.logger.info('Starting Fraud Detection Agent...');
        const config = {
            ...index_1.defaultConfig,
            id: 'fraud-detection-agent-1',
            name: 'Fraud Detection Agent',
            type: 'fraud-detection',
            capabilities: [
                {
                    name: 'fraud-detection',
                    description: 'Detect fraudulent transactions',
                    inputSchema: { type: 'object' },
                    outputSchema: { type: 'object' }
                },
                {
                    name: 'risk-analysis',
                    description: 'Analyze risk scores',
                    inputSchema: { type: 'object' },
                    outputSchema: { type: 'number' }
                },
                {
                    name: 'anomaly-detection',
                    description: 'Detect anomalous patterns',
                    inputSchema: { type: 'object' },
                    outputSchema: { type: 'object' }
                }
            ]
        };
        const agent = new fraud_detection_agent_1.FraudDetectionAgent(config);
        await agent.initialize();
        logger_1.logger.info('Fraud Detection Agent started successfully');
        // Handle graceful shutdown
        (0, graceful_shutdown_1.gracefulShutdown)(async () => {
            logger_1.logger.info('Shutting down Fraud Detection Agent...');
            await agent.shutdown();
            logger_1.logger.info('Fraud Detection Agent stopped');
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start Fraud Detection Agent:', error instanceof Error ? error : new Error(String(error)));
        process.exit(1);
    }
}
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled Rejection at:', new Error('Promise rejection'), 'reason:', reason);
    process.exit(1);
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception:', error);
    process.exit(1);
});
main();
//# sourceMappingURL=index.js.map