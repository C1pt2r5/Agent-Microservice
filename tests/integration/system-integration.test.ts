/**
 * System Integration Tests
 * Tests the complete Agentic Microservices system working together
 */

import { ConcreteBaseAgent } from '../../src/agents/base/base-agent';
import { AgentConfig } from '../../src/types';
import { MCPClientImpl } from '../../src/integration/mcp/mcp-client';
import { A2AClientImpl } from '../../src/integration/a2a/a2a-client';
import { EnhancedGeminiClient } from '../../src/integration/gemini/enhanced-gemini-client';

// Mock services for integration testing
class MockUserService {
  private users: Map<string, any> = new Map([
    ['user_123', {
      userId: 'user_123',
      name: 'John Doe',
      email: 'john.doe@example.com',
      accountType: 'premium',
      accountStatus: 'active'
    }],
    ['user_456', {
      userId: 'user_456',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      accountType: 'standard',
      accountStatus: 'active'
    }]
  ]);

  async getUserProfile(userId: string) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async updateUserProfile(userId: string, updates: any) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const updatedUser = { ...user, ...updates };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
}

class MockTransactionService {
  private transactions: any[] = [
    {
      transactionId: 'txn_001',
      userId: 'user_123',
      amount: 299.99,
      currency: 'USD',
      merchant: 'Apple Store',
      status: 'completed',
      timestamp: new Date('2024-01-15T10:00:00Z')
    },
    {
      transactionId: 'txn_002',
      userId: 'user_456',
      amount: 49.99,
      currency: 'USD',
      merchant: 'Amazon',
      status: 'completed',
      timestamp: new Date('2024-01-15T11:00:00Z')
    }
  ];

  async getUserTransactions(userId: string, limit: number = 10) {
    return this.transactions
      .filter(t => t.userId === userId)
      .slice(0, limit);
  }

  async getTransaction(transactionId: string) {
    const transaction = this.transactions.find(t => t.transactionId === transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    return transaction;
  }

  async createTransaction(transaction: any) {
    const newTransaction = {
      ...transaction,
      transactionId: `txn_${Date.now()}`,
      status: 'pending',
      timestamp: new Date()
    };
    this.transactions.push(newTransaction);
    return newTransaction;
  }
}

class MockProductService {
  private products: any[] = [
    {
      productId: 'prod_001',
      name: 'iPhone 15 Pro',
      category: 'electronics',
      price: 999.00,
      brand: 'Apple',
      features: ['wireless', 'high-quality', 'durable']
    },
    {
      productId: 'prod_002',
      name: 'Samsung Galaxy Watch',
      category: 'electronics',
      price: 299.00,
      brand: 'Samsung',
      features: ['wireless', 'fitness-tracking']
    },
    {
      productId: 'prod_003',
      name: 'Nike Air Max',
      category: 'sports',
      price: 129.00,
      brand: 'Nike',
      features: ['comfortable', 'durable']
    }
  ];

  async getProductsByCategory(category: string) {
    return this.products.filter(p => p.category === category);
  }

  async getProduct(productId: string) {
    const product = this.products.find(p => p.productId === productId);
    if (!product) {
      throw new Error('Product not found');
    }
    return product;
  }

  async searchProducts(query: string) {
    const lowerQuery = query.toLowerCase();
    return this.products.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.category.toLowerCase().includes(lowerQuery) ||
      p.brand.toLowerCase().includes(lowerQuery)
    );
  }
}

