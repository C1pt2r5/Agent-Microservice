/**
 * Unit tests for Gemini client factory
 */

import { GeminiClientFactory } from '../gemini-client-factory';
import { GeminiClient } from '../gemini-client';

// Mock the GeminiClient
jest.mock('../gemini-client');

describe('GeminiClientFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('createClient', () => {
    it('should create client with default options', () => {
      const client = GeminiClientFactory.createClient('test-api-key');

      expect(GeminiClient).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        model: 'gemini-pro',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        maxTokens: 2048,
        temperature: 0.7,
        rateLimitPerMinute: 60
      });
    });

    it('should create client with custom options', () => {
      const options = {
        model: 'gemini-pro-vision',
        temperature: 0.5,
        maxTokens: 1024,
        rateLimitPerMinute: 100
      };

      const client = GeminiClientFactory.createClient('test-api-key', options);

      expect(GeminiClient).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        model: 'gemini-pro-vision',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        maxTokens: 1024,
        temperature: 0.5,
        rateLimitPerMinute: 100
      });
    });
  });

  describe('specialized client creation', () => {
    it('should create chatbot client with appropriate settings', () => {
      const client = GeminiClientFactory.createChatbotClient('test-api-key');

      expect(GeminiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key',
          model: 'gemini-pro',
          maxTokens: 2048,
          temperature: 0.8, // More creative
          rateLimitPerMinute: 120
        })
      );
    });

    it('should create analytical client with appropriate settings', () => {
      const client = GeminiClientFactory.createAnalyticalClient('test-api-key');

      expect(GeminiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key',
          model: 'gemini-pro',
          maxTokens: 4096,
          temperature: 0.3, // More deterministic
          rateLimitPerMinute: 200
        })
      );
    });

    it('should create recommendation client with appropriate settings', () => {
      const client = GeminiClientFactory.createRecommendationClient('test-api-key');

      expect(GeminiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key',
          model: 'gemini-pro',
          maxTokens: 3072,
          temperature: 0.6, // Balanced
          rateLimitPerMinute: 150
        })
      );
    });

    it('should create development client with relaxed settings', () => {
      const client = GeminiClientFactory.createDevelopmentClient('dev-key');

      expect(GeminiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'dev-key',
          rateLimitPerMinute: 60 // Lower limit for dev
        })
      );
    });

    it('should create development client with env var fallback', () => {
      process.env.GEMINI_API_KEY = 'env-key';
      
      const client = GeminiClientFactory.createDevelopmentClient();

      expect(GeminiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'env-key'
        })
      );

      delete process.env.GEMINI_API_KEY;
    });
  });

  describe('createFromEnvironment', () => {
    beforeEach(() => {
      // Clean up environment
      delete process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_MODEL;
      delete process.env.GEMINI_ENDPOINT;
      delete process.env.GEMINI_MAX_TOKENS;
      delete process.env.GEMINI_TEMPERATURE;
      delete process.env.GEMINI_RATE_LIMIT;
    });

    it('should create client from environment variables', () => {
      process.env.GEMINI_API_KEY = 'env-api-key';
      process.env.GEMINI_MODEL = 'gemini-pro-vision';
      process.env.GEMINI_MAX_TOKENS = '4096';
      process.env.GEMINI_TEMPERATURE = '0.5';
      process.env.GEMINI_RATE_LIMIT = '120';

      const client = GeminiClientFactory.createFromEnvironment();

      expect(GeminiClient).toHaveBeenCalledWith({
        apiKey: 'env-api-key',
        model: 'gemini-pro-vision',
        endpoint: 'https://generativelanguage.googleapis.com',
        maxTokens: 4096,
        temperature: 0.5,
        rateLimitPerMinute: 120
      });
    });

    it('should use default values when env vars not set', () => {
      process.env.GEMINI_API_KEY = 'env-api-key';

      const client = GeminiClientFactory.createFromEnvironment();

      expect(GeminiClient).toHaveBeenCalledWith({
        apiKey: 'env-api-key',
        model: 'gemini-pro',
        endpoint: 'https://generativelanguage.googleapis.com',
        maxTokens: 2048,
        temperature: 0.7,
        rateLimitPerMinute: 60
      });
    });

    it('should throw error when API key not provided', () => {
      expect(() => {
        GeminiClientFactory.createFromEnvironment();
      }).toThrow('GEMINI_API_KEY environment variable is required');
    });
  });

  describe('createProductionClient', () => {
    beforeEach(() => {
      // Clean up environment
      delete process.env.GEMINI_MODEL;
      delete process.env.GEMINI_ENDPOINT;
      delete process.env.GEMINI_MAX_TOKENS;
      delete process.env.GEMINI_TEMPERATURE;
      delete process.env.GEMINI_RATE_LIMIT;
    });

    it('should create production client with environment overrides', () => {
      process.env.GEMINI_MODEL = 'gemini-pro-production';
      process.env.GEMINI_MAX_TOKENS = '8192';
      process.env.GEMINI_RATE_LIMIT = '500';

      const client = GeminiClientFactory.createProductionClient('prod-api-key');

      expect(GeminiClient).toHaveBeenCalledWith({
        apiKey: 'prod-api-key',
        model: 'gemini-pro-production',
        endpoint: 'https://generativelanguage.googleapis.com',
        maxTokens: 8192,
        temperature: 0.7,
        rateLimitPerMinute: 500
      });
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const config = {
        apiKey: 'test-key',
        model: 'gemini-pro',
        endpoint: 'https://generativelanguage.googleapis.com',
        maxTokens: 2048,
        temperature: 0.7,
        rateLimitPerMinute: 60
      };

      const errors = GeminiClientFactory.validateConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const config = {
        apiKey: '',
        model: '',
        endpoint: '',
        maxTokens: 2048,
        temperature: 0.7,
        rateLimitPerMinute: 60
      };

      const errors = GeminiClientFactory.validateConfig(config);
      expect(errors).toContain('API key is required');
      expect(errors).toContain('Model is required');
      expect(errors).toContain('Endpoint is required');
    });

    it('should validate numeric ranges', () => {
      const config = {
        apiKey: 'test-key',
        model: 'gemini-pro',
        endpoint: 'https://generativelanguage.googleapis.com',
        maxTokens: -1,
        temperature: 3.0,
        rateLimitPerMinute: 0
      };

      const errors = GeminiClientFactory.validateConfig(config);
      expect(errors).toContain('Max tokens must be positive');
      expect(errors).toContain('Temperature must be between 0 and 2');
      expect(errors).toContain('Rate limit must be positive');
    });

    it('should validate token limits', () => {
      const config = {
        apiKey: 'test-key',
        model: 'gemini-pro',
        endpoint: 'https://generativelanguage.googleapis.com',
        maxTokens: 50000, // Too high
        temperature: 0.7,
        rateLimitPerMinute: 60
      };

      const errors = GeminiClientFactory.validateConfig(config);
      expect(errors).toContain('Max tokens cannot exceed 32768');
    });

    it('should validate endpoint URL format', () => {
      const config = {
        apiKey: 'test-key',
        model: 'gemini-pro',
        endpoint: 'invalid-url',
        maxTokens: 2048,
        temperature: 0.7,
        rateLimitPerMinute: 60
      };

      const errors = GeminiClientFactory.validateConfig(config);
      expect(errors).toContain('Invalid endpoint URL');
    });
  });

  describe('getRecommendedSettings', () => {
    it('should return chatbot settings', () => {
      const settings = GeminiClientFactory.getRecommendedSettings('chatbot');
      
      expect(settings).toEqual({
        model: 'gemini-pro',
        maxTokens: 1024,
        temperature: 0.8,
        rateLimitPerMinute: 100
      });
    });

    it('should return analysis settings', () => {
      const settings = GeminiClientFactory.getRecommendedSettings('fraud-detection');
      
      expect(settings).toEqual({
        model: 'gemini-pro',
        maxTokens: 512,
        temperature: 0.1,
        rateLimitPerMinute: 200
      });
    });

    it('should return recommendation settings', () => {
      const settings = GeminiClientFactory.getRecommendedSettings('recommendation');
      
      expect(settings).toEqual({
        model: 'gemini-pro',
        maxTokens: 1536,
        temperature: 0.6,
        rateLimitPerMinute: 150
      });
    });

    it('should return creative settings', () => {
      const settings = GeminiClientFactory.getRecommendedSettings('creative');
      
      expect(settings).toEqual({
        model: 'gemini-pro',
        maxTokens: 2048,
        temperature: 0.9,
        rateLimitPerMinute: 80
      });
    });

    it('should return default settings for unknown use case', () => {
      const settings = GeminiClientFactory.getRecommendedSettings('unknown');
      
      expect(settings).toEqual({
        model: 'gemini-pro',
        maxTokens: 2048,
        temperature: 0.7,
        rateLimitPerMinute: 60
      });
    });
  });

  describe('createClientSuite', () => {
    it('should create multiple specialized clients', () => {
      const suite = GeminiClientFactory.createClientSuite('test-api-key');

      expect(suite).toHaveProperty('chatbot');
      expect(suite).toHaveProperty('analytical');
      expect(suite).toHaveProperty('recommendation');
      expect(GeminiClient).toHaveBeenCalledTimes(3);
    });
  });

  describe('testClient', () => {
    it('should test client connectivity successfully', async () => {
      const mockClient = {
        healthCheck: jest.fn().mockResolvedValue(true)
      } as any;

      const result = await GeminiClientFactory.testClient(mockClient);

      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThan(0);
      expect(mockClient.healthCheck).toHaveBeenCalled();
    });

    it('should handle client connectivity failure', async () => {
      const mockClient = {
        healthCheck: jest.fn().mockRejectedValue(new Error('Connection failed'))
      } as any;

      const result = await GeminiClientFactory.testClient(mockClient);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    it('should handle unhealthy client', async () => {
      const mockClient = {
        healthCheck: jest.fn().mockResolvedValue(false)
      } as any;

      const result = await GeminiClientFactory.testClient(mockClient);

      expect(result.success).toBe(false);
      expect(result.latency).toBeGreaterThan(0);
    });
  });
});