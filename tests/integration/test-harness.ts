import { EventEmitter } from 'events';
import { TestEnvironment } from '../utils/test-environment';
import { MockServiceManager } from './mock-services/mock-service-manager';
import { TestDataManager } from './test-data-manager';
import { TestReporter } from './test-reporter';

export class TestHarness extends EventEmitter {
  private testEnv: TestEnvironment;
  private mockServices: MockServiceManager;
  private dataManager: TestDataManager;
  private reporter: TestReporter;
  private isInitialized: boolean = false;
  private testSessions: Map<string, TestSession> = new Map();

  constructor() {
    super();
    this.testEnv = new TestEnvironment();
    this.mockServices = new MockServiceManager();
    this.dataManager = new TestDataManager();
    this.reporter = new TestReporter();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('Initializing Test Harness...');
    
    // Initialize components
    await this.testEnv.setup();
    await this.mockServices.initialize();
    await this.dataManager.initialize();
    await this.reporter.initialize();
    
    // Setup event listeners
    this.setupEventListeners();
    
    this.isInitialized = true;
    this.emit('initialized');
    console.log('Test Harness initialized successfully');
  }

  async cleanup(): Promise<void> {
    if (!this.isInitialized) return;

    console.log('Cleaning up Test Harness...');
    
    // Stop all test sessions
    for (const [sessionId, session] of this.testSessions) {
      await this.stopTestSession(sessionId);
    }
    
    // Cleanup components
    await this.reporter.finalize();
    await this.dataManager.cleanup();
    await this.mockServices.cleanup();
    await this.testEnv.cleanup();
    
    this.isInitialized = false;
    this.emit('cleanup');
    console.log('Test Harness cleanup complete');
  }

  async createTestSession(config: TestSessionConfig): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: TestSession = {
      id: sessionId,
      config,
      startTime: new Date(),
      status: 'initializing',
      agents: new Map(),
      communications: [],
      metrics: {
        messagesExchanged: 0,
        averageLatency: 0,
        errorCount: 0,
        successRate: 0
      }
    };
    
    this.testSessions.set(sessionId, session);
    
    // Initialize agents for this session
    await this.initializeSessionAgents(session);
    
    session.status = 'ready';
    this.emit('sessionCreated', sessionId);
    
