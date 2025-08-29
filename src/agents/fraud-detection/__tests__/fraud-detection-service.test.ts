/**
 * Integration tests for Fraud Detection Service
 */

import { FraudDetectionService, FraudDetectionServiceConfig } from '../fraud-detection-service';

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;
  let config: FraudDetectionServiceConfig;

  beforeEach(() => {
    config = {
      id: 'fraud-detection-service-1',
      name: 'Fraud Detection Service',
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
      capabilities: [],
      eventStream: {
        enabled: true,
        source: 'kafka',
        connectionString: 'localhost:9092',
        topics: ['transactions'],
        batchSize: 10,
        processingInterval: 5000
      },
      alerting: {
        enabled: true,
        channels: ['a2a', 'webhook'],
        thresholds: {
          highRisk: 70,
          critical: 90
        }
      },
      monitoring: {
        metricsEnabled: true,
        loggingLevel: 'info'
      }
    };

    service = new FraudDetectionService(config);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('initialization', () => {
    it('should initialize service successfully', async () => {
      const initPromise = service.initialize();
      
      // Listen for initialization event
      const initEvent = new Promise(resolve => {
        service.once('serviceInitialized', resolve);
      });

      await expect(initPromise).resolves.not.toThrow();
      await expect(initEvent).resolves.toBeDefined();
    });

    it('should handle initialization errors', async () => {
      // Create service with invalid config
      const invalidConfig = {
        ...config,
        geminiConfig: {
          ...config.geminiConfig,
          apiKey: '' // Invalid API key
        }
      };

      const invalidService = new FraudDetectionService(invalidConfig);
      
      await expect(invalidService.initialize()).rejects.toThrow();
    });
  });

  describe('transaction analysis', () => {
    beforeEach(async () => {
      // Mock the agent methods
      jest.spyOn(service['agent'] as any, 'queryMCP')
        .mockResolvedValueOnce({ // getUserProfile
          userId: 'user_123',
          accountAge: 365,
          avgTransactionAmount: 200,
          frequentLocations: ['USA'],
          frequentMerchants: ['Test Store'],
          typicalSpendingPattern: {
            hourlyDistribution: new Array(24).fill(1/24),
            weeklyDistribution: new Array(7).fill(1/7),
            monthlyDistribution: new Array(12).fill(1/12)
          },
          riskHistory: [],
          fraudHistory: []
        })
        .mockResolvedValueOnce({ transactions: [] }); // getRecentTransactions

      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);
      
      await service.initialize();
    });

    it('should analyze a single transaction', async () => {
      const transactionData = {
        id: 'txn_123',
        userId: 'user_123',
        amount: 250,
        currency: 'USD',
        merchant: 'Test Store',
        location: { country: 'USA', city: 'New York' },
        timestamp: new Date().toISOString(),
        paymentMethod: 'credit_card'
      };

      const assessment = await service.analyzeTransaction(transactionData);

      expect(assessment).toBeDefined();
      expect(assessment.transactionId).toBe('txn_123');
      expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(assessment.riskScore).toBeLessThanOrEqual(100);
      expect(['low', 'medium', 'high', 'critical']).toContain(assessment.riskLevel);
      expect(['approve', 'review', 'decline']).toContain(assessment.recommendation);
    });

    it('should handle high-risk transactions', async () => {
      const highRiskTransaction = {
        id: 'txn_456',
        userId: 'user_123',
        amount: 10000, // Very high amount
        currency: 'USD',
        merchant: 'Unknown Merchant',
        location: { country: 'Unknown', city: 'Unknown' },
        timestamp: new Date().toISOString(),
        paymentMethod: 'credit_card'
      };

      const alertPromise = new Promise(resolve => {
        service.once('alertGenerated', resolve);
      });

      const assessment = await service.analyzeTransaction(highRiskTransaction);

      expect(assessment.riskScore).toBeGreaterThan(50);
      expect(assessment.riskLevel).not.toBe('low');

      // Should generate alert for high-risk transaction
      await expect(alertPromise).resolves.toBeDefined();
    });

    it('should process batch transactions', async () => {
      const transactions = [
        {
          id: 'txn_1',
          userId: 'user_123',
          amount: 100,
          currency: 'USD',
          merchant: 'Store A',
          location: { country: 'USA', city: 'New York' },
          timestamp: new Date().toISOString(),
          paymentMethod: 'credit_card'
        },
        {
          id: 'txn_2',
          userId: 'user_456',
          amount: 200,
          currency: 'USD',
          merchant: 'Store B',
          location: { country: 'USA', city: 'Los Angeles' },
          timestamp: new Date().toISOString(),
          paymentMethod: 'debit_card'
        }
      ];

      const assessments = await service.analyzeBatch(transactions);

      expect(assessments).toHaveLength(2);
      expect(assessments[0].transactionId).toBe('txn_1');
      expect(assessments[1].transactionId).toBe('txn_2');
    });
  });

  describe('event stream processing', () => {
    beforeEach(async () => {
      // Mock dependencies
      jest.spyOn(service['agent'] as any, 'queryMCP')
        .mockResolvedValue({ userId: 'user_123', accountAge: 30 });
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);
      
      await service.initialize();
    });

    it('should process events from queue', async () => {
      const batchProcessedPromise = new Promise(resolve => {
        service.once('batchProcessed', resolve);
      });

      // Add events to queue
      service['eventQueue'].push({
        transaction_id: 'txn_stream_1',
        user_id: 'user_123',
        amount: '150.00',
        currency: 'USD',
        merchant: 'Stream Store',
        timestamp: new Date().toISOString()
      });

      // Trigger batch processing
      await service['processBatch'](service['eventQueue'].splice(0, 1));

      await expect(batchProcessedPromise).resolves.toBeDefined();
    });

    it('should handle batch processing errors', async () => {
      const batchErrorPromise = new Promise(resolve => {
        service.once('batchError', resolve);
      });

      // Add invalid event to trigger error
      const invalidEvents = [{ invalid: 'data' }];

      await service['processBatch'](invalidEvents);

      await expect(batchErrorPromise).resolves.toBeDefined();
    });
  });

  describe('health and metrics', () => {
    beforeEach(async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);
      jest.spyOn(service['agent'], 'isAgentHealthy').mockReturnValue(true);
      
      await service.initialize();
    });

    it('should report healthy status', () => {
      const health = service.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.agentHealth).toBe(true);
      expect(health.metrics).toBeDefined();
      expect(health.queueSize).toBeGreaterThanOrEqual(0);
    });

    it('should report degraded status with large queue', () => {
      // Fill queue to trigger degraded status
      for (let i = 0; i < 1500; i++) {
        service['eventQueue'].push({ test: i });
      }

      const health = service.getHealthStatus();

      expect(health.status).toBe('degraded');
      expect(health.queueSize).toBeGreaterThan(1000);
    });

    it('should report unhealthy status when agent is unhealthy', () => {
      jest.spyOn(service['agent'], 'isAgentHealthy').mockReturnValue(false);

      const health = service.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.agentHealth).toBe(false);
    });

    it('should track processing metrics', async () => {
      const transactionData = {
        id: 'txn_metrics',
        userId: 'user_123',
        amount: 100,
        currency: 'USD',
        merchant: 'Metrics Store',
        timestamp: new Date().toISOString()
      };

      const initialMetrics = service.getMetrics();
      expect(initialMetrics.transactionsProcessed).toBe(0);

      await service.analyzeTransaction(transactionData);

      const updatedMetrics = service.getMetrics();
      expect(updatedMetrics.transactionsProcessed).toBe(1);
      expect(updatedMetrics.averageProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('alerting', () => {
    beforeEach(async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({
        userId: 'user_123',
        accountAge: 30,
        avgTransactionAmount: 100
      });
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);
      
      await service.initialize();
    });

    it('should generate alerts for high-risk transactions', async () => {
      const alertPromise = new Promise(resolve => {
        service.once('alertGenerated', resolve);
      });

      const highRiskTransaction = {
        id: 'txn_alert',
        userId: 'user_123',
        amount: 5000, // High amount to trigger alert
        currency: 'USD',
        merchant: 'Suspicious Store',
        location: { country: 'Unknown', city: 'Unknown' },
        timestamp: new Date().toISOString(),
        paymentMethod: 'credit_card'
      };

      await service.analyzeTransaction(highRiskTransaction);

      const alert = await alertPromise;
      expect(alert).toBeDefined();
      expect((alert as any).transactionId).toBe('txn_alert');
      expect((alert as any).riskLevel).not.toBe('low');
    });

    it('should not generate alerts when alerting is disabled', async () => {
      // Create service with alerting disabled
      const configWithoutAlerting = {
        ...config,
        alerting: {
          ...config.alerting,
          enabled: false
        }
      };

      const serviceWithoutAlerting = new FraudDetectionService(configWithoutAlerting);
      
      jest.spyOn(serviceWithoutAlerting['agent'] as any, 'queryMCP').mockResolvedValue({
        userId: 'user_123',
        avgTransactionAmount: 100
      });
      jest.spyOn(serviceWithoutAlerting['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);
      
      await serviceWithoutAlerting.initialize();

      let alertGenerated = false;
      serviceWithoutAlerting.once('alertGenerated', () => {
        alertGenerated = true;
      });

      const highRiskTransaction = {
        id: 'txn_no_alert',
        userId: 'user_123',
        amount: 10000,
        currency: 'USD',
        merchant: 'Test Store',
        timestamp: new Date().toISOString()
      };

      await serviceWithoutAlerting.analyzeTransaction(highRiskTransaction);

      // Wait a bit to ensure no alert is generated
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(alertGenerated).toBe(false);

      await serviceWithoutAlerting.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await service.initialize();

      const shutdownPromise = new Promise(resolve => {
        service.once('serviceShutdown', resolve);
      });

      await service.shutdown();

      await expect(shutdownPromise).resolves.toBeDefined();
    });

    it('should process remaining events during shutdown', async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);
      
      await service.initialize();

      // Add events to queue
      service['eventQueue'].push({ test: 'event1' });
      service['eventQueue'].push({ test: 'event2' });

      const processBatchSpy = jest.spyOn(service as any, 'processBatch');

      await service.shutdown();

      expect(processBatchSpy).toHaveBeenCalled();
      expect(service['eventQueue']).toHaveLength(0);
    });
  });
});