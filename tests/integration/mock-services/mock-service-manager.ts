import express from 'express';
import { Server } from 'http';
import { MockMCPService } from './mock-mcp-service';
import { MockExternalAPIs } from './mock-external-apis';
import { MockGeminiService } from './mock-gemini-service';
import { MockRedisService } from './mock-redis-service';

export class MockServiceManager {
  private mockServices: Map<string, MockService> = new Map();
  private servers: Map<string, Server> = new Map();
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('Initializing Mock Services...');

    // Initialize mock services
    await this.initializeMockMCP();
    await this.initializeMockExternalAPIs();
    await this.initializeMockGemini();
    await this.initializeMockRedis();

    this.isInitialized = true;
    console.log('Mock Services initialized successfully');
  }

  async cleanup(): Promise<void> {
    if (!this.isInitialized) return;

    console.log('Cleaning up Mock Services...');

    // Stop all servers
    for (const [name, server] of this.servers) {
      await this.stopServer(name, server);
    }

    // Cleanup mock services
    for (const [name, service] of this.mockServices) {
      await service.cleanup();
    }

    this.mockServices.clear();
    this.servers.clear();
    this.isInitialized = false;

    console.log('Mock Services cleanup complete');
  }

  getMockService(serviceName: string): MockService | undefined {
    return this.mockServices.get(serviceName);
  }

  async configureMockResponse(serviceName: string, endpoint: string, response: any): Promise<void> {
    const service = this.mockServices.get(serviceName);
    if (!service) {
      throw new Error(`Mock service ${serviceName} not found`);
    }

    await service.configureResponse(endpoint, response);
  }

  async simulateServiceDelay(serviceName: string, delay: number): Promise<void> {
    const service = this.mockServices.get(serviceName);
    if (!service) {
      throw new Error(`Mock service ${serviceName} not found`);
    }

    await service.simulateDelay(delay);
  }

  async simulateServiceError(serviceName: string, errorCode: number, errorMessage: string): Promise<void> {
    const service = this.mockServices.get(serviceName);
    if (!service) {
      throw new Error(`Mock service ${serviceName} not found`);
    }

    await service.simulateError(errorCode, errorMessage);
  }

  async resetMockService(serviceName: string): Promise<void> {
    const service = this.mockServices.get(serviceName);
    if (!service) {
      throw new Error(`Mock service ${serviceName} not found`);
    }

    await service.reset();
  }

  async getServiceMetrics(serviceName: string): Promise<ServiceMetrics> {
    const service = this.mockServices.get(serviceName);
    if (!service) {
      throw new Error(`Mock service ${serviceName} not found`);
    }

    return service.getMetrics();
  }

  private async initializeMockMCP(): Promise<void> {
    const mockMCP = new MockMCPService();
    await mockMCP.initialize();

    const app = express();
    app.use(express.json());

    // Setup MCP endpoints
    app.get('/users/:id', (req, res) => mockMCP.handleGetUser(req, res));
    app.get('/users/:id/transactions', (req, res) => mockMCP.handleGetTransactions(req, res));
    app.get('/users/:id/orders', (req, res) => mockMCP.handleGetOrders(req, res));
    app.get('/users/:id/account', (req, res) => mockMCP.handleGetAccount(req, res));
    app.get('/products', (req, res) => mockMCP.handleGetProducts(req, res));
    app.get('/products/:id', (req, res) => mockMCP.handleGetProduct(req, res));

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'mock-mcp' });
    });

    const server = app.listen(9001, () => {
      console.log('Mock MCP Service listening on port 9001');
    });

    this.mockServices.set('mcp', mockMCP);
    this.servers.set('mcp', server);
  }

  private async initializeMockExternalAPIs(): Promise<void> {
    const mockAPIs = new MockExternalAPIs();
    await mockAPIs.initialize();

    const app = express();
    app.use(express.json());

    // User Service endpoints
    app.get('/api/users/:id', (req, res) => mockAPIs.handleGetUser(req, res));
    app.put('/api/users/:id', (req, res) => mockAPIs.handleUpdateUser(req, res));

    // Transaction Service endpoints
    app.get('/api/transactions/:id', (req, res) => mockAPIs.handleGetTransaction(req, res));
    app.post('/api/transactions', (req, res) => mockAPIs.handleCreateTransaction(req, res));
    app.get('/api/users/:userId/transactions', (req, res) => mockAPIs.handleGetUserTransactions(req, res));

    // Product Service endpoints
    app.get('/api/products', (req, res) => mockAPIs.handleGetProducts(req, res));
    app.get('/api/products/:id', (req, res) => mockAPIs.handleGetProduct(req, res));

    // Order Service endpoints
    app.get('/api/orders/:id', (req, res) => mockAPIs.handleGetOrder(req, res));
    app.post('/api/orders', (req, res) => mockAPIs.handleCreateOrder(req, res));
    app.get('/api/users/:userId/orders', (req, res) => mockAPIs.handleGetUserOrders(req, res));

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'mock-external-apis' });
    });

    const server = app.listen(9002, () => {
      console.log('Mock External APIs listening on port 9002');
    });

    this.mockServices.set('external-apis', mockAPIs);
    this.servers.set('external-apis', server);
  }

  private async initializeMockGemini(): Promise<void> {
    const mockGemini = new MockGeminiService();
    await mockGemini.initialize();

    const app = express();
    app.use(express.json());

    // Gemini API endpoints
    app.post('/v1/models/:model:generateContent', (req, res) => mockGemini.handleGenerateContent(req, res));
    app.get('/v1/models', (req, res) => mockGemini.handleListModels(req, res));
    app.get('/v1/models/:model', (req, res) => mockGemini.handleGetModel(req, res));

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'mock-gemini' });
    });

    const server = app.listen(9003, () => {
      console.log('Mock Gemini Service listening on port 9003');
    });

    this.mockServices.set('gemini', mockGemini);
    this.servers.set('gemini', server);
  }

  private async initializeMockRedis(): Promise<void> {
    const mockRedis = new MockRedisService();
    await mockRedis.initialize();

    const app = express();
    app.use(express.json());

    // Redis-like HTTP interface for testing
    app.post('/redis/:command', (req, res) => mockRedis.handleCommand(req, res));
    app.get('/redis/keys/:pattern', (req, res) => mockRedis.handleKeys(req, res));
    app.get('/redis/get/:key', (req, res) => mockRedis.handleGet(req, res));
    app.post('/redis/set', (req, res) => mockRedis.handleSet(req, res));

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'mock-redis' });
    });

    const server = app.listen(9004, () => {
      console.log('Mock Redis Service listening on port 9004');
    });

    this.mockServices.set('redis', mockRedis);
    this.servers.set('redis', server);
  }

  private async stopServer(name: string, server: Server): Promise<void> {
    return new Promise((resolve) => {
      server.close(() => {
        console.log(`Mock ${name} service stopped`);
        resolve();
      });
    });
  }
}