    return sessionId;
  }

  async startTestSession(sessionId: string): Promise<void> {
    const session = this.testSessions.get(sessionId);
    if (!session) throw new Error(`Test session ${sessionId} not found`);
    
    session.status = 'running';
    session.startTime = new Date();
    
    // Start monitoring
    this.startSessionMonitoring(session);
    
    this.emit('sessionStarted', sessionId);
  }

  async stopTestSession(sessionId: string): Promise<TestSessionResults> {
    const session = this.testSessions.get(sessionId);
    if (!session) throw new Error(`Test session ${sessionId} not found`);
    
    session.status = 'stopping';
    session.endTime = new Date();
    
    // Stop monitoring
    this.stopSessionMonitoring(session);
    
    // Collect final metrics
    const results = await this.collectSessionResults(session);
    
    // Cleanup session resources
    await this.cleanupSessionResources(session);
    
    session.status = 'completed';
    this.testSessions.delete(sessionId);
    
    this.emit('sessionCompleted', sessionId, results);
    
    return results;
  }

  async sendAgentMessage(sessionId: string, fromAgent: string, toAgent: string, message: any): Promise<MessageResult> {
    const session = this.testSessions.get(sessionId);
    if (!session) throw new Error(`Test session ${sessionId} not found`);
    
    const startTime = Date.now();
    
    try {
      // Send message through A2A communication
      const result = await this.testEnv.getA2AMessages();
      
      const communication: AgentCommunication = {
        id: `comm_${Date.now()}`,
        sessionId,
        fromAgent,
        toAgent,
        message,
        timestamp: new Date(),
        latency: Date.now() - startTime,
        success: true
      };
      
      session.communications.push(communication);
      session.metrics.messagesExchanged++;
      
      this.emit('messageSent', communication);
      
      return {
        success: true,
        messageId: communication.id,
        latency: communication.latency
      };
      
    } catch (error) {
      session.metrics.errorCount++;
      
      const communication: AgentCommunication = {
        id: `comm_${Date.now()}`,
        sessionId,
        fromAgent,
        toAgent,
        message,
        timestamp: new Date(),
        latency: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      session.communications.push(communication);
      this.emit('messageError', communication);
      
      return {
        success: false,
        error: communication.error,
        latency: communication.latency
      };
    }
  }

  async simulateAgentFailure(sessionId: string, agentName: string, duration: number = 30000): Promise<void> {
    const session = this.testSessions.get(sessionId);
    if (!session) throw new Error(`Test session ${sessionId} not found`);
    
    const agent = session.agents.get(agentName);
    if (!agent) throw new Error(`Agent ${agentName} not found in session`);
    
    agent.status = 'failed';
    agent.failureTime = new Date();
    
    this.emit('agentFailed', sessionId, agentName);
    
    // Restore agent after duration
    setTimeout(async () => {
      agent.status = 'running';
      agent.recoveryTime = new Date();
      this.emit('agentRecovered', sessionId, agentName);
    }, duration);
  }

  async simulateNetworkPartition(sessionId: string, agents: string[], duration: number = 30000): Promise<void> {
    const session = this.testSessions.get(sessionId);
    if (!session) throw new Error(`Test session ${sessionId} not found`);
    
    // Mark agents as partitioned
    agents.forEach(agentName => {
      const agent = session.agents.get(agentName);
      if (agent) {
        agent.partitioned = true;
        agent.partitionTime = new Date();
      }
    });
    
    this.emit('networkPartitioned', sessionId, agents);
    
    // Restore network after duration
    setTimeout(() => {
      agents.forEach(agentName => {
        const agent = session.agents.get(agentName);
        if (agent) {
          agent.partitioned = false;
          agent.partitionRecoveryTime = new Date();
        }
      });
      
      this.emit('networkRestored', sessionId, agents);
    }, duration);
  }

  async getSessionMetrics(sessionId: string): Promise<SessionMetrics> {
    const session = this.testSessions.get(sessionId);
    if (!session) throw new Error(`Test session ${sessionId} not found`);
    
    // Calculate current metrics
    const totalMessages = session.communications.length;
    const successfulMessages = session.communications.filter(c => c.success).length;
    const averageLatency = totalMessages > 0 
      ? session.communications.reduce((sum, c) => sum + c.latency, 0) / totalMessages 
      : 0;
    
    return {
      messagesExchanged: totalMessages,
      averageLatency,
      errorCount: session.metrics.errorCount,
      successRate: totalMessages > 0 ? successfulMessages / totalMessages : 0,
      agentStatus: Array.from(session.agents.entries()).map(([name, agent]) => ({
        name,
        status: agent.status,
        uptime: agent.status === 'running' ? Date.now() - agent.startTime.getTime() : 0
      }))
    };
  }

  async runCommunicationTest(config: CommunicationTestConfig): Promise<CommunicationTestResults> {
    const sessionId = await this.createTestSession({
      name: config.testName,
      agents: config.agents,
      duration: config.duration || 60000
    });
    
    await this.startTestSession(sessionId);
    
    const results: CommunicationTestResults = {
      testName: config.testName,
      startTime: new Date(),
      endTime: new Date(),
      totalMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      throughput: 0,
      agentPerformance: new Map()
    };
    
    try {
      // Execute test scenario
      for (const scenario of config.scenarios) {
        await this.executeScenario(sessionId, scenario);
      }
      
      // Wait for test duration
      await this.wait(config.duration || 60000);
      
      // Collect results
      const sessionResults = await this.stopTestSession(sessionId);
      
      results.endTime = new Date();
      results.totalMessages = sessionResults.totalCommunications;
      results.successfulMessages = sessionResults.successfulCommunications;
      results.failedMessages = sessionResults.failedCommunications;
      results.averageLatency = sessionResults.averageLatency;
      results.maxLatency = sessionResults.maxLatency;
      results.minLatency = sessionResults.minLatency;
      results.throughput = sessionResults.throughput;
      results.agentPerformance = sessionResults.agentPerformance;
      
    } catch (error) {
      await this.stopTestSession(sessionId);
      throw error;
    }
    
    return results;
  }

  private async initializeSessionAgents(session: TestSession): Promise<void> {
    for (const agentConfig of session.config.agents) {
      const agent: SessionAgent = {
        name: agentConfig.name,
        type: agentConfig.type,
        status: 'initializing',
        startTime: new Date(),
        messagesSent: 0,
        messagesReceived: 0,
        partitioned: false
      };
      
      // Initialize agent connection
      try {
        await this.initializeAgentConnection(agent);
        agent.status = 'running';
      } catch (error) {
        agent.status = 'failed';
        agent.error = error instanceof Error ? error.message : 'Unknown error';
      }
      
      session.agents.set(agent.name, agent);
    }
  }

  private async initializeAgentConnection(agent: SessionAgent): Promise<void> {
    // Initialize connection to agent service
    // This would establish WebSocket or HTTP connections as needed
    console.log(`Initializing connection to ${agent.name}`);
  }

  private startSessionMonitoring(session: TestSession): void {
    // Start monitoring session metrics
    const monitoringInterval = setInterval(() => {
      this.updateSessionMetrics(session);
    }, 1000);
    
    session.monitoringInterval = monitoringInterval;
  }

  private stopSessionMonitoring(session: TestSession): void {
    if (session.monitoringInterval) {
      clearInterval(session.monitoringInterval);
      delete session.monitoringInterval;
    }
  }

  private updateSessionMetrics(session: TestSession): void {
    // Update real-time metrics
    const totalMessages = session.communications.length;
    const successfulMessages = session.communications.filter(c => c.success).length;
    
    session.metrics.messagesExchanged = totalMessages;
    session.metrics.successRate = totalMessages > 0 ? successfulMessages / totalMessages : 0;
    session.metrics.averageLatency = totalMessages > 0 
      ? session.communications.reduce((sum, c) => sum + c.latency, 0) / totalMessages 
      : 0;
  }

  private async collectSessionResults(session: TestSession): Promise<TestSessionResults> {
    const communications = session.communications;
    const latencies = communications.map(c => c.latency);
    
    return {
      sessionId: session.id,
      duration: session.endTime!.getTime() - session.startTime.getTime(),
      totalCommunications: communications.length,
      successfulCommunications: communications.filter(c => c.success).length,
      failedCommunications: communications.filter(c => !c.success).length,
      averageLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
      minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
      throughput: communications.length / ((session.endTime!.getTime() - session.startTime.getTime()) / 1000),
      agentPerformance: this.calculateAgentPerformance(session)
    };
  }

  private calculateAgentPerformance(session: TestSession): Map<string, AgentPerformance> {
    const performance = new Map<string, AgentPerformance>();
    
    for (const [agentName, agent] of session.agents) {
      const agentCommunications = session.communications.filter(c => 
        c.fromAgent === agentName || c.toAgent === agentName
      );
      
      const sentMessages = session.communications.filter(c => c.fromAgent === agentName);
      const receivedMessages = session.communications.filter(c => c.toAgent === agentName);
      
      performance.set(agentName, {
        messagesSent: sentMessages.length,
        messagesReceived: receivedMessages.length,
        averageLatency: agentCommunications.length > 0 
          ? agentCommunications.reduce((sum, c) => sum + c.latency, 0) / agentCommunications.length 
          : 0,
        errorRate: agentCommunications.length > 0 
          ? agentCommunications.filter(c => !c.success).length / agentCommunications.length 
          : 0,
        uptime: agent.status === 'running' ? Date.now() - agent.startTime.getTime() : 0
      });
    }
    
    return performance;
  }

  private async cleanupSessionResources(session: TestSession): Promise<void> {
    // Cleanup any resources allocated for this session
    console.log(`Cleaning up resources for session ${session.id}`);
  }

  private async executeScenario(sessionId: string, scenario: TestScenario): Promise<void> {
    switch (scenario.type) {
      case 'message_exchange':
        await this.executeMessageExchangeScenario(sessionId, scenario);
        break;
      case 'failure_simulation':
        await this.executeFailureScenario(sessionId, scenario);
        break;
      case 'load_test':
        await this.executeLoadTestScenario(sessionId, scenario);
        break;
      default:
        throw new Error(`Unknown scenario type: ${scenario.type}`);
    }
  }

  private async executeMessageExchangeScenario(sessionId: string, scenario: TestScenario): Promise<void> {
    const { fromAgent, toAgent, messageCount, interval } = scenario.config;
    
    for (let i = 0; i < messageCount; i++) {
      await this.sendAgentMessage(sessionId, fromAgent, toAgent, {
        type: 'test_message',
        sequence: i,
        timestamp: new Date()
      });
      
      if (interval && i < messageCount - 1) {
        await this.wait(interval);
      }
    }
  }

  private async executeFailureScenario(sessionId: string, scenario: TestScenario): Promise<void> {
    const { agentName, failureDuration } = scenario.config;
    await this.simulateAgentFailure(sessionId, agentName, failureDuration);
  }

  private async executeLoadTestScenario(sessionId: string, scenario: TestScenario): Promise<void> {
    const { agents, messagesPerSecond, duration } = scenario.config;
    const interval = 1000 / messagesPerSecond;
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime) {
      const fromAgent = agents[Math.floor(Math.random() * agents.length)];
      const toAgent = agents[Math.floor(Math.random() * agents.length)];
      
      if (fromAgent !== toAgent) {
        this.sendAgentMessage(sessionId, fromAgent, toAgent, {
          type: 'load_test_message',
          timestamp: new Date()
        });
      }
      
      await this.wait(interval);
    }
  }

  private setupEventListeners(): void {
    this.on('messageSent', (communication: AgentCommunication) => {
      this.reporter.recordCommunication(communication);
    });
    
    this.on('messageError', (communication: AgentCommunication) => {
      this.reporter.recordError(communication);
    });
    
    this.on('agentFailed', (sessionId: string, agentName: string) => {
      this.reporter.recordAgentFailure(sessionId, agentName);
    });
    
    this.on('agentRecovered', (sessionId: string, agentName: string) => {
      this.reporter.recordAgentRecovery(sessionId, agentName);
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Type definitions
interface TestSessionConfig {
  name: string;
  agents: AgentConfig[];
  duration?: number;
  scenarios?: TestScenario[];
}

interface AgentConfig {
  name: string;
  type: string;
  endpoint?: string;
}

interface TestSession {
  id: string;
  config: TestSessionConfig;
  startTime: Date;
  endTime?: Date;
  status: 'initializing' | 'ready' | 'running' | 'stopping' | 'completed' | 'failed';
  agents: Map<string, SessionAgent>;
  communications: AgentCommunication[];
  metrics: SessionMetrics;
  monitoringInterval?: NodeJS.Timeout;
}

interface SessionAgent {
  name: string;
  type: string;
  status: 'initializing' | 'running' | 'failed' | 'stopped';
  startTime: Date;
  messagesSent: number;
  messagesReceived: number;
  partitioned: boolean;
  partitionTime?: Date;
  partitionRecoveryTime?: Date;
  failureTime?: Date;
  recoveryTime?: Date;
  error?: string;
}

interface AgentCommunication {
  id: string;
  sessionId: string;
  fromAgent: string;
  toAgent: string;
  message: any;
  timestamp: Date;
  latency: number;
  success: boolean;
  error?: string;
}

interface SessionMetrics {
  messagesExchanged: number;
  averageLatency: number;
  errorCount: number;
  successRate: number;
  agentStatus?: Array<{
    name: string;
    status: string;
    uptime: number;
  }>;
}

interface MessageResult {
  success: boolean;
  messageId?: string;
  latency: number;
  error?: string;
}

interface TestSessionResults {
  sessionId: string;
  duration: number;
  totalCommunications: number;
  successfulCommunications: number;
  failedCommunications: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  throughput: number;
  agentPerformance: Map<string, AgentPerformance>;
}

interface AgentPerformance {
  messagesSent: number;
  messagesReceived: number;
  averageLatency: number;
  errorRate: number;
  uptime: number;
}

interface CommunicationTestConfig {
  testName: string;
  agents: AgentConfig[];
  scenarios: TestScenario[];
  duration?: number;
}

interface TestScenario {
  type: 'message_exchange' | 'failure_simulation' | 'load_test';
  config: any;
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
  agentPerformance: Map<string, AgentPerformance>;
}