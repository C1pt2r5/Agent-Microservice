import { IntegrationTestFramework } from './integration-test-framework';

// Example Agent Communication Tests
export async function testAgentCommunication(framework: IntegrationTestFramework): Promise<void> {
  const testConfig = {
    testName: 'Basic Agent Communication',
    agents: [
      { name: 'chatbot', type: 'chatbot-agent' },
      { name: 'fraud-detection', type: 'fraud-detection-agent' },
      { name: 'recommendation', type: 'recommendation-agent' }
    ],
    scenarios: [
      {
        type: 'message_exchange',
        config: {
          fromAgent: 'chatbot',
          toAgent: 'fraud-detection',
          messageCount: 10,
          interval: 1000
        }
      },
      {
        type: 'message_exchange',
        config: {
          fromAgent: 'fraud-detection',
          toAgent: 'recommendation',
          messageCount: 5,
          interval: 2000
        }
      }
    ],
    duration: 30000 // 30 seconds
  };

  const results = await framework.runAgentCommunicationTest(testConfig);
  
  // Assertions
  if (results.failedMessages > 0) {
    throw new Error(`Communication test failed: ${results.failedMessages} failed messages`);
  }
  
  if (results.averageLatency > 1000) {
    throw new Error(`High latency detected: ${results.averageLatency}ms`);
  }
  
  console.log(`✓ Agent communication test passed: ${results.successfulMessages} messages exchanged`);
}

export async function testFraudDetectionWorkflow(framework: IntegrationTestFramework): Promise<void> {
  const testConfig = {
    testName: 'Fraud Detection End-to-End Workflow',
    scenario: 'fraud_detection',
    steps: [
      {
        name: 'Create suspicious transaction',
        execute: async (fw: IntegrationTestFramework, testData: any) => {
          const dataManager = fw.getDataManager();
          const customer = testData.customers[0];
          
          // Create a high-risk transaction
          const suspiciousTransaction = await dataManager.generateSyntheticWorkload('transaction_processing', 1);
          
          // Simulate transaction processing
          const mockServices = fw.getMockServices();
          await mockServices.configureMockResponse('external-apis', 'POST /api/transactions', {
            id: 'txn_suspicious_001',
            status: 'pending',
            riskScore: 0.95
          });
        }
      },
      {
        name: 'Fraud detection analysis',
        execute: async (fw: IntegrationTestFramework, testData: any) => {
          const testHarness = fw.getTestHarness();
          
          // Create test session with fraud detection agent
          const sessionId = await testHarness.createTestSession({
            name: 'fraud-detection-test',
            agents: [{ name: 'fraud-detection', type: 'fraud-detection-agent' }]
          });
          
          await testHarness.startTestSession(sessionId);
          
          // Send transaction for analysis
          const result = await testHarness.sendAgentMessage(
            sessionId,
            'system',
            'fraud-detection',
            {
              type: 'analyze_transaction',
              transactionId: 'txn_suspicious_001',
              amount: 10000,
              location: 'Unknown Location'
            }
          );
          
          if (!result.success) {
            throw new Error('Failed to send transaction for analysis');
          }
          
          await testHarness.stopTestSession(sessionId);
        }
      },
      {
        name: 'Alert notification',
        execute: async (fw: IntegrationTestFramework, testData: any) => {
          const environment = fw.getEnvironment();
          
          // Check if fraud alert was generated
          const notifications = await environment.getNotifications('fraud-alerts');
          
          if (notifications.length === 0) {
            throw new Error('No fraud alert notifications found');
          }
          
          const fraudAlert = notifications.find(n => n.type === 'fraud_alert');
          if (!fraudAlert) {
            throw new Error('Fraud alert notification not found');
          }
          
          console.log('✓ Fraud alert notification generated successfully');
        }
      },
      {
        name: 'Customer notification',
        execute: async (fw: IntegrationTestFramework, testData: any) => {
          const environment = fw.getEnvironment();
          const customer = testData.customers[0];
          
          // Check if customer was notified
          const customerNotifications = await environment.getCustomerNotifications(customer.id);
          
          const securityAlert = customerNotifications.find(n => n.type === 'security_alert');
          if (!securityAlert) {
            throw new Error('Customer security alert not found');
          }
          
          console.log('✓ Customer security notification sent successfully');
        }
      }
    ]
  };

  const results = await framework.runEndToEndTest(testConfig);
  
  if (!results.success) {
    throw new Error(`Fraud detection workflow failed: ${results.error}`);
  }
  
  console.log('✓ Fraud detection end-to-end workflow completed successfully');
}

