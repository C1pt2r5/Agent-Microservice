"use strict";
/**
 * A2A client implementation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.A2AClientImpl = void 0;
const ws_1 = __importDefault(require("ws"));
const axios_1 = __importDefault(require("axios"));
const events_1 = require("events");
const message_validator_1 = require("./message-validator");
const message_serializer_1 = require("./message-serializer");
class A2AClientImpl extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.wsClient = null;
        this.messageHandlers = new Map();
        this.subscriptions = new Map();
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000;
        this.config = config;
        this.messageValidator = new message_validator_1.A2AMessageValidator();
        this.messageSerializer = new message_serializer_1.A2AMessageSerializer();
        this.httpClient = axios_1.default.create({
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
    setupWebSocketConnection() {
        const wsUrl = this.config.hubUrl.replace('http', 'ws') + '/ws';
        try {
            this.wsClient = new ws_1.default(wsUrl, {
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
            this.wsClient.on('message', (data) => {
                try {
                    const message = this.messageSerializer.deserialize(data.toString());
                    this.handleIncomingMessage(message);
                }
                catch (error) {
                    console.error('Failed to process incoming message:', error);
                    this.emit('error', error);
                }
            });
            this.wsClient.on('close', (code, reason) => {
                console.log(`A2A Client disconnected: ${code} - ${reason}`);
                this.isConnected = false;
                this.emit('disconnected', { code, reason });
                // Only attempt reconnection if not in test environment
                if (process.env.NODE_ENV !== 'test') {
                    this.attemptReconnection();
                }
            });
            this.wsClient.on('error', (error) => {
                // Only log errors if not in test environment to avoid test noise
                if (process.env.NODE_ENV !== 'test') {
                    console.error('A2A WebSocket error:', error);
                }
                this.emit('error', error);
            });
        }
        catch (error) {
            // Only attempt reconnection if not in test environment
            if (process.env.NODE_ENV !== 'test') {
                console.error('Failed to establish WebSocket connection:', error);
                this.attemptReconnection();
            }
            else {
                // In test environment, just emit the error without reconnection attempts
                this.emit('error', error);
            }
        }
    }
    attemptReconnection() {
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
    async reestablishSubscriptions() {
        for (const subscription of this.subscriptions.values()) {
            try {
                await this.subscribe(subscription);
            }
            catch (error) {
                console.error(`Failed to reestablish subscription for topic ${subscription.topic}:`, error);
            }
        }
    }
    async handleIncomingMessage(message) {
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
                const responseMessage = {
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
                    const forwardMessage = {
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
        }
        catch (error) {
            console.error('Error handling incoming message:', error);
            this.emit('messageError', { message, error });
        }
    }
    async publish(message) {
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
            }
            else {
                return this.publishViaHttp(message);
            }
        }
        catch (error) {
            const receipt = {
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
    async publishViaWebSocket(serializedMessage) {
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
            const receiptHandler = (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.type === 'delivery_receipt' && response.messageId === messageId) {
                        clearTimeout(timeout);
                        this.wsClient?.removeListener('message', receiptHandler);
                        resolve(response.receipt);
                    }
                }
                catch (error) {
                    // Ignore parsing errors for non-receipt messages
                }
            };
            this.wsClient.on('message', receiptHandler);
            this.wsClient.send(serializedMessage);
        });
    }
    async publishViaHttp(message) {
        try {
            const response = await this.httpClient.post('/messages', message);
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw new Error(`HTTP publish failed: ${error.message}`);
            }
            throw error;
        }
    }
    async subscribe(subscription) {
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
        }
        catch (error) {
            this.subscriptions.delete(subscription.topic);
            const systemError = {
                code: 'A2A_ERROR',
                message: error instanceof Error ? error.message : 'Subscription failed',
                timestamp: new Date()
            };
            this.emit('subscriptionError', { subscription, error: systemError });
            throw systemError;
        }
    }
    async unsubscribe(topic) {
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
        }
        catch (error) {
            const systemError = {
                code: 'A2A_ERROR',
                message: error instanceof Error ? error.message : 'Unsubscribe failed',
                timestamp: new Date()
            };
            this.emit('unsubscribeError', { topic, error: systemError });
            throw systemError;
        }
    }
    async registerAgent(registration) {
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
        }
        catch (error) {
            const systemError = {
                code: 'A2A_ERROR',
                message: error instanceof Error ? error.message : 'Agent registration failed',
                timestamp: new Date()
            };
            this.emit('registrationError', { registration, error: systemError });
            throw systemError;
        }
    }
    async getTopicDefinition(topicName) {
        try {
            const response = await this.httpClient.get(`/topics/${topicName}/definition`);
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.status === 404) {
                throw new Error(`Topic not found: ${topicName}`);
            }
            throw new Error(`Failed to get topic definition: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async healthCheck() {
        try {
            const response = await this.httpClient.get('/health');
            return response.status === 200 && this.isConnected;
        }
        catch (error) {
            return false;
        }
    }
    // Message handler registration
    registerMessageHandler(handler) {
        this.messageHandlers.set(handler.messageType, handler);
        console.log(`Registered handler for message type: ${handler.messageType}`);
    }
    unregisterMessageHandler(messageType) {
        this.messageHandlers.delete(messageType);
        console.log(`Unregistered handler for message type: ${messageType}`);
    }
    // Connection management
    async connect() {
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
    async disconnect() {
        if (this.wsClient) {
            this.wsClient.close();
            this.wsClient = null;
        }
        this.isConnected = false;
        this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
    }
    // Getters
    getConfig() {
        return { ...this.config };
    }
    getSubscriptions() {
        return Array.from(this.subscriptions.values());
    }
    getMessageHandlers() {
        return Array.from(this.messageHandlers.keys());
    }
    isClientConnected() {
        return this.isConnected;
    }
}
exports.A2AClientImpl = A2AClientImpl;
//# sourceMappingURL=a2a-client.js.map