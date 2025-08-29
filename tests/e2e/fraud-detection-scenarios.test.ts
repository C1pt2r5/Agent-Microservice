import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { TestDataGenerator } from '../utils/test-data-generator';
import { TestEnvironment } from '../utils/test-environment';
import { FraudDetectionScenario } from '../scenarios/fraud-detection-scenario';

describe('Fraud Detection End-to-End Scenarios', () => {
  let testEnv: TestEnvironment;
  let testData: TestDataGenerator;
  let scenario: FraudDetectionScenario;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    testData = new TestDataGenerator();
    scenario = new FraudDetectionScenario(testEnv, testData);
    
    await testEnv.setup();
    await testEnv.waitForServicesReady();
  }, 60000);

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testData.resetTestData();
  });

  describe('Real-time Transaction Analysis', () => {
    test('should detect velocity-based fraud patterns', async () => {
      // Arrange - Create customer with normal spending pattern
      const customer = await testData.createTestCustomer();
      await testData.establishNormalSpendingPattern(customer.id, 30); // 30 days of history
      
      // Act - Simulate rapid-fire transactions (velocity attack)
      const rapidTransactions = await testData.createRapidTransactions(customer.id, 10, 60000); // 10 transactions in 1 minute
      
      const results = [];
      for (const transaction of rapidTransactions) {
        const result = await scenario.analyzeTransaction(transaction);
        results.push(result);
      }
      
      // Assert
      const flaggedTransactions = results.filter(r => r.fraudScore > 0.8);
      expect(flaggedTransactions.length).toBeGreaterThan(5); // At least half should be flagged
      
      // Verify velocity pattern detection
      const lastResult = results[results.length - 1];
      expect(lastResult.patterns).toContain('high_velocity');
      expect(lastResult.riskFactors).toContain('unusual_transaction_frequency');
      
      // Verify real-time processing
      results.forEach(result => {
        expect(result.processingTime).toBeLessThan(200); // Sub-200ms processing
      });
    });

    test('should identify geographic anomalies', async () => {
      // Arrange
      const customer = await testData.createTestCustomer({ location: 'New York, NY' });
      await testData.createLocationBasedHistory(customer.id, 'New York, NY', 60); // 60 days in NY
      
      // Act - Transaction from unusual location
      const suspiciousTransaction = await testData.createTransaction(customer.id, {
        amount: 500,
        location: 'Tokyo, Japan',
        timestamp: new Date()
      });
      
      const result = await scenario.analyzeTransaction(suspiciousTransaction);
      
      // Assert
      expect(result.fraudScore).toBeGreaterThan(0.7);
      expect(result.patterns).toContain('geographic_anomaly');
      expect(result.riskFactors).toContain('unusual_location');
      expect(result.locationRisk.distance).toBeGreaterThan(10000); // km from usual location
      expect(result.locationRisk.travelTime).toBe('impossible'); // Can't travel that fast
    });

    test('should detect amount-based anomalies', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      await testData.createSpendingPattern(customer.id, { averageAmount: 50, maxAmount: 200 });
      
      // Act - Unusually large transaction
      const largeTransaction = await testData.createTransaction(customer.id, {
        amount: 5000, // 25x normal spending
        merchant: 'Electronics Store'
      });
      
      const result = await scenario.analyzeTransaction(largeTransaction);
      
      // Assert
      expect(result.fraudScore).toBeGreaterThan(0.6);
      expect(result.patterns).toContain('amount_anomaly');
      expect(result.amountAnalysis.deviationFromNormal).toBeGreaterThan(20); // 20+ standard deviations
      expect(result.recommendedAction).toBe('manual_review');
    });

    test('should analyze merchant category anomalies', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      await testData.createMerchantCategoryHistory(customer.id, ['grocery', 'gas', 'restaurant']);
      
      // Act - Transaction in unusual category
      const unusualTransaction = await testData.createTransaction(customer.id, {
        amount: 1200,
        merchantCategory: 'jewelry',
        merchant: 'Luxury Jewelry Store'
      });
      
      const result = await scenario.analyzeTransaction(unusualTransaction);
      
      // Assert
      expect(result.fraudScore).toBeGreaterThan(0.5);
      expect(result.patterns).toContain('merchant_category_anomaly');
      expect(result.merchantAnalysis.categoryRisk).toBe('high');
      expect(result.merchantAnalysis.firstTimeCategory).toBe(true);
    });
  });

  describe('Machine Learning Pattern Detection', () => {
    test('should detect card testing patterns', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      
      // Act - Simulate card testing (multiple small transactions)
      const cardTestingTransactions = await testData.createCardTestingPattern(customer.id);
      
      const results = [];
      for (const transaction of cardTestingTransactions) {
        const result = await scenario.analyzeTransaction(transaction);
        results.push(result);
      }
      
      // Assert
      const patternDetected = results.some(r => r.patterns.includes('card_testing'));
      expect(patternDetected).toBe(true);
      
      // Verify ML model was used
      const mlResults = results.filter(r => r.mlModelUsed);
      expect(mlResults.length).toBeGreaterThan(0);
      expect(mlResults[0].modelConfidence).toBeGreaterThan(0.8);
    });

    test('should identify account takeover patterns', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      await testData.establishNormalBehaviorPattern(customer.id);
      
      // Act - Simulate account takeover behavior
      const takeoverPattern = await testData.createAccountTakeoverPattern(customer.id);
      
      const results = [];
      for (const activity of takeoverPattern) {
        const result = await scenario.analyzeActivity(activity);
        results.push(result);
      }
      
      // Assert
      const takeoverDetected = results.some(r => r.patterns.includes('account_takeover'));
      expect(takeoverDetected).toBe(true);
      
      const highRiskResults = results.filter(r => r.fraudScore > 0.9);
      expect(highRiskResults.length).toBeGreaterThan(0);
      expect(highRiskResults[0].immediateAction).toBe('block_account');
    });

    test('should detect synthetic identity fraud', async () => {
      // Arrange
      const syntheticProfile = await testData.createSyntheticIdentityProfile();
      
      // Act
      const result = await scenario.analyzeSyntheticIdentity(syntheticProfile);
      
      // Assert
      expect(result.syntheticIdentityScore).toBeGreaterThan(0.8);
      expect(result.redFlags).toContain('inconsistent_identity_data');
      expect(result.redFlags).toContain('unusual_credit_pattern');
      expect(result.recommendedAction).toBe('reject_application');
    });
  });

  describe('Real-time Response and Prevention', () => {
    test('should trigger immediate transaction blocking', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const highRiskTransaction = await testData.createHighRiskTransaction(customer.id);
      
      // Act
      const result = await scenario.analyzeTransaction(highRiskTransaction);
      
      // Assert
      expect(result.fraudScore).toBeGreaterThan(0.95);
      expect(result.immediateAction).toBe('block_transaction');
      expect(result.transactionBlocked).toBe(true);
      
      // Verify transaction was actually blocked in the system
      const transactionStatus = await testEnv.getTransactionStatus(highRiskTransaction.id);
      expect(transactionStatus.status).toBe('blocked');
      expect(transactionStatus.reason).toBe('fraud_prevention');
    });

    test('should send real-time alerts to stakeholders', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const fraudulentTransaction = await testData.createFraudulentTransaction(customer.id);
      
      // Act
      const result = await scenario.analyzeTransaction(fraudulentTransaction);
      
      // Assert
      expect(result.fraudDetected).toBe(true);
      expect(result.alertsSent).toBe(true);
      
      // Verify alerts were sent
      const securityAlerts = await testEnv.getSecurityAlerts();
      expect(securityAlerts.length).toBeGreaterThan(0);
      expect(securityAlerts[0].severity).toBe('high');
      expect(securityAlerts[0].customerId).toBe(customer.id);
      
      // Verify customer notification
      const customerAlerts = await testEnv.getCustomerAlerts(customer.id);
      expect(customerAlerts.length).toBeGreaterThan(0);
      expect(customerAlerts[0].type).toBe('security_alert');
    });

    test('should coordinate with other agents via A2A protocol', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const suspiciousTransaction = await testData.createSuspiciousTransaction(customer.id);
      
      // Act
      const result = await scenario.analyzeTransaction(suspiciousTransaction);
      
      // Assert
      expect(result.fraudScore).toBeGreaterThan(0.7);
      
      // Verify A2A messages were sent
      const a2aMessages = await testEnv.getA2AMessages();
      const fraudAlerts = a2aMessages.filter(m => m.type === 'fraud_alert');
      expect(fraudAlerts.length).toBeGreaterThan(0);
      
      // Verify chatbot received the alert
      const chatbotMessages = a2aMessages.filter(m => m.to === 'chatbot-agent');
      expect(chatbotMessages.length).toBeGreaterThan(0);
      expect(chatbotMessages[0].payload.customerId).toBe(customer.id);
      expect(chatbotMessages[0].payload.alertType).toBe('fraud_detected');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle high transaction volume', async () => {
      // Arrange
      const customers = await testData.createMultipleCustomers(100);
      const transactions = [];
      
      // Create 1000 transactions across 100 customers
      for (const customer of customers) {
        const customerTransactions = await testData.createRandomTransactions(customer.id, 10);
        transactions.push(...customerTransactions);
      }
      
      // Act - Process all transactions concurrently
      const startTime = Date.now();
      const results = await Promise.all(
        transactions.map(transaction => scenario.analyzeTransaction(transaction))
      );
      const endTime = Date.now();
      
      // Assert
      expect(results.length).toBe(1000);
      
      // Verify performance - should process 1000 transactions in under 10 seconds
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000);
      
      // Verify all transactions were processed
      const processedResults = results.filter(r => r.processed);
      expect(processedResults.length).toBe(1000);
      
      // Verify fraud detection accuracy
      const fraudDetected = results.filter(r => r.fraudScore > 0.5);
      expect(fraudDetected.length).toBeGreaterThan(0); // Should detect some fraud in random data
    });

    test('should maintain accuracy under load', async () => {
      // Arrange
      const testSet = await testData.createLabeledFraudTestSet(500); // 500 labeled transactions
      
      // Act
      const results = await Promise.all(
        testSet.map(transaction => scenario.analyzeTransaction(transaction))
      );
      
      // Assert - Calculate accuracy metrics
      let truePositives = 0;
      let falsePositives = 0;
      let trueNegatives = 0;
      let falseNegatives = 0;
      
      results.forEach((result, index) => {
        const actualFraud = testSet[index].isFraud;
        const predictedFraud = result.fraudScore > 0.5;
        
        if (actualFraud && predictedFraud) truePositives++;
        else if (!actualFraud && predictedFraud) falsePositives++;
        else if (!actualFraud && !predictedFraud) trueNegatives++;
        else if (actualFraud && !predictedFraud) falseNegatives++;
      });
      
      const precision = truePositives / (truePositives + falsePositives);
      const recall = truePositives / (truePositives + falseNegatives);
      const accuracy = (truePositives + trueNegatives) / results.length;
      
      // Verify acceptable performance metrics
      expect(precision).toBeGreaterThan(0.8); // 80% precision
      expect(recall).toBeGreaterThan(0.7); // 70% recall
      expect(accuracy).toBeGreaterThan(0.85); // 85% accuracy
    });
  });

  describe('Integration with External Systems', () => {
    test('should integrate with MCP for transaction data', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const transaction = await testData.createTestTransaction(customer.id);
      
      // Act
      const result = await scenario.analyzeTransactionWithMCP(transaction);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.dataSource).toBe('mcp');
      
      // Verify MCP calls were made
      const mcpLogs = await testEnv.getMCPGatewayLogs();
      expect(mcpLogs).toContain(`GET /transactions/${transaction.id}`);
      expect(mcpLogs).toContain(`GET /customers/${customer.id}`);
    });

    test('should handle MCP service failures gracefully', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const transaction = await testData.createTestTransaction(customer.id);
      
      // Simulate MCP failure
      await testEnv.simulateServiceFailure('mcp-gateway');
      
      // Act
      const result = await scenario.analyzeTransaction(transaction);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.dataSource).toBe('cache');
      expect(result.degradedMode).toBe(true);
      expect(result.fraudScore).toBeDefined(); // Should still provide some analysis
      
      // Cleanup
      await testEnv.restoreService('mcp-gateway');
    });
  });
});