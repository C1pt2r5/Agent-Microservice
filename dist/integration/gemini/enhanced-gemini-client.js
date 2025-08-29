"use strict";
/**
 * Enhanced Gemini AI client using official Google SDK with retry logic and rate limiting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedGeminiClient = void 0;
const generative_ai_1 = require("@google/generative-ai");
const events_1 = require("events");
class EnhancedGeminiClient extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.requestCount = 0;
        this.errorCount = 0;
        this.totalProcessingTime = 0;
        this.config = config;
        // Initialize Google Generative AI
        this.genAI = new generative_ai_1.GoogleGenerativeAI(config.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: config.model });
        // Initialize rate limiter
        this.rateLimiter = {
            tokens: config.rateLimitPerMinute,
            lastRefill: new Date(),
            requestQueue: []
        };
        // Initialize retry configuration
        this.retryConfig = {
            maxAttempts: 3,
            backoffStrategy: 'exponential',
            initialDelay: 1000,
            maxDelay: 10000,
            jitter: true
        };
        // Start rate limit token refill process (skip in test environment)
        if (process.env.DISABLE_BACKGROUND_TASKS !== 'true') {
            this.startRateLimitRefill();
        }
    }
    /**
     * Generate content with enhanced error handling and retry logic
     */
    async generateContent(request) {
        const startTime = Date.now();
        try {
            // Apply rate limiting
            await this.applyRateLimit();
            // Validate request
            this.validateRequest(request);
            // Execute with retry logic
            const result = await this.executeWithRetry(async () => {
                return await this.performGeneration(request);
            });
            const processingTime = Date.now() - startTime;
            this.updateMetrics(processingTime, true);
            const response = {
                id: `response_${Date.now()}`,
                requestId: request.id,
                timestamp: new Date(),
                success: true,
                content: result.content,
                usage: result.usage,
                processingTime,
                finishReason: result.finishReason
            };
            this.emit('contentGenerated', { request, response });
            return response;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateMetrics(processingTime, false);
            const errorResponse = this.handleError(request, error, processingTime);
            this.emit('generationError', { request, error: errorResponse.error });
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
            const generationConfig = this.buildGenerationConfig(request.options);
            const safetySettings = request.options?.safetySettings || this.getDefaultSafetySettings();
            // Create model with system instruction if provided
            const modelToUse = request.systemInstruction
                ? this.genAI.getGenerativeModel({
                    model: this.config.model
                })
                : this.model;
            const result = await modelToUse.generateContentStream({
                contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
                generationConfig,
                safetySettings
            });
            let fullContent = '';
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullContent += chunkText;
                onChunk(chunkText);
            }
            const finalResult = await result.response;
            const processingTime = Date.now() - startTime;
            this.updateMetrics(processingTime, true);
            const response = {
                id: `response_${Date.now()}`,
                requestId: request.id,
                timestamp: new Date(),
                success: true,
                content: fullContent,
                usage: {
                    promptTokens: finalResult.usageMetadata?.promptTokenCount || 0,
                    completionTokens: finalResult.usageMetadata?.candidatesTokenCount || 0,
                    totalTokens: finalResult.usageMetadata?.totalTokenCount || 0
                },
                processingTime,
                finishReason: finalResult.candidates?.[0]?.finishReason || 'STOP'
            };
            this.emit('streamCompleted', { request, response });
            return response;
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
     * Generate structured JSON response
     */
    async generateStructuredResponse(request, schema) {
        // Modify prompt to request JSON format
        const jsonRequest = {
            ...request,
            prompt: `${request.prompt}\n\nPlease respond with valid JSON format only.${schema ? ` Follow this schema: ${JSON.stringify(schema)}` : ''}`,
            options: {
                ...request.options,
                responseFormat: 'json'
            }
        };
        const response = await this.generateContent(jsonRequest);
        if (response.success && response.content) {
            try {
                const structuredData = JSON.parse(response.content);
                return {
                    ...response,
                    structuredData
                };
            }
            catch (parseError) {
                return {
                    ...response,
                    success: false,
                    error: {
                        code: 'JSON_PARSE_ERROR',
                        message: 'Failed to parse response as JSON',
                        timestamp: new Date()
                    }
                };
            }
        }
        return response;
    }
    /**
     * Batch process multiple requests with concurrency control
     */
    async batchGenerate(requests, concurrencyLimit = 3) {
        const responses = [];
        const chunks = this.chunkArray(requests, concurrencyLimit);
        for (const chunk of chunks) {
            const chunkPromises = chunk.map(request => this.generateContent(request));
            const chunkResponses = await Promise.allSettled(chunkPromises);
            chunkResponses.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    responses.push(result.value);
                }
                else {
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
    async performGeneration(request) {
        const generationConfig = this.buildGenerationConfig(request.options);
        const safetySettings = request.options?.safetySettings || this.getDefaultSafetySettings();
        // For now, we'll include system instruction in the prompt since the SDK might not support it directly
        const effectivePrompt = request.systemInstruction
            ? `${request.systemInstruction}\n\nUser: ${request.prompt}`
            : request.prompt;
        const result = await this.model.generateContent({
            contents: [{ role: 'user', parts: [{ text: effectivePrompt }] }],
            generationConfig,
            safetySettings
        });
        const response = result.response;
        const text = response.text();
        return {
            content: text,
            usage: {
                promptTokens: response.usageMetadata?.promptTokenCount || 0,
                completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata?.totalTokenCount || 0
            },
            finishReason: response.candidates?.[0]?.finishReason || 'STOP'
        };
    }
    buildGenerationConfig(options) {
        return {
            maxOutputTokens: options?.maxTokens || this.config.maxTokens,
            temperature: options?.temperature ?? this.config.temperature,
            topP: options?.topP || 0.8,
            topK: options?.topK || 40,
            stopSequences: options?.stopSequences || []
        };
    }
    getDefaultSafetySettings() {
        return [
            {
                category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
            },
            {
                category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
            },
            {
                category: generative_ai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
            },
            {
                category: generative_ai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
            }
        ];
    }
    async executeWithRetry(operation) {
        let lastError;
        for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                // Don't retry on certain errors
                if (this.isNonRetryableError(error)) {
                    throw error;
                }
                // Don't retry on last attempt
                if (attempt === this.retryConfig.maxAttempts) {
                    break;
                }
                // Calculate delay
                const delay = this.calculateRetryDelay(attempt);
                await this.sleep(delay);
                this.emit('retryAttempt', { attempt, error, delay });
            }
        }
        throw lastError;
    }
    isNonRetryableError(error) {
        // Don't retry on authentication errors, invalid requests, etc.
        const errorMessage = error?.message?.toLowerCase() || '';
        return errorMessage.includes('api key') ||
            errorMessage.includes('invalid') ||
            errorMessage.includes('permission');
    }
    calculateRetryDelay(attempt) {
        let delay;
        if (this.retryConfig.backoffStrategy === 'exponential') {
            delay = Math.min(this.retryConfig.initialDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
        }
        else {
            delay = Math.min(this.retryConfig.initialDelay * attempt, this.retryConfig.maxDelay);
        }
        // Add jitter if enabled
        if (this.retryConfig.jitter) {
            delay = delay * (0.5 + Math.random() * 0.5);
        }
        return Math.floor(delay);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    validateRequest(request) {
        if (!request.id) {
            throw new Error('Request ID is required');
        }
        if (!request.prompt || request.prompt.trim().length === 0) {
            throw new Error('Prompt is required and cannot be empty');
        }
        if (request.prompt.length > 1000000) { // 1M character limit
            throw new Error('Prompt exceeds maximum length');
        }
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
    handleError(request, error, processingTime) {
        const systemError = this.createSystemError(error);
        return {
            id: `error_${Date.now()}`,
            requestId: request.id,
            timestamp: new Date(),
            success: false,
            error: systemError,
            processingTime
        };
    }
    createSystemError(error) {
        return {
            code: 'GEMINI_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
        };
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
            queueLength: this.rateLimiter.requestQueue.length
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
     * Update retry configuration
     */
    updateRetryConfig(config) {
        this.retryConfig = { ...this.retryConfig, ...config };
        this.emit('retryConfigUpdated', this.retryConfig);
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
        // Reinitialize model if model or API key changed
        if (newConfig.model || newConfig.apiKey) {
            this.genAI = new generative_ai_1.GoogleGenerativeAI(this.config.apiKey);
            this.model = this.genAI.getGenerativeModel({ model: this.config.model });
        }
        this.emit('configUpdated', this.config);
    }
}
exports.EnhancedGeminiClient = EnhancedGeminiClient;
//# sourceMappingURL=enhanced-gemini-client.js.map