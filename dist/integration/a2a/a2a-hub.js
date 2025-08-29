"use strict";
/**
 * A2A communication hub implementation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.A2AHub = void 0;
const express_1 = __importDefault(require("express"));
const ws_1 = __importStar(require("ws"));
const http_1 = require("http");
const events_1 = require("events");
const message_validator_1 = require("./message-validator");
const message_serializer_1 = require("./message-serializer");
const message_router_1 = require("./message-router");
class A2AHub extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.connectedAgents = new Map();
        this.topics = new Map();
        this.messageHistory = new Map(); // topic -> messages
        this.deliveryReceipts = new Map();
        this.isRunning = false;
        this.heartbeatTimer = null;
        this.cleanupTimer = null;
        this.config = {
            port: 8081,
            maxConnections: 1000,
            heartbeatInterval: 30000, // 30 seconds
            messageRetention: 86400000, // 24 hours
            enablePersistence: true,
            enableMetrics: true,
            ...config
        };
        this.messageValidator = new message_validator_1.A2AMessageValidator();
        this.messageSerializer = new message_serializer_1.A2AMessageSerializer();
        this.messageRouter = new message_router_1.A2AMessageRouter();
        this.app = (0, express_1.default)();
        this.server = (0, http_1.createServer)(this.app);
        this.wsServer = new ws_1.WebSocketServer({ server: this.server });
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocketHandlers();
        this.setupMessageRouterHandlers();
        this.initializeDefaultTopics();
    }
    setupMiddleware() {
        // Body parsing
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true }));
        // CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Agent-ID');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            }
            else {
                next();
            }
        });
        // Request logging
        this.app.use((req, res, next) => {
            const startTime = Date.now();
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Agent: ${req.headers['x-agent-id'] || 'unknown'}`);
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
            });
            next();
        });
        // Error handling
        this.app.use((error, req, res, next) => {
            console.error('A2A Hub error:', error);
            const systemError = {
                code: 'A2A_ERROR',
                message: error.message,
                timestamp: new Date()
            };
            res.status(500).json({
                success: false,
                error: systemError
            });
        });
    }
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                connectedAgents: this.connectedAgents.size,
                topics: this.topics.size,
                uptime: process.uptime()
            });
        });
        // Agent registration
        this.app.post('/agents/register', async (req, res) => {
            try {
                const registration = req.body;
                await this.registerAgent(registration);
                res.json({ success: true, message: 'Agent registered successfully' });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'A2A_ERROR',
                        message: error instanceof Error ? error.message : 'Registration failed',
                        timestamp: new Date()
                    }
                });
            }
        });
        // Agent unregistration
        this.app.delete('/agents/:agentId', (req, res) => {
            try {
                const { agentId } = req.params;
                this.unregisterAgent(agentId);
                res.json({ success: true, message: 'Agent unregistered successfully' });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'A2A_ERROR',
                        message: error instanceof Error ? error.message : 'Unregistration failed',
                        timestamp: new Date()
                    }
                });
            }
        });
        // List connected agents
        this.app.get('/agents', (req, res) => {
            const agents = Array.from(this.connectedAgents.values()).map(agent => ({
                agentId: agent.agentId,
                agentType: agent.registration.agentType,
                capabilities: agent.registration.capabilities,
                subscriptions: agent.registration.subscriptions.map(sub => sub.topic),
                lastHeartbeat: agent.lastHeartbeat,
                queuedMessages: agent.messageQueue.length
            }));
            res.json({ agents });
        });
        // Subscription management
        this.app.post('/subscriptions', async (req, res) => {
            try {
                const { agentId, subscription } = req.body;
                await this.addSubscription(agentId, subscription);
                res.json({ success: true, message: 'Subscription added successfully' });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'A2A_ERROR',
                        message: error instanceof Error ? error.message : 'Subscription failed',
                        timestamp: new Date()
                    }
                });
            }
        });
        this.app.delete('/subscriptions/:topic', async (req, res) => {
            try {
                const { topic } = req.params;
                const agentId = req.query.agentId;
                await this.removeSubscription(agentId, topic);
                res.json({ success: true, message: 'Subscription removed successfully' });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'A2A_ERROR',
                        message: error instanceof Error ? error.message : 'Unsubscription failed',
                        timestamp: new Date()
                    }
                });
            }
        });
        // Message publishing (HTTP fallback)
        this.app.post('/messages', async (req, res) => {
            try {
                const message = req.body;
                const receipts = await this.publishMessage(message);
                res.json({ success: true, receipts });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'A2A_ERROR',
                        message: error instanceof Error ? error.message : 'Message publishing failed',
                        timestamp: new Date()
                    }
                });
            }
        });
        // Topic management
        this.app.get('/topics', (req, res) => {
            const topicList = Array.from(this.topics.values());
            res.json({ topics: topicList });
        });
        this.app.get('/topics/:topicName/definition', (req, res) => {
            const { topicName } = req.params;
            const topic = this.topics.get(topicName);
            if (!topic) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'A2A_ERROR',
                        message: `Topic not found: ${topicName}`,
                        timestamp: new Date()
                    }
                });
            }
            res.json(topic);
        });
        this.app.post('/topics', (req, res) => {
            try {
                const topicDefinition = req.body;
                this.createTopic(topicDefinition);
                res.json({ success: true, message: 'Topic created successfully' });
            }
            catch (error) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'A2A_ERROR',
                        message: error instanceof Error ? error.message : 'Topic creation failed',
                        timestamp: new Date()
                    }
                });
            }
        });
        // Message history
        this.app.get('/topics/:topicName/messages', (req, res) => {
            const { topicName } = req.params;
            const limit = parseInt(req.query.limit) || 100;
            const offset = parseInt(req.query.offset) || 0;
            const messages = this.messageHistory.get(topicName) || [];
            const paginatedMessages = messages.slice(offset, offset + limit);
            res.json({
                topic: topicName,
                messages: paginatedMessages,
                total: messages.length,
                limit,
                offset
            });
        });
        // Hub statistics
        this.app.get('/stats', (req, res) => {
            const stats = this.getHubStatistics();
            res.json(stats);
        });
    }
    setupWebSocketHandlers() {
        this.wsServer.on('connection', (ws, req) => {
            const agentId = req.headers['x-agent-id'];
            if (!agentId) {
                console.warn('WebSocket connection rejected: No agent ID provided');
                ws.close(1008, 'Agent ID required');
                return;
            }
            console.log(`WebSocket connection established for agent: ${agentId}`);
            // Update agent connection
            const agent = this.connectedAgents.get(agentId);
            if (agent) {
                agent.websocket = ws;
                agent.lastHeartbeat = new Date();
            }
            // Handle incoming messages
            ws.on('message', async (data) => {
                try {
                    const message = this.messageSerializer.deserialize(data.toString());
                    await this.handleWebSocketMessage(agentId, message, ws);
                }
                catch (error) {
                    console.error(`Error processing WebSocket message from ${agentId}:`, error);
                    this.sendWebSocketError(ws, error instanceof Error ? error.message : 'Message processing failed');
                }
            });
            // Handle connection close
            ws.on('close', (code, reason) => {
                console.log(`WebSocket connection closed for agent ${agentId}: ${code} - ${reason}`);
                this.handleAgentDisconnection(agentId);
            });
            // Handle errors
            ws.on('error', (error) => {
                console.error(`WebSocket error for agent ${agentId}:`, error);
                this.handleAgentDisconnection(agentId);
            });
            // Send queued messages
            this.deliverQueuedMessages(agentId);
        });
    }
    setupMessageRouterHandlers() {
        this.messageRouter.on('messageQueued', ({ message, agentId }) => {
            this.deliverMessageToAgent(message, agentId);
        });
        this.messageRouter.on('messageDelivered', ({ message, agentId, receipt }) => {
            this.deliveryReceipts.set(message.id, receipt);
            this.emit('messageDelivered', { message, agentId, receipt });
        });
        this.messageRouter.on('deliveryError', ({ message, agentId, error }) => {
            console.error(`Delivery error for message ${message.id} to agent ${agentId}:`, error);
            this.emit('deliveryError', { message, agentId, error });
        });
    }
    initializeDefaultTopics() {
        const defaultTopics = [
            {
                name: 'fraud-detection',
                description: 'Fraud detection and alerts',
                messageTypes: [
                    {
                        name: 'fraud.alert',
                        description: 'Fraud alert notification',
                        schema: {},
                        priority: 'high'
                    },
                    {
                        name: 'fraud.risk_score',
                        description: 'Risk score update',
                        schema: {},
                        priority: 'normal'
                    }
                ],
                retentionPolicy: {
                    maxMessages: 10000,
                    maxAge: 86400000, // 24 hours
                    compressionEnabled: true
                }
            },
            {
                name: 'recommendations',
                description: 'Product and service recommendations',
                messageTypes: [
                    {
                        name: 'recommendation.request',
                        description: 'Request for recommendations',
                        schema: {},
                        priority: 'normal'
                    },
                    {
                        name: 'recommendation.response',
                        description: 'Recommendation results',
                        schema: {},
                        priority: 'normal'
                    }
                ],
                retentionPolicy: {
                    maxMessages: 5000,
                    maxAge: 3600000, // 1 hour
                    compressionEnabled: false
                }
            },
            {
                name: 'chat-support',
                description: 'Chat support and customer interactions',
                messageTypes: [
                    {
                        name: 'chat.context_update',
                        description: 'Chat context update',
                        schema: {},
                        priority: 'normal'
                    },
                    {
                        name: 'chat.escalation',
                        description: 'Chat escalation request',
                        schema: {},
                        priority: 'high'
                    }
                ],
                retentionPolicy: {
                    maxMessages: 1000,
                    maxAge: 1800000, // 30 minutes
                    compressionEnabled: false
                }
            },
            {
                name: 'system-events',
                description: 'System-wide events and notifications',
                messageTypes: [
                    {
                        name: 'system.alert',
                        description: 'System alert',
                        schema: {},
                        priority: 'high'
                    },
                    {
                        name: 'agent.status_update',
                        description: 'Agent status update',
                        schema: {},
                        priority: 'low'
                    }
                ],
                retentionPolicy: {
                    maxMessages: 1000,
                    maxAge: 3600000, // 1 hour
                    compressionEnabled: true
                }
            }
        ];
        defaultTopics.forEach(topic => {
            this.topics.set(topic.name, topic);
            this.messageHistory.set(topic.name, []);
        });
    }
    async handleWebSocketMessage(agentId, message, ws) {
        // Validate message
        const validationResult = this.messageValidator.validate(message);
        if (!validationResult.isValid) {
            this.sendWebSocketError(ws, `Invalid message: ${validationResult.errors.join(', ')}`);
            return;
        }
        // Set source agent
        message.sourceAgent = agentId;
        // Publish message
        const receipts = await this.publishMessage(message);
        // Send delivery receipt back to sender
        const receipt = receipts[0] || {
            messageId: message.id,
            timestamp: new Date(),
            status: 'delivered',
            targetAgent: 'hub'
        };
        ws.send(JSON.stringify({
            type: 'delivery_receipt',
            messageId: message.id,
            receipt
        }));
    }
    sendWebSocketError(ws, message) {
        ws.send(JSON.stringify({
            type: 'error',
            message,
            timestamp: new Date().toISOString()
        }));
    }
    async registerAgent(registration) {
        // Validate agent ID
        const agentIdValidation = this.messageValidator.validateAgentId(registration.agentId);
        if (!agentIdValidation.isValid) {
            throw new Error(`Invalid agent ID: ${agentIdValidation.errors.join(', ')}`);
        }
        // Check connection limits
        if (this.connectedAgents.size >= this.config.maxConnections) {
            throw new Error('Maximum connections reached');
        }
        // Register with message router
        this.messageRouter.registerAgent(registration);
        // Create connected agent entry
        const connectedAgent = {
            agentId: registration.agentId,
            registration,
            websocket: null, // Will be set when WebSocket connects
            lastHeartbeat: new Date(),
            messageQueue: []
        };
        this.connectedAgents.set(registration.agentId, connectedAgent);
        this.emit('agentRegistered', registration);
        console.log(`Agent registered: ${registration.agentId}`);
    }
    unregisterAgent(agentId) {
        const agent = this.connectedAgents.get(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        // Close WebSocket connection
        if (agent.websocket && agent.websocket.readyState === ws_1.default.OPEN) {
            agent.websocket.close(1000, 'Agent unregistered');
        }
        // Unregister from message router
        this.messageRouter.unregisterAgent(agentId);
        // Remove from connected agents
        this.connectedAgents.delete(agentId);
        this.emit('agentUnregistered', { agentId, registration: agent.registration });
        console.log(`Agent unregistered: ${agentId}`);
    }
    async addSubscription(agentId, subscription) {
        // Validate topic name
        const topicValidation = this.messageValidator.validateTopicName(subscription.topic);
        if (!topicValidation.isValid) {
            throw new Error(`Invalid topic name: ${topicValidation.errors.join(', ')}`);
        }
        // Add to message router
        this.messageRouter.addSubscription(agentId, subscription);
        this.emit('subscriptionAdded', { agentId, subscription });
    }
    async removeSubscription(agentId, topic) {
        this.messageRouter.removeSubscription(agentId, topic);
        this.emit('subscriptionRemoved', { agentId, topic });
    }
    async publishMessage(message) {
        // Store message in history
        this.storeMessageInHistory(message);
        // Route message
        const receipts = await this.messageRouter.routeMessage(message);
        this.emit('messagePublished', { message, receipts });
        return receipts;
    }
    storeMessageInHistory(message) {
        if (!this.config.enablePersistence) {
            return;
        }
        const topicMessages = this.messageHistory.get(message.topic) || [];
        topicMessages.push(message);
        // Apply retention policy
        const topic = this.topics.get(message.topic);
        if (topic) {
            const { maxMessages, maxAge } = topic.retentionPolicy;
            const cutoffTime = new Date(Date.now() - maxAge);
            // Remove old messages
            const filteredMessages = topicMessages
                .filter(msg => msg.timestamp > cutoffTime)
                .slice(-maxMessages);
            this.messageHistory.set(message.topic, filteredMessages);
        }
    }
    deliverQueuedMessages(agentId) {
        const agent = this.connectedAgents.get(agentId);
        if (!agent || !agent.websocket || agent.websocket.readyState !== ws_1.default.OPEN) {
            return;
        }
        const queuedMessages = [...agent.messageQueue];
        agent.messageQueue = [];
        queuedMessages.forEach(message => {
            this.deliverMessageToAgent(message, agentId);
        });
    }
    deliverMessageToAgent(message, agentId) {
        const agent = this.connectedAgents.get(agentId);
        if (!agent) {
            return;
        }
        if (agent.websocket && agent.websocket.readyState === ws_1.default.OPEN) {
            // Deliver via WebSocket
            const serializedMessage = this.messageSerializer.serialize(message);
            agent.websocket.send(serializedMessage);
        }
        else {
            // Queue for later delivery
            agent.messageQueue.push(message);
        }
    }
    handleAgentDisconnection(agentId) {
        const agent = this.connectedAgents.get(agentId);
        if (agent) {
            agent.websocket = null;
            this.emit('agentDisconnected', { agentId });
        }
    }
    createTopic(topicDefinition) {
        // Validate topic name
        const topicValidation = this.messageValidator.validateTopicName(topicDefinition.name);
        if (!topicValidation.isValid) {
            throw new Error(`Invalid topic name: ${topicValidation.errors.join(', ')}`);
        }
        if (this.topics.has(topicDefinition.name)) {
            throw new Error(`Topic already exists: ${topicDefinition.name}`);
        }
        this.topics.set(topicDefinition.name, topicDefinition);
        this.messageHistory.set(topicDefinition.name, []);
        this.emit('topicCreated', topicDefinition);
        console.log(`Topic created: ${topicDefinition.name}`);
    }
    startHeartbeatMonitoring() {
        this.heartbeatTimer = setInterval(() => {
            const now = new Date();
            const timeout = this.config.heartbeatInterval * 2; // Allow 2x heartbeat interval
            for (const [agentId, agent] of this.connectedAgents.entries()) {
                const timeSinceHeartbeat = now.getTime() - agent.lastHeartbeat.getTime();
                if (timeSinceHeartbeat > timeout) {
                    console.warn(`Agent ${agentId} heartbeat timeout, disconnecting...`);
                    this.handleAgentDisconnection(agentId);
                }
            }
        }, this.config.heartbeatInterval);
    }
    startCleanupTasks() {
        this.cleanupTimer = setInterval(() => {
            // Clean up old delivery receipts
            const cutoffTime = new Date(Date.now() - 3600000); // 1 hour
            for (const [messageId, receipt] of this.deliveryReceipts.entries()) {
                if (receipt.timestamp < cutoffTime) {
                    this.deliveryReceipts.delete(messageId);
                }
            }
            // Clean up message history based on retention policies
            for (const [topicName, topic] of this.topics.entries()) {
                const messages = this.messageHistory.get(topicName) || [];
                const cutoffTime = new Date(Date.now() - topic.retentionPolicy.maxAge);
                const filteredMessages = messages
                    .filter(msg => msg.timestamp > cutoffTime)
                    .slice(-topic.retentionPolicy.maxMessages);
                this.messageHistory.set(topicName, filteredMessages);
            }
        }, 300000); // Run every 5 minutes
    }
    getHubStatistics() {
        const routingStats = this.messageRouter.getRoutingStats();
        return {
            connectedAgents: this.connectedAgents.size,
            topics: this.topics.size,
            totalMessages: Array.from(this.messageHistory.values())
                .reduce((total, messages) => total + messages.length, 0),
            deliveryReceipts: this.deliveryReceipts.size,
            uptime: process.uptime(),
            ...routingStats
        };
    }
    // Public methods
    async start() {
        if (this.isRunning) {
            throw new Error('A2A Hub is already running');
        }
        return new Promise((resolve, reject) => {
            this.server.listen(this.config.port, () => {
                this.isRunning = true;
                console.log(`A2A Hub started on port ${this.config.port}`);
                // Start background tasks
                this.startHeartbeatMonitoring();
                this.startCleanupTasks();
                this.emit('started');
                resolve();
            });
            this.server.on('error', (error) => {
                reject(error);
            });
        });
    }
    async stop() {
        if (!this.isRunning) {
            return;
        }
        // Stop background tasks
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        // Close all WebSocket connections
        this.wsServer.clients.forEach(ws => {
            ws.close(1001, 'Server shutdown');
        });
        // Close server
        return new Promise((resolve) => {
            this.server.close(() => {
                this.isRunning = false;
                console.log('A2A Hub stopped');
                this.emit('stopped');
                resolve();
            });
        });
    }
    // Getters
    getConnectedAgents() {
        return Array.from(this.connectedAgents.keys());
    }
    getTopics() {
        return Array.from(this.topics.values());
    }
    getConfig() {
        return { ...this.config };
    }
    isHubRunning() {
        return this.isRunning;
    }
}
exports.A2AHub = A2AHub;
//# sourceMappingURL=a2a-hub.js.map