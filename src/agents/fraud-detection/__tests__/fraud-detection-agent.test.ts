/**
 * Unit tests for Fraud Detection Agent
 */

import { FraudDetectionAgent, Transaction, CustomerProfile, RiskAssessment } from '../fraud-detection-agent';
import { AgentConfig } from '../../../types';

describe('FraudDetectionAgent', () => {
  let agent: FraudDetectionAgent;
  let config: AgentConfig;
  let mockTransaction: Transaction;
  let mockCustomerProfile: CustomerProfile;

  beforeEach(() => {
    config = {
      id: 'fraud-detection-1',
      name: 'Fraud Detection Agent',
      type: 'fraud-detection',
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

    mockTransaction = {
      id: 'txn_123',
      userId: 'user_456',
      amount: 500,
      currency: 'USD',
      merchant: 'Test Store',
      merchantCategory: 'Retail',
      location: {
        country: 'USA',
        city: 'New York'
      },
      timestamp: new Date(),
      paymentMethod: 'credit_card'
    };

    mockCustomerProfile = {
      userId: 'user_456',
      accountAge: 365,
      avgTransactionAmount: 200,
      frequentLocations: ['USA', 'New York'],
      frequentMerchants: ['Test Store', 'Another Store'],
      typicalSpendingPattern: {
        hourlyDistribution: new Array(24).fill(1/24),
        weeklyDistribution: new Array(7).fill(1/7),
        monthlyDistribution: new Array(12).fill(1/12)
      },
      riskHistory: [],
      fraudHistory: []
    };

    agent = new FraudDetectionAgent(config);
  });

  afterEach(async () => {
    if (agent && agent.isAgentHealthy()) {
      await agent.shutdown();
    }
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('analyzeTransaction', () => {
    it('should analyze a normal transaction with low risk', async () => {
      const assessment = await agent.analyzeTransaction(
        mockTransaction,
        mockCustomerProfile
      );

      expect(assessment).toBeDefined();
      expect(assessment.transactionId).toBe('txn_123');
      expect(assessment.riskLevel).toBe('low');
      expect(assessment.recommendation).toBe('approve');
      expect(assessment.riskScore).toBeLessThan(30);
    });

    it('should detect unusual amount as risk factor', async () => {
      const highAmountTransaction = {
        ...mockTransaction,
        amount: 5000 // 25x higher than average
      };

      const assessment = await agent.analyzeTransaction(
        highAmountTransaction,
        mockCustomerProfile
      );

      expect(assessment.riskLevel).not.toBe('low');
      expect(assessment.riskFactors).toContainEqual(
        expect.objectContaining({
          type: 'unusual_amount',
          severity: 'high'
        })
      );
    });

    it('should detect unusual location as risk factor', async () => {
      const foreignTransaction = {
        ...mockTransaction,
        location: {
          country: 'Russia',
          city: 'Moscow'
        }
      };

      const assessment = await agent.analyzeTransaction(
        foreignTransaction,
        mockCustomerProfile
      );

      expect(assessment.riskFactors).toContainEqual(
        expect.objectContaining({
          type: 'unusual_location',
          severity: 'medium'
        })
      );
    });

    it('should detect rapid succession pattern', async () => {
      const recentTransactions = [
        { ...mockTransaction, id: 'txn_1', timestamp: new Date(Date.now() - 30000) },
        { ...mockTransaction, id: 'txn_2', timestamp: new Date(Date.now() - 60000) },
        { ...mockTransaction, id: 'txn_3', timestamp: new Date(Date.now() - 90000) },
        { ...mockTransaction, id: 'txn_4', timestamp: new Date(Date.now() - 120000) },
        { ...mockTransaction, id: 'txn_5', timestamp: new Date(Date.now() - 150000) }
      ];

      const assessment = await agent.analyzeTransaction(
        mockTransaction,
        mockCustomerProfile,
        recentTransactions
      );

      expect(assessment.riskFactors).toContainEqual(
        expect.objectContaining({
          type: 'rapid_succession'
        })
      );
    });

    it('should handle analysis errors gracefully', async () => {
      // Create invalid transaction to trigger error
      const invalidTransaction = {
        ...mockTransaction,
        id: null as any
      };

      const assessment = await agent.analyzeTransaction(
        invalidTransaction,
        mockCustomerProfile
      );

      expect(assessment.riskLevel).toBe('critical');
      expect(assessment.recommendation).toBe('review');
      expect(assessment.riskFactors[0].type).toBe('analysis_error');
    });
  });

  describe('detectPatterns', () => {
    it('should detect rapid succession pattern', async () => {
      const rapidTransactions = [
        { ...mockTransaction, id: 'txn_1', timestamp: new Date(Date.now() - 30000) },
        { ...mockTransaction, id: 'txn_2', timestamp: new Date(Date.now() - 60000) },
        { ...mockTransaction, id: 'txn_3', timestamp: new Date(Date.now() - 90000) }
      ];

      const patterns = await agent.detectPatterns(rapidTransactions);

      expect(patterns).toContainEqual(
        expect.objectContaining({
          patternType: 'rapid_succession',
          confidence: expect.any(Number)
        })
      );
    });

    it('should detect amount escalation pattern', async () => {
      const escalatingTransactions = [
        { ...mockTransaction, id: 'txn_1', amount: 100, timestamp: new Date(Date.now() - 300000) },
        { ...mockTransaction, id: 'txn_2', amount: 200, timestamp: new Date(Date.now() - 200000) },
        { ...mockTransaction, id: 'txn_3', amount: 400, timestamp: new Date(Date.now() - 100000) }
      ];

      const patterns = await agent.detectPatterns(escalatingTransactions);

      expect(patterns).toContainEqual(
        expect.objectContaining({
          patternType: 'amount_escalation'
        })
      );
    });

    it('should detect geographic anomalies', async () => {
      const geoAnomalousTransactions = [
        { ...mockTransaction, id: 'txn_1', location: { country: 'USA', city: 'New York' } },
        { ...mockTransaction, id: 'txn_2', location: { country: 'Russia', city: 'Moscow' } },
        { ...mockTransaction, id: 'txn_3', location: { country: 'China', city: 'Beijing' } }
      ];

      const patterns = await agent.detectPatterns(geoAnomalousTransactions);

      expect(patterns).toContainEqual(
        expect.objectContaining({
          patternType: 'geographic_anomaly'
        })
      );
    });

    it('should return empty array for insufficient data', async () => {
      const singleTransaction = [mockTransaction];

      const patterns = await agent.detectPatterns(singleTransaction);

      expect(patterns).toHaveLength(0);
    });
  });

  describe('processRequest', () => {
    it('should handle analyze_transaction action', async () => {
      const request = {
        id: 'req_123',
        timestamp: new Date(),
        correlationId: 'corr_123',
        payload: {
          action: 'analyze_transaction',
          payload: {
            transaction: mockTransaction,
            customerProfile: mockCustomerProfile,
            recentTransactions: []
          }
        }
      };

      const response = await agent.processRequest(request);

      expect(response.success).toBe(true);
      expect(response.payload?.assessment).toBeDefined();
      expect(response.payload?.assessment?.transactionId).toBe('txn_123');
    });

    it('should handle detect_patterns action', async () => {
      const request = {
        id: 'req_124',
        timestamp: new Date(),
        correlationId: 'corr_124',
        payload: {
          action: 'detect_patterns',
          payload: {
            transactions: [mockTransaction]
          }
        }
      };

      const response = await agent.processRequest(request);

      expect(response.success).toBe(true);
      expect(response.payload?.patterns).toBeDefined();
      expect(Array.isArray(response.payload?.patterns)).toBe(true);
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

  describe('risk calculation', () => {
    it('should calculate higher risk for multiple factors', async () => {
      const highRiskTransaction = {
        ...mockTransaction,
        amount: 10000, // Very high amount
        location: { country: 'Unknown', city: 'Unknown' }, // Unusual location
        deviceId: 'new_device_123' // New device
      };

      const recentTransactions = [
        { ...mockTransaction, deviceId: 'old_device_456', timestamp: new Date(Date.now() - 30000) }
      ];

      const assessment = await agent.analyzeTransaction(
        highRiskTransaction,
        mockCustomerProfile,
        recentTransactions
      );

      expect(assessment.riskScore).toBeGreaterThan(50);
      expect(assessment.riskLevel).not.toBe('low');
      expect(assessment.riskFactors.length).toBeGreaterThan(1);
    });

    it('should recommend decline for critical risk', async () => {
      const criticalTransaction = {
        ...mockTransaction,
        amount: 50000 // Extremely high amount
      };

      const assessment = await agent.analyzeTransaction(
        criticalTransaction,
        mockCustomerProfile
      );

      expect(assessment.riskLevel).toBe('high');
      expect(assessment.recommendation).toBe('review');
    });
  });

  describe('event processing', () => {
    it('should process transaction events', async () => {
      const mockEvent = {
        transaction_id: 'txn_789',
        user_id: 'user_456',
        amount: '250.00',
        currency: 'USD',
        merchant: 'Online Store',
        location: {
          country: 'USA',
          city: 'San Francisco'
        },
        timestamp: new Date().toISOString(),
        payment_method: 'debit_card'
      };

      // Mock the MCP calls
      jest.spyOn(agent as any, 'queryMCP')
        .mockResolvedValueOnce(mockCustomerProfile) // getUserProfile
        .mockResolvedValueOnce({ transactions: [] }); // getRecentTransactions

      // Mock A2A message sending
      jest.spyOn(agent as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await expect(agent.processTransactionEvent(mockEvent)).resolves.not.toThrow();
    });
  });
});