/**
 * Unit tests for Gemini client
 */

import axios from 'axios';
import { GeminiClient, GeminiRequest } from '../gemini-client';
import { GeminiConfig } from '../../../types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GeminiClient', () => {
  let client: GeminiClient;
  let config: GeminiConfig;

  beforeEach(() => {
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
    // Clear any intervals
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: config.endpoint,
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Gemini-Client/1.0.0'
        }
      });
    });

    it('should initialize rate limiter', () => {
      const stats = client.getStatistics();
      expect(stats.rateLimitTokens).toBe(60);
      expect(stats.queueLength).toBe(0);
    });
  });

  describe('generateContent', () => {
    let mockRequest: GeminiRequest;

    beforeEach(() => {
      mockRequest = {
        id: 'test-request-1',
        timestamp: new Date(),
        prompt: 'Hello, how are you?'
      };
    });

    it('should generate content successfully', async () => {
      const mockAxiosInstance = mockedAxios.create();
      const mockApiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Hello! I am doing well, thank you for asking.' }]
            },
            finishReason: 'STOP'
          }
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 10,
          totalTokenCount: 15
        }
      };

      mockAxiosInstance.post = jest.fn().mockResolvedValue({ data: mockApiResponse });

      const response = await client.generateContent(mockRequest);

      expect(response.success).toBe(true);
      expect(response.content).toBe('Hello! I am doing well, thank you for asking.');
      expect(response.requestId).toBe('test-request-1');
      expect(response.usage?.totalTokens).toBe(15);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/v1/models/${config.model}:generateContent?key=${config.apiKey}`,
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              parts: [{ text: 'Hello, how are you?' }]
            })
          ])
        })
      );
    });

    it('should handle API errors', async () => {
      const mockAxiosInstance = mockedAxios.create();
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: { error: { message: 'Invalid request format' } }
        }
      };

      mockAxiosInstance.post = jest.fn().mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const response = await client.generateContent(mockRequest);

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('Bad request');
    });

    it('should validate request parameters', async () => {
      const invalidRequest = {
        id: '',
        timestamp: new Date(),
        prompt: ''
      };

      const response = await client.generateContent(invalidRequest);

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('Request ID is required');
    });

    it('should handle rate limiting', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.post = jest.fn().mockResolvedValue({
        data: {
          candidates: [{ content: { parts: [{ text: 'Response' }] } }]
        }
      });

      // Make requests up to the rate limit
      const requests = Array.from({ length: 60 }, (_, i) => ({
        id: `request-${i}`,
        timestamp: new Date(),
        prompt: `Test prompt ${i}`
      }));

      const responses = await Promise.all(
        requests.map(req => client.generateContent(req))
      );

      // All should succeed
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });

      // Next request should be queued
      const stats = client.getStatistics();
      expect(stats.rateLimitTokens).toBe(0);
    });

    it('should handle custom options', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.post = jest.fn().mockResolvedValue({
        data: {
          candidates: [{ content: { parts: [{ text: 'Response' }] } }]
        }
      });

      const requestWithOptions: GeminiRequest = {
        ...mockRequest,
        options: {
          temperature: 0.9,
          maxTokens: 1000,
          stopSequences: ['END']
        }
      };

      await client.generateContent(requestWithOptions);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            temperature: 0.9,
            maxOutputTokens: 1000,
            stopSequences: ['END']
          })
        })
      );
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embeddings successfully', async () => {
      const mockAxiosInstance = mockedAxios.create();
      const mockEmbeddingResponse = {
        embedding: {
          values: [0.1, 0.2, 0.3, 0.4, 0.5]
        }
      };

      mockAxiosInstance.post = jest.fn().mockResolvedValue({ data: mockEmbeddingResponse });

      const request = {
        id: 'embedding-test',
        text: 'This is a test sentence for embedding.'
      };

      const response = await client.generateEmbedding(request);

      expect(response.embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
      expect(response.requestId).toBe('embedding-test');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.stringContaining('embedContent'),
        expect.objectContaining({
          content: {
            parts: [{ text: request.text }]
          }
        })
      );
    });

    it('should handle embedding errors', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.post = jest.fn().mockRejectedValue(new Error('Embedding failed'));

      const request = {
        id: 'embedding-test',
        text: 'Test text'
      };

      const response = await client.generateEmbedding(request);

      expect(response.embedding).toEqual([]);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('Embedding failed');
    });
  });

  describe('generateContentStream', () => {
    it('should handle streaming responses', async () => {
      const mockAxiosInstance = mockedAxios.create();
      const mockStream = {
        on: jest.fn()
      };

      mockAxiosInstance.post = jest.fn().mockResolvedValue({ data: mockStream });

      const chunks: string[] = [];
      const onChunk = (chunk: string) => chunks.push(chunk);

      const testRequest: GeminiRequest = {
        id: 'stream-test-1',
        timestamp: new Date(),
        prompt: 'Hello, streaming test'
      };

      // Simulate stream events
      const streamPromise = client.generateContentStream(testRequest, onChunk);

      // Simulate data events immediately to ensure test completes
      setTimeout(() => {
        const dataCallback = mockStream.on.mock.calls.find(call => call[0] === 'data')?.[1];
        const endCallback = mockStream.on.mock.calls.find(call => call[0] === 'end')?.[1];

        if (dataCallback) {
          const mockChunk = Buffer.from('data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n');
          dataCallback(mockChunk);
        }

        if (endCallback) {
          endCallback();
        }
      }, 10);

      const response = await streamPromise;

      expect(response.success).toBe(true);
      expect(chunks).toContain('Hello');
    }, 10000);
  });

  describe('batchGenerate', () => {
    it('should process multiple requests in batches', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.post = jest.fn().mockResolvedValue({
        data: {
          candidates: [{ content: { parts: [{ text: 'Response' }] } }]
        }
      });

      const requests: GeminiRequest[] = [
        { id: 'req1', timestamp: new Date(), prompt: 'Prompt 1' },
        { id: 'req2', timestamp: new Date(), prompt: 'Prompt 2' },
        { id: 'req3', timestamp: new Date(), prompt: 'Prompt 3' }
      ];

      const responses = await client.batchGenerate(requests);

      expect(responses).toHaveLength(3);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });
    });

    it('should handle batch errors gracefully', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.post = jest.fn()
        .mockResolvedValueOnce({
          data: { candidates: [{ content: { parts: [{ text: 'Success' }] } }] }
        })
        .mockRejectedValueOnce(new Error('Failed'));

      const requests: GeminiRequest[] = [
        { id: 'req1', timestamp: new Date(), prompt: 'Prompt 1' },
        { id: 'req2', timestamp: new Date(), prompt: 'Prompt 2' }
      ];

      const responses = await client.batchGenerate(requests);

      expect(responses).toHaveLength(2);
      expect(responses[0].success).toBe(true);
      expect(responses[1].success).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return true when service is healthy', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.post = jest.fn().mockResolvedValue({
        data: {
          candidates: [{ content: { parts: [{ text: 'Hello' }] } }]
        }
      });

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should return false when service is unhealthy', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.post = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('statistics and configuration', () => {
    it('should track request statistics', async () => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.post = jest.fn().mockResolvedValue({
        data: {
          candidates: [{ content: { parts: [{ text: 'Response' }] } }]
        }
      });

      const initialStats = client.getStatistics();
      expect(initialStats.requestCount).toBe(0);

      const testRequest: GeminiRequest = {
        id: 'stats-test-1',
        timestamp: new Date(),
        prompt: 'Statistics test'
      };

      await client.generateContent(testRequest);

      const updatedStats = client.getStatistics();
      expect(updatedStats.requestCount).toBe(1);
      expect(updatedStats.errorRate).toBe(0);
      expect(updatedStats.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should update configuration', () => {
      const newConfig = { temperature: 0.9, maxTokens: 4096 };
      
      client.updateConfig(newConfig);
      
      const updatedConfig = client.getConfig();
      expect(updatedConfig.temperature).toBe(0.9);
      expect(updatedConfig.maxTokens).toBe(4096);
    });

    it('should emit events', (done) => {
      const mockAxiosInstance = mockedAxios.create();
      mockAxiosInstance.post = jest.fn().mockResolvedValue({
        data: {
          candidates: [{ content: { parts: [{ text: 'Response' }] } }]
        }
      });

      const eventTestRequest: GeminiRequest = {
        id: 'event-test-1',
        timestamp: new Date(),
        prompt: 'Event test'
      };

      client.on('contentGenerated', ({ request, response }) => {
        expect(request.id).toBe('event-test-1');
        expect(response.success).toBe(true);
        done();
      });

      client.generateContent(eventTestRequest);
    });
  });
});