"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const deployment_1 = require("./deployment");
const logger_1 = require("../../shared/utils/logger");
const graceful_shutdown_1 = require("../../shared/utils/graceful-shutdown");
const metrics_1 = require("../monitoring/metrics");
class ADKServer {
    constructor() {
        this.app = (0, express_1.default)();
        this.deploymentService = new deployment_1.DeploymentAutomation();
        this.metrics = new metrics_1.MetricsCollector();
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.urlencoded({ extended: true }));
        // Request logging
        this.app.use((req, res, next) => {
            logger_1.logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }
    setupRoutes() {
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
            }
            catch (error) {
                logger_1.logger.error('Error generating metrics:', error instanceof Error ? error : new Error(String(error)));
                res.status(500).json({ error: 'Failed to generate metrics' });
            }
        });
        // Deployment endpoints
        this.app.post('/deploy', async (req, res) => {
            try {
                const { agentConfig } = req.body;
                const result = await this.deploymentService.generateDeployment(agentConfig);
                res.json(result);
            }
            catch (error) {
                logger_1.logger.error('Deployment failed:', error instanceof Error ? error : new Error(String(error)));
                res.status(500).json({ error: 'Deployment failed' });
            }
        });
        this.app.get('/templates', async (req, res) => {
            try {
                const templates = ['basic-agent', 'chatbot-agent', 'fraud-detection-agent', 'recommendation-agent'];
                res.json(templates);
            }
            catch (error) {
                logger_1.logger.error('Failed to list templates:', error instanceof Error ? error : new Error(String(error)));
                res.status(500).json({ error: 'Failed to list templates' });
            }
        });
        this.app.post('/templates/:templateName/generate', async (req, res) => {
            try {
                const { templateName } = req.params;
                const { config } = req.body;
                const result = await this.deploymentService.generateDeployment(config);
                res.json(result);
            }
            catch (error) {
                logger_1.logger.error('Template generation failed:', error instanceof Error ? error : new Error(String(error)));
                res.status(500).json({ error: 'Template generation failed' });
            }
        });
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({ error: 'Not found' });
        });
        // Error handler
        this.app.use((error, req, res, next) => {
            logger_1.logger.error('Unhandled error:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
    }
    async start() {
        const port = process.env.PORT || 8080;
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    logger_1.logger.info(`ADK Server started on port ${port}`);
                    resolve();
                }
            });
        });
    }
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    logger_1.logger.info('ADK Server stopped');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
}
async function main() {
    try {
        logger_1.logger.info('Starting ADK Server...');
        const server = new ADKServer();
        await server.start();
        logger_1.logger.info('ADK Server started successfully');
        // Handle graceful shutdown
        (0, graceful_shutdown_1.gracefulShutdown)(async () => {
            logger_1.logger.info('Shutting down ADK Server...');
            await server.stop();
            logger_1.logger.info('ADK Server stopped');
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start ADK Server:', error instanceof Error ? error : new Error(String(error)));
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
//# sourceMappingURL=server.js.map