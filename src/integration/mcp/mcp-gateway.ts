/**
 * MCP gateway service implementation
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import axios, { AxiosInstance } from 'axios';
import { 
  MCPConfig, 
  MCPRequest, 
  MCPResponse, 
  MCPServiceConfig,
  MCPServiceDefinition,
  SystemError,
  CircuitBreakerConfig,
  RateLimitConfig
} from '../../types';
import { AuthManager } from './auth-manager';

interface ServiceRegistry {
  [serviceName: string]: {
    config: MCPServiceConfig;
    client: AxiosInstance;
    circuitBreaker: CircuitBreakerState;
    rateLimiter: RateLimiterState;
  };
}

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: Date | null;
  halfOpenAttempts: number;
}

interface RateLimiterState {
  tokens: number;
  lastRefill: Date;
  requestQueue: Array<{
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timestamp: Date;
  }>;
}

export class MCPGateway {
  private app: Express;
  private config: MCPConfig;
  private authManager: AuthManager;
  private serviceRegistry: ServiceRegistry = {};
  private isRunning: boolean = false;

  constructor(config: MCPConfig) {
    this.config = config;
    this.authManager = new AuthManager();
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeServices();
  }

  private setupMiddleware(): void {
    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      
      next();
    });

    // Error handling middleware
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Gateway error:', error);
      
      const systemError: SystemError = {
        code: 'MCP_ERROR',
        message: error.message,
        timestamp: new Date()
      };

      res.status(500).json({
        success: false,
        error: systemError
      });
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/mcp/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: Object.keys(this.serviceRegistry).map(serviceName => ({
          name: serviceName,
          status: this.getServiceHealth(serviceName)
        }))
      });
    });

    // Service discovery endpoint
    this.app.get('/mcp/services', (req: Request, res: Response) => {
      const services = Object.keys(this.serviceRegistry).map(serviceName => ({
        name: serviceName,
        endpoint: this.serviceRegistry[serviceName].config.endpoint,
        status: this.getServiceHealth(serviceName)
      }));

      res.json({ services });
    });

    // Service definition endpoint
    this.app.get('/mcp/services/:serviceName/definition', async (req: Request, res: Response) => {
      try {
        const { serviceName } = req.params;
        const definition = await this.getServiceDefinition(serviceName);
        res.json(definition);
      } catch (error) {
        res.status(404).json({
          success: false,
          error: {
            code: 'MCP_ERROR',
            message: error instanceof Error ? error.message : 'Service not found',
            timestamp: new Date()
          }
        });
      }
    });

    // Main MCP request endpoint
    this.app.post('/mcp/request', async (req: Request, res: Response) => {
      try {
        const mcpRequest: MCPRequest = req.body;
        const response = await this.handleMCPRequest(mcpRequest);
        res.json(response);
      } catch (error) {
        const systemError: SystemError = {
          code: 'MCP_ERROR',
          message: error instanceof Error ? error.message : 'Request processing failed',
          timestamp: new Date()
        };

        res.status(500).json({
          success: false,
          error: systemError
        });
      }
    });

    // Service metrics endpoint
    this.app.get('/mcp/services/:serviceName/metrics', (req: Request, res: Response) => {
      const { serviceName } = req.params;
      const service = this.serviceRegistry[serviceName];
      
      if (!service) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'MCP_ERROR',
            message: 'Service not found',
            timestamp: new Date()
          }
        });
      }

      res.json({
        serviceName,
        circuitBreaker: service.circuitBreaker,
        rateLimiter: {
          tokens: service.rateLimiter.tokens,
          lastRefill: service.rateLimiter.lastRefill,
          queueLength: service.rateLimiter.requestQueue.length
        }
      });
    });
  }

  private initializeServices(): void {
    Object.entries(this.config.services).forEach(([serviceName, serviceConfig]) => {
      const client = axios.create({
        baseURL: serviceConfig.endpoint,
        timeout: serviceConfig.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MCP-Gateway/1.0.0'
        }
      });

      this.serviceRegistry[serviceName] = {
        config: serviceConfig,
        client,
        circuitBreaker: {
          state: 'CLOSED',
          failureCount: 0,
          lastFailureTime: null,
          halfOpenAttempts: 0
        },
        rateLimiter: {
          tokens: serviceConfig.rateLimit.requestsPerMinute,
          lastRefill: new Date(),
          requestQueue: []
        }
      };
    });
  }

  private async handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
    const startTime = Date.now();
    const service = this.serviceRegistry[request.service];

    if (!service) {
      throw new Error(`Service ${request.service} not configured`);
    }

    // Check circuit breaker
    if (!this.isCircuitBreakerClosed(request.service)) {
      throw new Error(`Circuit breaker open for service ${request.service}`);
    }

    // Apply rate limiting
    await this.applyRateLimit(request.service);

    try {
      // Build authentication headers
      const authHeaders = this.authManager.getAuthHeaders(request.service, service.config.auth);

      // Make the actual service request
      const response = await service.client.request({
        method: 'POST',
        url: `/api/${request.operation}`,
        data: request.parameters,
        headers: {
          ...authHeaders,
          'X-Correlation-ID': request.metadata.correlationId,
          'X-Agent-ID': request.metadata.agentId
        },
        timeout: request.metadata.timeout || service.config.timeout
      });

      // Reset circuit breaker on success
      this.resetCircuitBreaker(request.service);

      const processingTime = Date.now() - startTime;

      return {
        id: `response_${Date.now()}`,
        requestId: request.id,
        timestamp: new Date(),
        success: true,
        data: response.data,
        metadata: {
          processingTime,
          serviceEndpoint: service.config.endpoint,
          retryCount: 0,
          cacheHit: false
        }
      };

    } catch (error) {
      // Record failure for circuit breaker
      this.recordFailure(request.service);

      const processingTime = Date.now() - startTime;
      let systemError: SystemError;

      if (axios.isAxiosError(error)) {
        systemError = {
          code: 'MCP_ERROR',
          message: error.message,
          details: {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
          },
          timestamp: new Date(),
          correlationId: request.metadata.correlationId
        };
      } else {
        systemError = {
          code: 'MCP_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          correlationId: request.metadata.correlationId
        };
      }

      return {
        id: `response_${Date.now()}`,
        requestId: request.id,
        timestamp: new Date(),
        success: false,
        error: systemError,
        metadata: {
          processingTime,
          serviceEndpoint: service.config.endpoint,
          retryCount: 0,
          cacheHit: false
        }
      };
    }
  }

  private isCircuitBreakerClosed(serviceName: string): boolean {
    const service = this.serviceRegistry[serviceName];
    if (!service) return false;

    const { circuitBreaker } = service;
    const config = service.config.circuitBreaker;

    switch (circuitBreaker.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        if (circuitBreaker.lastFailureTime && 
            Date.now() - circuitBreaker.lastFailureTime.getTime() > config.recoveryTimeout) {
          circuitBreaker.state = 'HALF_OPEN';
          circuitBreaker.halfOpenAttempts = 0;
          return true;
        }
        return false;
      case 'HALF_OPEN':
        return circuitBreaker.halfOpenAttempts < config.halfOpenMaxCalls;
      default:
        return true;
    }
  }

  private recordFailure(serviceName: string): void {
    const service = this.serviceRegistry[serviceName];
    if (!service) return;

    const { circuitBreaker } = service;
    const config = service.config.circuitBreaker;

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = new Date();

    if (circuitBreaker.state === 'HALF_OPEN') {
      circuitBreaker.state = 'OPEN';
      circuitBreaker.halfOpenAttempts = 0;
    } else if (circuitBreaker.failureCount >= config.failureThreshold) {
      circuitBreaker.state = 'OPEN';
    }
  }

  private resetCircuitBreaker(serviceName: string): void {
    const service = this.serviceRegistry[serviceName];
    if (!service) return;

    service.circuitBreaker.state = 'CLOSED';
    service.circuitBreaker.failureCount = 0;
    service.circuitBreaker.lastFailureTime = null;
    service.circuitBreaker.halfOpenAttempts = 0;
  }

  private async applyRateLimit(serviceName: string): Promise<void> {
    const service = this.serviceRegistry[serviceName];
    if (!service) return;

    const { rateLimiter } = service;
    const config = service.config.rateLimit;

    // Refill tokens based on time elapsed
    const now = new Date();
    const timeSinceLastRefill = now.getTime() - rateLimiter.lastRefill.getTime();
    const tokensToAdd = Math.floor(timeSinceLastRefill / (60000 / config.requestsPerMinute));

    if (tokensToAdd > 0) {
      rateLimiter.tokens = Math.min(config.burstLimit, rateLimiter.tokens + tokensToAdd);
      rateLimiter.lastRefill = now;
    }

    // Check if we have tokens available
    if (rateLimiter.tokens > 0) {
      rateLimiter.tokens--;
      return;
    }

    // No tokens available, need to queue the request
    return new Promise((resolve, reject) => {
      const queueItem = {
        resolve,
        reject,
        timestamp: new Date()
      };

      rateLimiter.requestQueue.push(queueItem);

      // Set a timeout to reject if queued too long
      setTimeout(() => {
        const index = rateLimiter.requestQueue.indexOf(queueItem);
        if (index !== -1) {
          rateLimiter.requestQueue.splice(index, 1);
          reject(new Error('Rate limit queue timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  private processRateLimitQueue(): void {
    Object.values(this.serviceRegistry).forEach(service => {
      const { rateLimiter } = service;
      
      while (rateLimiter.tokens > 0 && rateLimiter.requestQueue.length > 0) {
        const queueItem = rateLimiter.requestQueue.shift();
        if (queueItem) {
          rateLimiter.tokens--;
          queueItem.resolve(true);
        }
      }
    });
  }

  private getServiceHealth(serviceName: string): string {
    const service = this.serviceRegistry[serviceName];
    if (!service) return 'unknown';

    switch (service.circuitBreaker.state) {
      case 'CLOSED':
        return 'healthy';
      case 'HALF_OPEN':
        return 'recovering';
      case 'OPEN':
        return 'unhealthy';
      default:
        return 'unknown';
    }
  }

  private async getServiceDefinition(serviceName: string): Promise<MCPServiceDefinition> {
    const service = this.serviceRegistry[serviceName];
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    try {
      const authHeaders = this.authManager.getAuthHeaders(serviceName, service.config.auth);
      const response = await service.client.get('/api/definition', {
        headers: authHeaders
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get service definition for ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async start(port: number = 8080): Promise<void> {
    if (this.isRunning) {
      throw new Error('Gateway is already running');
    }

    // Start rate limit queue processor
    const queueProcessor = setInterval(() => {
      this.processRateLimitQueue();
    }, 1000); // Process queue every second

    return new Promise((resolve, reject) => {
      const server = this.app.listen(port, () => {
        this.isRunning = true;
        console.log(`MCP Gateway started on port ${port}`);
        resolve();
      });

      server.on('error', (error) => {
        clearInterval(queueProcessor);
        reject(error);
      });

      // Graceful shutdown handling
      process.on('SIGTERM', () => {
        console.log('Shutting down MCP Gateway...');
        clearInterval(queueProcessor);
        server.close(() => {
          this.isRunning = false;
          console.log('MCP Gateway stopped');
        });
      });
    });
  }

  public getServiceRegistry(): ServiceRegistry {
    return { ...this.serviceRegistry };
  }

  public getApp(): Express {
    return this.app;
  }
}