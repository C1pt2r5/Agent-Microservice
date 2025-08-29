"use strict";
/**
 * MCP client implementation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPClientImpl = void 0;
const axios_1 = __importDefault(require("axios"));
const auth_manager_1 = require("./auth-manager");
class MCPClientImpl {
    constructor(config) {
        this.circuitBreakers = new Map();
        this.rateLimiters = new Map();
        this.config = config;
        this.authManager = new auth_manager_1.AuthManager();
        this.httpClient = axios_1.default.create({
            baseURL: config.gatewayUrl,
            timeout: config.defaultTimeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'MCP-Client/1.0.0'
            }
        });
        // Initialize circuit breakers for each service
        Object.keys(config.services).forEach(serviceName => {
            this.circuitBreakers.set(serviceName, {
                state: 'CLOSED',
                failureCount: 0,
                lastFailureTime: null,
                halfOpenAttempts: 0
            });
            // Initialize rate limiters
            this.rateLimiters.set(serviceName, {
                tokens: config.services[serviceName].rateLimit.requestsPerMinute,
                lastRefill: new Date()
            });
        });
    }
    async request(request) {
        const serviceConfig = this.config.services[request.service];
        if (!serviceConfig) {
            throw this.createError('MCP_ERROR', `Service ${request.service} not configured`);
        }
        // Check circuit breaker
        if (!this.isCircuitBreakerClosed(request.service, serviceConfig.circuitBreaker)) {
            throw this.createError('MCP_ERROR', `Circuit breaker open for service ${request.service}`);
        }
        // Check rate limit
        if (!this.checkRateLimit(request.service, serviceConfig)) {
            throw this.createError('MCP_ERROR', `Rate limit exceeded for service ${request.service}`);
        }
        const retryPolicy = request.metadata.retryPolicy || this.config.retryPolicy;
        let lastError = null;
        let retryCount = 0;
        for (let attempt = 0; attempt <= retryPolicy.maxAttempts; attempt++) {
            try {
                const response = await this.executeRequest(request, serviceConfig);
                // Reset circuit breaker on success
                this.resetCircuitBreaker(request.service);
                return {
                    ...response,
                    metadata: {
                        ...response.metadata,
                        retryCount
                    }
                };
            }
            catch (error) {
                retryCount++;
                lastError = error instanceof Error ?
                    this.createError('MCP_ERROR', error.message) :
                    this.createError('MCP_ERROR', 'Unknown error');
                // Record failure for circuit breaker
                this.recordFailure(request.service, serviceConfig.circuitBreaker);
                if (attempt < retryPolicy.maxAttempts) {
                    const delay = this.calculateRetryDelay(attempt, retryPolicy);
                    await this.sleep(delay);
                }
            }
        }
        throw lastError;
    }
    async executeRequest(request, serviceConfig) {
        const startTime = Date.now();
        const axiosConfig = {
            method: 'POST',
            url: '/mcp/request',
            data: request,
            timeout: request.metadata.timeout || serviceConfig.timeout,
            headers: this.buildAuthHeaders(request.service, serviceConfig.auth)
        };
        try {
            const response = await this.httpClient.request(axiosConfig);
            const processingTime = Date.now() - startTime;
            return {
                id: `response_${Date.now()}`,
                requestId: request.id,
                timestamp: new Date(),
                success: true,
                data: response.data,
                metadata: {
                    processingTime,
                    serviceEndpoint: serviceConfig.endpoint,
                    retryCount: 0,
                    cacheHit: false
                }
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            if (axios_1.default.isAxiosError(error)) {
                const systemError = {
                    code: 'MCP_ERROR',
                    message: error.message,
                    details: {
                        status: error.response?.status,
                        statusText: error.response?.statusText,
                        data: error.response?.data
                    },
                    timestamp: new Date(),
                    correlationId: request.metadata.correlationId
                };
                return {
                    id: `response_${Date.now()}`,
                    requestId: request.id,
                    timestamp: new Date(),
                    success: false,
                    error: systemError,
                    metadata: {
                        processingTime,
                        serviceEndpoint: serviceConfig.endpoint,
                        retryCount: 0,
                        cacheHit: false
                    }
                };
            }
            throw error;
        }
    }
    buildAuthHeaders(serviceId, authConfig) {
        return this.authManager.getAuthHeaders(serviceId, authConfig);
    }
    isCircuitBreakerClosed(serviceName, config) {
        const state = this.circuitBreakers.get(serviceName);
        if (!state)
            return true;
        switch (state.state) {
            case 'CLOSED':
                return true;
            case 'OPEN':
                if (state.lastFailureTime &&
                    Date.now() - state.lastFailureTime.getTime() > config.recoveryTimeout) {
                    state.state = 'HALF_OPEN';
                    state.halfOpenAttempts = 0;
                    return true;
                }
                return false;
            case 'HALF_OPEN':
                return state.halfOpenAttempts < config.halfOpenMaxCalls;
            default:
                return true;
        }
    }
    recordFailure(serviceName, config) {
        const state = this.circuitBreakers.get(serviceName);
        if (!state)
            return;
        state.failureCount++;
        state.lastFailureTime = new Date();
        if (state.state === 'HALF_OPEN') {
            state.state = 'OPEN';
            state.halfOpenAttempts = 0;
        }
        else if (state.failureCount >= config.failureThreshold) {
            state.state = 'OPEN';
        }
    }
    resetCircuitBreaker(serviceName) {
        const state = this.circuitBreakers.get(serviceName);
        if (!state)
            return;
        state.state = 'CLOSED';
        state.failureCount = 0;
        state.lastFailureTime = null;
        state.halfOpenAttempts = 0;
    }
    checkRateLimit(serviceName, serviceConfig) {
        const rateLimiter = this.rateLimiters.get(serviceName);
        if (!rateLimiter)
            return true;
        const now = new Date();
        const timeSinceLastRefill = now.getTime() - rateLimiter.lastRefill.getTime();
        const tokensToAdd = Math.floor(timeSinceLastRefill / (60000 / serviceConfig.rateLimit.requestsPerMinute));
        if (tokensToAdd > 0) {
            rateLimiter.tokens = Math.min(serviceConfig.rateLimit.burstLimit, rateLimiter.tokens + tokensToAdd);
            rateLimiter.lastRefill = now;
        }
        if (rateLimiter.tokens > 0) {
            rateLimiter.tokens--;
            return true;
        }
        return false;
    }
    calculateRetryDelay(attempt, retryPolicy) {
        let delay;
        if (retryPolicy.backoffStrategy === 'exponential') {
            delay = retryPolicy.initialDelay * Math.pow(2, attempt);
        }
        else {
            delay = retryPolicy.initialDelay * (attempt + 1);
        }
        delay = Math.min(delay, retryPolicy.maxDelay);
        if (retryPolicy.jitter) {
            delay = delay * (0.5 + Math.random() * 0.5);
        }
        return delay;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    createError(code, message) {
        return {
            code,
            message,
            timestamp: new Date()
        };
    }
    async getServiceDefinition(serviceName) {
        const serviceConfig = this.config.services[serviceName];
        if (!serviceConfig) {
            throw this.createError('MCP_ERROR', `Service ${serviceName} not configured`);
        }
        try {
            const response = await this.httpClient.get(`/mcp/services/${serviceName}/definition`, {
                headers: this.buildAuthHeaders(serviceName, serviceConfig.auth)
            });
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw this.createError('MCP_ERROR', `Failed to get service definition: ${error.message}`);
            }
            throw error;
        }
    }
    async healthCheck() {
        try {
            const response = await this.httpClient.get('/mcp/health');
            return response.status === 200;
        }
        catch (error) {
            return false;
        }
    }
    // Additional utility methods
    getCircuitBreakerState(serviceName) {
        return this.circuitBreakers.get(serviceName);
    }
    getRateLimitStatus(serviceName) {
        return this.rateLimiters.get(serviceName);
    }
}
exports.MCPClientImpl = MCPClientImpl;
//# sourceMappingURL=mcp-client.js.map