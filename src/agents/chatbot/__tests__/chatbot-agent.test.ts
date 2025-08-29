/**
 * Unit tests for Chatbot Agent
 */

import { ChatbotAgent, ChatRequest, ConversationSession } from '../chatbot-agent';
import { AgentConfig } from '../../../types';

describe('ChatbotAgent', () => {
  let agent: ChatbotAgent;
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      id: 'chatbot-1',
      name: 'Customer Support Chatbot',
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

    agent = new ChatbotAgent(config);
  });

  afterEach(async () => {
    if (agent && agent.isAgentHealthy()) {
      await agent.shutdown();
    }
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('session management', () => {
    it('should create a new session', async () => {
      // Mock MCP call for customer info
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({
        name: 'John Doe',
        accountType: 'premium',
        accountStatus: 'active',
        interactionCount: 5
      });

      const session = await agent.createSession('session_123', 'user_456');

      expect(session).toBeDefined();
      expect(session.sessionId).toBe('session_123');
      expect(session.userId).toBe('user_456');
      expect(session.context.customerInfo?.name).toBe('John Doe');
      expect(session.history).toHaveLength(0);
    });

    it('should retrieve existing session', async () => {
      // Mock MCP call
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({});

      const session = await agent.createSession('session_123', 'user_456');
      const retrievedSession = agent.getSession('session_123');

      expect(retrievedSession).toBe(session);
    });

    it('should return undefined for non-existent session', () => {
      const session = agent.getSession('non_existent');
      expect(session).toBeUndefined();
    });

    it('should end session', async () => {
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({});

      await agent.createSession('session_123', 'user_456');
      agent.endSession('session_123');

      const session = agent.getSession('session_123');
      expect(session).toBeUndefined();
    });

    it('should clean up expired sessions', async () => {
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({});

      const session = await agent.createSession('session_123', 'user_456');
      
      // Manually set last activity to past timeout
      session.lastActivity = new Date(Date.now() - 2000000); // 33+ minutes ago
      
      agent.cleanupExpiredSessions();

      const retrievedSession = agent.getSession('session_123');
      expect(retrievedSession).toBeUndefined();
    });
  });

  describe('chat processing', () => {
    let mockSession: ConversationSession;

    beforeEach(async () => {
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({
        name: 'Jane Doe',
        accountType: 'standard',
        accountStatus: 'active'
      });

      mockSession = await agent.createSession('session_123', 'user_456');
    });

    it('should process greeting message', async () => {
      const request: ChatRequest = {
        sessionId: 'session_123',
        userId: 'user_456',
        message: 'Hello',
        channel: 'web'
      };

      const response = await agent.processChat(request);

      expect(response.sessionId).toBe('session_123');
      expect(response.intent).toBe('greeting');
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.message).toContain('Hello');
      expect(response.requiresEscalation).toBe(false);
    });

    it('should process balance inquiry', async () => {
      const request: ChatRequest = {
        sessionId: 'session_123',
        userId: 'user_456',
        message: 'What is my account balance?',
        channel: 'web'
      };

      const response = await agent.processChat(request);

      expect(response.intent).toBe('balance_check');
      expect(response.suggestedActions).toContain('View Transactions');
    });

    it('should process fraud report with escalation', async () => {
      jest.spyOn(agent as any, 'sendA2AMessage').mockResolvedValue(undefined);

      const request: ChatRequest = {
        sessionId: 'session_123',
        userId: 'user_456',
        message: 'I think there is fraudulent activity on my account',
        channel: 'web'
      };

      const response = await agent.processChat(request);

      expect(response.intent).toBe('fraud_report');
      expect(response.requiresEscalation).toBe(true);
      expect(response.context.requiresHumanHandoff).toBe(true);
    });

    it('should handle transaction inquiry', async () => {
      const request: ChatRequest = {
        sessionId: 'session_123',
        userId: 'user_456',
        message: 'I need information about my recent payment',
        channel: 'mobile'
      };

      const response = await agent.processChat(request);

      expect(response.intent).toBe('transaction_inquiry');
      expect(response.suggestedActions).toContain('View Details');
    });

    it('should maintain conversation history', async () => {
      const requests = [
        { message: 'Hello', expectedIntent: 'greeting' },
        { message: 'What is my balance?', expectedIntent: 'balance_check' },
        { message: 'Thank you', expectedIntent: 'compliment' }
      ];

      for (const req of requests) {
        const request: ChatRequest = {
          sessionId: 'session_123',
          userId: 'user_456',
          message: req.message,
          channel: 'web'
        };

        const response = await agent.processChat(request);
        expect(response.intent).toBe(req.expectedIntent);
      }

      const session = agent.getSession('session_123');
      expect(session?.history).toHaveLength(6); // 3 user + 3 assistant messages
    });

    it('should handle errors gracefully', async () => {
      // Mock error in processing
      jest.spyOn(agent as any, 'classifyIntent').mockRejectedValue(new Error('Classification failed'));

      const request: ChatRequest = {
        sessionId: 'session_123',
        userId: 'user_456',
        message: 'Hello',
        channel: 'web'
      };

      const response = await agent.processChat(request);

      expect(response.intent).toBe('error');
      expect(response.confidence).toBe(0);
      expect(response.requiresEscalation).toBe(true);
      expect(response.message).toContain('error');
    });
  });

  describe('intent classification', () => {
    beforeEach(async () => {
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({});
      await agent.createSession('session_123', 'user_456');
    });

    it('should classify greeting intent', async () => {
      const session = agent.getSession('session_123')!;
      const classification = await agent['classifyIntent']('Hello there!', session.context);

      expect(classification.intent).toBe('greeting');
      expect(classification.confidence).toBeGreaterThan(0.5);
    });

    it('should classify balance check intent', async () => {
      const session = agent.getSession('session_123')!;
      const classification = await agent['classifyIntent']('Check my balance please', session.context);

      expect(classification.intent).toBe('balance_check');
      expect(classification.confidence).toBeGreaterThan(0.5);
    });

    it('should classify fraud report intent', async () => {
      const session = agent.getSession('session_123')!;
      const classification = await agent['classifyIntent']('I see suspicious transactions', session.context);

      expect(classification.intent).toBe('fraud_report');
      expect(classification.confidence).toBeGreaterThan(0.5);
    });

    it('should fallback to general support for unclear messages', async () => {
      const session = agent.getSession('session_123')!;
      const classification = await agent['classifyIntent']('xyz abc random text', session.context);

      expect(classification.intent).toBe('general_support');
      expect(classification.confidence).toBeLessThanOrEqual(0.5);
    });
  });

  describe('escalation logic', () => {
    beforeEach(async () => {
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({});
      await agent.createSession('session_123', 'user_456');
    });

    it('should escalate for low confidence', async () => {
      const session = agent.getSession('session_123')!;
      const classification = { intent: 'general_support', confidence: 0.2, entities: {}, alternatives: [] };

      const shouldEscalate = agent['shouldEscalate'](session, classification);
      expect(shouldEscalate).toBe(true);
    });

    it('should escalate for fraud reports', async () => {
      const session = agent.getSession('session_123')!;
      const classification = { intent: 'fraud_report', confidence: 0.9, entities: {}, alternatives: [] };

      const shouldEscalate = agent['shouldEscalate'](session, classification);
      expect(shouldEscalate).toBe(true);
    });

    it('should escalate for complaints', async () => {
      const session = agent.getSession('session_123')!;
      const classification = { intent: 'complaint', confidence: 0.8, entities: {}, alternatives: [] };

      const shouldEscalate = agent['shouldEscalate'](session, classification);
      expect(shouldEscalate).toBe(true);
    });

    it('should not escalate for normal interactions', async () => {
      const session = agent.getSession('session_123')!;
      const classification = { intent: 'balance_check', confidence: 0.8, entities: {}, alternatives: [] };

      const shouldEscalate = agent['shouldEscalate'](session, classification);
      expect(shouldEscalate).toBe(false);
    });
  });

  describe('processRequest', () => {
    it('should handle process_chat action', async () => {
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({});

      const request = {
        id: 'req_123',
        timestamp: new Date(),
        correlationId: 'corr_123',
        payload: {
          action: 'process_chat',
          payload: {
            sessionId: 'session_123',
            userId: 'user_456',
            message: 'Hello',
            channel: 'web'
          }
        }
      };

      const response = await agent.processRequest(request);

      expect(response.success).toBe(true);
      expect(response.payload?.chatResponse).toBeDefined();
    });

    it('should handle get_session action', async () => {
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({});
      await agent.createSession('session_123', 'user_456');

      const request = {
        id: 'req_124',
        timestamp: new Date(),
        correlationId: 'corr_124',
        payload: {
          action: 'get_session',
          payload: { sessionId: 'session_123' }
        }
      };

      const response = await agent.processRequest(request);

      expect(response.success).toBe(true);
      expect(response.payload?.session).toBeDefined();
      expect(response.payload?.session?.sessionId).toBe('session_123');
    });

    it('should handle end_session action', async () => {
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({});
      await agent.createSession('session_123', 'user_456');

      const request = {
        id: 'req_125',
        timestamp: new Date(),
        correlationId: 'corr_125',
        payload: {
          action: 'end_session',
          payload: { sessionId: 'session_123' }
        }
      };

      const response = await agent.processRequest(request);

      expect(response.success).toBe(true);
      expect(response.payload?.ended).toBe(true);

      // Verify session is ended
      const session = agent.getSession('session_123');
      expect(session).toBeUndefined();
    });

    it('should handle unknown action with error', async () => {
      const request = {
        id: 'req_126',
        timestamp: new Date(),
        correlationId: 'corr_126',
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

  describe('statistics', () => {
    beforeEach(async () => {
      jest.spyOn(agent as any, 'queryMCP').mockResolvedValue({});
    });

    it('should track active sessions', async () => {
      expect(agent.getActiveSessionCount()).toBe(0);

      await agent.createSession('session_1', 'user_1');
      await agent.createSession('session_2', 'user_2');

      expect(agent.getActiveSessionCount()).toBe(2);

      agent.endSession('session_1');
      expect(agent.getActiveSessionCount()).toBe(1);
    });

    it('should provide session statistics', async () => {
      await agent.createSession('session_1', 'user_1');
      
      // Simulate some conversation
      const request: ChatRequest = {
        sessionId: 'session_1',
        userId: 'user_1',
        message: 'Hello',
        channel: 'web'
      };
      await agent.processChat(request);

      const stats = agent.getSessionStatistics();

      expect(stats.activeSessions).toBe(1);
      expect(stats.totalSessions).toBe(1);
      expect(stats.averageSessionDuration).toBeGreaterThan(0);
      expect(stats.topIntents).toBeDefined();
    });
  });
});