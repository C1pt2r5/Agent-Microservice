import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import axios from 'axios';
import WebSocket from 'ws';
import { TestDataGenerator } from '../utils/test-data-generator';
import { TestEnvironment } from '../utils/test-environment';
import { CustomerJourneyScenario } from '../scenarios/customer-journey-scenario';

describe('Customer Journey End-to-End Tests', () => {
  let testEnv: TestEnvironment;
  let testData: TestDataGenerator;
  let scenario: CustomerJourneyScenario;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    testData = new TestDataGenerator();
    scenario = new CustomerJourneyScenario(testEnv, testData);
    
    await testEnv.setup();
    await testEnv.waitForServicesReady();
  }, 60000);

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testData.resetTestData();
  });

  describe('Requirement 2: AI Chatbot Customer Support', () => {
    test('should handle customer transaction inquiry via chatbot', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const transactions = await testData.createTestTransactions(customer.id, 5);
      
      // Act - Customer asks about recent transactions
      const chatResponse = await scenario.customerAsksAboutTransactions(
        customer.id,
        'Show me my recent transactions'
      );
      
      // Assert
      expect(chatResponse.success).toBe(true);
      expect(chatResponse.data.transactions).toHaveLength(5);
      expect(chatResponse.data.transactions[0].customerId).toBe(customer.id);
      expect(chatResponse.responseTime).toBeLessThan(3000); // Response within 3 seconds
      
      // Verify chatbot retrieved data via MCP
      const mcpLogs = await testEnv.getMCPGatewayLogs();
      expect(mcpLogs).toContain(`GET /transactions?customerId=${customer.id}`);
    });

    test('should handle customer order status inquiry', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const order = await testData.createTestOrder(customer.id);
      
      // Act - Customer asks about order status
      const chatResponse = await scenario.customerAsksAboutOrder(
        customer.id,
        `What's the status of my order ${order.id}?`
      );
      
      // Assert
      expect(chatResponse.success).toBe(true);
      expect(chatResponse.data.order.id).toBe(order.id);
      expect(chatResponse.data.order.status).toBeDefined();
      expect(chatResponse.message).toContain(order.status);
    });

    test('should handle account information request', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      
      // Act - Customer asks about account details
      const chatResponse = await scenario.customerAsksAboutAccount(
        customer.id,
        'Show me my account information'
      );
      
      // Assert
      expect(chatResponse.success).toBe(true);
      expect(chatResponse.data.account.customerId).toBe(customer.id);
      expect(chatResponse.data.account.balance).toBeDefined();
      expect(chatResponse.data.account.accountNumber).toBeDefined();
      
      // Verify sensitive data is properly masked
      expect(chatResponse.message).not.toContain(customer.ssn);
      expect(chatResponse.message).toMatch(/\*\*\*\*\d{4}/); // Account number should be masked
    });

    test('should gracefully handle unknown queries', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      
      // Act - Customer asks something the bot can't handle
      const chatResponse = await scenario.customerAsksUnknownQuery(
        customer.id,
        'What is the meaning of life?'
      );
      
      // Assert
      expect(chatResponse.success).toBe(true);
      expect(chatResponse.escalated).toBe(true);
      expect(chatResponse.message).toContain('I can help you with banking');
      expect(chatResponse.supportOptions).toBeDefined();
      expect(chatResponse.supportOptions.length).toBeGreaterThan(0);
    });

    test('should handle chatbot service unavailability', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      await testEnv.stopService('chatbot-agent');
      
      // Act - Try to interact with chatbot
      const response = await scenario.customerTriesToChat(
        customer.id,
        'Hello, I need help'
      );
      
      // Assert
      expect(response.success).toBe(false);
      expect(response.fallbackActivated).toBe(true);
      expect(response.fallbackMessage).toContain('temporarily unavailable');
      expect(response.alternativeSupport).toBeDefined();
      
      // Cleanup
      await testEnv.startService('chatbot-agent');
      await testEnv.waitForServiceReady('chatbot-agent');
    });
  });

  describe('Requirement 3: Real-time Fraud Detection', () => {
    test('should detect suspicious transaction patterns in real-time', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const suspiciousTransactions = await testData.createSuspiciousTransactionPattern(customer.id);
      
      // Act - Process transactions through fraud detection
      const results = [];
      for (const transaction of suspiciousTransactions) {
        const result = await scenario.processTransaction(transaction);
        results.push(result);
      }
      
      // Assert
      const flaggedTransactions = results.filter(r => r.fraudScore > 0.7);
      expect(flaggedTransactions.length).toBeGreaterThan(0);
      
      // Verify real-time processing (within 500ms)
      results.forEach(result => {
        expect(result.processingTime).toBeLessThan(500);
      });
      
      // Verify fraud alerts were sent via A2A
      const a2aMessages = await testEnv.getA2AMessages('fraud-alerts');
      expect(a2aMessages.length).toBeGreaterThan(0);
      expect(a2aMessages[0].type).toBe('fraud-alert');
    });

    test('should identify anomalous banking behavior', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const normalPattern = await testData.createNormalBankingPattern(customer.id);
      const anomalousActivity = await testData.createAnomalousBankingActivity(customer.id);
      
      // Act - Establish baseline with normal pattern
      for (const activity of normalPattern) {
        await scenario.processTransaction(activity);
      }
      
      // Process anomalous activity
      const anomalyResult = await scenario.processTransaction(anomalousActivity);
      
      // Assert
      expect(anomalyResult.anomalyDetected).toBe(true);
      expect(anomalyResult.anomalyScore).toBeGreaterThan(0.8);
      expect(anomalyResult.reasons).toContain('unusual_amount');
      expect(anomalyResult.preventiveActions).toBeDefined();
    });

    test('should detect unusual shopping patterns', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const unusualShoppingPattern = await testData.createUnusualShoppingPattern(customer.id);
      
      // Act
      const results = [];
      for (const purchase of unusualShoppingPattern) {
        const result = await scenario.processPurchase(purchase);
        results.push(result);
      }
      
      // Assert
      const suspiciousPurchases = results.filter(r => r.suspiciousActivity);
      expect(suspiciousPurchases.length).toBeGreaterThan(0);
      
      // Verify stakeholder notification
      const notifications = await testEnv.getNotifications('security-team');
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].type).toBe('suspicious-shopping-pattern');
    });

    test('should trigger preventive actions when fraud is detected', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const fraudulentTransaction = await testData.createFraudulentTransaction(customer.id);
      
      // Act
      const result = await scenario.processTransaction(fraudulentTransaction);
      
      // Assert
      expect(result.fraudDetected).toBe(true);
      expect(result.preventiveActions).toContain('transaction_blocked');
      expect(result.preventiveActions).toContain('account_flagged');
      
      // Verify account was actually flagged
      const accountStatus = await testEnv.getAccountStatus(customer.id);
      expect(accountStatus.flagged).toBe(true);
      expect(accountStatus.reason).toBe('fraud_detection');
      
      // Verify notifications were sent
      const customerNotification = await testEnv.getCustomerNotifications(customer.id);
      expect(customerNotification.length).toBeGreaterThan(0);
      expect(customerNotification[0].type).toBe('security_alert');
    });
  });

  describe('Requirement 4: Personalized Recommendations', () => {
    test('should provide relevant product recommendations based on history', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const purchaseHistory = await testData.createPurchaseHistory(customer.id, 'electronics');
      
      // Act
      const recommendations = await scenario.getProductRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.products.length).toBeGreaterThan(0);
      expect(recommendations.products[0].category).toBe('electronics');
      expect(recommendations.confidence).toBeGreaterThan(0.7);
      expect(recommendations.personalized).toBe(true);
    });

    test('should generate personalized financial service recommendations', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const financialProfile = await testData.createFinancialProfile(customer.id, 'high_saver');
      
      // Act
      const recommendations = await scenario.getFinancialRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.services.length).toBeGreaterThan(0);
      expect(recommendations.services).toContainEqual(
        expect.objectContaining({ type: 'savings_account' })
      );
      expect(recommendations.reasoning).toBeDefined();
    });

    test('should consider real-time context in recommendations', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const recentActivity = await testData.createRecentActivity(customer.id, 'travel_booking');
      
      // Act
      const recommendations = await scenario.getContextualRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.contextConsidered).toBe(true);
      expect(recommendations.products.some(p => p.category === 'travel')).toBe(true);
      expect(recommendations.realTimeFactors).toContain('recent_travel_activity');
    });

    test('should intelligently merge multiple recommendation sources', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      await testData.createMultipleRecommendationSources(customer.id);
      
      // Act
      const recommendations = await scenario.getMergedRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.sources.length).toBeGreaterThan(1);
      expect(recommendations.merged).toBe(true);
      expect(recommendations.products.length).toBeGreaterThan(0);
      
      // Verify prioritization logic
      const topRecommendation = recommendations.products[0];
      expect(topRecommendation.priority).toBe('high');
      expect(topRecommendation.sourceCount).toBeGreaterThan(1);
    });

    test('should provide default recommendations when data is unavailable', async () => {
      // Arrange
      const newCustomer = await testData.createTestCustomer({ newUser: true });
      
      // Act
      const recommendations = await scenario.getRecommendations(newCustomer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.type).toBe('default');
      expect(recommendations.products.length).toBeGreaterThan(0);
      expect(recommendations.products[0].popular).toBe(true);
    });
  });

  describe('Cross-Agent Integration Scenarios', () => {
    test('should demonstrate fraud detection to chatbot communication', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const suspiciousTransaction = await testData.createSuspiciousTransaction(customer.id);
      
      // Act - Process suspicious transaction
      await scenario.processTransaction(suspiciousTransaction);
      
      // Customer asks chatbot about recent activity
      const chatResponse = await scenario.customerAsksAboutTransactions(
        customer.id,
        'Are there any issues with my recent transactions?'
      );
      
      // Assert
      expect(chatResponse.success).toBe(true);
      expect(chatResponse.securityAlert).toBe(true);
      expect(chatResponse.message).toContain('security review');
      
      // Verify A2A communication occurred
      const a2aMessages = await testEnv.getA2AMessages('chatbot-fraud-alerts');
      expect(a2aMessages.length).toBeGreaterThan(0);
      expect(a2aMessages[0].from).toBe('fraud-detection-agent');
      expect(a2aMessages[0].to).toBe('chatbot-agent');
    });

    test('should demonstrate recommendation agent requesting fraud insights', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      await testData.createTransactionHistory(customer.id);
      
      // Act
      const recommendations = await scenario.getSecurityAwareRecommendations(customer.id);
      
      // Assert
      expect(recommendations.success).toBe(true);
      expect(recommendations.securityFactorsConsidered).toBe(true);
      
      // Verify A2A communication between recommendation and fraud detection agents
      const a2aMessages = await testEnv.getA2AMessages('recommendation-fraud-insights');
      expect(a2aMessages.length).toBeGreaterThan(0);
      expect(a2aMessages[0].from).toBe('recommendation-agent');
      expect(a2aMessages[0].to).toBe('fraud-detection-agent');
      expect(a2aMessages[0].type).toBe('insight-request');
    });
  });

  describe('System Resilience Scenarios', () => {
    test('should handle individual agent failures gracefully', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      
      // Act - Stop fraud detection agent
      await testEnv.stopService('fraud-detection-agent');
      
      // Try to process transaction
      const transaction = await testData.createTestTransaction(customer.id);
      const result = await scenario.processTransaction(transaction);
      
      // Assert - Transaction should still process with degraded fraud detection
      expect(result.success).toBe(true);
      expect(result.fraudDetectionStatus).toBe('unavailable');
      expect(result.fallbackSecurity).toBe(true);
      
      // Cleanup
      await testEnv.startService('fraud-detection-agent');
    });

    test('should maintain system functionality during MCP gateway issues', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      
      // Act - Simulate MCP gateway issues
      await testEnv.simulateNetworkIssues('mcp-gateway');
      
      const chatResponse = await scenario.customerAsksAboutAccount(
        customer.id,
        'Show me my account balance'
      );
      
      // Assert
      expect(chatResponse.success).toBe(true);
      expect(chatResponse.dataSource).toBe('cache');
      expect(chatResponse.message).toContain('cached information');
      
      // Cleanup
      await testEnv.restoreNetworkConnectivity('mcp-gateway');
    });
  });
});