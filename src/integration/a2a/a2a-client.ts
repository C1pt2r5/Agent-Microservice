/**
 * A2A client implementation
 */

import WebSocket from 'ws';
import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { 
  A2AClient, 
  A2AMessage, 
  A2ADeliveryReceipt, 
  A2ASubscription, 
  A2AAgentRegistration, 
  A2ATopicDefinition,
  A2AConfig,
  A2AMessageHandler,
  A2AMessageResponse,
  SystemError
} from '../../types';
import { A2AMessageValidator } from './message-validator';
import { A2AMessageSerializer } from './message-serializer';

export class A2AClientImpl extends EventEmitter implements A2AClient {
  private config: A2AConfig;
  private httpClient: AxiosInstance;
  private wsClient: WebSocket | null = null;
  private messageValidator: A2AMessageValidator;
  private messageSerializer: A2AMessageSerializer;
  private messageHandlers: Map<string, A2AMessageHandler> = new Map();
  private subscriptions: Map<string, A2ASubscription> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 5000;

  constructor(config: A2AConfig) {
    super();
    this.config = config;
    this.messageValidator = new A2AMessageValidator();
    this.messageSerializer = new A2AMessageSerializer();

    this.httpClient = axios.create({
      baseURL: config.hubUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'A2A-Client/1.0.0',
        'X-Agent-ID': config.agentId
      }
    });

