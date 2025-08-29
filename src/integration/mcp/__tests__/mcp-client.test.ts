/**
 * Unit tests for MCP client implementation
 */

import axios from 'axios';
import { MCPClientImpl } from '../mcp-client';
import { MCPConfig, MCPRequest, SystemError } from '../../../types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MCPClientImpl', () => {
  let client: MCPClientImpl;
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
            failureThreshold: 5,
            recoveryTimeout: 30000,
            halfOpenMaxCalls: 3
          }
        }
      }
    };

    // Mock axios.create
    const mockAxiosInstance = {
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn()
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    mockedAxios.isAxiosError.mockImplementation((error) => error?.isAxiosError === true);

    client = new MCPClientImpl(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8080',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MCP-Client/1.0.0'
        }
      });
    });

    it('should initialize circuit breakers for all services', () => {
      const circuitBreakerState = client.getCircuitBreakerState('user-service');
      expect(circuitBreakerState).toEqual({
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        halfOpenAttempts: 0
      });
    });

    it('should initialize rate limiters for all services', () => {
      const rateLimitStatus = client.getRateLimitStatus('user-service');
      expect(rateLimitStatus).toBeDefined();
      expect(rateLimitStatus?.tokens).toBe(60);
    });
  });

  describe('request', () => {
    let mockRequest: MCPRequest;

    beforeEach(() => {
      mockRequest = {
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
    });

    it('should successfully make a request', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.request = jest.fn().mockResolvedValue({
        data: { user: { id: '123', name: 'Test User' } }
      });

      const response = await client.request(mockRequest);

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ user: { id: '123', name: 'Test User' } });
      expect(response.requestId).toBe('test-request-1');
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/mcp/request',
        data: mockRequest,
        timeout: 30000,
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
    });

    it('should throw error for unknown service', async () => {
      mockRequest.service = 'unknown-service';

      await expect(client.request(mockRequest)).rejects.toMatchObject({
        code: 'MCP_ERROR',
        message: 'Service unknown-service not configured'
      });
    });

    it('should handle axios errors', async () => {
      const mockAxiosInstance = mockedAxios.create();
      const axiosError = {
        isAxiosError: true,
        message: 'Network Error',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: 'Server error' }
        }
      };
      mockAxiosInstance.request = jest.fn().mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const response = await client.request(mockRequest);

      expect(response.success).toBe(false);
      expect(response.error).toMatchObject({
        code: 'MCP_ERROR',
        message: 'Network Error',
        details: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: 'Server error' }
        }
      });
    });

    it('should retry on failure', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.request = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce({ data: { success: true } });

      const response = await client.request(mockRequest);

      expect(response.success).toBe(true);
      expect(response.metadata.retryCount).toBe(2);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3);
    });

    it('should respect circuit breaker', async () => {
      // Mock the axios instance to consistently fail
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.request = jest.fn().mockRejectedValue(new Error('Service failure'));
      
      // Ensure the mock is returned when axios.create is called
      mockedAxios.create.mockReturnValue(mockAxiosInstance);

      // Make enough requests to trigger circuit breaker (5 failures based on config)
      for (let i = 0; i < 5; i++) {
        try {
          await client.request(mockRequest);
        } catch (error) {
          // Expected to fail - these failures should increment the circuit breaker counter
        }
      }

      // Verify circuit breaker state
      const circuitBreakerState = client.getCircuitBreakerState('user-service');
      expect(circuitBreakerState?.state).toBe('OPEN');
      expect(circuitBreakerState?.failureCount).toBeGreaterThanOrEqual(5);

      // Circuit breaker should now be open and reject requests immediately
      await expect(client.request(mockRequest)).rejects.toMatchObject({
        code: 'MCP_ERROR',
        message: 'Circuit breaker open for service user-service'
      });
    }, 15000);
  });

  describe('authentication', () => {
    it('should handle bearer token authentication', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.request = jest.fn().mockResolvedValue({ data: {} });

      const request: MCPRequest = {
        id: 'test-request',
        timestamp: new Date(),
        service: 'user-service',
        operation: 'getUser',
        parameters: {},
        metadata: {
          correlationId: 'corr-123',
          timeout: 30000,
          priority: 'normal',
          agentId: 'test-agent'
        }
      };

      await client.request(request);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-token'
          }
        })
      );
    });

    it('should handle API key authentication', async () => {
      // Update config for API key auth
      mockConfig.services['user-service'].auth = {
        type: 'api-key',
        credentials: { apiKey: 'test-api-key' }
      };
      client = new MCPClientImpl(mockConfig);

      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.request = jest.fn().mockResolvedValue({ data: {} });

      const request: MCPRequest = {
        id: 'test-request',
        timestamp: new Date(),
        service: 'user-service',
        operation: 'getUser',
        parameters: {},
        metadata: {
          correlationId: 'corr-123',
          timeout: 30000,
          priority: 'normal',
          agentId: 'test-agent'
        }
      };

      await client.request(request);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'X-API-Key': 'test-api-key'
          }
        })
      );
    });
  });

  describe('getServiceDefinition', () => {
    it('should retrieve service definition', async () => {
      const mockAxiosInstance = mockedAxios.create();
      const mockDefinition = {
        name: 'user-service',
        version: '1.0.0',
        description: 'User management service',
        operations: [],
        schemas: {}
      };
      mockAxiosInstance.get = jest.fn().mockResolvedValue({ data: mockDefinition });

      const definition = await client.getServiceDefinition('user-service');

      expect(definition).toEqual(mockDefinition);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/mcp/services/user-service/definition',
        {
          headers: {
            'Authorization': 'Bearer test-token'
          }
        }
      );
    });

    it('should throw error for unknown service', async () => {
      await expect(client.getServiceDefinition('unknown-service')).rejects.toMatchObject({
        code: 'MCP_ERROR',
        message: 'Service unknown-service not configured'
      });
    });
  });

  describe('healthCheck', () => {
    it('should return true when service is healthy', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.get = jest.fn().mockResolvedValue({ status: 200 });

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/mcp/health');
    });

    it('should return false when service is unhealthy', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.get = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limits', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.request = jest.fn().mockResolvedValue({ data: {} });

      // Mock Date.now to prevent token refill during test
      const originalDateNow = Date.now;
      const fixedTime = Date.now();
      Date.now = jest.fn(() => fixedTime);

      try {
        const request: MCPRequest = {
          id: 'test-request',
          timestamp: new Date(),
          service: 'user-service',
          operation: 'getUser',
          parameters: {},
          metadata: {
            correlationId: 'corr-123',
            timeout: 30000,
            priority: 'normal',
            agentId: 'test-agent'
          }
        };

        // Make requests to exhaust all tokens (60 requests per minute = 60 tokens initially)
        for (let i = 0; i < 60; i++) {
          await client.request({ ...request, id: `test-request-${i}` });
        }

        // Next request should be rate limited since all tokens are exhausted
        await expect(client.request({ ...request, id: 'test-request-61' })).rejects.toMatchObject({
          code: 'MCP_ERROR',
          message: 'Rate limit exceeded for service user-service'
        });
      } finally {
        // Restore original Date.now
        Date.now = originalDateNow;
      }
    });
  });
});