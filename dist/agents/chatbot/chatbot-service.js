"use strict";
/**
 * Chatbot Service with REST API and WebSocket interfaces
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotService = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const ws_1 = require("ws");
const events_1 = require("events");
const chatbot_agent_1 = require("./chatbot-agent");
class ChatbotService extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.wsClients = new Map();
        this.isRunning = false;
        this.startTime = new Date();
        this.rateLimitMap = new Map();
        this.config = config;
        this.agent = new chatbot_agent_1.ChatbotAgent(config);
        this.app = (0, express_1.default)();
        this.server = (0, http_1.createServer)(this.app);
        this.metrics = {
            activeConnections: 0,
            totalRequests: 0,
            totalMessages: 0,
            averageResponseTime: 0,
            errorRate: 0,
            uptime: 0
        };
        this.setupExpress();
        this.setupWebSocket();
        this.setupEventListeners();
    }
    /**
     * Initialize and start the chatbot service
     */
    async initialize() {
        try {
            // Initialize the agent
            await this.agent.initialize();
            // Set up A2A subscriptions for fraud alerts
            await this.setupA2ASubscriptions();
            // Start the server
            await this.startServer();
            // Start background tasks
            this.startBackgroundTasks();
            this.isRunning = true;
            this.emit('serviceStarted');
            console.log(`Chatbot Service started on ${this.config.server.host}:${this.config.server.port}`);
        }
        catch (error) {
            console.error('Failed to initialize Chatbot Service:', error);
            throw error;
        }
    }
    /**
     * Shutdown the service gracefully
     */
    async shutdown() {
        try {
            this.isRunning = false;
            // Close WebSocket connections
            for (const client of this.wsClients.values()) {
                client.socket.close(1000, 'Service shutting down');
            }
            this.wsClients.clear();
            // Close WebSocket server
            if (this.wss) {
                this.wss.close();
            }
            // Close HTTP server
            await new Promise((resolve) => {
                this.server.close(() => resolve());
            });
            // Shutdown agent
            await this.agent.shutdown();
            this.emit('serviceShutdown');
            console.log('Chatbot Service shutdown complete');
        }
        catch (error) {
            console.error('Error during service shutdown:', error);
            throw error;
        }
    }
    /**
     * Get service health status
     */
    getHealthStatus() {
        const agentHealth = this.agent.isAgentHealthy();
        const activeConnections = this.wsClients.size;
        let status = 'healthy';
        if (!agentHealth || this.metrics.errorRate > 0.1) {
            status = 'unhealthy';
        }
        else if (activeConnections > 1000 || this.metrics.errorRate > 0.05) {
            status = 'degraded';
        }
        this.metrics.uptime = Date.now() - this.startTime.getTime();
        this.metrics.activeConnections = activeConnections;
        return {
            status,
            metrics: { ...this.metrics },
            agentHealth,
            activeConnections
        };
    }
    setupExpress() {
        // Middleware
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true }));
        // CORS
        if (this.config.server.cors.enabled) {
            this.app.use((req, res, next) => {
                const origin = req.headers.origin;
                if (this.config.server.cors.origins.includes('*') ||
                    this.config.server.cors.origins.includes(origin)) {
                    res.header('Access-Control-Allow-Origin', origin);
                }
                res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
                if (req.method === 'OPTIONS') {
                    res.sendStatus(200);
                }
                else {
                    next();
                }
            });
        }
        // Authentication middleware
        if (this.config.api.authentication.enabled) {
            this.app.use('/api', this.authenticateRequest.bind(this));
        }
        // Rate limiting middleware
        this.app.use('/api', this.rateLimitMiddleware.bind(this));
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
        this.setupRoutes();
    }
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const health = this.getHealthStatus();
            const statusCode = health.status === 'healthy' ? 200 :
                health.status === 'degraded' ? 200 : 503;
            res.status(statusCode).json(health);
        });
        // Chat endpoints
        this.app.post('/api/chat', this.handleChatMessage.bind(this));
        this.app.get('/api/chat/session/:sessionId', this.getSession.bind(this));
        this.app.delete('/api/chat/session/:sessionId', this.endSession.bind(this));
        // Session management
        this.app.post('/api/chat/session', this.createSession.bind(this));
        this.app.get('/api/chat/sessions', this.listSessions.bind(this));
        // Statistics and monitoring
        this.app.get('/api/stats', this.getStatistics.bind(this));
        this.app.get('/api/metrics', this.getMetrics.bind(this));
        // Error handler
        this.app.use((error, req, res, next) => {
            console.error('API Error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        });
    }
    setupWebSocket() {
        if (!this.config.websocket.enabled)
            return;
        this.wss = new ws_1.WebSocketServer({
            server: this.server,
            path: this.config.websocket.path
        });
        this.wss.on('connection', (ws, req) => {
            this.handleWebSocketConnection(ws, req);
        });
    }
    handleWebSocketConnection(ws, req) {
        const clientId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const userId = url.searchParams.get('userId') || 'anonymous';
        const sessionId = url.searchParams.get('sessionId') || `session_${clientId}`;
        const client = {
            id: clientId,
            userId,
            sessionId,
            socket: ws,
            lastActivity: new Date(),
            metadata: {
                userAgent: req.headers['user-agent'],
                ip: req.connection.remoteAddress
            }
        };
        this.wsClients.set(clientId, client);
        this.metrics.activeConnections = this.wsClients.size;
        console.log(`WebSocket client connected: ${clientId} (User: ${userId}, Session: ${sessionId})`);
        // Send welcome message
        this.sendWebSocketMessage(client, {
            type: 'connection',
            data: {
                clientId,
                sessionId,
                message: 'Connected to chatbot service'
            }
        });
        // Handle messages
        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                await this.handleWebSocketMessage(client, message);
            }
            catch (error) {
                console.error('WebSocket message error:', error);
                this.sendWebSocketMessage(client, {
                    type: 'error',
                    data: { message: 'Invalid message format' }
                });
            }
        });
        // Handle disconnection
        ws.on('close', () => {
            this.wsClients.delete(clientId);
            this.metrics.activeConnections = this.wsClients.size;
            console.log(`WebSocket client disconnected: ${clientId}`);
        });
        // Handle errors
        ws.on('error', (error) => {
            console.error(`WebSocket error for client ${clientId}:`, error);
            this.wsClients.delete(clientId);
            this.metrics.activeConnections = this.wsClients.size;
        });
        // Set up heartbeat
        this.setupHeartbeat(client);
    }
    async handleWebSocketMessage(client, message) {
        client.lastActivity = new Date();
        switch (message.type) {
            case 'chat':
                await this.processWebSocketChat(client, message.data);
                break;
            case 'ping':
                this.sendWebSocketMessage(client, { type: 'pong', data: { timestamp: Date.now() } });
                break;
            case 'typing':
                // Broadcast typing indicator to other clients in same session (if needed)
                break;
            default:
                this.sendWebSocketMessage(client, {
                    type: 'error',
                    data: { message: `Unknown message type: ${message.type}` }
                });
        }
    }
    async processWebSocketChat(client, data) {
        try {
            const chatRequest = {
                sessionId: client.sessionId,
                userId: client.userId,
                message: data.message,
                channel: 'web',
                metadata: {
                    clientId: client.id,
                    timestamp: new Date().toISOString()
                }
            };
            const response = await this.agent.processChat(chatRequest);
            this.metrics.totalMessages++;
            this.sendWebSocketMessage(client, {
                type: 'chat_response',
                data: response
            });
            // Send typing indicator before response (simulate human-like behavior)
            if (data.simulateTyping) {
                this.sendWebSocketMessage(client, { type: 'typing', data: { isTyping: true } });
                setTimeout(() => {
                    this.sendWebSocketMessage(client, { type: 'typing', data: { isTyping: false } });
                }, 1000);
            }
        }
        catch (error) {
            console.error('WebSocket chat processing error:', error);
            this.sendWebSocketMessage(client, {
                type: 'error',
                data: { message: 'Failed to process chat message' }
            });
        }
    }
    sendWebSocketMessage(client, message) {
        if (client.socket.readyState === ws_1.WebSocket.OPEN) {
            client.socket.send(JSON.stringify(message));
        }
    }
    setupHeartbeat(client) {
        const interval = setInterval(() => {
            if (client.socket.readyState === ws_1.WebSocket.OPEN) {
                this.sendWebSocketMessage(client, { type: 'ping', data: { timestamp: Date.now() } });
            }
            else {
                clearInterval(interval);
            }
        }, this.config.websocket.heartbeatInterval);
    }
    // REST API Handlers
    async handleChatMessage(req, res) {
        const startTime = Date.now();
        try {
            const { sessionId, userId, message, channel = 'api' } = req.body;
            if (!sessionId || !userId || !message) {
                res.status(400).json({
                    error: 'Missing required fields',
                    required: ['sessionId', 'userId', 'message']
                });
                return;
            }
            const chatRequest = {
                sessionId,
                userId,
                message,
                channel,
                metadata: {
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    timestamp: new Date().toISOString()
                }
            };
            const response = await this.agent.processChat(chatRequest);
            const processingTime = Date.now() - startTime;
            this.updateMetrics(processingTime, true);
            this.metrics.totalRequests++;
            res.json({
                success: true,
                data: response,
                processingTime
            });
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateMetrics(processingTime, false);
            console.error('Chat API error:', error);
            res.status(500).json({
                error: 'Chat processing failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async getSession(req, res) {
        try {
            const { sessionId } = req.params;
            const session = this.agent.getSession(sessionId);
            if (!session) {
                res.status(404).json({
                    error: 'Session not found',
                    sessionId
                });
                return;
            }
            res.json({
                success: true,
                data: session
            });
        }
        catch (error) {
            console.error('Get session error:', error);
            res.status(500).json({
                error: 'Failed to retrieve session'
            });
        }
    }
    async endSession(req, res) {
        try {
            const { sessionId } = req.params;
            this.agent.endSession(sessionId);
            // Close any WebSocket connections for this session
            for (const [clientId, client] of this.wsClients.entries()) {
                if (client.sessionId === sessionId) {
                    client.socket.close(1000, 'Session ended');
                    this.wsClients.delete(clientId);
                }
            }
            res.json({
                success: true,
                message: 'Session ended successfully'
            });
        }
        catch (error) {
            console.error('End session error:', error);
            res.status(500).json({
                error: 'Failed to end session'
            });
        }
    }
    async createSession(req, res) {
        try {
            const { userId } = req.body;
            if (!userId) {
                res.status(400).json({
                    error: 'Missing required field: userId'
                });
                return;
            }
            const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            const session = await this.agent.createSession(sessionId, userId);
            res.json({
                success: true,
                data: session
            });
        }
        catch (error) {
            console.error('Create session error:', error);
            res.status(500).json({
                error: 'Failed to create session'
            });
        }
    }
    async listSessions(req, res) {
        try {
            const { userId } = req.query;
            const stats = this.agent.getSessionStatistics();
            res.json({
                success: true,
                data: {
                    activeSessions: stats.activeSessions,
                    totalSessions: stats.totalSessions,
                    averageSessionDuration: stats.averageSessionDuration,
                    topIntents: stats.topIntents
                }
            });
        }
        catch (error) {
            console.error('List sessions error:', error);
            res.status(500).json({
                error: 'Failed to list sessions'
            });
        }
    }
    async getStatistics(req, res) {
        try {
            const agentStats = this.agent.getSessionStatistics();
            const serviceHealth = this.getHealthStatus();
            res.json({
                success: true,
                data: {
                    agent: agentStats,
                    service: serviceHealth,
                    websocket: {
                        activeConnections: this.wsClients.size,
                        clients: Array.from(this.wsClients.values()).map(client => ({
                            id: client.id,
                            userId: client.userId,
                            sessionId: client.sessionId,
                            lastActivity: client.lastActivity
                        }))
                    }
                }
            });
        }
        catch (error) {
            console.error('Get statistics error:', error);
            res.status(500).json({
                error: 'Failed to retrieve statistics'
            });
        }
    }
    async getMetrics(req, res) {
        try {
            res.json({
                success: true,
                data: this.metrics
            });
        }
        catch (error) {
            console.error('Get metrics error:', error);
            res.status(500).json({
                error: 'Failed to retrieve metrics'
            });
        }
    }
    // Middleware
    authenticateRequest(req, res, next) {
        const apiKey = req.headers[this.config.api.authentication.apiKeyHeader];
        if (!apiKey) {
            res.status(401).json({
                error: 'Missing API key',
                header: this.config.api.authentication.apiKeyHeader
            });
            return;
        }
        // In production, validate API key against database/service
        // For now, just check if it exists
        if (apiKey.length < 10) {
            res.status(401).json({
                error: 'Invalid API key'
            });
            return;
        }
        next();
    }
    rateLimitMiddleware(req, res, next) {
        const clientId = req.ip || 'unknown';
        const now = Date.now();
        const windowMs = this.config.api.rateLimit.windowMs;
        const maxRequests = this.config.api.rateLimit.maxRequests;
        let clientData = this.rateLimitMap.get(clientId);
        if (!clientData || now > clientData.resetTime) {
            clientData = {
                count: 0,
                resetTime: now + windowMs
            };
        }
        clientData.count++;
        this.rateLimitMap.set(clientId, clientData);
        if (clientData.count > maxRequests) {
            res.status(429).json({
                error: 'Rate limit exceeded',
                retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
            });
            return;
        }
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - clientData.count));
        res.setHeader('X-RateLimit-Reset', Math.ceil(clientData.resetTime / 1000));
        next();
    }
    // Background tasks and event handling
    async setupA2ASubscriptions() {
        // Subscribe to fraud alerts from fraud detection agent
        if (this.agent['a2aClient']) {
            this.agent['a2aClient'].on('messageReceived', this.handleA2AMessage.bind(this));
        }
    }
    handleA2AMessage(message) {
        try {
            switch (message.messageType) {
                case 'high-risk-transaction':
                    this.handleFraudAlert(message.payload);
                    break;
                case 'transaction-assessed':
                    this.handleRiskAssessment(message.payload);
                    break;
                default:
                    console.log('Unknown A2A message type:', message.messageType);
            }
        }
        catch (error) {
            console.error('Error handling A2A message:', error);
        }
    }
    handleFraudAlert(alertData) {
        // Notify relevant WebSocket clients about fraud alert
        const affectedClients = Array.from(this.wsClients.values())
            .filter(client => client.userId === alertData.userId);
        for (const client of affectedClients) {
            this.sendWebSocketMessage(client, {
                type: 'fraud_alert',
                data: {
                    message: 'We detected suspicious activity on your account. Please contact us immediately.',
                    alertLevel: 'high',
                    transactionId: alertData.transactionId,
                    timestamp: new Date().toISOString()
                }
            });
        }
        this.emit('fraudAlertReceived', alertData);
    }
    handleRiskAssessment(assessmentData) {
        // Store risk assessment for context in future conversations
        console.log('Risk assessment received:', assessmentData.transactionId);
        this.emit('riskAssessmentReceived', assessmentData);
    }
    startBackgroundTasks() {
        // Clean up expired sessions every 5 minutes
        setInterval(() => {
            this.agent.cleanupExpiredSessions();
        }, 300000);
        // Clean up rate limit data every hour
        setInterval(() => {
            const now = Date.now();
            for (const [clientId, data] of this.rateLimitMap.entries()) {
                if (now > data.resetTime) {
                    this.rateLimitMap.delete(clientId);
                }
            }
        }, 3600000);
        // Update metrics every minute
        setInterval(() => {
            this.updateServiceMetrics();
        }, 60000);
    }
    async startServer() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.config.server.port, this.config.server.host, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    updateMetrics(processingTime, success) {
        const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + processingTime;
        this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;
        if (!success) {
            const errorCount = this.metrics.errorRate * (this.metrics.totalRequests - 1) + 1;
            this.metrics.errorRate = errorCount / this.metrics.totalRequests;
        }
        else {
            this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.totalRequests - 1)) / this.metrics.totalRequests;
        }
    }
    updateServiceMetrics() {
        this.metrics.uptime = Date.now() - this.startTime.getTime();
        this.metrics.activeConnections = this.wsClients.size;
    }
    setupEventListeners() {
        this.agent.on('chatProcessed', ({ request, response, session }) => {
            this.emit('chatProcessed', { request, response, session });
        });
        this.agent.on('sessionCreated', ({ session }) => {
            this.emit('sessionCreated', { session });
        });
        this.agent.on('sessionEnded', ({ session }) => {
            this.emit('sessionEnded', { session });
        });
        this.agent.on('fraudReported', ({ session }) => {
            this.emit('fraudReported', { session });
        });
    }
}
exports.ChatbotService = ChatbotService;
//# sourceMappingURL=chatbot-service.js.map