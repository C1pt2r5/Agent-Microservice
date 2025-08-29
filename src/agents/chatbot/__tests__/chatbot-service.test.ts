/**
 * Integration tests for Chatbot Service
 */

import request from 'supertest';
import { WebSocket } from 'ws';
import { ChatbotService, ChatbotServiceConfig } from '../chatbot-service';

describe('ChatbotService', () => {
  let service: ChatbotService;
  let config: ChatbotServiceConfig;

  beforeEach(() => {
    config = {
      id: 'chatbot-service-1',
      name: 'Chatbot Service',
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
      capabilities: [],
      server: {
        port: 0, // Use random port for testing
        host: 'localhost',
        cors: {
          enabled: true,
          origins: ['*']
        }
      },
      websocket: {
        enabled: true,
        path: '/ws',
        heartbeatInterval: 30000
      },
      api: {
        rateLimit: {
          windowMs: 60000,
          maxRequests: 100
        },
        authentication: {
          enabled: false,
          apiKeyHeader: 'x-api-key'
        }
      },
      monitoring: {
        metricsEnabled: true,
        loggingLevel: 'info'
      }
    };

    service = new ChatbotService(config);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('service lifecycle', () => {
    it('should initialize service successfully', async () => {
      // Mock agent dependencies
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      const initPromise = service.initialize();
      
      const startEvent = new Promise(resolve => {
        service.once('serviceStarted', resolve);
      });

      await expect(initPromise).resolves.not.toThrow();
      await expect(startEvent).resolves.toBeDefined();
    });

    it('should shutdown gracefully', async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();

      const shutdownPromise = new Promise(resolve => {
        service.once('serviceShutdown', resolve);
      });

      await service.shutdown();

      await expect(shutdownPromise).resolves.toBeDefined();
    });
  });

  describe('REST API endpoints', () => {
    beforeEach(async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({
        name: 'Test User',
        accountType: 'standard'
      });
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();
    });

    it('should handle health check', async () => {
      const response = await request(service['app'])
        .get('/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.metrics).toBeDefined();
      expect(response.body.agentHealth).toBeDefined();
    });

    it('should create a new session', async () => {
      const response = await request(service['app'])
        .post('/api/chat/session')
        .send({ userId: 'user_123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBeDefined();
      expect(response.body.data.userId).toBe('user_123');
    });

    it('should process chat message', async () => {
      // First create a session
      const sessionResponse = await request(service['app'])
        .post('/api/chat/session')
        .send({ userId: 'user_123' });

      const sessionId = sessionResponse.body.data.sessionId;

      // Then send a chat message
      const chatResponse = await request(service['app'])
        .post('/api/chat')
        .send({
          sessionId,
          userId: 'user_123',
          message: 'Hello, I need help with my account'
        })
        .expect(200);

      expect(chatResponse.body.success).toBe(true);
      expect(chatResponse.body.data.message).toBeDefined();
      expect(chatResponse.body.data.intent).toBeDefined();
      expect(chatResponse.body.data.confidence).toBeGreaterThan(0);
    });

    it('should retrieve session information', async () => {
      // Create session
      const sessionResponse = await request(service['app'])
        .post('/api/chat/session')
        .send({ userId: 'user_123' });

      const sessionId = sessionResponse.body.data.sessionId;

      // Retrieve session
      const getResponse = await request(service['app'])
        .get(`/api/chat/session/${sessionId}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.sessionId).toBe(sessionId);
    });

    it('should end session', async () => {
      // Create session
      const sessionResponse = await request(service['app'])
        .post('/api/chat/session')
        .send({ userId: 'user_123' });

      const sessionId = sessionResponse.body.data.sessionId;

      // End session
      await request(service['app'])
        .delete(`/api/chat/session/${sessionId}`)
        .expect(200);

      // Verify session is gone
      await request(service['app'])
        .get(`/api/chat/session/${sessionId}`)
        .expect(404);
    });

    it('should return statistics', async () => {
      const response = await request(service['app'])
        .get('/api/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.agent).toBeDefined();
      expect(response.body.data.service).toBeDefined();
      expect(response.body.data.websocket).toBeDefined();
    });

    it('should return metrics', async () => {
      const response = await request(service['app'])
        .get('/api/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRequests).toBeDefined();
      expect(response.body.data.activeConnections).toBeDefined();
    });

    it('should handle missing required fields', async () => {
      const response = await request(service['app'])
        .post('/api/chat')
        .send({ userId: 'user_123' }) // Missing sessionId and message
        .expect(400);

      expect(response.body.error).toBe('Missing required fields');
      expect(response.body.required).toContain('sessionId');
      expect(response.body.required).toContain('message');
    });

    it('should handle non-existent session', async () => {
      const response = await request(service['app'])
        .get('/api/chat/session/non_existent')
        .expect(404);

      expect(response.body.error).toBe('Session not found');
    });
  });

  describe('WebSocket functionality', () => {
    let wsUrl: string;

    beforeEach(async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();
      
      // Get the actual port assigned
      const address = service['server'].address() as any;
      wsUrl = `ws://localhost:${address.port}/ws`;
    });

    it('should handle WebSocket connections', (done) => {
      const ws = new WebSocket(`${wsUrl}?userId=user_123&sessionId=session_123`);

      ws.on('open', () => {
        expect(service['wsClients'].size).toBe(1);
        ws.close();
      });

      ws.on('close', () => {
        expect(service['wsClients'].size).toBe(0);
        done();
      });

      ws.on('error', done);
    });

    it('should receive welcome message on connection', (done) => {
      const ws = new WebSocket(`${wsUrl}?userId=user_123&sessionId=session_123`);

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection') {
          expect(message.data.message).toContain('Connected to chatbot service');
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('should process chat messages via WebSocket', (done) => {
      const ws = new WebSocket(`${wsUrl}?userId=user_123&sessionId=session_123`);

      let messageCount = 0;

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        messageCount++;

        if (message.type === 'connection') {
          // Send chat message after connection
          ws.send(JSON.stringify({
            type: 'chat',
            data: { message: 'Hello, I need help' }
          }));
        } else if (message.type === 'chat_response') {
          expect(message.data.message).toBeDefined();
          expect(message.data.intent).toBeDefined();
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('should handle ping-pong messages', (done) => {
      const ws = new WebSocket(`${wsUrl}?userId=user_123&sessionId=session_123`);

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'connection') {
          // Send ping
          ws.send(JSON.stringify({ type: 'ping' }));
        } else if (message.type === 'pong') {
          expect(message.data.timestamp).toBeDefined();
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('should handle invalid message format', (done) => {
      const ws = new WebSocket(`${wsUrl}?userId=user_123&sessionId=session_123`);

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'connection') {
          // Send invalid message
          ws.send('invalid json');
        } else if (message.type === 'error') {
          expect(message.data.message).toContain('Invalid message format');
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });
  });

  describe('rate limiting', () => {
    beforeEach(async () => {
      // Enable rate limiting for this test
      config.api.rateLimit.maxRequests = 2;
      config.api.rateLimit.windowMs = 1000;
      
      service = new ChatbotService(config);
      
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();
    });

    it('should enforce rate limits', async () => {
      // First request should succeed
      await request(service['app'])
        .get('/api/stats')
        .expect(200);

      // Second request should succeed
      await request(service['app'])
        .get('/api/stats')
        .expect(200);

      // Third request should be rate limited
      const response = await request(service['app'])
        .get('/api/stats')
        .expect(429);

      expect(response.body.error).toBe('Rate limit exceeded');
      expect(response.body.retryAfter).toBeDefined();
    });
  });

  describe('authentication', () => {
    beforeEach(async () => {
      // Enable authentication for this test
      config.api.authentication.enabled = true;
      
      service = new ChatbotService(config);
      
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();
    });

    it('should require API key when authentication is enabled', async () => {
      const response = await request(service['app'])
        .get('/api/stats')
        .expect(401);

      expect(response.body.error).toBe('Missing API key');
    });

    it('should accept valid API key', async () => {
      await request(service['app'])
        .get('/api/stats')
        .set('x-api-key', 'valid-api-key-123')
        .expect(200);
    });

    it('should reject invalid API key', async () => {
      const response = await request(service['app'])
        .get('/api/stats')
        .set('x-api-key', 'short')
        .expect(401);

      expect(response.body.error).toBe('Invalid API key');
    });
  });

  describe('A2A message handling', () => {
    beforeEach(async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();
    });

    it('should handle fraud alerts', (done) => {
      const fraudAlert = {
        messageType: 'high-risk-transaction',
        payload: {
          userId: 'user_123',
          transactionId: 'txn_456',
          riskScore: 95
        }
      };

      service.once('fraudAlertReceived', (alertData) => {
        expect(alertData.userId).toBe('user_123');
        expect(alertData.transactionId).toBe('txn_456');
        done();
      });

      service['handleA2AMessage'](fraudAlert);
    });

    it('should handle risk assessments', (done) => {
      const riskAssessment = {
        messageType: 'transaction-assessed',
        payload: {
          transactionId: 'txn_789',
          userId: 'user_456',
          assessment: {
            riskScore: 25,
            riskLevel: 'low'
          }
        }
      };

      service.once('riskAssessmentReceived', (assessmentData) => {
        expect(assessmentData.transactionId).toBe('txn_789');
        done();
      });

      service['handleA2AMessage'](riskAssessment);
    });

    it('should notify WebSocket clients of fraud alerts', (done) => {
      const wsUrl = `ws://localhost:${(service['server'].address() as any).port}/ws`;
      const ws = new WebSocket(`${wsUrl}?userId=user_123&sessionId=session_123`);

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'connection') {
          // Simulate fraud alert
          const fraudAlert = {
            messageType: 'high-risk-transaction',
            payload: {
              userId: 'user_123',
              transactionId: 'txn_456'
            }
          };

          service['handleA2AMessage'](fraudAlert);
        } else if (message.type === 'fraud_alert') {
          expect(message.data.message).toContain('suspicious activity');
          expect(message.data.alertLevel).toBe('high');
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      jest.spyOn(service['agent'] as any, 'queryMCP').mockResolvedValue({});
      jest.spyOn(service['agent'] as any, 'sendA2AMessage').mockResolvedValue(undefined);

      await service.initialize();
    });

    it('should handle chat processing errors', async () => {
      // Mock agent to throw error
      jest.spyOn(service['agent'], 'processChat').mockRejectedValue(new Error('Processing failed'));

      const sessionResponse = await request(service['app'])
        .post('/api/chat/session')
        .send({ userId: 'user_123' });

      const sessionId = sessionResponse.body.data.sessionId;

      const response = await request(service['app'])
        .post('/api/chat')
        .send({
          sessionId,
          userId: 'user_123',
          message: 'Hello'
        })
        .expect(500);

      expect(response.body.error).toBe('Chat processing failed');
    });

    it('should handle session creation errors', async () => {
      // Mock agent to throw error
      jest.spyOn(service['agent'], 'createSession').mockRejectedValue(new Error('Session creation failed'));

      const response = await request(service['app'])
        .post('/api/chat/session')
        .send({ userId: 'user_123' })
        .expect(500);

      expect(response.body.error).toBe('Failed to create session');
    });
  });
});