export async function testChatbotCustomerInteraction(framework: IntegrationTestFramework): Promise<void> {
  const testConfig = {
    testName: 'Chatbot Customer Interaction',
    scenario: 'simple_chat',
    steps: [
      {
        name: 'Initialize chat session',
        execute: async (fw: IntegrationTestFramework, testData: any) => {
          const testHarness = fw.getTestHarness();
          const customer = testData.customers[0];
          
          const sessionId = await testHarness.createTestSession({
            name: 'chatbot-interaction-test',
            agents: [{ name: 'chatbot', type: 'chatbot-agent' }]
          });
          
          await testHarness.startTestSession(sessionId);
          
          // Store session ID for later steps
          testData.sessionId = sessionId;
        }
      },
      {
        name: 'Customer asks about balance',
        execute: async (fw: IntegrationTestFramework, testData: any) => {
          const testHarness = fw.getTestHarness();
          
          const result = await testHarness.sendAgentMessage(
            testData.sessionId,
            'customer',
            'chatbot',
            {
              type: 'chat_message',
              content: 'What is my account balance?',
              customerId: testData.customers[0].id
            }
          );
          
          if (!result.success) {
            throw new Error('Failed to send chat message');
          }
          
          // Verify response latency
          if (result.latency > 2000) {
            throw new Error(`Chatbot response too slow: ${result.latency}ms`);
          }
        }
      },
      {
        name: 'Chatbot provides account information',
        execute: async (fw: IntegrationTestFramework, testData: any) => {
          const mockServices = fw.getMockServices();
          
          // Verify that chatbot accessed account information
          const mcpService = mockServices.getMockService('mcp');
          const metrics = mcpService?.getMetrics();
          
          if (!metrics || metrics.requestCount === 0) {
            throw new Error('Chatbot did not access account information via MCP');
          }
          
          console.log('✓ Chatbot successfully accessed account information');
        }
      },
      {
        name: 'Cleanup chat session',
        execute: async (fw: IntegrationTestFramework, testData: any) => {
          const testHarness = fw.getTestHarness();
          await testHarness.stopTestSession(testData.sessionId);
        }
      }
    ]
  };

  const results = await framework.runEndToEndTest(testConfig);
  
  if (!results.success) {
    throw new Error(`Chatbot interaction test failed: ${results.error}`);
  }
  
  console.log('✓ Chatbot customer interaction test completed successfully');
}

export async function testRecommendationEngine(framework: IntegrationTestFramework): Promise<void> {
  const testConfig = {
    testName: 'Recommendation Engine Test',
    scenario: 'recommendation',
    steps: [
      {
        name: 'Setup customer with purchase history',
        execute: async (fw: IntegrationTestFramework, testData: any) => {
          const dataManager = fw.getDataManager();
          
          // Create customer with specific purchase patterns
          const customer = testData.customers[0];
          const purchaseHistory = await dataManager.createRecommendationTestData();
          
          testData.purchaseHistory = purchaseHistory;
        }
      },
      {
        name: 'Request product recommendations',
        execute: async (fw: IntegrationTestFramework, testData: any) => {
          const testHarness = fw.getTestHarness();
          
          const sessionId = await testHarness.createTestSession({
            name: 'recommendation-test',
            agents: [{ name: 'recommendation', type: 'recommendation-agent' }]
          });
          
          await testHarness.startTestSession(sessionId);
          
          const result = await testHarness.sendAgentMessage(
            sessionId,
            'system',
            'recommendation',
            {
              type: 'get_recommendations',
              customerId: testData.customers[0].id,
              category: 'electronics',
              limit: 5
            }
          );
          
          if (!result.success) {
            throw new Error('Failed to get recommendations');
          }
          
          testData.sessionId = sessionId;
        }
      },
      {
        name: 'Verify recommendation quality',
        execute: async (fw: IntegrationTestFramework, testData: any) => {
          const mockServices = fw.getMockServices();
          
          // Configure Gemini to return specific recommendations
          const geminiService = mockServices.getMockService('gemini');
          await geminiService?.configureResponse('recommendation_request', {
            recommendations: [
              { productId: 'prod_123', score: 0.92, reason: 'Based on purchase history' },
              { productId: 'prod_456', score: 0.87, reason: 'Similar customers liked this' }
            ]
          });
          
          // Verify recommendations were generated
          const metrics = geminiService?.getMetrics();
          if (!metrics || metrics.requestCount === 0) {
            throw new Error('Recommendation engine did not use AI for recommendations');
          }
        }
      },
      {
        name: 'Cleanup recommendation session',
        execute: async (fw: IntegrationTestFramework, testData: any) => {
          const testHarness = fw.getTestHarness();
          await testHarness.stopTestSession(testData.sessionId);
        }
      }
    ]
  };

  const results = await framework.runEndToEndTest(testConfig);
  
  if (!results.success) {
    throw new Error(`Recommendation engine test failed: ${results.error}`);
  }
  
  console.log('✓ Recommendation engine test completed successfully');
}