describe('System Integration Tests', () => {
  let mockUserService: MockUserService;
  let mockTransactionService: MockTransactionService;
  let mockProductService: MockProductService;

  let chatbotAgent: ConcreteBaseAgent;
  let fraudDetectionAgent: ConcreteBaseAgent;
  let recommendationAgent: ConcreteBaseAgent;

  beforeAll(async () => {
    // Initialize mock services
    mockUserService = new MockUserService();
    mockTransactionService = new MockTransactionService();
    mockProductService = new MockProductService();

    // Create mock MCP client that routes to our mock services
    const mockMCPClient = {
      request: jest.fn(async (request: any) => {
        const { service, operation, parameters } = request;

        switch (service) {
          case 'user-service':
            switch (operation) {
              case 'getUserProfile':
                return { success: true, data: await mockUserService.getUserProfile(parameters.userId) };
              case 'updateUserProfile':
                return { success: true, data: await mockUserService.updateUserProfile(parameters.userId, parameters.updates) };
              default:
                throw new Error(`Unknown operation: ${operation}`);
            }
          case 'transaction-service':
            switch (operation) {
              case 'getUserTransactions':
                return { success: true, data: await mockTransactionService.getUserTransactions(parameters.userId, parameters.limit) };
              case 'getTransaction':
                return { success: true, data: await mockTransactionService.getTransaction(parameters.transactionId) };
              case 'createTransaction':
                return { success: true, data: await mockTransactionService.createTransaction(parameters.transaction) };
              default:
                throw new Error(`Unknown operation: ${operation}`);
            }
          case 'product-service':
            switch (operation) {
              case 'getProductsByCategory':
                return { success: true, data: await mockProductService.getProductsByCategory(parameters.category) };
              case 'getProduct':
                return { success: true, data: await mockProductService.getProduct(parameters.productId) };
              case 'searchProducts':
                return { success: true, data: await mockProductService.searchProducts(parameters.query) };
              default:
                throw new Error(`Unknown operation: ${operation}`);
            }
          default:
            throw new Error(`Unknown service: ${service}`);
        }
      }),
      getServiceDefinition: jest.fn(),
      healthCheck: jest.fn().mockResolvedValue(true)
    };

    // Create mock A2A client
    const mockA2AClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      registerAgent: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue({
        messageId: 'msg_123',
        timestamp: new Date(),
        status: 'delivered'
      }),
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      getConnectionStatus: jest.fn().mockReturnValue('connected'),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    };

    // Create mock Gemini client
    const mockGeminiClient = {
      generateContent: jest.fn().mockResolvedValue({
        success: true,
        content: 'This is a mock response from Gemini AI.',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        processingTime: 150
      }),
      generateContentStream: jest.fn(),
      generateStructuredResponse: jest.fn().mockResolvedValue({
        success: true,
        content: '{"intent": "greeting", "confidence": 0.9}',
        structuredData: { intent: 'greeting', confidence: 0.9 },
        processingTime: 200
      })
    };

    // Create agent configurations
    const baseConfig = {
      environment: 'development' as const,
      mcpEndpoint: { url: 'http://localhost:8080', timeout: 30000, retryAttempts: 3, circuitBreakerThreshold: 5 },
      a2aEndpoint: { url: 'http://localhost:8081', timeout: 15000, retryAttempts: 3, circuitBreakerThreshold: 5 },
      geminiConfig: { apiKey: 'test-key', model: 'gemini-pro', endpoint: 'https://test-endpoint', maxTokens: 2048, temperature: 0.7, rateLimitPerMinute: 60 }
    };

    const chatbotConfig: AgentConfig = {
      ...baseConfig,
      id: 'chatbot-agent-test',
      name: 'Chatbot Agent Test',
      version: '1.0.0',
      type: 'chatbot',
      capabilities: [
        { name: 'natural-language-processing', description: 'Process natural language', inputSchema: { type: 'string' }, outputSchema: { type: 'string' } }
      ]
    };

    const fraudConfig: AgentConfig = {
      ...baseConfig,
      id: 'fraud-detection-agent-test',
      name: 'Fraud Detection Agent Test',
      version: '1.0.0',
      type: 'fraud-detection',
      capabilities: [
        { name: 'risk-assessment', description: 'Assess transaction risk', inputSchema: { type: 'object' }, outputSchema: { type: 'object' } }
      ]
    };

    const recommendationConfig: AgentConfig = {
      ...baseConfig,
      id: 'recommendation-agent-test',
      name: 'Recommendation Agent Test',
      version: '1.0.0',
      type: 'recommendation',
      capabilities: [
        { name: 'product-recommendation', description: 'Generate recommendations', inputSchema: { type: 'object' }, outputSchema: { type: 'array' } }
      ]
    };

    // Create agents with mock dependencies
    chatbotAgent = new ConcreteBaseAgent(chatbotConfig, {
      mcpClient: mockMCPClient as any,
      a2aClient: mockA2AClient as any,
      geminiClient: mockGeminiClient as any
    });

    fraudDetectionAgent = new ConcreteBaseAgent(fraudConfig, {
      mcpClient: mockMCPClient as any,
      a2aClient: mockA2AClient as any,
      geminiClient: mockGeminiClient as any
    });

    recommendationAgent = new ConcreteBaseAgent(recommendationConfig, {
      mcpClient: mockMCPClient as any,
      a2aClient: mockA2AClient as any,
      geminiClient: mockGeminiClient as any
    });

    // Initialize agents
    await chatbotAgent.initialize();
    await fraudDetectionAgent.initialize();
    await recommendationAgent.initialize();
  });

  afterAll(async () => {
    // Clean up agents
    await chatbotAgent.shutdown();
    await fraudDetectionAgent.shutdown();
    await recommendationAgent.shutdown();
  });

  describe('End-to-End Customer Journey', () => {
    test('should handle complete customer interaction flow', async () => {
      const userId = 'user_123';
      const sessionId = 'session_e2e_001';

      // Step 1: Customer greets the chatbot
      const greetingRequest = {
        id: 'req_001',
        timestamp: new Date(),
        correlationId: 'corr_001',
        payload: {
          action: 'process_chat',
          sessionId,
          userId,
          message: 'Hello, I need help with my account'
        }
      };

      const greetingResponse = await chatbotAgent.processRequest(greetingRequest);
      expect(greetingResponse.success).toBe(true);
      expect(greetingResponse.payload?.chatResponse.intent).toBe('greeting');

      // Step 2: Customer asks about their balance
      const balanceRequest = {
        id: 'req_002',
        timestamp: new Date(),
        correlationId: 'corr_002',
        payload: {
          action: 'process_chat',
          sessionId,
          userId,
          message: 'What is my account balance?'
        }
      };

      const balanceResponse = await chatbotAgent.processRequest(balanceRequest);
      expect(balanceResponse.success).toBe(true);
      expect(balanceResponse.payload?.chatResponse.intent).toBe('balance_check');

      // Step 3: Customer views their transaction history
      const historyRequest = {
        id: 'req_003',
        timestamp: new Date(),
        correlationId: 'corr_003',
        payload: {
          action: 'process_chat',
          sessionId,
          userId,
          message: 'Show me my recent transactions'
        }
      };

      const historyResponse = await chatbotAgent.processRequest(historyRequest);
      expect(historyResponse.success).toBe(true);
      expect(historyResponse.payload?.chatResponse.intent).toBe('transaction_inquiry');

      // Step 4: Get product recommendations based on user behavior
      const recommendationRequest = {
        id: 'req_004',
        timestamp: new Date(),
        correlationId: 'corr_004',
        payload: {
          action: 'generate_recommendations',
          userId,
          context: 'post_transaction',
          limit: 3
        }
      };

      const recommendationResponse = await recommendationAgent.processRequest(recommendationRequest);
      expect(recommendationResponse.success).toBe(true);
      expect(recommendationResponse.payload?.recommendations).toBeDefined();
      expect(recommendationResponse.payload?.recommendations.length).toBeGreaterThan(0);
    });

    test('should handle fraud detection workflow', async () => {
      const userId = 'user_456';

      // Step 1: Simulate a suspicious transaction
      const transaction = {
        transactionId: 'txn_suspicious_001',
        userId,
        amount: 2500.00,
        currency: 'USD',
        merchant: 'Unknown Merchant',
        timestamp: new Date(),
        location: { country: 'US', city: 'Unknown City' },
        device: { userAgent: 'Suspicious Browser', fingerprint: 'unknown_device' }
      };

      // Step 2: Fraud detection agent analyzes the transaction
      const fraudRequest = {
        id: 'req_fraud_001',
        timestamp: new Date(),
        correlationId: 'corr_fraud_001',
        payload: {
          action: 'analyze_transaction',
          transaction
        }
      };

      const fraudResponse = await fraudDetectionAgent.processRequest(fraudRequest);
      expect(fraudResponse.success).toBe(true);
      expect(fraudResponse.payload?.assessment).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(fraudResponse.payload?.assessment.riskLevel);

      // Step 3: If high risk, chatbot should be notified via A2A
      if (fraudResponse.payload?.assessment.riskLevel === 'high' || fraudResponse.payload?.assessment.riskLevel === 'critical') {
        // Simulate chatbot receiving fraud alert
        const alertRequest = {
          id: 'req_alert_001',
          timestamp: new Date(),
          correlationId: 'corr_alert_001',
          payload: {
            action: 'process_chat',
            sessionId: 'alert_session_001',
            userId,
            message: 'I noticed some suspicious activity on my account'
          }
        };

        const alertResponse = await chatbotAgent.processRequest(alertRequest);
        expect(alertResponse.success).toBe(true);
        expect(alertResponse.payload?.chatResponse.intent).toBe('fraud_report');
        expect(alertResponse.payload?.chatResponse.requiresEscalation).toBe(true);
      }
    });

    test('should handle product recommendation flow', async () => {
      const userId = 'user_123';

      // Step 1: User browses electronics category
      const browseRequest = {
        id: 'req_browse_001',
        timestamp: new Date(),
        correlationId: 'corr_browse_001',
        payload: {
          action: 'generate_recommendations',
          userId,
          context: 'category_browse',
          filters: {
            category: 'electronics',
            priceRange: { min: 100, max: 1000 }
          },
          limit: 5
        }
      };

      const browseResponse = await recommendationAgent.processRequest(browseRequest);
      expect(browseResponse.success).toBe(true);
      expect(browseResponse.payload?.recommendations).toBeDefined();

      // Verify recommendations are in electronics category
      browseResponse.payload?.recommendations.forEach((rec: any) => {
        expect(rec.category).toBe('electronics');
        expect(rec.score).toBeGreaterThan(0);
      });

      // Step 2: User searches for specific products
      const searchRequest = {
        id: 'req_search_001',
        timestamp: new Date(),
        correlationId: 'corr_search_001',
        payload: {
          action: 'generate_recommendations',
          userId,
          context: 'search',
          filters: {
            query: 'wireless'
          },
          limit: 3
        }
      };

      const searchResponse = await recommendationAgent.processRequest(searchRequest);
      expect(searchResponse.success).toBe(true);
      expect(searchResponse.payload?.recommendations).toBeDefined();

      // Verify search results contain wireless products
      const hasWireless = searchResponse.payload?.recommendations.some((rec: any) =>
        rec.features && rec.features.includes('wireless')
      );
      expect(hasWireless).toBe(true);
    });
  });

  describe('Cross-Agent Communication', () => {
    test('should enable agents to communicate via A2A', async () => {
      const userId = 'user_123';

      // Step 1: Fraud detection agent detects suspicious activity
      const fraudAlert = {
        transactionId: 'txn_alert_001',
        userId,
        riskLevel: 'high',
        amount: 1500.00,
        timestamp: new Date()
      };

      // Step 2: Fraud agent sends alert to chatbot via A2A
      await fraudDetectionAgent.sendA2AMessage(
        'fraud-alerts',
        'fraud.detected',
        fraudAlert,
        'chatbot-agent-test'
      );

      // Step 3: Chatbot receives and processes the alert
      const chatbotRequest = {
        id: 'req_a2a_001',
        timestamp: new Date(),
        correlationId: 'corr_a2a_001',
        payload: {
          action: 'process_chat',
          sessionId: 'a2a_session_001',
          userId,
          message: 'I think there might be fraudulent activity on my account'
        }
      };

      const chatbotResponse = await chatbotAgent.processRequest(chatbotRequest);
      expect(chatbotResponse.success).toBe(true);
      expect(chatbotResponse.payload?.chatResponse.intent).toBe('fraud_report');
      expect(chatbotResponse.payload?.chatResponse.requiresEscalation).toBe(true);
    });

    test('should handle recommendation requests from chatbot', async () => {
      const userId = 'user_456';

      // Step 1: Chatbot identifies need for recommendations
      const chatRequest = {
        id: 'req_rec_001',
        timestamp: new Date(),
        correlationId: 'corr_rec_001',
        payload: {
          action: 'process_chat',
          sessionId: 'rec_session_001',
          userId,
          message: 'Can you recommend some electronics for me?'
        }
      };

      const chatResponse = await chatbotAgent.processRequest(chatRequest);
      expect(chatResponse.success).toBe(true);

      // Step 2: Chatbot requests recommendations from recommendation agent
      const recRequest = {
        id: 'req_cross_001',
        timestamp: new Date(),
        correlationId: 'corr_cross_001',
        payload: {
          action: 'generate_recommendations',
          userId,
          context: 'chatbot_request',
          filters: {
            category: 'electronics'
          },
          limit: 3
        }
      };

      const recResponse = await recommendationAgent.processRequest(recRequest);
      expect(recResponse.success).toBe(true);
      expect(recResponse.payload?.recommendations).toBeDefined();
      expect(recResponse.payload?.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle MCP service failures gracefully', async () => {
      const userId = 'nonexistent_user';

      // Step 1: Try to get recommendations for non-existent user
      const request = {
        id: 'req_error_001',
        timestamp: new Date(),
        correlationId: 'corr_error_001',
        payload: {
          action: 'generate_recommendations',
          userId,
          context: 'error_test',
          limit: 5
        }
      };

      const response = await recommendationAgent.processRequest(request);

      // Should handle the error gracefully and return fallback response
      expect(response.success).toBe(true);
      expect(response.payload?.recommendations).toBeDefined();
      expect(response.payload?.algorithms).toContain('fallback');
    });

    test('should handle A2A communication failures', async () => {
      const userId = 'user_123';

      // Step 1: Try to send message to non-existent agent
      try {
        await chatbotAgent.sendA2AMessage(
          'test-topic',
          'test.message',
          { test: 'data' },
          'nonexistent-agent'
        );
      } catch (error) {
        // Should handle the error gracefully
        expect(error).toBeDefined();
      }

      // Step 2: Verify agent continues to function normally
      const healthRequest = {
        id: 'req_health_001',
        timestamp: new Date(),
        correlationId: 'corr_health_001',
        payload: {
          action: 'get_health'
        }
      };

      const healthResponse = await chatbotAgent.processRequest(healthRequest);
      expect(healthResponse.success).toBe(true);
    });

    test('should handle Gemini API failures', async () => {
      const userId = 'user_123';

      // Step 1: Simulate Gemini API failure
      const mockGeminiClient = (chatbotAgent as any).geminiClient;
      mockGeminiClient.generateStructuredResponse.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      // Step 2: Chatbot should handle the failure gracefully
      const request = {
        id: 'req_gemini_error_001',
        timestamp: new Date(),
        correlationId: 'corr_gemini_error_001',
        payload: {
          action: 'process_chat',
          sessionId: 'error_session_001',
          userId,
          message: 'Hello'
        }
      };

      const response = await chatbotAgent.processRequest(request);

      // Should return fallback response
      expect(response.success).toBe(true);
      expect(response.payload?.chatResponse.intent).toBe('greeting');
      expect(response.payload?.chatResponse.confidence).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle concurrent requests efficiently', async () => {
      const userId = 'user_123';
      const concurrentRequests = 10;

      // Create multiple concurrent requests
      const requests = Array.from({ length: concurrentRequests }, (_, i) => ({
        id: `req_concurrent_${i}`,
        timestamp: new Date(),
        correlationId: `corr_concurrent_${i}`,
        payload: {
          action: 'process_chat',
          sessionId: `session_concurrent_${i}`,
          userId,
          message: 'Hello from concurrent request'
        }
      }));

      const startTime = Date.now();

      // Execute all requests concurrently
      const responses = await Promise.all(
        requests.map(request => chatbotAgent.processRequest(request))
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / concurrentRequests;

      // Verify all requests succeeded
      responses.forEach((response, i) => {
        expect(response.success).toBe(true);
        expect(response.payload?.chatResponse.intent).toBe('greeting');
      });

      // Performance assertions
      expect(avgTimePerRequest).toBeLessThan(500); // Less than 500ms per request
      expect(totalTime).toBeLessThan(3000); // Less than 3 seconds total

      console.log(`Concurrent test results: ${concurrentRequests} requests in ${totalTime}ms (${avgTimePerRequest}ms avg)`);
    });

    test('should maintain performance under load', async () => {
      const userId = 'user_456';
      const loadTestRequests = 50;

      const requests = Array.from({ length: loadTestRequests }, (_, i) => ({
        id: `req_load_${i}`,
        timestamp: new Date(),
        correlationId: `corr_load_${i}`,
        payload: {
          action: 'generate_recommendations',
          userId,
          context: 'load_test',
          limit: 3
        }
      }));

      const startTime = Date.now();

      const responses = await Promise.all(
        requests.map(request => recommendationAgent.processRequest(request))
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / loadTestRequests;

      // Verify performance
      responses.forEach(response => {
        expect(response.success).toBe(true);
        expect(response.payload?.recommendations).toBeDefined();
      });

      // Performance benchmarks
      expect(avgTimePerRequest).toBeLessThan(300); // Less than 300ms per request
      expect(totalTime).toBeLessThan(10000); // Less than 10 seconds total

      // Check cache effectiveness (should improve performance)
      const cachedResponses = responses.filter(r => r.payload?.cacheHit);
      const cacheHitRate = cachedResponses.length / loadTestRequests;

      console.log(`Load test results: ${loadTestRequests} requests in ${totalTime}ms (${avgTimePerRequest}ms avg), cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`);
    });
  });
});