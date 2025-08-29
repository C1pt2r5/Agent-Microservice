import express from 'express';
import { DeploymentAutomation } from './deployment';
import { logger } from '../../shared/utils/logger';
import { gracefulShutdown } from '../../shared/utils/graceful-shutdown';
import { MetricsCollector } from '../monitoring/metrics';

class ADKServer {
  private app: express.Application;
  private server: any;
  private deploymentService: DeploymentAutomation;
  private metrics: any;

  constructor() {
    this.app = express();
    this.deploymentService = new DeploymentAutomation();
    this.metrics = new MetricsCollector();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, { 
        ip: req.ip, 
        userAgent: req.get('User-Agent') 
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'adk'
      });
    });

    // Ready check endpoint
    this.app.get('/ready', (req, res) => {
      res.status(200).json({ 
        status: 'ready', 
        timestamp: new Date().toISOString(),
        service: 'adk'
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.metrics.register.metrics();
        res.set('Content-Type', this.metrics.register.contentType);
        res.end(metrics);
      } catch (error) {
        logger.error('Error generating metrics:', error instanceof Error ? error : new Error(String(error)));
        res.status(500).json({ error: 'Failed to generate metrics' });
      }
    });

    // Deployment endpoints
    this.app.post('/deploy', async (req, res) => {
      try {
        const { agentConfig } = req.body;
        const result = await this.deploymentService.generateDeployment(agentConfig);
        res.json(result);
      } catch (error) {
        logger.error('Deployment failed:', error instanceof Error ? error : new Error(String(error)));
        res.status(500).json({ error: 'Deployment failed' });
      }
    });

    this.app.get('/templates', async (req, res) => {
      try {
        const templates = ['basic-agent', 'chatbot-agent', 'fraud-detection-agent', 'recommendation-agent'];
        res.json(templates);
      } catch (error) {
        logger.error('Failed to list templates:', error instanceof Error ? error : new Error(String(error)));
        res.status(500).json({ error: 'Failed to list templates' });
      }
    });

    this.app.post('/templates/:templateName/generate', async (req, res) => {
      try {
        const { templateName } = req.params;
        const { config } = req.body;
        const result = await this.deploymentService.generateDeployment(config);
        res.json(result);
      } catch (error) {
        logger.error('Template generation failed:', error instanceof Error ? error : new Error(String(error)));
        res.status(500).json({ error: 'Template generation failed' });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  public async start(): Promise<void> {
    const port = process.env.PORT || 8080;
    
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          logger.info(`ADK Server started on port ${port}`);
          resolve();
        }
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('ADK Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

async function main() {
  try {
    logger.info('Starting ADK Server...');
    
    const server = new ADKServer();
    await server.start();
    
    logger.info('ADK Server started successfully');
    
    // Handle graceful shutdown
    gracefulShutdown(async () => {
      logger.info('Shutting down ADK Server...');
      await server.stop();
      logger.info('ADK Server stopped');
    });
    
  } catch (error) {
    logger.error('Failed to start ADK Server:', error instanceof Error ? error : new Error(String(error)));
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