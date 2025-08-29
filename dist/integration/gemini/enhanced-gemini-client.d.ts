/**
 * Enhanced Gemini AI client using official Google SDK with retry logic and rate limiting
 */
import { SafetySetting } from '@google/generative-ai';
import { EventEmitter } from 'events';
import { GeminiConfig, SystemError } from '../../types';
export interface EnhancedGeminiRequest {
    id: string;
    timestamp: Date;
    prompt: string;
    systemInstruction?: string;
    options?: EnhancedGeminiRequestOptions;
    metadata?: Record<string, any>;
}
export interface EnhancedGeminiRequestOptions {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    safetySettings?: SafetySetting[];
    responseFormat?: 'text' | 'json';
}
export interface EnhancedGeminiResponse {
    id: string;
    requestId: string;
    timestamp: Date;
    success: boolean;
    content?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    error?: SystemError;
    processingTime: number;
    finishReason?: string;
}
interface RetryConfig {
    maxAttempts: number;
    backoffStrategy: 'exponential' | 'linear';
    initialDelay: number;
    maxDelay: number;
    jitter: boolean;
}
export declare class EnhancedGeminiClient extends EventEmitter {
    private config;
    private genAI;
    private model;
    private rateLimiter;
    private retryConfig;
    private requestCount;
    private errorCount;
    private totalProcessingTime;
    constructor(config: GeminiConfig);
    /**
     * Generate content with enhanced error handling and retry logic
     */
    generateContent(request: EnhancedGeminiRequest): Promise<EnhancedGeminiResponse>;
    /**
     * Generate content with streaming response
     */
    generateContentStream(request: EnhancedGeminiRequest, onChunk: (chunk: string) => void): Promise<EnhancedGeminiResponse>;
    /**
     * Generate structured JSON response
     */
    generateStructuredResponse<T = any>(request: EnhancedGeminiRequest, schema?: Record<string, any>): Promise<EnhancedGeminiResponse & {
        structuredData?: T;
    }>;
    /**
     * Batch process multiple requests with concurrency control
     */
    batchGenerate(requests: EnhancedGeminiRequest[], concurrencyLimit?: number): Promise<EnhancedGeminiResponse[]>;
    private performGeneration;
    private buildGenerationConfig;
    private getDefaultSafetySettings;
    private executeWithRetry;
    private isNonRetryableError;
    private calculateRetryDelay;
    private sleep;
    private validateRequest;
    private applyRateLimit;
    private startRateLimitRefill;
    private updateMetrics;
    private handleError;
    private createSystemError;
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
    };
    /**
     * Health check
     */
    healthCheck(): Promise<boolean>;
    /**
     * Update retry configuration
     */
    updateRetryConfig(config: Partial<RetryConfig>): void;
    /**
     * Get configuration
     */
    getConfig(): GeminiConfig;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<GeminiConfig>): void;
}
export {};
//# sourceMappingURL=enhanced-gemini-client.d.ts.map