/**
 * Gemini AI client implementation with comprehensive functionality
 */
import { EventEmitter } from 'events';
import { GeminiConfig, SystemError } from '../../types';
export interface GeminiRequest {
    id: string;
    timestamp: Date;
    prompt: string;
    options?: GeminiRequestOptions;
    metadata?: Record<string, any>;
}
export interface GeminiRequestOptions {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    safetySettings?: SafetySetting[];
}
export interface SafetySetting {
    category: string;
    threshold: string;
}
export interface GeminiResponse {
    id: string;
    requestId: string;
    timestamp: Date;
    success: boolean;
    content?: string;
    candidates?: GeminiCandidate[];
    usage?: TokenUsage;
    error?: SystemError;
    processingTime: number;
}
export interface GeminiCandidate {
    content: string;
    finishReason: string;
    safetyRatings?: SafetyRating[];
}
export interface SafetyRating {
    category: string;
    probability: string;
}
export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}
export interface EmbeddingRequest {
    id: string;
    text: string;
    model?: string;
}
export interface EmbeddingResponse {
    id: string;
    requestId: string;
    embedding: number[];
    usage?: TokenUsage;
    error?: SystemError;
}
export declare class GeminiClient extends EventEmitter {
    private config;
    private httpClient;
    private rateLimiter;
    private quotaManager;
    private requestCount;
    private errorCount;
    private totalProcessingTime;
    private circuitBreakerState;
    private circuitBreakerFailures;
    private circuitBreakerLastFailure;
    constructor(config: GeminiConfig);
    /**
     * Generate content using Gemini AI
     */
    generateContent(request: GeminiRequest): Promise<GeminiResponse>;
    /**
     * Generate embeddings for text
     */
    generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;
    /**
     * Generate content with streaming response
     */
    generateContentStream(request: GeminiRequest, onChunk: (chunk: string) => void): Promise<GeminiResponse>;
    /**
     * Batch process multiple requests
     */
    batchGenerate(requests: GeminiRequest[]): Promise<GeminiResponse[]>;
    private validateRequest;
    private buildApiRequest;
    private parseApiResponse;
    private handleError;
    private getErrorMessage;
    private createSystemError;
    private applyRateLimit;
    private startRateLimitRefill;
    private updateMetrics;
    private estimateTokens;
    private chunkArray;
    /**
     * Get client statistics
     */
    getStatistics(): {
        requestCount: number;
        errorCount: number;
        errorRate: number;
        averageProcessingTime: number;
        rateLimitTokens: number;
        queueLength: number;
        quotaInfo: ReturnType<GeminiClient['getQuotaInfo']>;
        circuitBreakerStatus: ReturnType<GeminiClient['getCircuitBreakerStatus']>;
    };
    /**
     * Health check
     */
    healthCheck(): Promise<boolean>;
    /**
     * Get configuration
     */
    getConfig(): GeminiConfig;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<GeminiConfig>): void;
    /**
     * Check quota availability
     */
    private checkQuota;
    /**
     * Update quota usage
     */
    private updateQuotaUsage;
    /**
     * Start quota reset process
     */
    private startQuotaReset;
    /**
     * Update circuit breaker state based on error
     */
    private updateCircuitBreaker;
    /**
     * Reset circuit breaker on successful request
     */
    private resetCircuitBreaker;
    /**
     * Get quota information
     */
    getQuotaInfo(): {
        dailyUsed: number;
        dailyQuota: number;
        dailyRemaining: number;
        monthlyUsed: number;
        monthlyQuota: number;
        monthlyRemaining: number;
    };
    /**
     * Set quota limits
     */
    setQuotaLimits(dailyQuota?: number, monthlyQuota?: number): void;
    /**
     * Get circuit breaker status
     */
    getCircuitBreakerStatus(): {
        state: 'closed' | 'open' | 'half-open';
        failures: number;
        lastFailure: Date | null;
    };
}
//# sourceMappingURL=gemini-client.d.ts.map