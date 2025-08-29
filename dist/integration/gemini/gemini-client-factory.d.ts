/**
 * Factory for creating Gemini clients with different configurations
 */
import { GeminiClient } from './gemini-client';
import { GeminiConfig } from '../../types';
export interface GeminiClientOptions {
    apiKey?: string;
    model?: string;
    endpoint?: string;
    maxTokens?: number;
    temperature?: number;
    rateLimitPerMinute?: number;
}
export declare class GeminiClientFactory {
    /**
     * Create a Gemini client with the provided configuration
     */
    static createClient(config: GeminiConfig): GeminiClient;
    static createClient(apiKey: string, options?: GeminiClientOptions): GeminiClient;
    /**
     * Create a Gemini client for development with default settings
     */
    static createDevelopmentClient(apiKey?: string): GeminiClient;
    /**
     * Create a Gemini client for production with optimized settings
     */
    static createProductionClient(apiKey: string, options?: GeminiClientOptions): GeminiClient;
    /**
     * Create a Gemini client for testing with mock-friendly settings
     */
    static createTestClient(): GeminiClient;
    /**
     * Create a Gemini client optimized for chatbot use cases
     */
    static createChatbotClient(apiKey: string): GeminiClient;
    /**
     * Create a Gemini client optimized for analytical tasks
     */
    static createAnalyticalClient(apiKey: string): GeminiClient;
    /**
     * Create a Gemini client optimized for recommendation tasks
     */
    static createRecommendationClient(apiKey: string): GeminiClient;
    /**
     * Create a Gemini client from environment variables
     */
    static createFromEnvironment(): GeminiClient;
    /**
     * Validate Gemini configuration
     */
    static validateConfig(config: GeminiConfig): string[];
    /**
     * Get recommended settings for different use cases
     */
    static getRecommendedSettings(useCase: string): Partial<GeminiConfig>;
    /**
     * Get recommended configuration for different use cases
     */
    static getRecommendedConfig(useCase: 'chatbot' | 'analysis' | 'creative' | 'factual'): Partial<GeminiConfig>;
    /**
     * Create multiple clients for different purposes
     */
    static createClientPool(apiKey: string): {
        chatbot: GeminiClient;
        analysis: GeminiClient;
        creative: GeminiClient;
        factual: GeminiClient;
    };
    /**
     * Create a suite of clients for different use cases
     */
    static createClientSuite(apiKey: string): {
        chatbot: GeminiClient;
        analytical: GeminiClient;
        recommendation: GeminiClient;
    };
    /**
     * Test a Gemini client connection and functionality
     */
    static testClient(client: GeminiClient): Promise<{
        success: boolean;
        error?: string;
        latency?: number;
    }>;
    /**
     * Create a client with custom safety settings
     */
    static createSafeClient(apiKey: string, safetyLevel?: 'strict' | 'moderate' | 'permissive'): GeminiClient;
}
//# sourceMappingURL=gemini-client-factory.d.ts.map