/**
 * Integration tests for MCP Gateway
 */

import request from 'supertest';
import axios from 'axios';
import { MCPGateway } from '../mcp-gateway';
import { MCPConfig, MCPRequest } from '../../../types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MCPGateway', () => {
  let gateway: MCPGateway;
  let mockConfig: MCPConfig;

  beforeEach(() => {
    mockConfig = {
      gatewayUrl: 'http://localhost:8080',
      defaultTimeout: 30000,
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        initialDelay: 1000,
        maxDelay: 10000,
        jitter: true
      },
      services: {
        'user-service': {
          endpoint: 'http://user-service:8080',
          auth: {
            type: 'bearer',
            credentials: { token: 'test-token' }
          },
          rateLimit: {
            requestsPerMinute: 60,
            burstLimit: 10
          },
          timeout: 30000,
          circuitBreaker: {
            failureThreshold: 3,
            recoveryTimeout: 10000,
            halfOpenMaxCalls: 2
          }
        }
      }
    };

    // Mock axios.create
    const mockAxiosInstance = {
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn()
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    mockedAxios.isAxiosError.mockImplementation((error) => error?.isAxiosError === true);

    gateway = new MCPGateway(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(gateway.getApp())
        .get('/mcp/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        services: [
          {
            name: 'user-service',
            status: 'healthy'
          }
        ]
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Service Discovery', () => {
    it('should list available services', async () => {
      const response = await request(gateway.getApp())
        .get('/mcp/services')
        .expect(200);

      expect(response.body).toEqual({
        services: [
          {
            name: 'user-service',
            endpoint: 'http://user-service:8080',
            status: 'healthy'
          }
        ]
      });
    });
  });

  describe('Service Definition', () => {
    it('should return service definition', async () => {
      const mockDefinition = {
        name: 'user-service',
        version: '1.0.0',
        description: 'User management service',
        operations: [],
        schemas: {}
      };

      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.get = jest.fn().mockResolvedValue({ data: mockDefinition });

      const response = await request(gateway.getApp())
        .get('/mcp/services/user-service/definition')
        .expect(200);

      expect(response.body).toEqual(mockDefinition);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/definition', {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
    });

    it('should return 404 for unknown service', async () => {
      const response = await request(gateway.getApp())
        .get('/mcp/services/unknown-service/definition')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Service unknown-service not found');
    });
  });

  describe('MCP Request Handling', () => {
    it('should successfully process MCP request', async () => {
      const mockServiceResponse = { user: { id: '123', name: 'Test User' } };
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.request = jest.fn().mockResolvedValue({ data: mockServiceResponse });

      const mcpRequest: MCPRequest = {
        id: 'test-request-1',
        timestamp: new Date(),
        service: 'user-service',
        operation: 'getUser',
        parameters: { userId: '123' },
        metadata: {
          correlationId: 'corr-123',
          timeout: 30000,
          priority: 'normal',
          agentId: 'test-agent'
        }
      };

      const response = await request(gateway.getApp())
        .post('/mcp/request')
        .send(mcpRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockServiceResponse);
      expect(response.body.requestId).toBe('test-request-1');
      expect(response.body.metadata.processingTime).toBeDefined();

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/getUser',
        data: { userId: '123' },
        headers: {
          'Authorization': 'Bearer test-token',
          'X-Correlation-ID': 'corr-123',
          'X-Agent-ID': 'test-agent'
        },
        timeout: 30000
      });
    });

    it('should handle service errors gracefully', async () => {
      const mockAxiosInstance = mockedAxios.create();
      const axiosError = {
        isAxiosError: true,
        message: 'Service Error',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: 'Database connection failed' }
        }
      };
      mockAxiosInstance.request = jest.fn().mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const mcpRequest: MCPRequest = {
        id: 'test-request-1',
        timestamp: new Date(),
        service: 'user-service',
        operation: 'getUser',
        parameters: { userId: '123' },
        metadata: {
          correlationId: 'corr-123',
          timeout: 30000,
          priority: 'normal',
          agentId: 'test-agent'
        }
      };

      const response = await request(gateway.getApp())
        .post('/mcp/request')
        .send(mcpRequest)
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatchObject({
        code: 'MCP_ERROR',
        message: 'Service Error',
        details: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: 'Database connection failed' }
        }
      });
    });

    it('should return error for unknown service', async () => {
      const mcpRequest: MCPRequest = {
        id: 'test-request-1',
        timestamp: new Date(),
        service: 'unknown-service',
        operation: 'getUser',
        parameters: { userId: '123' },
        metadata: {
          correlationId: 'corr-123',
          timeout: 30000,
          priority: 'normal',
          agentId: 'test-agent'
        }
      };

      const response = await request(gateway.getApp())
        .post('/mcp/request')
        .send(mcpRequest)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Service unknown-service not configured');
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after failures', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.request = jest.fn().mockRejectedValue(new Error('Service failure'));

      const mcpRequest: MCPRequest = {
        id: 'test-request',
        timestamp: new Date(),
        service: 'user-service',
        operation: 'getUser',
        parameters: { userId: '123' },
        metadata: {
          correlationId: 'corr-123',
          timeout: 30000,
          priority: 'normal',
          agentId: 'test-agent'
        }
      };

      // Make enough requests to trigger circuit breaker (threshold is 3)
      for (let i = 0; i < 3; i++) {
        await request(gateway.getApp())
          .post('/mcp/request')
          .send({ ...mcpRequest, id: `test-request-${i}` })
          .expect(200); // Should return error response but 200 status
      }

      // Next request should be blocked by circuit breaker
      const response = await request(gateway.getApp())
        .post('/mcp/request')
        .send({ ...mcpRequest, id: 'test-request-blocked' })
        .expect(500);

      expect(response.body.error.message).toContain('Circuit breaker open for service user-service');
    });
  });

  describe('Service Metrics', () => {
    it('should return service metrics', async () => {
      const response = await request(gateway.getApp())
        .get('/mcp/services/user-service/metrics')
        .expect(200);

      expect(response.body).toMatchObject({
        serviceName: 'user-service',
        circuitBreaker: {
          state: 'CLOSED',
          failureCount: 0,
          lastFailureTime: null,
          halfOpenAttempts: 0
        },
        rateLimiter: {
          tokens: expect.any(Number),
          lastRefill: expect.any(String),
          queueLength: 0
        }
      });
    });

    it('should return 404 for unknown service metrics', async () => {
      const response = await request(gateway.getApp())
        .get('/mcp/services/unknown-service/metrics')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Service not found');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.request = jest.fn().mockResolvedValue({ data: { success: true } });

      const mcpRequest: MCPRequest = {
        id: 'test-request',
        timestamp: new Date(),
        service: 'user-service',
        operation: 'getUser',
        parameters: { userId: '123' },
        metadata: {
          correlationId: 'corr-123',
          timeout: 30000,
          priority: 'normal',
          agentId: 'test-agent'
        }
      };

      // Make requests up to the burst limit (10)
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(gateway.getApp())
            .post('/mcp/request')
            .send({ ...mcpRequest, id: `test-request-${i}` })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Next request should be rate limited (queued)
      const rateLimitedResponse = await request(gateway.getApp())
        .post('/mcp/request')
        .send({ ...mcpRequest, id: 'test-request-rate-limited' })
        .timeout(5000); // Set a timeout for the test

      // The request should either succeed (if processed from queue) or timeout
      expect([200, 500]).toContain(rateLimitedResponse.status);
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(gateway.getApp())
        .options('/mcp/request')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    it('should include CORS headers in responses', async () => {
      const response = await request(gateway.getApp())
        .get('/mcp/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });
});