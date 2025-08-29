import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { TestDataGenerator } from '../utils/test-data-generator';
import { TestEnvironment } from '../utils/test-environment';
import { PerformanceScenario } from '../scenarios/performance-scenario';

describe('Performance and Load Testing', () => {
  let testEnv: TestEnvironment;
  let testData: TestDataGenerator;
  let scenario: PerformanceScenario;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    testData = new TestDataGenerator();
    scenario = new PerformanceScenario(testEnv, testData);
    
    await testEnv.setup();
    await testEnv.waitForServicesReady();
    await testEnv.scaleForLoadTesting(); // Scale up services for load testing
  }, 120000);

  afterAll(async () => {
    await testEnv.scaleDown(); // Scale back down
    await testEnv.cleanup();
  });

  describe('High Volume Transaction Processing', () => {
    test('should handle 10,000 concurrent transactions', async () => {
      // Arrange
      const customers = await testData.createMultipleCustomers(1000);
      const transactions = [];
      
      // Create 10,000 transactions
      for (let i = 0; i < 10000; i++) {
        const customer = customers[i % 1000];
        const transaction = await testData.createRandomTransaction(customer.id);
        transactions.push(transaction);
      }
      
      // Act - Process all transactions concurrently
      const startTime = Date.now();
      const results = await Promise.allSettled(
        transactions.map(transaction => scenario.processTransactionWithTimeout(transaction, 5000))
      );
      const endTime = Date.now();
      
      // Assert
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      expect(successful).toBeGreaterThan(9500); // 95% success rate minimum
      expect(failed).toBeLessThan(500);
      
      // Performance requirements
      const totalTime = endTime - startTime;
      const throughput = successful / (totalTime / 1000); // transactions per second
      
      expect(throughput).toBeGreaterThan(100); // At least 100 TPS
      expect(totalTime).toBeLessThan(60000); // Complete within 60 seconds
      
      // Verify system stability
      const systemMetrics = await testEnv.getSystemMetrics();
      expect(systemMetrics.cpuUsage).toBeLessThan(90);
      expect(systemMetrics.memoryUsage).toBeLessThan(85);
    });

    test('should maintain fraud detection accuracy under load', async () => {
      // Arrange
      const fraudTestSet = await testData.createLabeledFraudTestSet(5000);
      const legitimateTestSet = await testData.createLegitimateTransactionSet(5000);
      const allTransactions = [...fraudTestSet, ...legitimateTestSet];
      
      // Shuffle to simulate realistic load
      const shuffledTransactions = testData.shuffleArray(allTransactions);
      
      // Act - Process under load
      const startTime = Date.now();
      const results = await Promise.all(
        shuffledTransactions.map(transaction => scenario.analyzeFraudUnderLoad(transaction))
      );
      const endTime = Date.now();
      
      // Assert - Performance
      const totalTime = endTime - startTime;
      const avgProcessingTime = totalTime / results.length;
      expect(avgProcessingTime).toBeLessThan(100); // Under 100ms per transaction
      
      // Assert - Accuracy
      let truePositives = 0, falsePositives = 0, trueNegatives = 0, falseNegatives = 0;
      
      results.forEach((result, index) => {
        const actualFraud = shuffledTransactions[index].isFraud;
        const predictedFraud = result.fraudScore > 0.5;
        
        if (actualFraud && predictedFraud) truePositives++;
        else if (!actualFraud && predictedFraud) falsePositives++;
        else if (!actualFraud && !predictedFraud) trueNegatives++;
        else falseNegatives++;
      });
      
      const precision = truePositives / (truePositives + falsePositives);
      const recall = truePositives / (truePositives + falseNegatives);
      
      expect(precision).toBeGreaterThan(0.75); // Maintain 75% precision under load
      expect(recall).toBeGreaterThan(0.70); // Maintain 70% recall under load
    });
  });

  describe('Chatbot Concurrent User Handling', () => {
    test('should handle 1000 concurrent chat sessions', async () => {
      // Arrange
      const customers = await testData.createMultipleCustomers(1000);
      const chatSessions = customers.map(customer => ({
        customerId: customer.id,
        sessionId: `session_${customer.id}`,
        messages: testData.generateChatMessages(10) // 10 messages per session
      }));
      
      // Act - Start all chat sessions concurrently
      const startTime = Date.now();
      const sessionPromises = chatSessions.map(session => 
        scenario.runConcurrentChatSession(session)
      );
      
      const results = await Promise.allSettled(sessionPromises);
      const endTime = Date.now();
      
      // Assert
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(950); // 95% success rate
      
      // Performance metrics
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(30000); // Complete within 30 seconds
      
      // Verify response times
      const successfulResults = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);
      
      const avgResponseTime = successfulResults.reduce((sum, result) => 
        sum + result.avgResponseTime, 0) / successfulResults.length;
      
      expect(avgResponseTime).toBeLessThan(2000); // Under 2 seconds average response
      
      // Verify WebSocket connections remained stable
      const wsMetrics = await testEnv.getWebSocketMetrics();
      expect(wsMetrics.activeConnections).toBeGreaterThan(950);
      expect(wsMetrics.connectionErrors).toBeLessThan(50);
    });

    test('should handle message bursts without dropping messages', async () => {
      // Arrange
      const customer = await testData.createTestCustomer();
      const burstMessages = testData.generateMessageBurst(100, 1000); // 100 messages in 1 second
      
      // Act
      const results = await scenario.sendMessageBurst(customer.id, burstMessages);
      
      // Assert
      expect(results.messagesReceived).toBe(100);
      expect(results.messagesProcessed).toBe(100);
      expect(results.messagesDropped).toBe(0);
      
      // Verify message ordering
      expect(results.messageOrder).toBe('preserved');
      
      // Verify response times under burst
      expect(results.maxResponseTime).toBeLessThan(5000);
      expect(results.avgResponseTime).toBeLessThan(3000);
    });
  });

  describe('Recommendation Engine Scalability', () => {
    test('should generate recommendations for 10,000 users simultaneously', async () => {
      // Arrange
      const customers = await testData.createMultipleCustomers(10000);
      
      // Act - Request recommendations for all customers
      const startTime = Date.now();
      const recommendationPromises = customers.map(customer => 
        scenario.getRecommendationsWithTimeout(customer.id, 10000)
      );
      
      const results = await Promise.allSettled(recommendationPromises);
      const endTime = Date.now();
      
      // Assert
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(9500); // 95% success rate
      
      // Performance requirements
      const totalTime = endTime - startTime;
      const throughput = successful / (totalTime / 1000);
      
      expect(throughput).toBeGreaterThan(50); // At least 50 recommendations per second
      expect(totalTime).toBeLessThan(120000); // Complete within 2 minutes
      
      // Verify recommendation quality wasn't compromised
      const successfulResults = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);
      
      const avgConfidence = successfulResults.reduce((sum, result) => 
        sum + result.avgConfidenceScore, 0) / successfulResults.length;
      
      expect(avgConfidence).toBeGreaterThan(0.6); // Maintain quality under load
    });

    test('should handle recommendation cache efficiently under load', async () => {
      // Arrange
      const customers = await testData.createMultipleCustomers(5000);
      
      // Pre-warm cache with some customers
      const cacheWarmupCustomers = customers.slice(0, 1000);
      for (const customer of cacheWarmupCustomers) {
        await scenario.getRecommendations(customer.id);
      }
      
      // Act - Mix of cached and non-cached requests
      const mixedRequests = customers.map(customer => 
        scenario.getRecommendationsWithCacheMetrics(customer.id)
      );
      
      const results = await Promise.all(mixedRequests);
      
      // Assert
      const cacheHits = results.filter(r => r.cacheHit).length;
      const cacheMisses = results.filter(r => !r.cacheHit).length;
      
      expect(cacheHits).toBeGreaterThan(800); // Good cache hit rate
      
      // Cache hits should be much faster
      const cacheHitTimes = results.filter(r => r.cacheHit).map(r => r.responseTime);
      const cacheMissTimes = results.filter(r => !r.cacheHit).map(r => r.responseTime);
      
      const avgCacheHitTime = cacheHitTimes.reduce((a, b) => a + b, 0) / cacheHitTimes.length;
      const avgCacheMissTime = cacheMissTimes.reduce((a, b) => a + b, 0) / cacheMissTimes.length;
      
      expect(avgCacheHitTime).toBeLessThan(avgCacheMissTime * 0.1); // Cache hits 10x faster
    });
  });

  describe('A2A Communication Performance', () => {
    test('should handle high-volume inter-agent messaging', async () => {
      // Arrange
      const messageVolume = 50000;
      const messages = await testData.createA2AMessages(messageVolume);
      
      // Act - Send all messages
      const startTime = Date.now();
      const results = await Promise.allSettled(
        messages.map(message => scenario.sendA2AMessage(message))
      );
      const endTime = Date.now();
      
      // Assert
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(messageVolume * 0.98); // 98% success rate
      
      // Performance metrics
      const totalTime = endTime - startTime;
      const throughput = successful / (totalTime / 1000);
      
      expect(throughput).toBeGreaterThan(500); // At least 500 messages per second
      
      // Verify message delivery
      const deliveryMetrics = await testEnv.getA2ADeliveryMetrics();
      expect(deliveryMetrics.averageDeliveryTime).toBeLessThan(100); // Under 100ms
      expect(deliveryMetrics.messageOrdering).toBe('preserved');
    });

    test('should maintain message ordering under concurrent load', async () => {
      // Arrange
      const agents = ['chatbot-agent', 'fraud-detection-agent', 'recommendation-agent'];
      const messageSequences = agents.map(agent => 
        testData.createOrderedMessageSequence(agent, 1000)
      );
      
      // Act - Send sequences concurrently
      const results = await Promise.all(
        messageSequences.map(sequence => scenario.sendOrderedMessages(sequence))
      );
      
      // Assert
      results.forEach(result => {
        expect(result.orderPreserved).toBe(true);
        expect(result.messagesDelivered).toBe(1000);
        expect(result.duplicateMessages).toBe(0);
      });
    });
  });

  describe('MCP Gateway Load Testing', () => {
    test('should handle concurrent API requests efficiently', async () => {
      // Arrange
      const apiRequests = [];
      for (let i = 0; i < 5000; i++) {
        apiRequests.push(testData.createRandomAPIRequest());
      }
      
      // Act
      const startTime = Date.now();
      const results = await Promise.allSettled(
        apiRequests.map(request => scenario.makeMCPRequest(request))
      );
      const endTime = Date.now();
      
      // Assert
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(4750); // 95% success rate
      
      // Performance requirements
      const totalTime = endTime - startTime;
      const throughput = successful / (totalTime / 1000);
      
      expect(throughput).toBeGreaterThan(200); // At least 200 requests per second
      
      // Verify rate limiting is working
      const rateLimitMetrics = await testEnv.getMCPRateLimitMetrics();
      expect(rateLimitMetrics.rateLimitHits).toBeGreaterThan(0);
      expect(rateLimitMetrics.circuitBreakerTrips).toBeLessThan(10);
    });

    test('should handle circuit breaker scenarios gracefully', async () => {
      // Arrange - Simulate downstream service failures
      await testEnv.simulateDownstreamFailures(['user-service', 'transaction-service']);
      
      const requests = [];
      for (let i = 0; i < 1000; i++) {
        requests.push(testData.createAPIRequest('user-service'));
      }
      
      // Act
      const results = await Promise.all(
        requests.map(request => scenario.makeMCPRequestWithCircuitBreaker(request))
      );
      
      // Assert
      const circuitBreakerResponses = results.filter(r => r.circuitBreakerOpen);
      expect(circuitBreakerResponses.length).toBeGreaterThan(800); // Most should hit circuit breaker
      
      // Verify fast failure
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      expect(avgResponseTime).toBeLessThan(100); // Fast failure under 100ms
      
      // Cleanup
      await testEnv.restoreDownstreamServices();
    });
  });

  describe('System Resource Utilization', () => {
    test('should maintain acceptable resource usage under peak load', async () => {
      // Arrange - Create peak load scenario
      const peakLoadTasks = [
        scenario.simulateTransactionLoad(1000),
        scenario.simulateChatLoad(500),
        scenario.simulateRecommendationLoad(2000),
        scenario.simulateA2ALoad(5000)
      ];
      
      // Act - Run all loads simultaneously
      const startTime = Date.now();
      await Promise.all(peakLoadTasks);
      const endTime = Date.now();
      
      // Assert - Check resource utilization
      const resourceMetrics = await testEnv.getResourceMetrics();
      
      expect(resourceMetrics.cpu.average).toBeLessThan(80); // Under 80% CPU
      expect(resourceMetrics.memory.average).toBeLessThan(85); // Under 85% memory
      expect(resourceMetrics.network.utilization).toBeLessThan(90); // Under 90% network
      
      // Verify no service degradation
      expect(resourceMetrics.services.unhealthy).toBe(0);
      expect(resourceMetrics.services.responding).toBe(resourceMetrics.services.total);
      
      // Check for memory leaks
      const memoryTrend = await testEnv.getMemoryTrend(startTime, endTime);
      expect(memoryTrend.slope).toBeLessThan(0.1); // Minimal memory growth
    });

    test('should auto-scale appropriately under varying load', async () => {
      // Arrange - Start with baseline load
      await scenario.applyBaselineLoad();
      const initialScale = await testEnv.getCurrentScale();
      
      // Act - Gradually increase load
      await scenario.graduallyIncreaseLoad(5, 60000); // 5 steps over 1 minute
      
      // Assert - Verify scaling occurred
      const finalScale = await testEnv.getCurrentScale();
      expect(finalScale.totalReplicas).toBeGreaterThan(initialScale.totalReplicas);
      
      // Verify scaling decisions were appropriate
      const scalingEvents = await testEnv.getScalingEvents();
      expect(scalingEvents.length).toBeGreaterThan(0);
      
      scalingEvents.forEach(event => {
        expect(event.reason).toBeDefined();
        expect(event.metricValue).toBeGreaterThan(event.threshold);
      });
      
      // Act - Reduce load
      await scenario.reduceLoad();
      
      // Assert - Verify scale down
      await testData.wait(120000); // Wait for scale down
      const scaledDownState = await testEnv.getCurrentScale();
      expect(scaledDownState.totalReplicas).toBeLessThan(finalScale.totalReplicas);
    });
  });

  describe('Database Performance Under Load', () => {
    test('should maintain database performance with concurrent queries', async () => {
      // Arrange
      const queryLoad = [];
      for (let i = 0; i < 10000; i++) {
        queryLoad.push(testData.createRandomDatabaseQuery());
      }
      
      // Act
      const startTime = Date.now();
      const results = await Promise.allSettled(
        queryLoad.map(query => scenario.executeDatabaseQuery(query))
      );
      const endTime = Date.now();
      
      // Assert
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(9500); // 95% success rate
      
      // Performance metrics
      const totalTime = endTime - startTime;
      const queryThroughput = successful / (totalTime / 1000);
      
      expect(queryThroughput).toBeGreaterThan(100); // At least 100 queries per second
      
      // Verify database health
      const dbMetrics = await testEnv.getDatabaseMetrics();
      expect(dbMetrics.connectionPoolUtilization).toBeLessThan(90);
      expect(dbMetrics.averageQueryTime).toBeLessThan(500); // Under 500ms
      expect(dbMetrics.slowQueries).toBeLessThan(100); // Less than 1% slow queries
    });
  });
});