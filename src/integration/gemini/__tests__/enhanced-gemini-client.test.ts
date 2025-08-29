/**
 * Unit tests for Enhanced Gemini client
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { EnhancedGeminiClient, EnhancedGeminiRequest } from '../enhanced-gemini-client';
import { GeminiConfig } from '../../../types';

// Mock the Google Generative AI SDK
jest.mock('@google/generative-ai');

describe('EnhancedGeminiClient', () => {
  let client: EnhancedGeminiClient;
  let config: GeminiConfig;
  let mockGenAI: jest.Mocked<GoogleGenerativeAI>;
  let mockModel: any;

  beforeEach(() => {
    config = {
      apiKey: 'test-api-key',
      model: 'gemini-pro',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      maxTokens: 2048,
      temperature: 0.7,
      rateLimitPerMinute: 60
    };

    // Mock the model
    mockModel = {
      generateContent: jest.fn(),
      generateContentStream: jest.fn()
    };

    // Mock GoogleGenerativeAI
    mockGenAI = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel)
    } as any;

    (GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>).mockImplementation(() => mockGenAI);

    client = new EnhancedGeminiClient(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(GoogleGenerativeAI).toHaveBeenCalledWith(config.apiKey);
      expect(mockGenAI.getGenerativeModel).toHaveBeenCalledWith({ model: config.model });
    });

    it('should initialize rate limiter', () => {
      const stats = client.getStatistics();
      expect(stats.rateLimitTokens).toBe(60);
      expect(stats.queueLength).toBe(0);
    });
  });

  describe('generateContent', () => {
    let mockRequest: EnhancedGeminiRequest;

    beforeEach(() => {
      mockRequest = {
        id: 'test-request-1',
        timestamp: new Date(),
        prompt: 'Hello, how are you?'
      };
    });

    it('should generate content successfully', async () => {
      const mockResponse = {
        response: {
          text: () => 'Hello! I am doing well, thank you for asking.',
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 10,
            totalTokenCount: 15
          },
          candidates: [{ finishReason: 'STOP' }]
        }
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const response = await client.generateContent(mockRequest);

      expect(response.success).toBe(true);
      expect(response.content).toBe('Hello! I am doing well, thank you for asking.');
      expect(response.requestId).toBe('test-request-1');
      expect(response.usage?.totalTokens).toBe(15);
      expect(response.finishReason).toBe('STOP');
    });

    it('should handle system instructions', async () => {
      const requestWithSystemInstruction: EnhancedGeminiRequest = {
        ...mockRequest,
        systemInstruction: 'You are a helpful assistant.'
      };

      const mockResponse = {
        response: {
          text: () => 'I understand. How can I help you?',
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 8, totalTokenCount: 13 },
          candidates: [{ finishReason: 'STOP' }]
        }
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await client.generateContent(requestWithSystemInstruction);

      // The enhanced client includes system instruction in the prompt
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: [{ 
            role: 'user', 
            parts: [{ text: 'You are a helpful assistant.\n\nUser: Hello, how are you?' }] 
          }]
        })
      );
    });

    it('should handle custom options', async () => {
      const requestWithOptions: EnhancedGeminiRequest = {
        ...mockRequest,
        options: {
          temperature: 0.9,
          maxTokens: 1000,
          topP: 0.9,
          topK: 50,
          stopSequences: ['END']
        }
      };

      const mockResponse = {
        response: {
          text: () => 'Response with custom options',
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 10 },
          candidates: [{ finishReason: 'STOP' }]
        }
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const response = await client.generateContent(requestWithOptions);

      expect(response.success).toBe(true);
      expect(mockModel.generateContent).toHaveBeenCalledWith({
        contents: [{ role: 'user', parts: [{ text: mockRequest.prompt }] }],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.9,
          topP: 0.9,
          topK: 50,
          stopSequences: ['END']
        },
        safetySettings: expect.any(Array)
      });
    });

    it('should handle API errors with retry logic', async () => {
      const error = new Error('API rate limit exceeded');
      mockModel.generateContent
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          response: {
            text: () => 'Success after retries',
            usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 10 },
            candidates: [{ finishReason: 'STOP' }]
          }
        });

      const response = await client.generateContent(mockRequest);

      expect(response.success).toBe(true);
      expect(response.content).toBe('Success after retries');
      expect(mockModel.generateContent).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const error = new Error('Invalid API key');
      mockModel.generateContent.mockRejectedValue(error);

      const response = await client.generateContent(mockRequest);

      expect(response.success).toBe(false);
      expect(response.error?.message).toBe('Invalid API key');
      expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
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
      const mockResponse = {
        response: {
          text: () => 'Response',
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 10 },
          candidates: [{ finishReason: 'STOP' }]
        }
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

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

      // Check rate limit tokens are consumed
      const stats = client.getStatistics();
      expect(stats.rateLimitTokens).toBe(0);
    });
  });

  describe('generateContentStream', () => {
    it('should handle streaming responses', async () => {
      const mockStream = {
        stream: (async function* () {
          yield { text: () => 'Hello' };
          yield { text: () => ' world' };
        })(),
        response: Promise.resolve({
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 10 },
          candidates: [{ finishReason: 'STOP' }]
        })
      };

      mockModel.generateContentStream.mockResolvedValue(mockStream);

      const chunks: string[] = [];
      const onChunk = (chunk: string) => chunks.push(chunk);

      const testRequest: EnhancedGeminiRequest = {
        id: 'stream-test-1',
        timestamp: new Date(),
        prompt: 'Hello, streaming test'
      };

      const response = await client.generateContentStream(testRequest, onChunk);

      expect(response.success).toBe(true);
      expect(response.content).toBe('Hello world');
      expect(chunks).toEqual(['Hello', ' world']);
    });

    it('should handle streaming errors', async () => {
      const error = new Error('Streaming failed');
      mockModel.generateContentStream.mockRejectedValue(error);

      const onChunk = jest.fn();
      const testRequest: EnhancedGeminiRequest = {
        id: 'stream-error-test',
        timestamp: new Date(),
        prompt: 'Test prompt'
      };

      const response = await client.generateContentStream(testRequest, onChunk);

      expect(response.success).toBe(false);
      expect(response.error?.message).toBe('Streaming failed');
      expect(onChunk).not.toHaveBeenCalled();
    });
  });

  describe('generateStructuredResponse', () => {
    it('should generate and parse JSON response', async () => {
      const mockResponse = {
        response: {
          text: () => '{"name": "John", "age": 30}',
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8, totalTokenCount: 18 },
          candidates: [{ finishReason: 'STOP' }]
        }
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const testRequest: EnhancedGeminiRequest = {
        id: 'json-test-1',
        timestamp: new Date(),
        prompt: 'Generate a person object'
      };

      const schema = { name: 'string', age: 'number' };
      const response = await client.generateStructuredResponse(testRequest, schema);

      expect(response.success).toBe(true);
      expect(response.structuredData).toEqual({ name: 'John', age: 30 });
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        response: {
          text: () => 'This is not valid JSON',
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
          candidates: [{ finishReason: 'STOP' }]
        }
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const testRequest: EnhancedGeminiRequest = {
        id: 'invalid-json-test',
        timestamp: new Date(),
        prompt: 'Generate JSON'
      };

      const response = await client.generateStructuredResponse(testRequest);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('JSON_PARSE_ERROR');
    });
  });

  describe('batchGenerate', () => {
    it('should process multiple requests in batches', async () => {
      const mockResponse = {
        response: {
          text: () => 'Response',
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 10 },
          candidates: [{ finishReason: 'STOP' }]
        }
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const requests: EnhancedGeminiRequest[] = [
        { id: 'req1', timestamp: new Date(), prompt: 'Prompt 1' },
        { id: 'req2', timestamp: new Date(), prompt: 'Prompt 2' },
        { id: 'req3', timestamp: new Date(), prompt: 'Prompt 3' }
      ];

      const responses = await client.batchGenerate(requests, 2);

      expect(responses).toHaveLength(3);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });
    });

    it('should handle batch errors gracefully', async () => {
      mockModel.generateContent
        .mockResolvedValueOnce({
          response: {
            text: () => 'Success',
            usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 10 },
            candidates: [{ finishReason: 'STOP' }]
          }
        })
        .mockRejectedValueOnce(new Error('Failed'));

      const requests: EnhancedGeminiRequest[] = [
        { id: 'req1', timestamp: new Date(), prompt: 'Prompt 1' },
        { id: 'req2', timestamp: new Date(), prompt: 'Prompt 2' }
      ];

      const responses = await client.batchGenerate(requests, 2);

      expect(responses).toHaveLength(2);
      expect(responses[0].success).toBe(true);
      expect(responses[1].success).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return true when service is healthy', async () => {
      const mockResponse = {
        response: {
          text: () => 'Hello',
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
          candidates: [{ finishReason: 'STOP' }]
        }
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should return false when service is unhealthy', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('Service unavailable'));

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('configuration and statistics', () => {
    it('should track request statistics', async () => {
      const mockResponse = {
        response: {
          text: () => 'Response',
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 10 },
          candidates: [{ finishReason: 'STOP' }]
        }
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const initialStats = client.getStatistics();
      expect(initialStats.requestCount).toBe(0);

      const testRequest: EnhancedGeminiRequest = {
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

    it('should update retry configuration', () => {
      const newRetryConfig = { maxAttempts: 5, initialDelay: 2000 };
      
      client.updateRetryConfig(newRetryConfig);
      
      // Test that retry config is updated by checking behavior
      expect(() => client.updateRetryConfig(newRetryConfig)).not.toThrow();
    });

    it('should emit events', (done) => {
      const mockResponse = {
        response: {
          text: () => 'Response',
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 10 },
          candidates: [{ finishReason: 'STOP' }]
        }
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const eventTestRequest: EnhancedGeminiRequest = {
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