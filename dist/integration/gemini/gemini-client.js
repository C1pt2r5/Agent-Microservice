"use strict";
/**
 * Gemini AI client implementation with comprehensive functionality
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const events_1 = require("events");
class GeminiClient extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.requestCount = 0;
        this.errorCount = 0;
        this.totalProcessingTime = 0;
        this.circuitBreakerState = 'closed';
        this.circuitBreakerFailures = 0;
        this.circuitBreakerLastFailure = null;
        this.config = config;
        this.httpClient = axios_1.default.create({
            baseURL: config.endpoint,
            timeout: 60000, // 60 seconds for AI requests
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Gemini-Client/1.0.0'
            }
        });
        // Initialize rate limiter
        this.rateLimiter = {
            tokens: config.rateLimitPerMinute,
            lastRefill: new Date(),
            requestQueue: []
        };
        // Initialize quota manager
        this.quotaManager = {
            dailyQuota: 1000, // Default daily quota
            dailyUsed: 0,
            lastReset: new Date(),
            monthlyQuota: 30000, // Default monthly quota
            monthlyUsed: 0
        };
        // Start rate limit token refill process
        this.startRateLimitRefill();
        // Start quota reset process
        this.startQuotaReset();
    }
    /**
     * Generate content using Gemini AI
     */
    async generateContent(request) {
        const startTime = Date.now();
        try {
            // Check circuit breaker
            if (this.circuitBreakerState === 'open') {
                throw new Error('Circuit breaker is open - service temporarily unavailable');
            }
            // Apply rate limiting
            await this.applyRateLimit();
            // Check quota
            this.checkQuota();
            // Validate request
            this.validateRequest(request);
            // Prepare API request
            const apiRequest = this.buildApiRequest(request);
            // Make API call
            const response = await this.httpClient.post(`/v1/models/${this.config.model}:generateContent?key=${this.config.apiKey}`, apiRequest);
            const processingTime = Date.now() - startTime;
            this.updateMetrics(processingTime, true);
            this.updateQuotaUsage(request);
            this.resetCircuitBreaker(); // Reset on successful request
            const geminiResponse = this.parseApiResponse(request, response.data, processingTime);
            this.emit('contentGenerated', { request, response: geminiResponse });
            return geminiResponse;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateMetrics(processingTime, false);
            this.updateCircuitBreaker(error);
            const errorResponse = this.handleError(request, error, processingTime);
            this.emit('generationError', { request, error: errorResponse.error });
            return errorResponse;
        }
    }
    /**
     * Generate embeddings for text
     */
    async generateEmbedding(request) {
        try {
            // Apply rate limiting
            await this.applyRateLimit();
            const apiRequest = {
                model: request.model || 'models/embedding-001',
                content: {
                    parts: [{ text: request.text }]
                }
            };
            const response = await this.httpClient.post(`/v1/models/${apiRequest.model}:embedContent?key=${this.config.apiKey}`, apiRequest);
            const embeddingResponse = {
                id: `embedding_${Date.now()}`,
                requestId: request.id,
                embedding: response.data.embedding?.values || [],
                usage: {
                    promptTokens: this.estimateTokens(request.text),
                    completionTokens: 0,
                    totalTokens: this.estimateTokens(request.text)
                }
            };
            this.emit('embeddingGenerated', { request, response: embeddingResponse });
            return embeddingResponse;
        }
        catch (error) {
            const errorResponse = {
                id: `embedding_${Date.now()}`,
                requestId: request.id,
                embedding: [],
                error: this.createSystemError(error)
            };
            this.emit('embeddingError', { request, error: errorResponse.error });
            return errorResponse;
        }
    }
    /**
     * Generate content with streaming response
     */
    async generateContentStream(request, onChunk) {
        const startTime = Date.now();
        try {
            await this.applyRateLimit();
            this.validateRequest(request);
            const apiRequest = {
                ...this.buildApiRequest(request),
                stream: true
            };
            const response = await this.httpClient.post(`/v1/models/${this.config.model}:streamGenerateContent?key=${this.config.apiKey}`, apiRequest, {
                responseType: 'stream'
            });
            let fullContent = '';
            return new Promise((resolve, reject) => {
                response.data.on('data', (chunk) => {
                    try {
                        const lines = chunk.toString().split('\n');
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = JSON.parse(line.slice(6));
                                if (data.candidates && data.candidates[0]?.content?.parts) {
                                    const content = data.candidates[0].content.parts[0]?.text || '';
                                    fullContent += content;
                                    onChunk(content);
                                }
                            }
                        }
                    }
                    catch (error) {
                        // Ignore parsing errors for incomplete chunks
                    }
                });
                response.data.on('end', () => {
                    const processingTime = Date.now() - startTime;
                    this.updateMetrics(processingTime, true);
                    const geminiResponse = {
                        id: `response_${Date.now()}`,
                        requestId: request.id,
                        timestamp: new Date(),
                        success: true,
                        content: fullContent,
                        processingTime
                    };
                    this.emit('streamCompleted', { request, response: geminiResponse });
                    resolve(geminiResponse);
                });
                response.data.on('error', (error) => {
                    const processingTime = Date.now() - startTime;
                    this.updateMetrics(processingTime, false);
                    const errorResponse = this.handleError(request, error, processingTime);
                    this.emit('streamError', { request, error: errorResponse.error });
                    reject(errorResponse);
                });
            });
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateMetrics(processingTime, false);
            const errorResponse = this.handleError(request, error, processingTime);
            this.emit('streamError', { request, error: errorResponse.error });
            return errorResponse;
        }
    }
    /**
     * Batch process multiple requests
     */
    async batchGenerate(requests) {
        const responses = [];
        // Process requests with concurrency limit
        const concurrencyLimit = 3;
        const chunks = this.chunkArray(requests, concurrencyLimit);
        for (const chunk of chunks) {
            const chunkPromises = chunk.map(request => this.generateContent(request));
            const chunkResponses = await Promise.allSettled(chunkPromises);
            chunkResponses.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    responses.push(result.value);
                }
                else {
                    // Create error response for failed requests
                    responses.push({
                        id: `error_${Date.now()}`,
                        requestId: chunk[index].id,
                        timestamp: new Date(),
                        success: false,
                        error: this.createSystemError(result.reason),
                        processingTime: 0
                    });
                }
            });
        }
        this.emit('batchCompleted', { requests, responses });
        return responses;
    }
    validateRequest(request) {
        if (!request.id) {
            throw new Error('Request ID is required');
        }
        if (!request.prompt || request.prompt.trim().length === 0) {
            throw new Error('Prompt is required and cannot be empty');
        }
        if (request.prompt.length > 100000) { // 100k character limit
            throw new Error('Prompt exceeds maximum length');
        }
    }
    buildApiRequest(request) {
        const options = request.options || {};
        return {
            contents: [
                {
                    parts: [{ text: request.prompt }]
                }
            ],
            generationConfig: {
                maxOutputTokens: options.maxTokens || this.config.maxTokens,
                temperature: options.temperature ?? this.config.temperature,
                topP: options.topP || 0.8,
                topK: options.topK || 40,
                stopSequences: options.stopSequences || []
            },
            safetySettings: options.safetySettings || [
                {
                    category: 'HARM_CATEGORY_HARASSMENT',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                },
                {
                    category: 'HARM_CATEGORY_HATE_SPEECH',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                },
                {
                    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                },
                {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                }
            ]
        };
    }
    parseApiResponse(request, data, processingTime) {
        const candidates = data.candidates || [];
        const firstCandidate = candidates[0];
        return {
            id: `response_${Date.now()}`,
            requestId: request.id,
            timestamp: new Date(),
            success: true,
            content: firstCandidate?.content?.parts?.[0]?.text || '',
            candidates: candidates.map((candidate) => ({
                content: candidate.content?.parts?.[0]?.text || '',
                finishReason: candidate.finishReason || 'STOP',
                safetyRatings: candidate.safetyRatings || []
            })),
            usage: {
                promptTokens: data.usageMetadata?.promptTokenCount || this.estimateTokens(request.prompt),
                completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata?.totalTokenCount || 0
            },
            processingTime
        };
    }
    handleError(request, error, processingTime) {
        let systemError;
        if (axios_1.default.isAxiosError(error)) {
            const status = error.response?.status;
            const data = error.response?.data;
            systemError = {
                code: 'GEMINI_ERROR',
                message: this.getErrorMessage(status, data),
                details: {
                    status,
                    statusText: error.response?.statusText,
                    data
                },
                timestamp: new Date()
            };
        }
        else {
            systemError = this.createSystemError(error);
        }
        return {
            id: `error_${Date.now()}`,
            requestId: request.id,
            timestamp: new Date(),
            success: false,
            error: systemError,
            processingTime
        };
    }
    getErrorMessage(status, data) {
        switch (status) {
            case 400:
                return `Bad request: ${data?.error?.message || 'Invalid request format'}`;
            case 401:
                return 'Authentication failed: Invalid API key';
            case 403:
                return 'Permission denied: API key lacks required permissions';
            case 429:
                return 'Rate limit exceeded: Too many requests';
            case 500:
                return 'Internal server error: Gemini service unavailable';
            case 503:
                return 'Service unavailable: Gemini service temporarily down';
            default:
                return data?.error?.message || 'Unknown Gemini API error';
        }
    }
    createSystemError(error) {
        return {
            code: 'GEMINI_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
        };
    }
    async applyRateLimit() {
        // Refill tokens based on time elapsed
        const now = new Date();
        const timeSinceLastRefill = now.getTime() - this.rateLimiter.lastRefill.getTime();
        const tokensToAdd = Math.floor(timeSinceLastRefill / (60000 / this.config.rateLimitPerMinute));
        if (tokensToAdd > 0) {
            this.rateLimiter.tokens = Math.min(this.config.rateLimitPerMinute, this.rateLimiter.tokens + tokensToAdd);
            this.rateLimiter.lastRefill = now;
        }
        // Check if we have tokens available
        if (this.rateLimiter.tokens > 0) {
            this.rateLimiter.tokens--;
            return;
        }
        // No tokens available, queue the request
        return new Promise((resolve, reject) => {
            const queueItem = {
                resolve,
                reject,
                timestamp: new Date()
            };
            this.rateLimiter.requestQueue.push(queueItem);
            // Set timeout for queued requests
            setTimeout(() => {
                const index = this.rateLimiter.requestQueue.indexOf(queueItem);
                if (index !== -1) {
                    this.rateLimiter.requestQueue.splice(index, 1);
                    reject(new Error('Rate limit queue timeout'));
                }
            }, 30000); // 30 second timeout
        });
    }
    startRateLimitRefill() {
        setInterval(() => {
            // Process queued requests
            while (this.rateLimiter.tokens > 0 && this.rateLimiter.requestQueue.length > 0) {
                const queueItem = this.rateLimiter.requestQueue.shift();
                if (queueItem) {
                    this.rateLimiter.tokens--;
                    queueItem.resolve(true);
                }
            }
        }, 1000); // Check every second
    }
    updateMetrics(processingTime, success) {
        this.requestCount++;
        this.totalProcessingTime += processingTime;
        if (!success) {
            this.errorCount++;
        }
        this.emit('metricsUpdated', {
            requestCount: this.requestCount,
            errorCount: this.errorCount,
            errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
            averageProcessingTime: this.totalProcessingTime / this.requestCount,
            rateLimitTokens: this.rateLimiter.tokens
        });
    }
    estimateTokens(text) {
        // Rough estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    // Public utility methods
    /**
     * Get client statistics
     */
    getStatistics() {
        return {
            requestCount: this.requestCount,
            errorCount: this.errorCount,
            errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
            averageProcessingTime: this.requestCount > 0 ? this.totalProcessingTime / this.requestCount : 0,
            rateLimitTokens: this.rateLimiter.tokens,
            queueLength: this.rateLimiter.requestQueue.length,
            quotaInfo: this.getQuotaInfo(),
            circuitBreakerStatus: this.getCircuitBreakerStatus()
        };
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const testRequest = {
                id: 'health_check',
                timestamp: new Date(),
                prompt: 'Hello'
            };
            const response = await this.generateContent(testRequest);
            return response.success;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.emit('configUpdated', this.config);
    }
    /**
     * Check quota availability
     */
    checkQuota() {
        const now = new Date();
        // Reset daily quota if needed
        if (now.getDate() !== this.quotaManager.lastReset.getDate()) {
            this.quotaManager.dailyUsed = 0;
            this.quotaManager.lastReset = now;
        }
        // Reset monthly quota if needed
        if (now.getMonth() !== this.quotaManager.lastReset.getMonth()) {
            this.quotaManager.monthlyUsed = 0;
        }
        if (this.quotaManager.dailyUsed >= this.quotaManager.dailyQuota) {
            throw new Error('Daily quota exceeded');
        }
        if (this.quotaManager.monthlyUsed >= this.quotaManager.monthlyQuota) {
            throw new Error('Monthly quota exceeded');
        }
    }
    /**
     * Update quota usage
     */
    updateQuotaUsage(request) {
        const estimatedTokens = this.estimateTokens(request.prompt);
        this.quotaManager.dailyUsed += estimatedTokens;
        this.quotaManager.monthlyUsed += estimatedTokens;
        this.emit('quotaUpdated', {
            dailyUsed: this.quotaManager.dailyUsed,
            dailyQuota: this.quotaManager.dailyQuota,
            monthlyUsed: this.quotaManager.monthlyUsed,
            monthlyQuota: this.quotaManager.monthlyQuota
        });
    }
    /**
     * Start quota reset process
     */
    startQuotaReset() {
        setInterval(() => {
            const now = new Date();
            // Reset daily quota at midnight
            if (now.getHours() === 0 && now.getMinutes() === 0) {
                this.quotaManager.dailyUsed = 0;
                this.quotaManager.lastReset = now;
                this.emit('quotaReset', { type: 'daily' });
            }
            // Reset monthly quota on first day of month
            if (now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() === 0) {
                this.quotaManager.monthlyUsed = 0;
                this.emit('quotaReset', { type: 'monthly' });
            }
        }, 60000); // Check every minute
    }
    /**
     * Update circuit breaker state based on error
     */
    updateCircuitBreaker(error) {
        const isServiceError = axios_1.default.isAxiosError(error) &&
            error.response &&
            error.response.status >= 500;
        if (isServiceError) {
            this.circuitBreakerFailures++;
            this.circuitBreakerLastFailure = new Date();
            if (this.circuitBreakerFailures >= 5) { // Threshold of 5 failures
                this.circuitBreakerState = 'open';
                this.emit('circuitBreakerOpened', { failures: this.circuitBreakerFailures });
                // Auto-reset after 30 seconds
                setTimeout(() => {
                    this.circuitBreakerState = 'half-open';
                    this.emit('circuitBreakerHalfOpen');
                }, 30000);
            }
        }
    }
    /**
     * Reset circuit breaker on successful request
     */
    resetCircuitBreaker() {
        if (this.circuitBreakerState === 'half-open') {
            this.circuitBreakerState = 'closed';
            this.circuitBreakerFailures = 0;
            this.circuitBreakerLastFailure = null;
            this.emit('circuitBreakerClosed');
        }
    }
    /**
     * Get quota information
     */
    getQuotaInfo() {
        return {
            dailyUsed: this.quotaManager.dailyUsed,
            dailyQuota: this.quotaManager.dailyQuota,
            dailyRemaining: this.quotaManager.dailyQuota - this.quotaManager.dailyUsed,
            monthlyUsed: this.quotaManager.monthlyUsed,
            monthlyQuota: this.quotaManager.monthlyQuota,
            monthlyRemaining: this.quotaManager.monthlyQuota - this.quotaManager.monthlyUsed
        };
    }
    /**
     * Set quota limits
     */
    setQuotaLimits(dailyQuota, monthlyQuota) {
        if (dailyQuota !== undefined) {
            this.quotaManager.dailyQuota = dailyQuota;
        }
        if (monthlyQuota !== undefined) {
            this.quotaManager.monthlyQuota = monthlyQuota;
        }
        this.emit('quotaLimitsUpdated', {
            dailyQuota: this.quotaManager.dailyQuota,
            monthlyQuota: this.quotaManager.monthlyQuota
        });
    }
    /**
     * Get circuit breaker status
     */
    getCircuitBreakerStatus() {
        return {
            state: this.circuitBreakerState,
            failures: this.circuitBreakerFailures,
            lastFailure: this.circuitBreakerLastFailure
        };
    }
}
exports.GeminiClient = GeminiClient;
//# sourceMappingURL=gemini-client.js.map