/**
 * Unit tests for Recommendation Agent
 */

import { RecommendationAgent, RecommendationRequest, User, Product } from '../recommendation-agent';
import { AgentConfig } from '../../../types';

describe('RecommendationAgent', () => {
  let agent: RecommendationAgent;
  let config: AgentConfig;
  let mockUser: User;
  let mockProducts: Product[];

  beforeEach(() => {
    config = {
      id: 'recommendation-1',
      name: 'Recommendation Agent',
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
      capabilities: []
    };

    mockUser = {
      userId: 'user_123',
      demographics: {
        age: 30,
        gender: 'female',
        location: 'New York',
        income: 'medium'
      },
      preferences: {
        categories: ['electronics', 'books'],
        brands: ['Apple', 'Samsung'],
        priceRange: { min: 50, max: 500 },
        features: ['wireless', 'portable', 'high-quality']
      },
      behavior: {
        purchaseHistory: [
          {
            purchaseId: 'p1',
            productId: 'prod_1',
            userId: 'user_123',
            amount: 299,
            timestamp: new Date(),
            category: 'electronics',
            rating: 5
          },
          {
            purchaseId: 'p2',
            productId: 'prod_2',
            userId: 'user_123',
            amount: 25,
            timestamp: new Date(),
            category: 'books',
            rating: 4
          }
        ],
        browsingHistory: [],
        interactionHistory: []
      },
      profile: {
        riskTolerance: 'medium',
        investmentGoals: ['retirement', 'education']
      }
    };

    mockProducts = [
      {
        productId: 'prod_3',
        name: 'Wireless Headphones',
        category: 'electronics',
        brand: 'Apple',
        price: 199,
        features: ['wireless', 'noise-canceling', 'high-quality'],
        description: 'Premium wireless headphones with noise canceling',
        tags: ['audio', 'premium'],
        availability: true,
        rating: 4.5,
        reviewCount: 1250,
        metadata: {}
      },
      {
        productId: 'prod_4',
        name: 'Programming Book',
        category: 'books',
        brand: 'TechBooks',
        price: 45,
        features: ['educational', 'technical', 'comprehensive'],
        description: 'Complete guide to modern programming',
        tags: ['programming', 'education'],
        availability: true,
        rating: 4.2,
        reviewCount: 890,
        metadata: {}
      },
      {
        productId: 'prod_5',
        name: 'Expensive Watch',
        category: 'accessories',
        brand: 'Luxury',
        price: 2000,
        features: ['premium', 'luxury', 'mechanical'],
        description: 'Luxury mechanical watch',
        tags: ['luxury', 'timepiece'],
        availability: true,
        rating: 4.8,
        reviewCount: 150,
        metadata: {}
      }
    ];

    agent = new RecommendationAgent(config);
  });

  afterEach(async () => {
    if (agent && agent.isAgentHealthy()) {
      await agent.shutdown();
    }
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('recommendation generation', () => {
    beforeEach(() => {
      // Mock MCP calls
      jest.spyOn(agent as any, 'queryMCP')
        .mockImplementation((service, operation, params) => {
          if (operation === 'getUserProfile') {
            return Promise.resolve({
              demographics: mockUser.demographics,
              preferences: mockUser.preferences,
              profile: mockUser.profile
            });
          }
          if (operation === 'getUserPurchases') {
            return Promise.resolve({ purchases: mockUser.behavior.purchaseHistory });
          }
          if (operation === 'getProducts') {
            return Promise.resolve({ products: mockProducts });
          }
          if (operation === 'getUsersWithPurchases') {
            return Promise.resolve({ users: [] });
          }
          return Promise.resolve({});
        });
    });

    it('should generate recommendations successfully', async () => {
      const request: RecommendationRequest = {
        userId: 'user_123',
        context: {
          currentPage: 'home',
          timeOfDay: 'evening'
        },
        count: 5,
        type: 'personalized'
      };

      const response = await agent.generateRecommendations(request);

      expect(response).toBeDefined();
      expect(response.recommendations).toBeDefined();
      expect(response.totalCount).toBeGreaterThanOrEqual(0);
      expect(response.algorithms).toBeDefined();
      expect(response.processingTime).toBeGreaterThan(0);
      expect(response.cacheHit).toBe(false);
    });

    it('should generate content-based recommendations', async () => {
      const request: RecommendationRequest = {
        userId: 'user_123',
        context: {},
        count: 3,
        type: 'personalized'
      };

      const response = await agent.generateRecommendations(request);

      // Should recommend products matching user preferences
      const electronicsRec = response.recommendations.find(r => 
        mockProducts.find(p => p.productId === r.productId)?.category === 'electronics'
      );

      if (electronicsRec) {
        expect(electronicsRec.algorithm).toContain('content-based');
        expect(electronicsRec.score).toBeGreaterThan(0);
        expect(electronicsRec.reasoning).toContain('matches your interest');
      }
    });

    it('should handle empty product catalog', async () => {
      // Mock empty product response
      jest.spyOn(agent as any, 'queryMCP')
        .mockImplementation((service, operation) => {
          if (operation === 'getProducts') {
            return Promise.resolve({ products: [] });
          }
          return Promise.resolve({});
        });

      const request: RecommendationRequest = {
        userId: 'user_123',
        context: {},
        count: 5,
        type: 'personalized'
      };

      const response = await agent.generateRecommendations(request);

      expect(response.recommendations).toHaveLength(0);
      expect(response.totalCount).toBe(0);
    });

    it('should apply filters correctly', async () => {
      const request: RecommendationRequest = {
        userId: 'user_123',
        context: {},
        count: 5,
        type: 'personalized',
        filters: {
          categories: ['electronics'],
          priceRange: { min: 100, max: 300 }
        }
      };

      const response = await agent.generateRecommendations(request);

      // All recommendations should match filters (if any are returned)
      for (const rec of response.recommendations) {
        const product = mockProducts.find(p => p.productId === rec.productId);
        if (product) {
          expect(product.category).toBe('electronics');
          expect(product.price).toBeGreaterThanOrEqual(100);
          expect(product.price).toBeLessThanOrEqual(300);
        }
      }
    });

    it('should exclude specified products', async () => {
      const request: RecommendationRequest = {
        userId: 'user_123',
        context: {},
        count: 5,
        type: 'personalized',
        excludeProducts: ['prod_3', 'prod_4']
      };

      const response = await agent.generateRecommendations(request);

      // Should not recommend excluded products
      const excludedRecs = response.recommendations.filter(r => 
        ['prod_3', 'prod_4'].includes(r.productId)
      );

      expect(excludedRecs).toHaveLength(0);
    });
  });

  describe('collaborative filtering', () => {
    beforeEach(() => {
      // Mock similar users data
      jest.spyOn(agent as any, 'findSimilarUsers').mockResolvedValue([
        {
          userId1: 'user_123',
          userId2: 'user_456',
          score: 0.8,
          commonItems: ['prod_1', 'prod_2'],
          algorithm: 'cosine'
        },
        {
          userId1: 'user_123',
          userId2: 'user_789',
          score: 0.6,
          commonItems: ['prod_1'],
          algorithm: 'cosine'
        }
      ]);

      jest.spyOn(agent as any, 'getProductsLikedBySimilarUsers').mockResolvedValue(['prod_3', 'prod_4']);
    });

    it('should generate collaborative recommendations', async () => {
      const user = mockUser;
      const products = mockProducts;
      const request: RecommendationRequest = {
        userId: 'user_123',
        context: {},
        count: 3,
        type: 'personalized'
      };

      const recommendations = await agent['generateCollaborativeRecommendations'](user, products, request);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      
      if (recommendations.length > 0) {
        expect(recommendations[0].algorithm).toBe('collaborative');
        expect(recommendations[0].score).toBeGreaterThan(0);
        expect(recommendations[0].reasoning).toContain('similar users');
      }
    });

    it('should handle insufficient similar users', async () => {
      // Mock insufficient similar users
      jest.spyOn(agent as any, 'findSimilarUsers').mockResolvedValue([]);

      const user = mockUser;
      const products = mockProducts;
      const request: RecommendationRequest = {
        userId: 'user_123',
        context: {},
        count: 3,
        type: 'personalized'
      };

      const recommendations = await agent['generateCollaborativeRecommendations'](user, products, request);

      expect(recommendations).toHaveLength(0);
    });
  });

  describe('content-based filtering', () => {
    it('should generate content-based recommendations', async () => {
      const user = mockUser;
      const products = mockProducts;
      const request: RecommendationRequest = {
        userId: 'user_123',
        context: {},
        count: 3,
        type: 'personalized'
      };

      const recommendations = await agent['generateContentBasedRecommendations'](user, products, request);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);

      // Should recommend products matching user preferences
      const electronicsRec = recommendations.find(r => r.productId === 'prod_3');
      if (electronicsRec) {
        expect(electronicsRec.algorithm).toBe('content-based');
        expect(electronicsRec.score).toBeGreaterThan(0);
        expect(electronicsRec.reasoning).toContain('electronics');
      }
    });

    it('should calculate content similarity correctly', async () => {
      const product = mockProducts[0]; // Wireless Headphones
      const userProfile = agent['buildUserPreferenceProfile'](mockUser);

      const score = agent['calculateContentSimilarityScore'](product, userProfile);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should build user preference profile correctly', async () => {
      const profile = agent['buildUserPreferenceProfile'](mockUser);

      expect(profile.preferredCategories).toContain('electronics');
      expect(profile.preferredCategories).toContain('books');
      expect(profile.averagePrice).toBeGreaterThan(0);
      expect(profile.priceRange.min).toBeDefined();
      expect(profile.priceRange.max).toBeDefined();
    });
  });

  describe('user similarity calculation', () => {
    it('should calculate user similarity correctly', async () => {
      const userPurchases = mockUser.behavior.purchaseHistory;
      const otherPurchases = [
        {
          purchaseId: 'p3',
          productId: 'prod_1', // Common with user
          userId: 'user_456',
          amount: 299,
          timestamp: new Date(),
          category: 'electronics',
          rating: 4
        },
        {
          purchaseId: 'p4',
          productId: 'prod_3', // Different from user
          userId: 'user_456',
          amount: 199,
          timestamp: new Date(),
          category: 'electronics',
          rating: 5
        }
      ];

      const similarity = agent['calculateUserSimilarity'](userPurchases, otherPurchases);

      expect(similarity.score).toBeGreaterThan(0);
      expect(similarity.commonItems).toContain('prod_1');
    });

    it('should return zero similarity for no common items', async () => {
      const userPurchases = mockUser.behavior.purchaseHistory;
      const otherPurchases = [
        {
          purchaseId: 'p5',
          productId: 'prod_999', // No common items
          userId: 'user_456',
          amount: 100,
          timestamp: new Date(),
          category: 'other',
          rating: 3
        }
      ];

      const similarity = agent['calculateUserSimilarity'](userPurchases, otherPurchases);

      expect(similarity.score).toBe(0);
      expect(similarity.commonItems).toHaveLength(0);
    });
  });

  describe('recommendation merging and ranking', () => {
    it('should merge recommendations from different algorithms', async () => {
      const recommendations = [
        {
          recommendationId: 'rec1',
          userId: 'user_123',
          productId: 'prod_3',
          score: 0.8,
          confidence: 0.9,
          reasoning: 'Content-based',
          algorithm: 'content-based',
          context: {},
          metadata: {}
        },
        {
          recommendationId: 'rec2',
          userId: 'user_123',
          productId: 'prod_3', // Same product
          score: 0.6,
          confidence: 0.7,
          reasoning: 'Collaborative',
          algorithm: 'collaborative',
          context: {},
          metadata: {}
        },
        {
          recommendationId: 'rec3',
          userId: 'user_123',
          productId: 'prod_4',
          score: 0.5,
          confidence: 0.6,
          reasoning: 'AI-based',
          algorithm: 'ai-personalized',
          context: {},
          metadata: {}
        }
      ];

      const merged = await agent['mergeAndRankRecommendations'](recommendations, 5);

      expect(merged).toHaveLength(2); // Two unique products
      
      // First recommendation should be the merged one with higher score
      const mergedRec = merged.find(r => r.productId === 'prod_3');
      expect(mergedRec).toBeDefined();
      expect(mergedRec!.score).toBe(0.8 + 0.6); // Sum of scores
      expect(mergedRec!.algorithm).toContain('+'); // Combined algorithms
    });

    it('should apply diversity filter', async () => {
      const recommendations = Array.from({ length: 10 }, (_, i) => ({
        recommendationId: `rec${i}`,
        userId: 'user_123',
        productId: `prod_${i}`,
        score: 1 - (i * 0.1),
        confidence: 0.8,
        reasoning: 'Test',
        algorithm: 'test',
        context: {},
        metadata: { category: i < 5 ? 'electronics' : 'books' }
      }));

      const diverse = agent['applyDiversityFilter'](recommendations, 5);

      expect(diverse).toHaveLength(5);
      
      // Should have products from different categories
      const categories = diverse.map(r => r.metadata?.category);
      const uniqueCategories = new Set(categories);
      expect(uniqueCategories.size).toBeGreaterThan(1);
    });
  });

  describe('processRequest', () => {
    beforeEach(() => {
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({});
    });

    it('should handle generate_recommendations action', async () => {
      const request = {
        id: 'req_123',
        timestamp: new Date(),
        correlationId: 'corr_123',
        payload: {
          action: 'generate_recommendations',
          payload: {
            userId: 'user_123',
            context: {},
            count: 5,
            type: 'personalized'
          }
        }
      };

      const response = await agent.processRequest(request);

      expect(response.success).toBe(true);
      expect(response.payload?.response).toBeDefined();
    });

    it('should handle get_similar_users action', async () => {
      jest.spyOn(agent as any, 'findSimilarUsers').mockResolvedValue([]);

      const request = {
        id: 'req_124',
        timestamp: new Date(),
        correlationId: 'corr_124',
        payload: {
          action: 'get_similar_users',
          payload: { userId: 'user_123' }
        }
      };

      const response = await agent.processRequest(request);

      expect(response.success).toBe(true);
      expect(response.payload?.similarUsers).toBeDefined();
    });

    it('should handle unknown action with error', async () => {
      const request = {
        id: 'req_125',
        timestamp: new Date(),
        correlationId: 'corr_125',
        payload: {
          action: 'unknown_action',
          payload: {}
        }
      };

      const response = await agent.processRequest(request);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('INVALID_ACTION');
    });
  });

  describe('error handling', () => {
    it('should handle MCP errors gracefully', async () => {
      // Mock MCP to throw error
      jest.spyOn(agent as any, 'queryMCP').mockRejectedValue(new Error('MCP error'));

      const request: RecommendationRequest = {
        userId: 'user_123',
        context: {},
        count: 5,
        type: 'personalized'
      };

      const response = await agent.generateRecommendations(request);

      // Should return fallback response
      expect(response).toBeDefined();
      expect(response.algorithms).toContain('fallback');
    });

    it('should handle AI generation errors', async () => {
      // Mock successful MCP calls but AI error
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({ products: mockProducts });
      
      if (agent['geminiClient']) {
        jest.spyOn(agent['geminiClient'], 'generateStructuredResponse')
          .mockRejectedValue(new Error('AI error'));
      }

      const user = mockUser;
      const products = mockProducts;
      const request: RecommendationRequest = {
        userId: 'user_123',
        context: {},
        count: 3,
        type: 'personalized'
      };

      const recommendations = await agent['generateAIRecommendations'](user, products, request);

      expect(recommendations).toHaveLength(0);
    });
  });

  describe('caching', () => {
    beforeEach(() => {
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({ products: mockProducts });
    });

    it('should cache recommendations', async () => {
      const request: RecommendationRequest = {
        userId: 'user_123',
        context: {},
        count: 5,
        type: 'personalized'
      };

      // First call
      const response1 = await agent.generateRecommendations(request);
      expect(response1.cacheHit).toBe(false);

      // Second call should hit cache
      const response2 = await agent.generateRecommendations(request);
      expect(response2.cacheHit).toBe(true);
    });

    it('should generate different cache keys for different requests', async () => {
      const request1: RecommendationRequest = {
        userId: 'user_123',
        context: {},
        count: 5,
        type: 'personalized'
      };

      const request2: RecommendationRequest = {
        userId: 'user_456', // Different user
        context: {},
        count: 5,
        type: 'personalized'
      };

      const key1 = agent['generateCacheKey'](request1);
      const key2 = agent['generateCacheKey'](request2);

      expect(key1).not.toBe(key2);
    });
  });
});