// Base class for mock services
export abstract class MockService {
  protected metrics: ServiceMetrics = {
    requestCount: 0,
    errorCount: 0,
    averageResponseTime: 0,
    lastRequestTime: null
  };
  protected responses: Map<string, any> = new Map();
  protected delays: Map<string, number> = new Map();
  protected errors: Map<string, { code: number; message: string }> = new Map();
  protected globalDelay: number = 0;
  protected globalError: { code: number; message: string } | null = null;

  abstract initialize(): Promise<void>;
  abstract cleanup(): Promise<void>;

  async configureResponse(endpoint: string, response: any): Promise<void> {
    this.responses.set(endpoint, response);
  }

  async simulateDelay(delay: number): Promise<void> {
    this.globalDelay = delay;
  }

  async simulateError(errorCode: number, errorMessage: string): Promise<void> {
    this.globalError = { code: errorCode, message: errorMessage };
  }

  async reset(): Promise<void> {
    this.responses.clear();
    this.delays.clear();
    this.errors.clear();
    this.globalDelay = 0;
    this.globalError = null;
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      lastRequestTime: null
    };
  }

  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  protected async handleRequest(endpoint: string, defaultResponse: any): Promise<any> {
    const startTime = Date.now();
    this.metrics.requestCount++;
    this.metrics.lastRequestTime = new Date();

    try {
      // Apply global delay
      if (this.globalDelay > 0) {
        await this.wait(this.globalDelay);
      }

      // Apply endpoint-specific delay
      const endpointDelay = this.delays.get(endpoint);
      if (endpointDelay && endpointDelay > 0) {
        await this.wait(endpointDelay);
      }

      // Check for global error
      if (this.globalError) {
        this.metrics.errorCount++;
        throw new Error(`${this.globalError.code}: ${this.globalError.message}`);
      }

      // Check for endpoint-specific error
      const endpointError = this.errors.get(endpoint);
      if (endpointError) {
        this.metrics.errorCount++;
        throw new Error(`${endpointError.code}: ${endpointError.message}`);
      }

      // Return configured response or default
      const response = this.responses.get(endpoint) || defaultResponse;

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + responseTime) / this.metrics.requestCount;

      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + responseTime) / this.metrics.requestCount;
      
      throw error;
    }
  }

  protected wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface ServiceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastRequestTime: Date | null;
}