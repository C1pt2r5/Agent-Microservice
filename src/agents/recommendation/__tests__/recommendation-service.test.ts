/**
 * Integration tests for Recommendation Service
 */

import request from 'supertest';
import { RecommendationService, RecommendationServiceConfig } from '../recommendation-service';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let config: RecommendationServiceConfig;

  beforeEach(() => {
    config = {
      id: 'recommendation-service-1',
      name: 'Recommendation Service',
      type: 'recommendation',
      version: '1.0.0',
      environment: 'development',
      mcpEndpoint: {
        url: 'http://localhost:8080',
        timeout: 30000,
        retryAttempts: 3,
        circuitBreakerThreshold: 5
      },
      a2aEndpoint: {
        url: 'http://localhost:8081',
        timeout: 30000,
        retryAttempts: 3,
        circuitBreakerThreshold: 5
      },
      geminiConfig: {
        apiKey: 'test-key',
        model: 'gemini-pro',
        endpoint: 'https://api.gemini.com',
        maxTokens: 2048,
        temperature: 0.7,
        rateLimitPerMinute: 60
      },
      capabilities: [],
      server: {
        port: 0, // Use random port for testing
        host: 'localhost',
        cors: {
          enabled: true,
          origins: ['*']
        }
      },
      api: {
        rateLimit: {
          windowMs: 60000,
          maxRequests: 100
        },
        authentication: {
          enabled: false,
          apiKeyHeader: 'x-api-key'
        }
      },
      caching: {
        enabled: true,
        ttl: 300000, // 5 minutes
        maxSize: 1000,
        strategy: 'lru'
      },
      analytics: {
        enabled: true,
        trackingEvents: ['recommendations_generated', 'user_interaction'],
        batchSize: 10,
        flushInterval: 5000
      },
      monitoring: {
        metricsEnabled: true,
        loggingLevel: 'info'
      }
    };

    service = new RecommendationService(config);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('service lifecycle', () => {
    it('should initialize service successfully', async () => {
      // Mock agent dependencies
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      const initPromise = service.initialize();
      
      const startEvent = new Promise(resolve => {
        service.once('serviceStarted', resolve);
      });

      await expect(initPromise).resolves.not.toThrow();
      await expect(startEvent).resolves.toBeDefined();
    });

    it('should shutdown gracefully', async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();

      const shutdownPromise = new Promise(resolve => {
        service.once('serviceShutdown', resolve);
      });

      await service.shutdown();

      await expect(shutdownPromise).resolves.toBeDefined();
    });
  });

  describe('REST API endpoints', () => {
    beforeEach(async () => {
      // Mock agent methods
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({
        products: [
          {
            productId: 'prod_1',
            name: 'Test Product',
            category: 'electronics',
            price: 199
          }
        ]
      });
      
      jest.spyOn(service['agent'], 'generateRecommendations').mockResolvedValue({
        recommendations: [
          {
            recommendationId: 'rec_1',
            userId: 'user_123',
            productId: 'prod_1',
            score: 0.8,
            confidence: 0.9,
            reasoning: 'Test recommendation',
            algorithm: 'test',
            context: {},
            metadata: {}
          }
        ],
        totalCount: 1,
        algorithms: ['test'],
        processingTime: 100,
        cacheHit: false
      });

      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();
    });

    it('should handle health check', async () => {
      const response = await request(service['app'])
        .get('/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.metrics).toBeDefined();
      expect(response.body.agentHealth).toBeDefined();
      expect(response.body.cacheStats).toBeDefined();
    });

    it('should generate recommendations', async () => {
      const response = await request(service['app'])
        .post('/api/recommendations')
        .send({
          userId: 'user_123',
          context: { currentPage: 'home' },
          count: 5,
          type: 'personalized'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations).toBeDefined();
      expect(response.body.data.recommendations).toHaveLength(1);
      expect(response.body.cached).toBe(false);
    });

    it('should return cached recommendations on second request', async () => {
      const requestData = {
        userId: 'user_123',
        context: { currentPage: 'home' },
        count: 5,
        type: 'personalized'
      };

      // First request
      await request(service['app'])
        .post('/api/recommendations')
        .send(requestData)
        .expect(200);

      // Second request should hit cache
      const response = await request(service['app'])
        .post('/api/recommendations')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.cached).toBe(true);
    });

    it('should get user recommendations', async () => {
      const response = await request(service['app'])
        .get('/api/recommendations/user_123?count=3&type=personalized')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations).toBeDefined();
    });

    it('should get similar users', async () => {
      jest.spyOn(service['agent'] as any, 'findSimilarUsers').mockResolvedValue([
        {
          userId1: 'user_123',
          userId2: 'user_456',
          score: 0.8,
          commonItems: ['prod_1'],
          algorithm: 'cosine'
        }
      ]);

      const response = await request(service['app'])
        .post('/api/recommendations/similar-users')
        .send({ userId: 'user_123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].userId2).toBe('user_456');
    });

    it('should get product information', async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({
        productId: 'prod_1',
        name: 'Test Product',
        category: 'electronics',
        price: 199
      });

      const response = await request(service['app'])
        .get('/api/products/prod_1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.productId).toBe('prod_1');
    });

    it('should get user profile', async () => {
      jest.spyOn(service['agent'] as any, 'getUserProfile').mockResolvedValue({
        userId: 'user_123',
        demographics: { age: 30 },
        preferences: { categories: ['electronics'] }
      });

      const response = await request(service['app'])
        .get('/api/users/user_123/profile')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe('user_123');
    });

    it('should track user interactions', async () => {
      const response = await request(service['app'])
        .post('/api/users/user_123/interactions')
        .send({
          productId: 'prod_1',
          action: 'view',
          metadata: { duration: 30 }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('tracked successfully');
    });

    it('should record feedback', async () => {
      const response = await request(service['app'])
        .post('/api/feedback')
        .send({
          userId: 'user_123',
          recommendationId: 'rec_1',
          rating: 5,
          feedback: 'Great recommendation!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('recorded successfully');
    });

    it('should track events', async () => {
      const response = await request(service['app'])
        .post('/api/events')
        .send({
          userId: 'user_123',
          eventType: 'product_view',
          data: { productId: 'prod_1' }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('tracked successfully');
    });

    it('should clear cache', async () => {
      // First, populate cache
      await request(service['app'])
        .post('/api/recommendations')
        .send({
          userId: 'user_123',
          context: {},
          count: 5,
          type: 'personalized'
        });

      // Clear cache
      const response = await request(service['app'])
        .delete('/api/cache')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cleared successfully');
    });

    it('should get cache statistics', async () => {
      const response = await request(service['app'])
        .get('/api/cache/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.size).toBeDefined();
      expect(response.body.data.maxSize).toBe(config.caching.maxSize);
    });

    it('should get service statistics', async () => {
      const response = await request(service['app'])
        .get('/api/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.service).toBeDefined();
      expect(response.body.data.analytics).toBeDefined();
    });

    it('should get metrics', async () => {
      const response = await request(service['app'])
        .get('/api/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRequests).toBeDefined();
      expect(response.body.data.cacheHitRate).toBeDefined();
    });

    it('should handle missing userId in recommendations', async () => {
      const response = await request(service['app'])
        .post('/api/recommendations')
        .send({
          context: {},
          count: 5
        })
        .expect(400);

      expect(response.body.error).toBe('Missing required field: userId');
    });

    it('should handle product not found', async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue(null);

      const response = await request(service['app'])
        .get('/api/products/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Product not found');
    });
  });

  describe('caching functionality', () => {
    beforeEach(async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'], 'generateRecommendations').mockResolvedValue({
        recommendations: [],
        totalCount: 0,
        algorithms: ['test'],
        processingTime: 100,
        cacheHit: false
      });
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();
    });

    it('should cache and retrieve data correctly', async () => {
      const testData = { test: 'data' };
      const cacheKey = 'test_key';
      const ttl = 60000;

      // Set cache
      service['setCache'](cacheKey, testData, ttl);

      // Get from cache
      const retrieved = service['getFromCache'](cacheKey);

      expect(retrieved).toEqual(testData);
    });

    it('should expire cache entries based on TTL', async () => {
      const testData = { test: 'data' };
      const cacheKey = 'test_key';
      const ttl = 100; // Very short TTL

      service['setCache'](cacheKey, testData, ttl);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const retrieved = service['getFromCache'](cacheKey);
      expect(retrieved).toBeNull();
    });

    it('should evict cache entries when max size reached', async () => {
      // Set a small max size for testing
      config.caching.maxSize = 3;
      const testService = new RecommendationService(config);

      // Fill cache beyond max size
      for (let i = 0; i < 5; i++) {
        testService['setCache'](`key_${i}`, { data: i }, 60000);
      }

      expect(testService['cache'].size).toBeLessThanOrEqual(3);
    });

    it('should invalidate user-specific caches', async () => {
      const userId = 'user_123';
      const cacheKey = service['generateCacheKey']('recommendations', { userId, type: 'test' });
      
      service['setCache'](cacheKey, { test: 'data' }, 60000);
      expect(service['getFromCache'](cacheKey)).toBeTruthy();

      service['invalidateUserCaches'](userId);
      expect(service['getFromCache'](cacheKey)).toBeNull();
    });
  });

  describe('analytics functionality', () => {
    beforeEach(async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();
    });

    it('should track analytics events', async () => {
      const event = {
        eventType: 'test_event',
        userId: 'user_123',
        data: { test: 'data' }
      };

      service['trackAnalyticsEvent'](event);

      expect(service['analyticsQueue']).toHaveLength(1);
      expect(service['analyticsQueue'][0].eventType).toBe('test_event');
    });

    it('should flush analytics when batch size reached', async () => {
      const flushSpy = jest.spyOn(service as any, 'flushAnalytics').mockResolvedValue(undefined);

      // Add events to reach batch size
      for (let i = 0; i < config.analytics.batchSize; i++) {
        service['trackAnalyticsEvent']({
          eventType: 'test_event',
          userId: `user_${i}`,
          data: {}
        });
      }

      expect(flushSpy).toHaveBeenCalled();
    });
  });

  describe('A2A message handling', () => {
    beforeEach(async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();
    });

    it('should handle user behavior updates', (done) => {
      const payload = {
        userId: 'user_123',
        behaviorType: 'purchase',
        data: { productId: 'prod_1' }
      };

      service.once('userBehaviorUpdated', (receivedPayload) => {
        expect(receivedPayload.userId).toBe('user_123');
        done();
      });

      service['handleA2AMessage']({
        messageType: 'user-behavior-update',
        payload
      });
    });

    it('should handle fraud alerts', (done) => {
      const payload = {
        userId: 'user_123',
        alertType: 'high_risk_transaction',
        transactionId: 'txn_456'
      };

      service.once('fraudAlertReceived', (receivedPayload) => {
        expect(receivedPayload.userId).toBe('user_123');
        done();
      });

      service['handleA2AMessage']({
        messageType: 'fraud-alert',
        payload
      });
    });

    it('should handle interaction tracking', (done) => {
      const payload = {
        userId: 'user_123',
        productId: 'prod_1',
        action: 'view'
      };

      service.once('interactionTracked', (receivedPayload) => {
        expect(receivedPayload.userId).toBe('user_123');
        done();
      });

      service['handleA2AMessage']({
        messageType: 'interaction-tracked',
        payload
      });
    });
  });

  describe('rate limiting', () => {
    beforeEach(async () => {
      // Enable rate limiting for this test
      config.api.rateLimit.maxRequests = 2;
      config.api.rateLimit.windowMs = 1000;
      
      service = new RecommendationService(config);
      
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();
    });

    it('should enforce rate limits', async () => {
      // First request should succeed
      await request(service['app'])
        .get('/api/stats')
        .expect(200);

      // Second request should succeed
      await request(service['app'])
        .get('/api/stats')
        .expect(200);

      // Third request should be rate limited
      const response = await request(service['app'])
        .get('/api/stats')
        .expect(429);

      expect(response.body.error).toBe('Rate limit exceeded');
      expect(response.body.retryAfter).toBeDefined();
    });
  });

  describe('authentication', () => {
    beforeEach(async () => {
      // Enable authentication for this test
      config.api.authentication.enabled = true;
      
      service = new RecommendationService(config);
      
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();
    });

    it('should require API key when authentication is enabled', async () => {
      const response = await request(service['app'])
        .get('/api/stats')
        .expect(401);

      expect(response.body.error).toBe('Missing API key');
    });

    it('should accept valid API key', async () => {
      await request(service['app'])
        .get('/api/stats')
        .set('x-api-key', 'valid-api-key-123')
        .expect(200);
    });

    it('should reject invalid API key', async () => {
      const response = await request(service['app'])
        .get('/api/stats')
        .set('x-api-key', 'short')
        .expect(401);

      expect(response.body.error).toBe('Invalid API key');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();
    });

    it('should handle recommendation generation errors', async () => {
      // Mock agent to throw error
      jest.spyOn(service['agent'], 'generateRecommendations').mockRejectedValue(new Error('Generation failed'));

      const response = await request(service['app'])
        .post('/api/recommendations')
        .send({
          userId: 'user_123',
          context: {},
          count: 5,
          type: 'personalized'
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to generate recommendations');
    });

    it('should handle MCP errors gracefully', async () => {
      // Mock MCP to throw error
      jest.spyOn(service['agent'] as any, 'queryMCP').mockRejectedValue(new Error('MCP error'));

      const response = await request(service['app'])
        .get('/api/products/prod_1')
        .expect(500);

      expect(response.body.error).toBe('Failed to get product');
    });

    it('should handle analytics flush errors', async () => {
      // Mock MCP to throw error for analytics
      jest.spyOn(service['agent'] as any, 'queryMCP')
        .mockImplementation((service, operation) => {
          if (operation === 'batchTrackEvents') {
            return Promise.reject(new Error('Analytics error'));
          }
          return Promise.resolve({});
        });

      // Should not throw error
      await expect(service['flushAnalytics']()).resolves.not.toThrow();
    });
  });
});