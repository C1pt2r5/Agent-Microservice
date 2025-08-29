/**
 * Unit tests for Gemini client quota management and circuit breaker
 */

import axios from 'axios';
import { GeminiClient, GeminiRequest } from '../gemini-client';
import { GeminiConfig } from '../../../types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GeminiClient - Quota Management and Circuit Breaker', () => {
  let client: GeminiClient;
  let config: GeminiConfig;

  beforeEach(() => {
    jest.useFakeTimers();
    
    config = {
      apiKey: 'test-api-key',
      model: 'gemini-pro',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      maxTokens: 2048,
      temperature: 0.7,
      rateLimitPerMinute: 60
    };

    // Mock axios.create
    const mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn()
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    mockedAxios.isAxiosError.mockImplementation((error) => error?.isAxiosError === true);

    client = new GeminiClient(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Quota Management', () => {
    it('should initialize with default quota limits', () => {
      const quotaInfo = client.getQuotaInfo();
      
      expect(quotaInfo.dailyQuota).toBe(1000);
      expect(quotaInfo.monthlyQuota).toBe(30000);
      expect(quotaInfo.dailyUsed).toBe(0);
      expect(quotaInfo.monthlyUsed).toBe(0);
    });

    it('should allow setting custom quota limits', () => {
      client.setQuotaLimits(500, 15000);
      
      const quotaInfo = client.getQuotaInfo();
      expect(quotaInfo.dailyQuota).toBe(500);
      expect(quotaInfo.monthlyQuota).toBe(15000);
    });

    it('should track quota usage on successful requests', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.post = jest.fn().mockResolvedValue({
        data: {
          candidates: [{ content: { parts: [{ text: 'Response' }] } }]
        }
      });

      const request: GeminiRequest = {
        id: 'test-request',
        timestamp: new Date(),
        prompt: 'Test prompt with some content'
      };

      await client.generateContent(request);

      const quotaInfo = client.getQuotaInfo();
      expect(quotaInfo.dailyUsed).toBeGreaterThan(0);
      expect(quotaInfo.monthlyUsed).toBeGreaterThan(0);
    });

    it('should reject requests when daily quota is exceeded', async () => {
      // Set a very low daily quota
      client.setQuotaLimits(1, 30000);

      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.post = jest.fn().mockResolvedValue({
        data: {
          candidates: [{ content: { parts: [{ text: 'Response' }] } }]
        }
      });

      const request: GeminiRequest = {
        id: 'test-request',
        timestamp: new Date(),
        prompt: 'A very long prompt that will exceed the quota limit because it has many tokens'
      };

      // First request should succeed
      const response1 = await client.generateContent(request);
      expect(response1.success).toBe(true);

      // Second request should fail due to quota
      const response2 = await client.generateContent(request);
      expect(response2.success).toBe(false);
      expect(response2.error?.message).toContain('Daily quota exceeded');
    });

    it('should emit quota events', (done) => {
      let eventCount = 0;
      
      client.on('quotaUpdated', (data) => {
        expect(data.dailyUsed).toBeGreaterThan(0);
        eventCount++;
        
        if (eventCount === 2) {
          done();
        }
      });

      client.on('quotaLimitsUpdated', (data) => {
        expect(data.dailyQuota).toBe(500);
        eventCount++;
        
        if (eventCount === 2) {
          done();
        }
      });

      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.post = jest.fn().mockResolvedValue({
        data: {
          candidates: [{ content: { parts: [{ text: 'Response' }] } }]
        }
      });

      const request: GeminiRequest = {
        id: 'test-request',
        timestamp: new Date(),
        prompt: 'Test prompt'
      };

      // Trigger quota limits updated event
      client.setQuotaLimits(500, 15000);
      
      // Trigger quota updated event by making a request
      client.generateContent(request);
    }, 10000);
  });

  describe('Circuit Breaker', () => {
    it('should initialize with closed circuit breaker', () => {
      const status = client.getCircuitBreakerStatus();
      
      expect(status.state).toBe('closed');
      expect(status.failures).toBe(0);
      expect(status.lastFailure).toBeNull();
    });

    it('should open circuit breaker after multiple service errors', async () => {
      const mockAxiosInstance = mockedAxios.create();
      const serviceError = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: { message: 'Service unavailable' } }
        }
      };

      mockAxiosInstance.post = jest.fn().mockRejectedValue(serviceError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const request: GeminiRequest = {
        id: 'test-request',
        timestamp: new Date(),
        prompt: 'Test prompt'
      };

      // Make 5 requests to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await client.generateContent(request);
      }

      const status = client.getCircuitBreakerStatus();
      expect(status.state).toBe('open');
      expect(status.failures).toBe(5);
    });

    it('should reject requests when circuit breaker is open', async () => {
      const mockAxiosInstance = mockedAxios.create();
      const serviceError = new Error('Service Error');
      (serviceError as any).isAxiosError = true;
      (serviceError as any).response = {
        status: 500,
        statusText: 'Internal Server Error',
        data: { error: { message: 'Service unavailable' } }
      };

      mockAxiosInstance.post = jest.fn().mockRejectedValue(serviceError);
      mockedAxios.isAxiosError.mockImplementation((error) => error === serviceError);

      const request: GeminiRequest = {
        id: 'test-request',
        timestamp: new Date(),
        prompt: 'Test prompt'
      };

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await client.generateContent(request);
      }

      // Verify circuit breaker is open
      expect(client.getCircuitBreakerStatus().state).toBe('open');

      // Next request should be rejected immediately
      const response = await client.generateContent(request);
      expect(response.success).toBe(false);
      expect(response.error?.message).toBe('Circuit breaker is open - service temporarily unavailable');
    });

    it('should transition to half-open after timeout', async () => {
      const mockAxiosInstance = mockedAxios.create();
      const serviceError = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: { message: 'Service unavailable' } }
        }
      };

      mockAxiosInstance.post = jest.fn().mockRejectedValue(serviceError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const request: GeminiRequest = {
        id: 'test-request',
        timestamp: new Date(),
        prompt: 'Test prompt'
      };

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await client.generateContent(request);
      }

      expect(client.getCircuitBreakerStatus().state).toBe('open');

      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);

      expect(client.getCircuitBreakerStatus().state).toBe('half-open');
    });

    it('should close circuit breaker on successful request in half-open state', async () => {
      const mockAxiosInstance = mockedAxios.create();
      
      // First, trigger circuit breaker with errors
      const serviceError = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: { message: 'Service unavailable' } }
        }
      };

      mockAxiosInstance.post = jest.fn().mockRejectedValue(serviceError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const request: GeminiRequest = {
        id: 'test-request',
        timestamp: new Date(),
        prompt: 'Test prompt'
      };

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await client.generateContent(request);
      }

      // Fast-forward to half-open state
      jest.advanceTimersByTime(30000);
      expect(client.getCircuitBreakerStatus().state).toBe('half-open');

      // Now mock successful response
      mockAxiosInstance.post = jest.fn().mockResolvedValue({
        data: {
          candidates: [{ content: { parts: [{ text: 'Success' }] } }]
        }
      });

      // Make successful request
      const response = await client.generateContent(request);
      expect(response.success).toBe(true);
      expect(client.getCircuitBreakerStatus().state).toBe('closed');
    });

    it('should emit circuit breaker events', (done) => {
      let eventCount = 0;
      
      client.on('circuitBreakerOpened', (data) => {
        expect(data.failures).toBe(5);
        eventCount++;
      });

      client.on('circuitBreakerHalfOpen', () => {
        eventCount++;
      });

      client.on('circuitBreakerClosed', () => {
        eventCount++;
        if (eventCount === 3) {
          done();
        }
      });

      const mockAxiosInstance = mockedAxios.create();
      const serviceError = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: { message: 'Service unavailable' } }
        }
      };

      mockAxiosInstance.post = jest.fn()
        .mockRejectedValueOnce(serviceError)
        .mockRejectedValueOnce(serviceError)
        .mockRejectedValueOnce(serviceError)
        .mockRejectedValueOnce(serviceError)
        .mockRejectedValueOnce(serviceError)
        .mockResolvedValueOnce({
          data: {
            candidates: [{ content: { parts: [{ text: 'Success' }] } }]
          }
        });

      mockedAxios.isAxiosError.mockReturnValue(true);

      const request: GeminiRequest = {
        id: 'test-request',
        timestamp: new Date(),
        prompt: 'Test prompt'
      };

      // Trigger circuit breaker
      Promise.all([
        client.generateContent(request),
        client.generateContent(request),
        client.generateContent(request),
        client.generateContent(request),
        client.generateContent(request)
      ]).then(() => {
        // Fast-forward to half-open
        jest.advanceTimersByTime(30000);
        
        // Make successful request to close circuit breaker
        client.generateContent(request);
      });
    });
  });

  describe('Enhanced Statistics', () => {
    it('should include quota and circuit breaker info in statistics', () => {
      const stats = client.getStatistics();
      
      expect(stats.quotaInfo).toBeDefined();
      expect(stats.quotaInfo.dailyQuota).toBe(1000);
      expect(stats.quotaInfo.monthlyQuota).toBe(30000);
      
      expect(stats.circuitBreakerStatus).toBeDefined();
      expect(stats.circuitBreakerStatus.state).toBe('closed');
      expect(stats.circuitBreakerStatus.failures).toBe(0);
    });
  });
});