export async function testSystemLoadHandling(framework: IntegrationTestFramework): Promise<void> {
  const loadTestConfig = {
    testName: 'System Load Test',
    workloadType: 'mixed',
    intensity: 100, // 100 requests per second
    concurrentSessions: 10,
    duration: 60000, // 1 minute
    agents: [
      { name: 'chatbot', type: 'chatbot-agent' },
      { name: 'fraud-detection', type: 'fraud-detection-agent' },
      { name: 'recommendation', type: 'recommendation-agent' }
    ],
    scaleServices: true
  };

  const results = await framework.runLoadTest(loadTestConfig);
  
  // Verify performance criteria
  if (results.errorRate > 0.05) { // 5% error threshold
    throw new Error(`High error rate during load test: ${(results.errorRate * 100).toFixed(2)}%`);
  }
  
  if (results.averageLatency > 2000) { // 2 second latency threshold
    throw new Error(`High latency during load test: ${results.averageLatency}ms`);
  }
  
  if (results.throughput < 50) { // Minimum 50 requests per second
    throw new Error(`Low throughput during load test: ${results.throughput} req/s`);
  }
  
  console.log(`✓ Load test passed: ${results.throughput} req/s, ${results.averageLatency}ms avg latency`);
}

export async function testFailureRecovery(framework: IntegrationTestFramework): Promise<void> {
  const failureTestConfig = {
    testName: 'Agent Failure Recovery Test',
    agents: [
      { name: 'chatbot', type: 'chatbot-agent' },
      { name: 'fraud-detection', type: 'fraud-detection-agent' }
    ],
    duration: 120000, // 2 minutes
    failures: [
      {
        type: 'agent_failure' as const,
        target: 'fraud-detection',
        duration: 30000 // 30 seconds
      },
      {
        type: 'network_partition' as const,
        target: 'chatbot',
        duration: 20000 // 20 seconds
      }
    ],
    maxRecoveryTime: 60000 // 1 minute max recovery time
  };

  const results = await framework.runFailureRecovery(failureTestConfig);
  
  if (!results.success) {
    throw new Error(`Failure recovery test failed: recovery time ${results.recoveryTime}ms exceeded threshold`);
  }
  
  if (results.recoveryTime > failureTestConfig.maxRecoveryTime) {
    throw new Error(`Recovery took too long: ${results.recoveryTime}ms`);
  }
  
  console.log(`✓ Failure recovery test passed: recovered in ${results.recoveryTime}ms`);
}

// Test Suite Definitions
export const agentCommunicationSuite = {
  tests: [
    testAgentCommunication
  ],
  allowParallel: false,
  setup: async (framework: IntegrationTestFramework) => {
    console.log('Setting up agent communication test suite...');
    // Ensure all agents are running
    await framework.getEnvironment().waitForServicesReady();
  },
  teardown: async (framework: IntegrationTestFramework) => {
    console.log('Tearing down agent communication test suite...');
    // Reset any test-specific configurations
  }
};

export const endToEndSuite = {
  tests: [
    testFraudDetectionWorkflow,
    testChatbotCustomerInteraction,
    testRecommendationEngine
  ],
  allowParallel: false,
  setup: async (framework: IntegrationTestFramework) => {
    console.log('Setting up end-to-end test suite...');
    // Configure mock services for realistic responses
    const mockServices = framework.getMockServices();
    
    // Configure Gemini for consistent AI responses
    const geminiService = mockServices.getMockService('gemini');
    await geminiService?.configureResponse('fraud_analysis', {
      riskScore: 0.95,
      riskLevel: 'HIGH',
      recommendation: 'BLOCK_TRANSACTION'
    });
  }
};

export const performanceSuite = {
  tests: [
    testSystemLoadHandling,
    testFailureRecovery
  ],
  allowParallel: false,
  setup: async (framework: IntegrationTestFramework) => {
    console.log('Setting up performance test suite...');
    // Prepare system for performance testing
    await framework.getEnvironment().scaleForLoadTesting();
  },
  teardown: async (framework: IntegrationTestFramework) => {
    console.log('Tearing down performance test suite...');
    // Scale back down after performance tests
    await framework.getEnvironment().scaleDown();
  }
};

// Main test runner function
export async function runAllIntegrationTests(): Promise<void> {
  const framework = new IntegrationTestFramework({
    reportDirectory: 'test-reports/integration',
    mockServices: true,
    parallelExecution: false,
    generateReports: true,
    cleanupAfterTests: true
  });

  try {
    await framework.initialize();

    // Register test suites
    framework.registerTestSuite('agent-communication', agentCommunicationSuite);
    framework.registerTestSuite('end-to-end', endToEndSuite);
    framework.registerTestSuite('performance', performanceSuite);

    // Run all test suites
    const results = await framework.runAllTestSuites();

    // Generate CI report
    const ciReport = await framework.generateCIReport();
    console.log('CI Report:', ciReport);

    // Export metrics for CI
    const ciMetrics = await framework.exportMetricsForCI();
    console.log('CI Metrics:', ciMetrics);

    // Check overall success
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const [suiteName, suiteResults] of results) {
      console.log(`\n${suiteName}: ${suiteResults.passedTests}/${suiteResults.totalTests} passed`);
      totalPassed += suiteResults.passedTests;
      totalFailed += suiteResults.failedTests;
    }

    console.log(`\nOverall Results: ${totalPassed} passed, ${totalFailed} failed`);

    if (totalFailed > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('Integration test execution failed:', error);
    process.exit(1);
  } finally {
    await framework.cleanup();
  }
}