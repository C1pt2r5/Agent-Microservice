import { FraudDetectionAgent } from './fraud-detection-agent';
import { logger } from '../../shared/utils/logger';
import { gracefulShutdown } from '../../shared/utils/graceful-shutdown';
import { defaultConfig } from '../../index';

async function main() {
  try {
    logger.info('Starting Fraud Detection Agent...');
    
    const config = {
      ...defaultConfig,
      id: 'fraud-detection-agent-1',
      name: 'Fraud Detection Agent',
      type: 'fraud-detection' as const,
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
    
    const agent = new FraudDetectionAgent(config);
    await agent.initialize();
    
    logger.info('Fraud Detection Agent started successfully');
    
    // Handle graceful shutdown
    gracefulShutdown(async () => {
      logger.info('Shutting down Fraud Detection Agent...');
      await agent.shutdown();
      logger.info('Fraud Detection Agent stopped');
    });
    
  } catch (error) {
    logger.error('Failed to start Fraud Detection Agent:', error instanceof Error ? error : new Error(String(error)));
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