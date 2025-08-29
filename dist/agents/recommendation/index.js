"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const recommendation_agent_1 = require("./recommendation-agent");
const logger_1 = require("../../shared/utils/logger");
const graceful_shutdown_1 = require("../../shared/utils/graceful-shutdown");
const index_1 = require("../../index");
async function main() {
    try {
        logger_1.logger.info('Starting Recommendation Agent...');
        const config = {
            ...index_1.defaultConfig,
            id: 'recommendation-agent-1',
            name: 'Recommendation Agent',
            type: 'recommendation',
            capabilities: [
                {
                    name: 'recommendations',
                    description: 'Generate personalized recommendations',
                    inputSchema: { type: 'object' },
                    outputSchema: { type: 'array' }
                },
                {
                    name: 'personalization',
                    description: 'Personalize user experience',
                    inputSchema: { type: 'object' },
                    outputSchema: { type: 'object' }
                },
                {
                    name: 'analytics',
                    description: 'Analyze user behavior',
                    inputSchema: { type: 'object' },
                    outputSchema: { type: 'object' }
                }
            ]
        };
        const agent = new recommendation_agent_1.RecommendationAgent(config);
        await agent.initialize();
        logger_1.logger.info('Recommendation Agent started successfully');
        // Handle graceful shutdown
        (0, graceful_shutdown_1.gracefulShutdown)(async () => {
            logger_1.logger.info('Shutting down Recommendation Agent...');
            await agent.shutdown();
            logger_1.logger.info('Recommendation Agent stopped');
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start Recommendation Agent:', error instanceof Error ? error : new Error(String(error)));
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