    // Don't automatically connect in constructor for better testability
    // Connection will be established when connect() is called explicitly
  }

  private setupWebSocketConnection(): void {
    const wsUrl = this.config.hubUrl.replace('http', 'ws') + '/ws';

    try {
      this.wsClient = new WebSocket(wsUrl, {
        headers: {
          'X-Agent-ID': this.config.agentId
        }
      });

      this.wsClient.on('open', () => {
        console.log(`A2A Client connected to hub: ${wsUrl}`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');

        // Re-register subscriptions after reconnection
        this.reestablishSubscriptions();
      });

      this.wsClient.on('message', (data: WebSocket.Data) => {
        try {
          const message = this.messageSerializer.deserialize(data.toString());
          this.handleIncomingMessage(message);
        } catch (error) {
          console.error('Failed to process incoming message:', error);
          this.emit('error', error);
        }
      });

      this.wsClient.on('close', (code: number, reason: string) => {
        console.log(`A2A Client disconnected: ${code} - ${reason}`);
        this.isConnected = false;
        this.emit('disconnected', { code, reason });

        // Only attempt reconnection if not in test environment
        if (process.env.NODE_ENV !== 'test') {
          this.attemptReconnection();
        }
      });

      this.wsClient.on('error', (error: Error) => {
        // Only log errors if not in test environment to avoid test noise
        if (process.env.NODE_ENV !== 'test') {
          console.error('A2A WebSocket error:', error);
        }
        this.emit('error', error);
      });

    } catch (error) {
      // Only attempt reconnection if not in test environment
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to establish WebSocket connection:', error);
        this.attemptReconnection();
      } else {
        // In test environment, just emit the error without reconnection attempts
        this.emit('error', error);
      }
    }
  }

  private attemptReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.setupWebSocketConnection();
    }, this.reconnectInterval * this.reconnectAttempts);
  }

  private async reestablishSubscriptions(): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      try {
        await this.subscribe(subscription);
      } catch (error) {
        console.error(`Failed to reestablish subscription for topic ${subscription.topic}:`, error);
      }
    }
  }

  private async handleIncomingMessage(message: A2AMessage): Promise<void> {
    try {
      // Validate message
      const validationResult = this.messageValidator.validate(message);
      if (!validationResult.isValid) {
        console.error('Invalid incoming message:', validationResult.errors);
        return;
      }

      // Find appropriate handler
      const handler = this.messageHandlers.get(message.messageType);
      if (!handler) {
        console.warn(`No handler registered for message type: ${message.messageType}`);
        return;
      }

      // Process message
      const response = await handler.handle(message);
      
      // Send response if needed
      if (response.responsePayload && message.metadata.replyTo) {
        const responseMessage: A2AMessage = {
          id: `response_${Date.now()}`,
          timestamp: new Date(),
          sourceAgent: this.config.agentId,
          targetAgent: message.sourceAgent,
          topic: message.topic,
          messageType: `${message.messageType}_response`,
          priority: message.priority,
          payload: response.responsePayload,
          metadata: {
            correlationId: message.metadata.correlationId,
            ttl: 300000, // 5 minutes
            retryCount: 0,
            deliveryAttempts: 0,
            replyTo: message.metadata.replyTo
          }
        };

        await this.publish(responseMessage);
      }

      // Forward to other agents if specified
      if (response.forwardTo && response.forwardTo.length > 0) {
        for (const targetAgent of response.forwardTo) {
          const forwardMessage: A2AMessage = {
            ...message,
            id: `forward_${Date.now()}`,
            timestamp: new Date(),
            sourceAgent: this.config.agentId,
            targetAgent,
            metadata: {
              ...message.metadata,
              deliveryAttempts: 0
            }
          };

          await this.publish(forwardMessage);
        }
      }

      this.emit('messageProcessed', { message, response });

    } catch (error) {
      console.error('Error handling incoming message:', error);
      this.emit('messageError', { message, error });
    }
  }

  async publish(message: A2AMessage): Promise<A2ADeliveryReceipt> {
    try {
      // Validate message
      const validationResult = this.messageValidator.validate(message);
      if (!validationResult.isValid) {
        throw new Error(`Invalid message: ${validationResult.errors.join(', ')}`);
      }

      // Set source agent if not specified
      if (!message.sourceAgent) {
        message.sourceAgent = this.config.agentId;
      }

      // Serialize message
      const serializedMessage = this.messageSerializer.serialize(message);

      // Send via WebSocket if connected, otherwise use HTTP
      if (this.isConnected && this.wsClient) {
        return this.publishViaWebSocket(serializedMessage);
      } else {
        return this.publishViaHttp(message);
      }

    } catch (error) {
      const receipt: A2ADeliveryReceipt = {
        messageId: message.id,
        timestamp: new Date(),
        status: 'failed',
        targetAgent: message.targetAgent || 'unknown',
        error: {
          code: 'A2A_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
      };

      this.emit('publishError', { message, error, receipt });
      return receipt;
    }
  }

  private async publishViaWebSocket(serializedMessage: string): Promise<A2ADeliveryReceipt> {
    return new Promise((resolve, reject) => {
      if (!this.wsClient || !this.isConnected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const messageId = JSON.parse(serializedMessage).id;
      const timeout = setTimeout(() => {
        reject(new Error('Message publish timeout'));
      }, 30000);

      // Listen for delivery receipt
      const receiptHandler = (data: WebSocket.Data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.type === 'delivery_receipt' && response.messageId === messageId) {
            clearTimeout(timeout);
            this.wsClient?.removeListener('message', receiptHandler);
            resolve(response.receipt);
          }
        } catch (error) {
          // Ignore parsing errors for non-receipt messages
        }
      };

      this.wsClient.on('message', receiptHandler);
      this.wsClient.send(serializedMessage);
    });
  }

  private async publishViaHttp(message: A2AMessage): Promise<A2ADeliveryReceipt> {
    try {
      const response = await this.httpClient.post('/messages', message);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`HTTP publish failed: ${error.message}`);
      }
      throw error;
    }
  }

  async subscribe(subscription: A2ASubscription): Promise<void> {
    try {
      // Store subscription locally
      this.subscriptions.set(subscription.topic, subscription);

      // Register with hub
      const response = await this.httpClient.post('/subscriptions', {
        agentId: this.config.agentId,
        subscription
      });

      if (response.status !== 200) {
        throw new Error(`Subscription failed: ${response.statusText}`);
      }

      this.emit('subscribed', subscription);
      console.log(`Subscribed to topic: ${subscription.topic}`);

    } catch (error) {
      this.subscriptions.delete(subscription.topic);
      const systemError: SystemError = {
        code: 'A2A_ERROR',
        message: error instanceof Error ? error.message : 'Subscription failed',
        timestamp: new Date()
      };
      this.emit('subscriptionError', { subscription, error: systemError });
      throw systemError;
    }
  }

  async unsubscribe(topic: string): Promise<void> {
    try {
      // Remove local subscription
      this.subscriptions.delete(topic);

      // Unregister with hub
      const response = await this.httpClient.delete(`/subscriptions/${topic}`, {
        params: { agentId: this.config.agentId }
      });

      if (response.status !== 200) {
        throw new Error(`Unsubscribe failed: ${response.statusText}`);
      }

      this.emit('unsubscribed', topic);
      console.log(`Unsubscribed from topic: ${topic}`);

    } catch (error) {
      const systemError: SystemError = {
        code: 'A2A_ERROR',
        message: error instanceof Error ? error.message : 'Unsubscribe failed',
        timestamp: new Date()
      };
      this.emit('unsubscribeError', { topic, error: systemError });
      throw systemError;
    }
  }

  async registerAgent(registration: A2AAgentRegistration): Promise<void> {
    try {
      const response = await this.httpClient.post('/agents/register', registration);

      if (response.status !== 200) {
        throw new Error(`Agent registration failed: ${response.statusText}`);
      }

      // Register message handlers for subscriptions
      registration.subscriptions.forEach(subscription => {
        this.subscriptions.set(subscription.topic, subscription);
      });

      this.emit('agentRegistered', registration);
      console.log(`Agent registered: ${registration.agentId}`);

    } catch (error) {
      const systemError: SystemError = {
        code: 'A2A_ERROR',
        message: error instanceof Error ? error.message : 'Agent registration failed',
        timestamp: new Date()
      };
      this.emit('registrationError', { registration, error: systemError });
      throw systemError;
    }
  }

  async getTopicDefinition(topicName: string): Promise<A2ATopicDefinition> {
    try {
      const response = await this.httpClient.get(`/topics/${topicName}/definition`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error(`Topic not found: ${topicName}`);
      }
      throw new Error(`Failed to get topic definition: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/health');
      return response.status === 200 && this.isConnected;
    } catch (error) {
      return false;
    }
  }

  // Message handler registration
  registerMessageHandler(handler: A2AMessageHandler): void {
    this.messageHandlers.set(handler.messageType, handler);
    console.log(`Registered handler for message type: ${handler.messageType}`);
  }

  unregisterMessageHandler(messageType: string): void {
    this.messageHandlers.delete(messageType);
    console.log(`Unregistered handler for message type: ${messageType}`);
  }

  // Connection management
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    this.setupWebSocketConnection();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 30000);

      this.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    this.isConnected = false;
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  // Getters
  getConfig(): A2AConfig {
    return { ...this.config };
  }

  getSubscriptions(): A2ASubscription[] {
    return Array.from(this.subscriptions.values());
  }

  getMessageHandlers(): string[] {
    return Array.from(this.messageHandlers.keys());
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }
}