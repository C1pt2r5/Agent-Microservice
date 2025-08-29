import { ChatbotAgent } from './chatbot-agent';
import { logger } from '../../shared/utils/logger';
import { gracefulShutdown } from '../../shared/utils/graceful-shutdown';
import { defaultConfig } from '../../index';

async function main() {
  try {
    logger.info('Starting Chatbot Agent...');
    
    const config = {
      ...defaultConfig,
      id: 'chatbot-agent-1',
      name: 'Chatbot Agent',
      type: 'chatbot' as const,
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
    
    const agent = new ChatbotAgent(config);
    await agent.initialize();
    
    logger.info('Chatbot Agent started successfully');
    
    // Handle graceful shutdown
    gracefulShutdown(async () => {
      logger.info('Shutting down Chatbot Agent...');
      await agent.shutdown();
      logger.info('Chatbot Agent stopped');
    });
    
  } catch (error) {
    logger.error('Failed to start Chatbot Agent:', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', new Error('Promise rejection'), 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

main();