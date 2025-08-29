import { TestHarness } from './test-harness';
import { TestDataManager } from './test-data-manager';
import { TestReporter } from './test-reporter';
import { TestEnvironment } from '../utils/test-environment';
import { MockServiceManager } from './mock-services/mock-service-manager';

export class IntegrationTestFramework {
  private testHarness: TestHarness;
  private dataManager: TestDataManager;
  private reporter: TestReporter;
  private environment: TestEnvironment;
  private mockServices: MockServiceManager;
  private isInitialized: boolean = false;
  private testSuites: Map<string, TestSuite> = new Map();
  private globalConfig: FrameworkConfig;

  constructor(config: Partial<FrameworkConfig> = {}) {
    this.globalConfig = {
      reportDirectory: 'test-reports',
      mockServices: true,
      parallelExecution: false,
      maxRetries: 3,
      timeout: 300000, // 5 minutes
      cleanupAfterTests: true,
      generateReports: true,
      ...config
    };

    this.testHarness = new TestHarness();
    this.dataManager = new TestDataManager();
    this.reporter = new TestReporter(this.globalConfig.reportDirectory);
    this.environment = new TestEnvironment();
    this.mockServices = new MockServiceManager();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('Initializing Integration Test Framework...');

    try {
      // Initialize components in order
      await this.environment.setup();
      
      if (this.globalConfig.mockServices) {
        await this.mockServices.initialize();
      }
      
      await this.dataManager.initialize();
      await this.testHarness.initialize();
      await this.reporter.initialize();

      // Wait for services to be ready
      await this.environment.waitForServicesReady();

      this.isInitialized = true;
      console.log('Integration Test Framework initialized successfully');

    } catch (error) {
      console.error('Failed to initialize Integration Test Framework:', error);
      await this.cleanup();
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.isInitialized) return;

    console.log('Cleaning up Integration Test Framework...');

    try {
      if (this.globalConfig.generateReports) {
        await this.reporter.finalize();
      }
      
      await this.testHarness.cleanup();
      await this.dataManager.cleanup();
      
      if (this.globalConfig.mockServices) {
        await this.mockServices.cleanup();
      }
      
      if (this.globalConfig.cleanupAfterTests) {
        await this.environment.cleanup();
      }

      this.isInitialized = false;
      console.log('Integration Test Framework cleanup complete');

    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  registerTestSuite(name: string, suite: TestSuite): void {
    this.testSuites.set(name, suite);
    console.log(`Registered test suite: ${name}`);
  }

  async runTestSuite(suiteName: string): Promise<TestSuiteResults> {
    const suite = this.testSuites.get(suiteName);
    if (!suite) {
      throw new Error(`Test suite '${suiteName}' not found`);
    }

    console.log(`Running test suite: ${suiteName}`);
    this.reporter.startTestSuite(suiteName);

    const results: TestSuiteResults = {
      suiteName,
      startTime: new Date(),
      endTime: new Date(),
      totalTests: suite.tests.length,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      testResults: [],
      duration: 0
    };

    try {
      // Setup suite-specific configuration
      if (suite.setup) {
        await suite.setup(this);
      }

      // Run tests
      if (this.globalConfig.parallelExecution && suite.allowParallel) {
        results.testResults = await this.runTestsInParallel(suite.tests);
      } else {
        results.testResults = await this.runTestsSequentially(suite.tests);
      }

      // Calculate results
      results.passedTests = results.testResults.filter(r => r.status === 'passed').length;
      results.failedTests = results.testResults.filter(r => r.status === 'failed').length;
      results.skippedTests = results.testResults.filter(r => r.status === 'skipped').length;

    } catch (error) {
      console.error(`Error running test suite ${suiteName}:`, error);
      results.failedTests = results.totalTests;
    } finally {
      // Cleanup suite-specific resources
      if (suite.teardown) {
        await suite.teardown(this);
      }

      results.endTime = new Date();
      results.duration = results.endTime.getTime() - results.startTime.getTime();
      
      this.reporter.endTestSuite();
    }

    return results;
  }

  async runAllTestSuites(): Promise<Map<string, TestSuiteResults>> {
    const results = new Map<string, TestSuiteResults>();

    for (const [suiteName] of this.testSuites) {
      try {
        const suiteResults = await this.runTestSuite(suiteName);
        results.set(suiteName, suiteResults);
      } catch (error) {
        console.error(`Failed to run test suite ${suiteName}:`, error);
        results.set(suiteName, {
          suiteName,
          startTime: new Date(),
          endTime: new Date(),
          totalTests: 0,
          passedTests: 0,
          failedTests: 1,
          skippedTests: 0,
          testResults: [{
            testName: `${suiteName} - Suite Execution`,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          }],
          duration: 0
        });
      }
    }

    return results;
  }

  async runAgentCommunicationTest(config: AgentCommunicationTestConfig): Promise<CommunicationTestResults> {
    console.log(`Running agent communication test: ${config.testName}`);

    // Create test data if needed
    let testDataId: string | undefined;
    if (config.testDataConfig) {
      testDataId = await this.dataManager.createTestDataSet(config.testDataConfig);
    }

    try {
      // Run the communication test using test harness
      const results = await this.testHarness.runCommunicationTest({
        testName: config.testName,
        agents: config.agents,
        scenarios: config.scenarios,
        duration: config.duration
      });

      // Record results in reporter
      this.reporter.recordTestResult({
        testName: config.testName,
        status: results.failedMessages === 0 ? 'passed' : 'failed',
        duration: results.endTime.getTime() - results.startTime.getTime(),
        details: results
      });

      return results;

    } finally {
      // Cleanup test data
      if (testDataId) {
        await this.dataManager.deleteTestDataSet(testDataId);
      }
    }
  }

  async runEndToEndTest(config: EndToEndTestConfig): Promise<EndToEndTestResults> {
    console.log(`Running end-to-end test: ${config.testName}`);

    const results: EndToEndTestResults = {
      testName: config.testName,
      startTime: new Date(),
      endTime: new Date(),
      steps: [],
      success: false,
      error: null
    };

    try {
      // Create test data
      const testData = await this.dataManager.createCustomerJourneyData(config.scenario);

      // Execute test steps
      for (const step of config.steps) {
        const stepResult = await this.executeTestStep(step, testData);
        results.steps.push(stepResult);

        if (!stepResult.success) {
          results.error = stepResult.error;
          break;
        }
      }

      results.success = results.steps.every(step => step.success);
      results.endTime = new Date();

      // Record results
      this.reporter.recordTestResult({
        testName: config.testName,
        status: results.success ? 'passed' : 'failed',
        duration: results.endTime.getTime() - results.startTime.getTime(),
        error: results.error || undefined,
        details: results
      });

      // Cleanup test data
      await this.dataManager.deleteTestDataSet(testData.dataSetId);

    } catch (error) {
      results.success = false;
      results.error = error instanceof Error ? error.message : 'Unknown error';
      results.endTime = new Date();

      this.reporter.recordTestResult({
        testName: config.testName,
        status: 'failed',
        duration: results.endTime.getTime() - results.startTime.getTime(),
        error: results.error
      });
    }

    return results;
  }

  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResults> {
    console.log(`Running load test: ${config.testName}`);

    // Scale up services for load testing
    if (config.scaleServices) {
      await this.environment.scaleForLoadTesting();
    }

    try {
      // Generate synthetic workload
      const workload = await this.dataManager.generateSyntheticWorkload(
        config.workloadType,
        config.intensity
      );

      // Create multiple test sessions for load testing
      const sessions: string[] = [];
      for (let i = 0; i < config.concurrentSessions; i++) {
        const sessionId = await this.testHarness.createTestSession({
          name: `${config.testName}_session_${i}`,
          agents: config.agents,
          duration: config.duration
        });
        sessions.push(sessionId);
      }

      // Start all sessions
      await Promise.all(sessions.map(sessionId => 
        this.testHarness.startTestSession(sessionId)
      ));

      // Wait for test duration
      await this.wait(config.duration);

      // Collect results from all sessions
      const sessionResults = await Promise.all(sessions.map(sessionId =>
        this.testHarness.stopTestSession(sessionId)
      ));

      // Aggregate results
      const results: LoadTestResults = {
        testName: config.testName,
        startTime: new Date(Date.now() - config.duration),
        endTime: new Date(),
        concurrentSessions: config.concurrentSessions,
        totalRequests: sessionResults.reduce((sum, r) => sum + r.totalCommunications, 0),
        successfulRequests: sessionResults.reduce((sum, r) => sum + r.successfulCommunications, 0),
        failedRequests: sessionResults.reduce((sum, r) => sum + r.failedCommunications, 0),
        averageLatency: sessionResults.reduce((sum, r) => sum + r.averageLatency, 0) / sessionResults.length,
        maxLatency: Math.max(...sessionResults.map(r => r.maxLatency)),
        throughput: sessionResults.reduce((sum, r) => sum + r.throughput, 0),
        errorRate: sessionResults.reduce((sum, r) => sum + (r.failedCommunications / r.totalCommunications), 0) / sessionResults.length
      };

      // Record results
      this.reporter.recordTestResult({
        testName: config.testName,
        status: results.errorRate < 0.05 ? 'passed' : 'failed', // 5% error threshold
        duration: config.duration,
        details: results
      });

      return results;

    } finally {
      // Scale services back down
      if (config.scaleServices) {
        await this.environment.scaleDown();
      }
    }
  }

  async runFailureRecoveryTest(config: FailureRecoveryTestConfig): Promise<FailureRecoveryTestResults> {
    console.log(`Running failure recovery test: ${config.testName}`);

    const results: FailureRecoveryTestResults = {
      testName: config.testName,
      startTime: new Date(),
      endTime: new Date(),
      failureEvents: [],
      recoveryEvents: [],
      success: false,
      recoveryTime: 0
    };

    try {
      // Create test session
      const sessionId = await this.testHarness.createTestSession({
        name: config.testName,
        agents: config.agents,
        duration: config.duration
      });

      await this.testHarness.startTestSession(sessionId);

      // Simulate failures
      for (const failure of config.failures) {
        const failureStart = Date.now();
        
        if (failure.type === 'agent_failure') {
          await this.testHarness.simulateAgentFailure(sessionId, failure.target, failure.duration);
        } else if (failure.type === 'network_partition') {
          await this.testHarness.simulateNetworkPartition(sessionId, [failure.target], failure.duration);
        } else if (failure.type === 'service_failure') {
          await this.environment.simulateServiceFailure(failure.target);
          await this.wait(failure.duration);
          await this.environment.restoreService(failure.target);
        }

        results.failureEvents.push({
          type: failure.type,
          target: failure.target,
          timestamp: new Date(failureStart),
          duration: failure.duration
        });

        // Wait for recovery
        const recoveryStart = Date.now();
        await this.waitForRecovery(sessionId, failure.target);
        const recoveryTime = Date.now() - recoveryStart;

        results.recoveryEvents.push({
          target: failure.target,
          timestamp: new Date(recoveryStart),
          recoveryTime
        });

        results.recoveryTime = Math.max(results.recoveryTime, recoveryTime);
      }

      // Stop test session and collect final metrics
      const sessionResults = await this.testHarness.stopTestSession(sessionId);
      
      results.success = sessionResults.successfulCommunications > 0 && 
                       results.recoveryTime < config.maxRecoveryTime;
      results.endTime = new Date();

      // Record results
      this.reporter.recordTestResult({
        testName: config.testName,
        status: results.success ? 'passed' : 'failed',
        duration: results.endTime.getTime() - results.startTime.getTime(),
        details: results
      });

    } catch (error) {
      results.success = false;
      results.endTime = new Date();

      this.reporter.recordTestResult({
        testName: config.testName,
        status: 'failed',
        duration: results.endTime.getTime() - results.startTime.getTime(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return results;
  }

  // Getters for accessing framework components
  getTestHarness(): TestHarness {
    return this.testHarness;
  }

  getDataManager(): TestDataManager {
    return this.dataManager;
  }

  getReporter(): TestReporter {
    return this.reporter;
  }

  getEnvironment(): TestEnvironment {
    return this.environment;
  }

  getMockServices(): MockServiceManager {
    return this.mockServices;
  }

  // CI/CD Integration methods
  async generateCIReport(): Promise<CIReport> {
    const summary = this.reporter.getReportSummary();
    
    return {
      success: summary.failedTests === 0,
      totalTests: summary.totalTests,
      passedTests: summary.passedTests,
      failedTests: summary.failedTests,
      duration: summary.duration,
      coverage: await this.calculateTestCoverage(),
      reportPath: await this.reporter.generateReport('json')
    };
  }

  async exportMetricsForCI(): Promise<CIMetrics> {
    const summary = this.reporter.getReportSummary();
    
    return {
      test_success_rate: summary.successRate,
      average_test_duration: summary.duration / summary.totalTests,
      communication_success_rate: 1 - summary.errorRate,
      average_latency: summary.averageLatency,
      throughput: summary.throughput,
      total_communications: summary.totalCommunications
    };
  }

  // Private helper methods
  private async runTestsSequentially(tests: TestFunction[]): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const test of tests) {
      const result = await this.executeTest(test);
      results.push(result);
      this.reporter.recordTestResult(result);
    }

    return results;
  }

  private async runTestsInParallel(tests: TestFunction[]): Promise<TestResult[]> {
    const testPromises = tests.map(test => this.executeTest(test));
    const results = await Promise.allSettled(testPromises);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        this.reporter.recordTestResult(result.value);
        return result.value;
      } else {
        const failedResult: TestResult = {
          testName: `Test ${index}`,
          status: 'failed',
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
        };
        this.reporter.recordTestResult(failedResult);
        return failedResult;
      }
    });
  }

  private async executeTest(test: TestFunction): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      await test(this);
      
      return {
        testName: test.name || 'Anonymous Test',
        status: 'passed',
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        testName: test.name || 'Anonymous Test',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async executeTestStep(step: TestStep, testData: any): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      await step.execute(this, testData);
      
      return {
        stepName: step.name,
        success: true,
        duration: Date.now() - startTime,
        error: null
      };
      
    } catch (error) {
      return {
        stepName: step.name,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async waitForRecovery(sessionId: string, target: string): Promise<void> {
    const maxWait = 60000; // 1 minute
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const metrics = await this.testHarness.getSessionMetrics(sessionId);
      const targetAgent = metrics.agentStatus?.find(agent => agent.name === target);
      
      if (targetAgent && targetAgent.status === 'running') {
        return;
      }
      
      await this.wait(1000);
    }
    
    throw new Error(`Recovery timeout for ${target}`);
  }

  private async calculateTestCoverage(): Promise<number> {
    // Implement test coverage calculation
    // This would analyze which components/endpoints were tested
    return 0.85; // Mock value
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Type definitions
interface FrameworkConfig {
  reportDirectory: string;
  mockServices: boolean;
  parallelExecution: boolean;
  maxRetries: number;
  timeout: number;
  cleanupAfterTests: boolean;
  generateReports: boolean;
}

interface TestSuite {
  tests: TestFunction[];
  allowParallel: boolean;
  setup?: (framework: IntegrationTestFramework) => Promise<void>;
  teardown?: (framework: IntegrationTestFramework) => Promise<void>;
}

interface TestFunction {
  (framework: IntegrationTestFramework): Promise<void>;
  name?: string;
}

interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  details?: any;
}

interface TestSuiteResults {
  suiteName: string;
  startTime: Date;
  endTime: Date;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  testResults: TestResult[];
  duration: number;
}

interface AgentCommunicationTestConfig {
  testName: string;
  agents: Array<{ name: string; type: string }>;
  scenarios: Array<{ type: string; config: any }>;
  duration: number;
  testDataConfig?: any;
}

interface CommunicationTestResults {
  testName: string;
  startTime: Date;
  endTime: Date;
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  throughput: number;
  agentPerformance: Map<string, any>;
}

interface EndToEndTestConfig {
  testName: string;
  scenario: string;
  steps: TestStep[];
}

interface TestStep {
  name: string;
  execute: (framework: IntegrationTestFramework, testData: any) => Promise<void>;
}

interface TestStepResult {
  stepName: string;
  success: boolean;
  duration: number;
  error: string | null;
}

interface EndToEndTestResults {
  testName: string;
  startTime: Date;
  endTime: Date;
  steps: TestStepResult[];
  success: boolean;
  error: string | null;
}

interface LoadTestConfig {
  testName: string;
  workloadType: string;
  intensity: number;
  concurrentSessions: number;
  duration: number;
  agents: Array<{ name: string; type: string }>;
  scaleServices: boolean;
}

interface LoadTestResults {
  testName: string;
  startTime: Date;
  endTime: Date;
  concurrentSessions: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  maxLatency: number;
  throughput: number;
  errorRate: number;
}

interface FailureRecoveryTestConfig {
  testName: string;
  agents: Array<{ name: string; type: string }>;
  duration: number;
  failures: Array<{
    type: 'agent_failure' | 'network_partition' | 'service_failure';
    target: string;
    duration: number;
  }>;
  maxRecoveryTime: number;
}

interface FailureRecoveryTestResults {
  testName: string;
  startTime: Date;
  endTime: Date;
  failureEvents: Array<{
    type: string;
    target: string;
    timestamp: Date;
    duration: number;
  }>;
  recoveryEvents: Array<{
    target: string;
    timestamp: Date;
    recoveryTime: number;
  }>;
  success: boolean;
  recoveryTime: number;
}

interface CIReport {
  success: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  coverage: number;
  reportPath: string;
}

interface CIMetrics {
  test_success_rate: number;
  average_test_duration: number;
  communication_success_rate: number;
  average_latency: number;
  throughput: number;
  total_communications: number;
}