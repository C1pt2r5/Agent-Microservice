/**
 * Integration tests for A2A Hub
 */

import WebSocket from 'ws';
import request from 'supertest';
import { A2AHub } from '../a2a-hub';
import { A2AMessage, A2AAgentRegistration } from '../../../types';

describe('A2AHub', () => {
  let hub: A2AHub;
  const testPort = 8082;

  beforeEach(async () => {
    hub = new A2AHub({ port: testPort });
    await hub.start();
  });

  afterEach(async () => {
    if (hub.isHubRunning()) {
      await hub.stop();
    }
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(`http://localhost:${testPort}`)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        connectedAgents: 0,
        topics: 4
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Agent Registration', () => {
    const testRegistration: A2AAgentRegistration = {
      agentId: 'test-agent-001',
      agentType: 'chatbot',
      capabilities: ['chat', 'support'],
      subscriptions: [
        {
          topic: 'chat-support',
          messageTypes: ['chat.context_update'],
          priority: 'normal',
          handler: 'handleChatUpdate'
        }
      ],
      endpoint: 'http://test-agent:8080',
      heartbeatInterval: 30000
    };

    it('should register an agent successfully', async () => {
      const response = await request(`http://localhost:${testPort}`)
        .post('/agents/register')
        .send(testRegistration)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Agent registered successfully'
      });
    });

    it('should list registered agents', async () => {
      await request(`http://localhost:${testPort}`)
        .post('/agents/register')
        .send(testRegistration);

      const response = await request(`http://localhost:${testPort}`)
        .get('/agents')
        .expect(200);

      expect(response.body.agents).toHaveLength(1);
      expect(response.body.agents[0].agentId).toBe('test-agent-001');
    });
  });

  describe('Message Publishing', () => {
    const testMessage: A2AMessage = {
      id: 'test-message-001',
      timestamp: new Date(),
      sourceAgent: 'test-sender',
      topic: 'fraud-detection',
      messageType: 'fraud.alert',
      priority: 'high',
      payload: {
        transactionId: 'txn_12345',
        riskScore: 0.95
      },
      metadata: {
        correlationId: 'corr-123',
        ttl: 300000,
        retryCount: 0,
        deliveryAttempts: 0
      }
    };

    it('should publish a message via HTTP', async () => {
      const response = await request(`http://localhost:${testPort}`)
        .post('/messages')
        .send(testMessage)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.receipts).toBeDefined();
    });
  });

  describe('Hub Lifecycle', () => {
    it('should start and stop hub correctly', async () => {
      const testHub = new A2AHub({ port: testPort + 1 });
      
      expect(testHub.isHubRunning()).toBe(false);
      
      await testHub.start();
      expect(testHub.isHubRunning()).toBe(true);
      
      await testHub.stop();
      expect(testHub.isHubRunning()).toBe(false);
    });
  });
});