"use strict";
/**
 * Recommendation Service Integration
 * Handles MCP integration, A2A messaging, caching, and API endpoints
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationService = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const events_1 = require("events");
const recommendation_agent_1 = require("./recommendation-agent");
class RecommendationService extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.cache = new Map();
        this.isRunning = false;
        this.startTime = new Date();
        this.rateLimitMap = new Map();
        this.analyticsQueue = [];
        this.config = config;
        this.agent = new recommendation_agent_1.RecommendationAgent(config);
        this.app = (0, express_1.default)();
        this.server = (0, http_1.createServer)(this.app);
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            cacheHitRate: 0,
            activeUsers: 0,
            recommendationsServed: 0,
            uptime: 0
        };
        this.setupExpress();
        this.setupEventListeners();
    }
    /**
     * Initialize and start the recommendation service
     */
    async initialize() {
        try {
            // Initialize the agent
            await this.agent.initialize();
            // Set up A2A subscriptions for cross-agent insights
            await this.setupA2ASubscriptions();
            // Start the server
            await this.startServer();
            // Start background tasks
            this.startBackgroundTasks();
            this.isRunning = true;
            this.emit('serviceStarted');
            console.log(`Recommendation Service started on ${this.config.server.host}:${this.config.server.port}`);
        }
        catch (error) {
            console.error('Failed to initialize Recommendation Service:', error);
            throw error;
        }
    }
    /**
     * Shutdown the service gracefully
     */
    async shutdown() {
        try {
            this.isRunning = false;
            // Stop background tasks
            if (this.analyticsInterval) {
                clearInterval(this.analyticsInterval);
            }
            if (this.cacheCleanupInterval) {
                clearInterval(this.cacheCleanupInterval);
            }
            // Flush remaining analytics events
            if (this.analyticsQueue.length > 0) {
                await this.flushAnalytics();
            }
            // Close HTTP server
            await new Promise((resolve) => {
                this.server.close(() => resolve());
            });
            // Shutdown agent
            await this.agent.shutdown();
            this.emit('serviceShutdown');
            console.log('Recommendation Service shutdown complete');
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
        const cacheSize = this.cache.size;
        let status = 'healthy';
        if (!agentHealth || this.metrics.failedRequests / Math.max(this.metrics.totalRequests, 1) > 0.1) {
            status = 'unhealthy';
        }
        else if (cacheSize > this.config.caching.maxSize * 0.9 || this.metrics.averageResponseTime > 5000) {
            status = 'degraded';
        }
        this.metrics.uptime = Date.now() - this.startTime.getTime();
        return {
            status,
            metrics: { ...this.metrics },
            agentHealth,
            cacheStats: {
                size: cacheSize,
                hitRate: this.metrics.cacheHitRate,
                maxSize: this.config.caching.maxSize
            }
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
        // Request logging and analytics
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            // Track analytics if enabled
            if (this.config.analytics.enabled) {
                this.trackAnalyticsEvent({
                    eventType: 'api_request',
                    userId: req.headers['x-user-id'] || 'anonymous',
                    data: {
                        method: req.method,
                        path: req.path,
                        userAgent: req.headers['user-agent'],
                        ip: req.ip
                    }
                });
            }
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
        // Recommendation endpoints
        this.app.post('/api/recommendations', this.getRecommendations.bind(this));
        this.app.get('/api/recommendations/:userId', this.getUserRecommendations.bind(this));
        this.app.post('/api/recommendations/similar-users', this.getSimilarUsers.bind(this));
        // Product and user data endpoints
        this.app.get('/api/products/:productId', this.getProduct.bind(this));
        this.app.get('/api/users/:userId/profile', this.getUserProfile.bind(this));
        this.app.post('/api/users/:userId/interactions', this.trackUserInteraction.bind(this));
        // Analytics and feedback endpoints
        this.app.post('/api/feedback', this.recordFeedback.bind(this));
        this.app.post('/api/events', this.trackEvent.bind(this));
        // Cache management endpoints
        this.app.delete('/api/cache', this.clearCache.bind(this));
        this.app.get('/api/cache/stats', this.getCacheStats.bind(this));
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
    // API Route Handlers
    async getRecommendations(req, res) {
        const startTime = Date.now();
        try {
            const { userId, context, count = 10, type = 'personalized', filters, excludeProducts } = req.body;
            if (!userId) {
                res.status(400).json({
                    error: 'Missing required field: userId'
                });
                return;
            }
            // Check cache first
            const cacheKey = this.generateCacheKey('recommendations', { userId, context, count, type, filters });
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                this.updateMetrics(Date.now() - startTime, true, true);
                res.json({
                    success: true,
                    data: cached,
                    cached: true,
                    processingTime: Date.now() - startTime
                });
                return;
            }
            const request = {
                userId,
                context: context || {},
                count,
                type,
                filters,
                excludeProducts
            };
            const response = await this.agent.generateRecommendations(request);
            // Cache the response
            if (this.config.caching.enabled) {
                this.setCache(cacheKey, response, this.config.caching.ttl);
            }
            // Track analytics
            if (this.config.analytics.enabled) {
                this.trackAnalyticsEvent({
                    eventType: 'recommendations_generated',
                    userId,
                    data: {
                        count: response.recommendations.length,
                        algorithms: response.algorithms,
                        type,
                        processingTime: response.processingTime
                    }
                });
            }
            const processingTime = Date.now() - startTime;
            this.updateMetrics(processingTime, true, false);
            this.metrics.recommendationsServed += response.recommendations.length;
            res.json({
                success: true,
                data: response,
                cached: false,
                processingTime
            });
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateMetrics(processingTime, false, false);
            console.error('Recommendations API error:', error);
            res.status(500).json({
                error: 'Failed to generate recommendations',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async getUserRecommendations(req, res) {
        try {
            const { userId } = req.params;
            const { count = 10, type = 'personalized' } = req.query;
            const request = {
                userId,
                context: {
                    currentPage: 'profile',
                    timeOfDay: new Date().getHours() < 12 ? 'morning' :
                        new Date().getHours() < 18 ? 'afternoon' : 'evening'
                },
                count: parseInt(count),
                type: type
            };
            const response = await this.agent.generateRecommendations(request);
            res.json({
                success: true,
                data: response
            });
        }
        catch (error) {
            console.error('User recommendations error:', error);
            res.status(500).json({
                error: 'Failed to get user recommendations'
            });
        }
    }
    async getSimilarUsers(req, res) {
        try {
            const { userId } = req.body;
            if (!userId) {
                res.status(400).json({
                    error: 'Missing required field: userId'
                });
                return;
            }
            // Check cache
            const cacheKey = this.generateCacheKey('similar_users', { userId });
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                res.json({
                    success: true,
                    data: cached,
                    cached: true
                });
                return;
            }
            const similarUsers = await this.agent['findSimilarUsers'](userId);
            // Cache the result
            if (this.config.caching.enabled) {
                this.setCache(cacheKey, similarUsers, this.config.caching.ttl);
            }
            res.json({
                success: true,
                data: similarUsers,
                cached: false
            });
        }
        catch (error) {
            console.error('Similar users error:', error);
            res.status(500).json({
                error: 'Failed to find similar users'
            });
        }
    }
    async getProduct(req, res) {
        try {
            const { productId } = req.params;
            // Check cache first
            const cacheKey = this.generateCacheKey('product', { productId });
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                res.json({
                    success: true,
                    data: cached,
                    cached: true
                });
                return;
            }
            // Get product via MCP
            const productData = await this.agent['queryMCP']('product-service', 'getProduct', { productId });
            if (!productData) {
                res.status(404).json({
                    error: 'Product not found'
                });
                return;
            }
            // Cache the product
            if (this.config.caching.enabled) {
                this.setCache(cacheKey, productData, this.config.caching.ttl);
            }
            res.json({
                success: true,
                data: productData,
                cached: false
            });
        }
        catch (error) {
            console.error('Get product error:', error);
            res.status(500).json({
                error: 'Failed to get product'
            });
        }
    }
    async getUserProfile(req, res) {
        try {
            const { userId } = req.params;
            // Check cache first
            const cacheKey = this.generateCacheKey('user_profile', { userId });
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                res.json({
                    success: true,
                    data: cached,
                    cached: true
                });
                return;
            }
            // Get user profile via MCP
            const userProfile = await this.agent['getUserProfile'](userId);
            // Cache the profile
            if (this.config.caching.enabled) {
                this.setCache(cacheKey, userProfile, this.config.caching.ttl / 2); // Shorter TTL for user data
            }
            res.json({
                success: true,
                data: userProfile,
                cached: false
            });
        }
        catch (error) {
            console.error('Get user profile error:', error);
            res.status(500).json({
                error: 'Failed to get user profile'
            });
        }
    }
    async trackUserInteraction(req, res) {
        try {
            const { userId } = req.params;
            const { productId, action, metadata } = req.body;
            // Invalidate relevant caches
            this.invalidateUserCaches(userId);
            // Track the interaction
            if (this.config.analytics.enabled) {
                this.trackAnalyticsEvent({
                    eventType: 'user_interaction',
                    userId,
                    data: {
                        productId,
                        action,
                        metadata,
                        timestamp: new Date().toISOString()
                    }
                });
            }
            // Send A2A message to other agents about user behavior
            await this.agent['sendA2AMessage']('user-behavior', 'interaction-tracked', {
                userId,
                productId,
                action,
                timestamp: new Date()
            });
            res.json({
                success: true,
                message: 'Interaction tracked successfully'
            });
        }
        catch (error) {
            console.error('Track interaction error:', error);
            res.status(500).json({
                error: 'Failed to track interaction'
            });
        }
    }
    async recordFeedback(req, res) {
        try {
            const { userId, recommendationId, rating, feedback } = req.body;
            // Track feedback analytics
            if (this.config.analytics.enabled) {
                this.trackAnalyticsEvent({
                    eventType: 'recommendation_feedback',
                    userId,
                    data: {
                        recommendationId,
                        rating,
                        feedback,
                        timestamp: new Date().toISOString()
                    }
                });
            }
            // Send feedback to analytics service via MCP
            await this.agent['queryMCP']('analytics-service', 'recordFeedback', {
                userId,
                recommendationId,
                rating,
                feedback,
                timestamp: new Date()
            });
            res.json({
                success: true,
                message: 'Feedback recorded successfully'
            });
        }
        catch (error) {
            console.error('Record feedback error:', error);
            res.status(500).json({
                error: 'Failed to record feedback'
            });
        }
    }
    async trackEvent(req, res) {
        try {
            const { userId, eventType, data } = req.body;
            if (this.config.analytics.enabled) {
                this.trackAnalyticsEvent({
                    eventType,
                    userId,
                    data
                });
            }
            res.json({
                success: true,
                message: 'Event tracked successfully'
            });
        }
        catch (error) {
            console.error('Track event error:', error);
            res.status(500).json({
                error: 'Failed to track event'
            });
        }
    }
    async clearCache(req, res) {
        try {
            const { pattern } = req.query;
            if (pattern) {
                // Clear cache entries matching pattern
                const regex = new RegExp(pattern);
                for (const [key] of this.cache.entries()) {
                    if (regex.test(key)) {
                        this.cache.delete(key);
                    }
                }
            }
            else {
                // Clear all cache
                this.cache.clear();
            }
            res.json({
                success: true,
                message: 'Cache cleared successfully'
            });
        }
        catch (error) {
            console.error('Clear cache error:', error);
            res.status(500).json({
                error: 'Failed to clear cache'
            });
        }
    }
    async getCacheStats(req, res) {
        try {
            const stats = {
                size: this.cache.size,
                maxSize: this.config.caching.maxSize,
                hitRate: this.metrics.cacheHitRate,
                entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
                    key,
                    timestamp: entry.timestamp,
                    accessCount: entry.accessCount,
                    lastAccessed: entry.lastAccessed
                }))
            };
            res.json({
                success: true,
                data: stats
            });
        }
        catch (error) {
            console.error('Get cache stats error:', error);
            res.status(500).json({
                error: 'Failed to get cache stats'
            });
        }
    }
    async getStatistics(req, res) {
        try {
            const agentStats = this.agent.getSessionStatistics?.() || {};
            const serviceHealth = this.getHealthStatus();
            res.json({
                success: true,
                data: {
                    agent: agentStats,
                    service: serviceHealth,
                    analytics: {
                        queueSize: this.analyticsQueue.length,
                        eventsProcessed: this.metrics.totalRequests
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
    // Cache Management
    generateCacheKey(type, params) {
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((result, key) => {
            result[key] = params[key];
            return result;
        }, {});
        return `${type}:${JSON.stringify(sortedParams)}`;
    }
    getFromCache(key) {
        if (!this.config.caching.enabled)
            return null;
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        // Check TTL
        if (Date.now() - entry.timestamp.getTime() > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        // Update access statistics
        entry.accessCount++;
        entry.lastAccessed = new Date();
        return entry.data;
    }
    setCache(key, data, ttl) {
        if (!this.config.caching.enabled)
            return;
        // Check cache size limit
        if (this.cache.size >= this.config.caching.maxSize) {
            this.evictCacheEntries();
        }
        const entry = {
            data,
            timestamp: new Date(),
            ttl,
            accessCount: 1,
            lastAccessed: new Date()
        };
        this.cache.set(key, entry);
    }
    evictCacheEntries() {
        const entriesToEvict = Math.floor(this.config.caching.maxSize * 0.1); // Evict 10%
        if (this.config.caching.strategy === 'lru') {
            // Evict least recently used
            const entries = Array.from(this.cache.entries())
                .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
            for (let i = 0; i < entriesToEvict && i < entries.length; i++) {
                this.cache.delete(entries[i][0]);
            }
        }
        else if (this.config.caching.strategy === 'fifo') {
            // Evict first in, first out
            const entries = Array.from(this.cache.entries())
                .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
            for (let i = 0; i < entriesToEvict && i < entries.length; i++) {
                this.cache.delete(entries[i][0]);
            }
        }
        else {
            // TTL-based eviction
            const now = Date.now();
            for (const [key, entry] of this.cache.entries()) {
                if (now - entry.timestamp.getTime() > entry.ttl) {
                    this.cache.delete(key);
                }
            }
        }
    }
    invalidateUserCaches(userId) {
        const userPattern = new RegExp(`"userId":"${userId}"`);
        for (const [key] of this.cache.entries()) {
            if (userPattern.test(key)) {
                this.cache.delete(key);
            }
        }
    }
    // Analytics Management
    trackAnalyticsEvent(event) {
        if (!this.config.analytics.enabled)
            return;
        const fullEvent = {
            eventId: `event_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            userId: event.userId || 'anonymous',
            eventType: event.eventType || 'unknown',
            timestamp: new Date(),
            data: event.data || {},
            sessionId: event.sessionId
        };
        this.analyticsQueue.push(fullEvent);
        // Flush if batch size reached
        if (this.analyticsQueue.length >= this.config.analytics.batchSize) {
            this.flushAnalytics();
        }
    }
    async flushAnalytics() {
        if (this.analyticsQueue.length === 0)
            return;
        try {
            const events = this.analyticsQueue.splice(0);
            // Send to analytics service via MCP
            await this.agent['queryMCP']('analytics-service', 'batchTrackEvents', { events });
            console.log(`Flushed ${events.length} analytics events`);
        }
        catch (error) {
            console.error('Failed to flush analytics:', error);
            // Re-queue events on failure (with limit to prevent infinite growth)
            if (this.analyticsQueue.length < 1000) {
                this.analyticsQueue.unshift(...this.analyticsQueue.splice(0, 100));
            }
        }
    }
    // Background Tasks and Event Handling
    async setupA2ASubscriptions() {
        // Subscribe to cross-agent insights
        if (this.agent['a2aClient']) {
            this.agent['a2aClient'].on('messageReceived', this.handleA2AMessage.bind(this));
        }
    }
    handleA2AMessage(message) {
        try {
            switch (message.messageType) {
                case 'user-behavior-update':
                    this.handleUserBehaviorUpdate(message.payload);
                    break;
                case 'fraud-alert':
                    this.handleFraudAlert(message.payload);
                    break;
                case 'interaction-tracked':
                    this.handleInteractionTracked(message.payload);
                    break;
                default:
                    console.log('Unknown A2A message type:', message.messageType);
            }
        }
        catch (error) {
            console.error('Error handling A2A message:', error);
        }
    }
    handleUserBehaviorUpdate(payload) {
        // Invalidate user-related caches
        this.invalidateUserCaches(payload.userId);
        // Track analytics
        if (this.config.analytics.enabled) {
            this.trackAnalyticsEvent({
                eventType: 'user_behavior_updated',
                userId: payload.userId,
                data: payload
            });
        }
        this.emit('userBehaviorUpdated', payload);
    }
    handleFraudAlert(payload) {
        // Adjust recommendations for users with fraud alerts
        // This could involve reducing financial product recommendations
        console.log('Fraud alert received for user:', payload.userId);
        // Invalidate user caches to ensure fresh recommendations
        this.invalidateUserCaches(payload.userId);
        this.emit('fraudAlertReceived', payload);
    }
    handleInteractionTracked(payload) {
        // Update user interaction data
        console.log('User interaction tracked:', payload);
        // Invalidate relevant caches
        this.invalidateUserCaches(payload.userId);
        this.emit('interactionTracked', payload);
    }
    startBackgroundTasks() {
        // Analytics flush interval
        if (this.config.analytics.enabled) {
            this.analyticsInterval = setInterval(() => {
                this.flushAnalytics();
            }, this.config.analytics.flushInterval);
        }
        // Cache cleanup interval
        if (this.config.caching.enabled) {
            this.cacheCleanupInterval = setInterval(() => {
                this.evictCacheEntries();
            }, 300000); // Every 5 minutes
        }
        // Metrics update interval
        setInterval(() => {
            this.updateServiceMetrics();
        }, 60000); // Every minute
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
    // Metrics and Monitoring
    updateMetrics(processingTime, success, cacheHit) {
        this.metrics.totalRequests++;
        if (success) {
            this.metrics.successfulRequests++;
        }
        else {
            this.metrics.failedRequests++;
        }
        // Update average response time
        const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + processingTime;
        this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;
        // Update cache hit rate
        if (cacheHit) {
            const totalHits = this.metrics.cacheHitRate * (this.metrics.totalRequests - 1) + 1;
            this.metrics.cacheHitRate = totalHits / this.metrics.totalRequests;
        }
        else {
            this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (this.metrics.totalRequests - 1)) / this.metrics.totalRequests;
        }
    }
    updateServiceMetrics() {
        this.metrics.uptime = Date.now() - this.startTime.getTime();
        // Update active users (simplified - would use session tracking in production)
        this.metrics.activeUsers = Math.floor(Math.random() * 100) + 50; // Placeholder
    }
    setupEventListeners() {
        this.agent.on('recommendationsGenerated', ({ request, response }) => {
            this.emit('recommendationsGenerated', { request, response });
        });
    }
}
exports.RecommendationService = RecommendationService;
//# sourceMappingURL=recommendation-service.js.map