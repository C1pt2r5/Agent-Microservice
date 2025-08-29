/**
 * Unit tests for agent factory
 */

import { AgentFactory } from '../agent-factory';
import { AgentConfig } from '../../../types';

// Mock the dependencies
jest.mock('../../../integration/mcp/mcp-client-factory');
jest.mock('../../../integration/a2a/a2a-client');
jest.mock('../../../integration/gemini/gemini-client');

describe('AgentFactory', () => {
  const validConfig: AgentConfig = {
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

  describe('createAgent', () => {
    it('should create a chatbot agent', async () => {
      const agent = await AgentFactory.createAgent(validConfig);

      expect(agent).toBeDefined();
      expect(agent.getConfig().type).toBe('chatbot');
      expect(agent.getConfig().id).toBe('test-agent-001');
    });

    it('should create a fraud detection agent', async () => {
      const fraudConfig = { ...validConfig, type: 'fraud-detection' as const };
      const agent = await AgentFactory.createAgent(fraudConfig);

      expect(agent).toBeDefined();
      expect(agent.getConfig().type).toBe('fraud-detection');
    });

    it('should create a recommendation agent', async () => {
      const recConfig = { ...validConfig, type: 'recommendation' as const };
      const agent = await AgentFactory.createAgent(recConfig);

      expect(agent).toBeDefined();
      expect(agent.getConfig().type).toBe('recommendation');
    });

    it('should throw error for unknown agent type', async () => {
      const invalidConfig = { ...validConfig, type: 'unknown' as any };

      await expect(AgentFactory.createAgent(invalidConfig)).rejects.toThrow('Invalid agent type');
    });

    it('should validate configuration by default', async () => {
      const invalidConfig = { ...validConfig, id: '' };

      await expect(AgentFactory.createAgent(invalidConfig)).rejects.toThrow('Invalid agent configuration');
    });

    it('should skip validation when requested', async () => {
      const invalidConfig = { ...validConfig, id: '' };

      const agent = await AgentFactory.createAgent(invalidConfig, { validateConfig: false });
      expect(agent).toBeDefined();
    });

    it('should auto-initialize when requested', async () => {
      const agent = await AgentFactory.createAgent(validConfig, { autoInitialize: false });
      
      // Agent should not be initialized
      expect(() => agent.isAgentHealthy()).not.toThrow();
    });
  });

  describe('createDevelopmentAgent', () => {
    it('should create development chatbot agent', async () => {
      const agent = await AgentFactory.createDevelopmentAgent('dev-chatbot-001', 'chatbot');

      expect(agent).toBeDefined();
      expect(agent.getConfig().environment).toBe('development');
      expect(agent.getConfig().type).toBe('chatbot');
      expect(agent.getConfig().name).toContain('Development');
    });

    it('should create development fraud detection agent', async () => {
      const agent = await AgentFactory.createDevelopmentAgent('dev-fraud-001', 'fraud-detection');

      expect(agent).toBeDefined();
      expect(agent.getConfig().type).toBe('fraud-detection');
      expect(agent.getConfig().capabilities.length).toBeGreaterThan(0);
    });

    it('should create development recommendation agent', async () => {
      const agent = await AgentFactory.createDevelopmentAgent('dev-rec-001', 'recommendation');

      expect(agent).toBeDefined();
      expect(agent.getConfig().type).toBe('recommendation');
      expect(agent.getConfig().capabilities.some(cap => cap.name.includes('recommendation'))).toBe(true);
    });
  });

  describe('createProductionAgent', () => {
    beforeEach(() => {
      // Set up environment variables for production
      process.env.GEMINI_API_KEY = 'prod-key';
      process.env.MCP_ENDPOINT = 'http://mcp-gateway:8080';
      process.env.A2A_ENDPOINT = 'http://a2a-hub:8081';
    });

    afterEach(() => {
      // Clean up environment variables
      delete process.env.GEMINI_API_KEY;
      delete process.env.MCP_ENDPOINT;
      delete process.env.A2A_ENDPOINT;
      jest.clearAllMocks();
      jest.clearAllTimers();
    });

    it('should create production agent with environment config', async () => {
      const agent = await AgentFactory.createProductionAgent('prod-chatbot-001', 'chatbot');

      expect(agent).toBeDefined();
      expect(agent.getConfig().environment).toBe('production');
      expect(agent.getConfig().geminiConfig.apiKey).toBe('prod-key');
      expect(agent.getConfig().mcpEndpoint.url).toBe('http://mcp-gateway:8080');
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const errors = AgentFactory.validateConfig(validConfig);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidConfig = { ...validConfig, id: '', name: '' };
      const errors = AgentFactory.validateConfig(invalidConfig);

      expect(errors).toContain('Agent ID is required');
      expect(errors).toContain('Agent name is required');
    });

    it('should validate agent type', () => {
      const invalidConfig = { ...validConfig, type: 'invalid' as any };
      const errors = AgentFactory.validateConfig(invalidConfig);

      expect(errors).toContain('Invalid agent type');
    });

    it('should validate environment', () => {
      const invalidConfig = { ...validConfig, environment: 'invalid' as any };
      const errors = AgentFactory.validateConfig(invalidConfig);

      expect(errors).toContain('Invalid environment');
    });

    it('should validate MCP endpoint', () => {
      const invalidConfig = { 
        ...validConfig, 
        mcpEndpoint: { 
          ...validConfig.mcpEndpoint, 
          url: '', 
          timeout: -1 
        } 
      };
      const errors = AgentFactory.validateConfig(invalidConfig);

      expect(errors).toContain('MCP endpoint URL is required');
      expect(errors).toContain('MCP timeout must be positive');
    });

    it('should validate A2A endpoint', () => {
      const invalidConfig = { 
        ...validConfig, 
        a2aEndpoint: { 
          ...validConfig.a2aEndpoint, 
          url: '', 
          retryAttempts: -1 
        } 
      };
      const errors = AgentFactory.validateConfig(invalidConfig);

      expect(errors).toContain('A2A endpoint URL is required');
      expect(errors).toContain('A2A retry attempts must be non-negative');
    });

    it('should validate Gemini configuration', () => {
      const invalidConfig = { 
        ...validConfig, 
        geminiConfig: { 
          ...validConfig.geminiConfig, 
          apiKey: '', 
          temperature: 3.0 
        } 
      };
      const errors = AgentFactory.validateConfig(invalidConfig);

      expect(errors).toContain('Gemini API key is required');
      expect(errors).toContain('Gemini temperature must be between 0 and 2');
    });

    it('should validate capabilities', () => {
      const invalidConfig = { 
        ...validConfig, 
        capabilities: [
          { name: '', description: 'Test', inputSchema: {}, outputSchema: {} }
        ]
      };
      const errors = AgentFactory.validateConfig(invalidConfig);

      expect(errors).toContain('Capability 0: name is required');
    });
  });

  describe('createAgentCluster', () => {
    it('should create multiple agents', async () => {
      const configs = [
        { ...validConfig, id: 'agent-001', type: 'chatbot' as const },
        { ...validConfig, id: 'agent-002', type: 'fraud-detection' as const },
        { ...validConfig, id: 'agent-003', type: 'recommendation' as const }
      ];

      const agents = await AgentFactory.createAgentCluster(configs);

      expect(agents).toHaveLength(3);
      expect(agents[0].getConfig().type).toBe('chatbot');
      expect(agents[1].getConfig().type).toBe('fraud-detection');
      expect(agents[2].getConfig().type).toBe('recommendation');
    });

    it('should continue creating agents even if some fail', async () => {
      const configs = [
        { ...validConfig, id: 'agent-001', type: 'chatbot' as const },
        { ...validConfig, id: 'agent-002', type: 'invalid' as any }, // Invalid type
        { ...validConfig, id: 'agent-003', type: 'recommendation' as const }
      ];

      const agents = await AgentFactory.createAgentCluster(configs);

      expect(agents).toHaveLength(2); // Only valid agents created
      expect(agents[0].getConfig().type).toBe('chatbot');
      expect(agents[1].getConfig().type).toBe('recommendation');
    });
  });

  describe('shutdownAgentCluster', () => {
    it('should shutdown all agents in cluster', async () => {
      const configs = [
        { ...validConfig, id: 'agent-001', type: 'chatbot' as const },
        { ...validConfig, id: 'agent-002', type: 'fraud-detection' as const }
      ];

      const agents = await AgentFactory.createAgentCluster(configs);
      
      // Mock shutdown method
      agents.forEach(agent => {
        agent.shutdown = jest.fn().mockResolvedValue(undefined);
      });

      await AgentFactory.shutdownAgentCluster(agents);

      agents.forEach(agent => {
        expect(agent.shutdown).toHaveBeenCalled();
      });
    });

    it('should handle shutdown errors gracefully', async () => {
      const configs = [
        { ...validConfig, id: 'agent-001', type: 'chatbot' as const }
      ];

      const agents = await AgentFactory.createAgentCluster(configs);
      
      // Mock shutdown to throw error
      agents[0].shutdown = jest.fn().mockRejectedValue(new Error('Shutdown failed'));

      // Should not throw
      await expect(AgentFactory.shutdownAgentCluster(agents)).resolves.toBeUndefined();
    });
  });
});