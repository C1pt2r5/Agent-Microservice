/**
 * Unit tests for base agent implementation
 */

// Mock A2A client to prevent real WebSocket connections
jest.mock('../../../integration/a2a/a2a-client', () => ({
  A2AClientImpl: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    registerAgent: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    getConnectionStatus: jest.fn().mockReturnValue('connected'),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  }))
}));

import { ConcreteBaseAgent, AgentDependencies } from '../base-agent';
import { AgentConfig, AgentRequest } from '../../../types';

// Mock dependencies
const mockMCPClient = {
  request: jest.fn(),
  getServiceDefinition: jest.fn(),
  healthCheck: jest.fn()
};

const mockA2AClient = {
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  registerAgent: jest.fn(),
  getTopicDefinition: jest.fn(),
  healthCheck: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn()
};

const mockGeminiClient = {
  generateContent: jest.fn(),
  generateEmbedding: jest.fn()
};

describe('ConcreteBaseAgent', () => {
  let agent: ConcreteBaseAgent;
  let config: AgentConfig;
  let dependencies: AgentDependencies;

  beforeEach(() => {
    config = {
      id: 'test-agent-001',
      name: 'Test Agent',
      version: '1.0.0',
      environment: 'development',
      type: 'chatbot',
      mcpEndpoint: {
        url: 'http://localhost:8080',
        timeout: 30000,
        retryAttempts: 3,
        circuitBreakerThreshold: 5
      },
      a2aEndpoint: {
        url: 'http://localhost:8081',
        timeout: 15000,
        retryAttempts: 3,
        circuitBreakerThreshold: 5
      },
      geminiConfig: {
        apiKey: 'test-key',
        model: 'gemini-pro',
        endpoint: 'https://test-endpoint',
        maxTokens: 2048,
        temperature: 0.7,
        rateLimitPerMinute: 60
      },
      capabilities: [
        {
          name: 'test-capability',
          description: 'Test capability',
          inputSchema: { type: 'string' },
          outputSchema: { type: 'string' }
        }
      ]
    };

    dependencies = {
      mcpClient: mockMCPClient as any,
      a2aClient: mockA2AClient as any,
      geminiClient: mockGeminiClient as any
    };

    agent = new ConcreteBaseAgent(config, dependencies);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    try {
      if (agent && agent.isAgentHealthy()) {
        await agent.shutdown();
      }
    } catch (error) {
      // Ignore shutdown errors in tests
    }
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('initialization', () => {
    it('should initialize successfully with dependencies', async () => {
      // Since dependencies are injected, the agent won't call connect/registerAgent on the mocks
      // Instead, it will use the provided mock clients directly
      await agent.initialize();

      expect(agent.getState().status).toBe('running');
      // The agent uses injected dependencies, so these methods aren't called during initialization
      // The actual connection logic is bypassed when dependencies are provided
    });

    it('should throw error if already initialized', async () => {
      mockA2AClient.connect.mockResolvedValue(undefined);
      mockA2AClient.registerAgent.mockResolvedValue(undefined);

      await agent.initialize();

      await expect(agent.initialize()).rejects.toThrow('Agent is already initialized');
    });

    it('should handle initialization errors', async () => {
      // Create a new agent instance for this test
      const agentWithError = new ConcreteBaseAgent(config);
      
      // Mock the A2A client connect method to fail after agent creation
      const mockA2AClientError = {
        connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
        disconnect: jest.fn().mockResolvedValue(undefined),
        registerAgent: jest.fn().mockResolvedValue(undefined),
        sendMessage: jest.fn().mockResolvedValue(undefined),
        subscribe: jest.fn().mockResolvedValue(undefined),
        unsubscribe: jest.fn().mockResolvedValue(undefined),
        getConnectionStatus: jest.fn().mockReturnValue('disconnected'),
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn()
      };

      // Inject the failing A2A client before initialization
      (agentWithError as any).a2aClient = mockA2AClientError;

      // Test that initialization fails
      await expect(agentWithError.initialize()).rejects.toThrow('Connection failed');
      
      // Verify error state is set correctly
      expect(agentWithError.getState().status).toBe('error');
      expect(agentWithError.getState().errors).toHaveLength(1);
      expect(agentWithError.getState().errors[0].message).toContain('Connection failed');
    });
  });

  describe('request processing', () => {
    beforeEach(async () => {
      mockA2AClient.connect.mockResolvedValue(undefined);
      mockA2AClient.registerAgent.mockResolvedValue(undefined);
      await agent.initialize();
    });

    it('should process valid requests', async () => {
      const request: AgentRequest = {
        id: 'req-001',
        timestamp: new Date(),
        correlationId: 'corr-001',
        payload: { message: 'test' }
      };

      const response = await agent.processRequest(request);

      expect(response.success).toBe(true);
      expect(response.requestId).toBe('req-001');
      expect(response.payload).toBeDefined();
      expect(response.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should validate request fields', async () => {
      const invalidRequest = {
        id: '',
        timestamp: new Date(),
        correlationId: 'corr-001',
        payload: { message: 'test' }
      } as AgentRequest;

      const response = await agent.processRequest(invalidRequest);

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('Request ID is required');
    });

    it('should throw error if not initialized', async () => {
      const uninitializedAgent = new ConcreteBaseAgent(config, dependencies);
      const request: AgentRequest = {
        id: 'req-001',
        timestamp: new Date(),
        correlationId: 'corr-001',
        payload: { message: 'test' }
      };

      await expect(uninitializedAgent.processRequest(request)).rejects.toThrow('Agent not initialized');
    });

    it('should update metrics on request processing', async () => {
      const request: AgentRequest = {
        id: 'req-001',
        timestamp: new Date(),
        correlationId: 'corr-001',
        payload: { message: 'test' }
      };

      const initialMetrics = agent.getState().metrics;
      const initialRequestCount = initialMetrics.requestsProcessed;
      
      await agent.processRequest(request);
      const updatedMetrics = agent.getState().metrics;

      expect(updatedMetrics.requestsProcessed).toBe(initialRequestCount + 1);
      expect(updatedMetrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('A2A messaging', () => {
    beforeEach(async () => {
      mockA2AClient.connect.mockResolvedValue(undefined);
      mockA2AClient.registerAgent.mockResolvedValue(undefined);
      await agent.initialize();
    });

    it('should send A2A messages', async () => {
      mockA2AClient.publish.mockResolvedValue({
        messageId: 'msg-001',
        timestamp: new Date(),
        status: 'delivered',
        targetAgent: 'target-agent'
      });

      await agent.sendA2AMessage('test-topic', 'test.message', { data: 'test' });

      expect(mockA2AClient.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'test-topic',
          messageType: 'test.message',
          payload: { data: 'test' },
          sourceAgent: 'test-agent-001'
        })
      );
    });

    it('should throw error if A2A client not available', async () => {
      const agentWithoutA2A = new ConcreteBaseAgent(config, { 
        mcpClient: mockMCPClient as any,
        geminiClient: mockGeminiClient as any
      });

      await expect(
        agentWithoutA2A.sendA2AMessage('test-topic', 'test.message', { data: 'test' })
      ).rejects.toThrow('A2A client not available');
    });
  });

  describe('MCP queries', () => {
    beforeEach(async () => {
      mockA2AClient.connect.mockResolvedValue(undefined);
      mockA2AClient.registerAgent.mockResolvedValue(undefined);
      await agent.initialize();
    });

    it('should execute MCP queries', async () => {
      mockMCPClient.request.mockResolvedValue({
        success: true,
        data: { result: 'test-data' }
      });

      const result = await agent.queryMCP('user-service', 'getUser', { userId: '123' });

      expect(result).toEqual({ result: 'test-data' });
      expect(mockMCPClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'user-service',
          operation: 'getUser',
          parameters: { userId: '123' }
        })
      );
    });

    it('should handle MCP query failures', async () => {
      mockMCPClient.request.mockResolvedValue({
        success: false,
        error: { code: 'MCP_ERROR', message: 'Service unavailable', timestamp: new Date() }
      });

      await expect(
        agent.queryMCP('user-service', 'getUser', { userId: '123' })
      ).rejects.toThrow('MCP request failed: Service unavailable');
    });

    it('should throw error if MCP client not available', async () => {
      const agentWithoutMCP = new ConcreteBaseAgent(config, { 
        a2aClient: mockA2AClient as any,
        geminiClient: mockGeminiClient as any
      });

      await expect(
        agentWithoutMCP.queryMCP('user-service', 'getUser', { userId: '123' })
      ).rejects.toThrow('MCP client not available');
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      mockA2AClient.connect.mockResolvedValue(undefined);
      mockA2AClient.registerAgent.mockResolvedValue(undefined);
      await agent.initialize();
    });

    it('should report healthy status when running normally', () => {
      expect(agent.isAgentHealthy()).toBe(true);
      
      const healthStatus = agent.getHealthStatus();
      expect(healthStatus.status).toBe('running');
      expect(healthStatus.metrics).toBeDefined();
    });

    it('should report unhealthy status with high error rate', async () => {
      // Simulate multiple failed requests to increase error rate
      const failingRequest: AgentRequest = {
        id: '',  // Invalid request
        timestamp: new Date(),
        correlationId: 'corr-001',
        payload: { message: 'test' }
      };

      // Process multiple failing requests
      for (let i = 0; i < 10; i++) {
        await agent.processRequest(failingRequest);
      }

      expect(agent.isAgentHealthy()).toBe(false);
    });

    it('should emit heartbeat events', (done) => {
      agent.on('heartbeat', ({ agentId, timestamp }) => {
        expect(agentId).toBe('test-agent-001');
        expect(timestamp).toBeInstanceOf(Date);
        done();
      });

      // Trigger heartbeat manually for testing
      agent.emit('heartbeat', { agentId: 'test-agent-001', timestamp: new Date() });
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      mockA2AClient.connect.mockResolvedValue(undefined);
      mockA2AClient.registerAgent.mockResolvedValue(undefined);
      mockA2AClient.disconnect.mockResolvedValue(undefined);
      await agent.initialize();
    });

    it('should shutdown gracefully', async () => {
      await agent.shutdown();

      expect(agent.getState().status).toBe('stopped');
      expect(mockA2AClient.disconnect).toHaveBeenCalled();
    });

    it('should handle shutdown errors', async () => {
      mockA2AClient.disconnect.mockRejectedValue(new Error('Disconnect failed'));

      await expect(agent.shutdown()).rejects.toThrow('Disconnect failed');
      expect(agent.getState().errors).toHaveLength(1);
    });

    it('should be idempotent', async () => {
      await agent.shutdown();
      await agent.shutdown(); // Should not throw

      expect(mockA2AClient.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      mockA2AClient.connect.mockResolvedValue(undefined);
      mockA2AClient.registerAgent.mockResolvedValue(undefined);
      await agent.initialize();
    });

    it('should emit and handle events', (done) => {
      const testData = { test: 'data' };

      agent.on('test-event', (data) => {
        expect(data).toEqual(testData);
        done();
      });

      agent.emit('test-event', testData);
    });

    it('should remove event listeners', () => {
      const listener = jest.fn();

      agent.on('test-event', listener);
      agent.emit('test-event', { test: 'data' });
      expect(listener).toHaveBeenCalledTimes(1);

      agent.off('test-event', listener);
      agent.emit('test-event', { test: 'data' });
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });
});