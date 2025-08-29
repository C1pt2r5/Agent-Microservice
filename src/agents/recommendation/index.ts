import { RecommendationAgent } from './recommendation-agent';
import { logger } from '../../shared/utils/logger';
import { gracefulShutdown } from '../../shared/utils/graceful-shutdown';
import { defaultConfig } from '../../index';

async function main() {
  try {
    logger.info('Starting Recommendation Agent...');
    
    const config = {
      ...defaultConfig,
      id: 'recommendation-agent-1',
      name: 'Recommendation Agent',
      type: 'recommendation' as const,
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
    
    const agent = new RecommendationAgent(config);
    await agent.initialize();
    
    logger.info('Recommendation Agent started successfully');
    
    // Handle graceful shutdown
    gracefulShutdown(async () => {
      logger.info('Shutting down Recommendation Agent...');
      await agent.shutdown();
      logger.info('Recommendation Agent stopped');
    });
    
  } catch (error) {
    logger.error('Failed to start Recommendation Agent:', error instanceof Error ? error : new Error(String(error)));
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