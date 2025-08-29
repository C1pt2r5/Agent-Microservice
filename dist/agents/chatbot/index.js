"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chatbot_agent_1 = require("./chatbot-agent");
const logger_1 = require("../../shared/utils/logger");
const graceful_shutdown_1 = require("../../shared/utils/graceful-shutdown");
const index_1 = require("../../index");
async function main() {
    try {
        logger_1.logger.info('Starting Chatbot Agent...');
        const config = {
            ...index_1.defaultConfig,
            id: 'chatbot-agent-1',
            name: 'Chatbot Agent',
            type: 'chatbot',
            capabilities: [
                {
                    name: 'chat',
                    description: 'Handle chat conversations',
                    inputSchema: { type: 'string' },
                    outputSchema: { type: 'string' }
                },
                {
                    name: 'conversation',
                    description: 'Manage conversation context',
                    inputSchema: { type: 'object' },
                    outputSchema: { type: 'object' }
                },
                {
                    name: 'support',
                    description: 'Provide customer support',
                    inputSchema: { type: 'object' },
                    outputSchema: { type: 'object' }
                }
            ]
        };
        const agent = new chatbot_agent_1.ChatbotAgent(config);
        await agent.initialize();
        logger_1.logger.info('Chatbot Agent started successfully');
        // Handle graceful shutdown
        (0, graceful_shutdown_1.gracefulShutdown)(async () => {
            logger_1.logger.info('Shutting down Chatbot Agent...');
            await agent.shutdown();
            logger_1.logger.info('Chatbot Agent stopped');
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start Chatbot Agent:', error instanceof Error ? error : new Error(String(error)));
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