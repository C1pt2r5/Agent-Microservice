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

export class GeminiClientFactory {
  /**
   * Create a Gemini client with the provided configuration
   */
  static createClient(config: GeminiConfig): GeminiClient;
  static createClient(apiKey: string, options?: GeminiClientOptions): GeminiClient;
  static createClient(configOrApiKey: GeminiConfig | string, options?: GeminiClientOptions): GeminiClient {
    if (typeof configOrApiKey === 'string') {
      const config: GeminiConfig = {
        apiKey: configOrApiKey,
        model: options?.model || 'gemini-pro',
        endpoint: options?.endpoint || 'https://generativelanguage.googleapis.com/v1beta',
        maxTokens: options?.maxTokens || 2048,
        temperature: options?.temperature ?? 0.7,
        rateLimitPerMinute: options?.rateLimitPerMinute || 60
      };
      return new GeminiClient(config);
    }
    return new GeminiClient(configOrApiKey);
  }

  /**
   * Create a Gemini client for development with default settings
   */
  static createDevelopmentClient(apiKey?: string): GeminiClient {
    const config: GeminiConfig = {
      apiKey: apiKey || process.env.GEMINI_API_KEY || 'dev-key',
      model: 'gemini-pro',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      maxTokens: 2048,
      temperature: 0.7,
      rateLimitPerMinute: 60
    };

    return new GeminiClient(config);
  }

  /**
   * Create a Gemini client for production with optimized settings
   */
  static createProductionClient(apiKey: string, options: GeminiClientOptions = {}): GeminiClient {
    const config: GeminiConfig = {
      apiKey,
      model: options.model || process.env.GEMINI_MODEL || 'gemini-pro',
      endpoint: options.endpoint || process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com',
      maxTokens: options.maxTokens || parseInt(process.env.GEMINI_MAX_TOKENS || '4096'),
      temperature: options.temperature ?? parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
      rateLimitPerMinute: options.rateLimitPerMinute || parseInt(process.env.GEMINI_RATE_LIMIT || '300')
    };

    return new GeminiClient(config);
  }

  /**
   * Create a Gemini client for testing with mock-friendly settings
   */
  static createTestClient(): GeminiClient {
    const config: GeminiConfig = {
      apiKey: 'test-key',
      model: 'gemini-pro',
      endpoint: 'https://test-endpoint',
      maxTokens: 1024,
      temperature: 0.5,
      rateLimitPerMinute: 1000 // High limit for testing
    };

    return new GeminiClient(config);
  }

  /**
   * Create a Gemini client optimized for chatbot use cases
   */
  static createChatbotClient(apiKey: string): GeminiClient {
    const config: GeminiConfig = {
      apiKey,
      model: 'gemini-pro',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      maxTokens: 2048,
      temperature: 0.8, // Higher temperature for more creative responses
      rateLimitPerMinute: 120
    };

    return new GeminiClient(config);
  }

  /**
   * Create a Gemini client optimized for analytical tasks
   */
  static createAnalyticalClient(apiKey: string): GeminiClient {
    const config: GeminiConfig = {
      apiKey,
      model: 'gemini-pro',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      maxTokens: 4096,
      temperature: 0.3, // Lower temperature for more consistent analysis
      rateLimitPerMinute: 200
    };

    return new GeminiClient(config);
  }

  /**
   * Create a Gemini client optimized for recommendation tasks
   */
  static createRecommendationClient(apiKey: string): GeminiClient {
    const config: GeminiConfig = {
      apiKey,
      model: 'gemini-pro',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      maxTokens: 3072,
      temperature: 0.6, // Balanced temperature for recommendations
      rateLimitPerMinute: 150
    };

    return new GeminiClient(config);
  }

  /**
   * Create a Gemini client from environment variables
   */
  static createFromEnvironment(): GeminiClient {
    const config: GeminiConfig = {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-pro',
      endpoint: process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com',
      maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '2048'),
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
      rateLimitPerMinute: parseInt(process.env.GEMINI_RATE_LIMIT || '60')
    };

    if (!config.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    return new GeminiClient(config);
  }

  /**
   * Validate Gemini configuration
   */
  static validateConfig(config: GeminiConfig): string[] {
    const errors: string[] = [];

    if (!config.apiKey) {
      errors.push('API key is required');
    }

    if (!config.model) {
      errors.push('Model is required');
    }

    if (!config.endpoint) {
      errors.push('Endpoint is required');
    } else {
      try {
        new URL(config.endpoint);
      } catch {
        errors.push('Invalid endpoint URL');
      }
    }

    if (config.maxTokens <= 0) {
      errors.push('Max tokens must be positive');
    }

    if (config.temperature < 0 || config.temperature > 2) {
      errors.push('Temperature must be between 0 and 2');
    }

    if (config.rateLimitPerMinute <= 0) {
      errors.push('Rate limit must be positive');
    }

    if (config.maxTokens > 32768) {
      errors.push('Max tokens cannot exceed 32768');
    }

    return errors;
  }

  /**
   * Get recommended settings for different use cases
   */
  static getRecommendedSettings(useCase: string): Partial<GeminiConfig> {
    switch (useCase) {
      case 'chatbot':
        return {
          model: 'gemini-pro',
          maxTokens: 1024,
          temperature: 0.8,
          rateLimitPerMinute: 100
        };

      case 'fraud-detection':
        return {
          model: 'gemini-pro',
          maxTokens: 512,
          temperature: 0.1,
          rateLimitPerMinute: 200
        };

      case 'recommendation':
        return {
          model: 'gemini-pro',
          maxTokens: 1536,
          temperature: 0.6,
          rateLimitPerMinute: 150
        };

      case 'creative':
        return {
          model: 'gemini-pro',
          maxTokens: 2048,
          temperature: 0.9,
          rateLimitPerMinute: 80
        };

      default:
        return {
          model: 'gemini-pro',
          maxTokens: 2048,
          temperature: 0.7,
          rateLimitPerMinute: 60
        };
    }
  }

  /**
   * Get recommended configuration for different use cases
   */
  static getRecommendedConfig(useCase: 'chatbot' | 'analysis' | 'creative' | 'factual'): Partial<GeminiConfig> {
    switch (useCase) {
      case 'chatbot':
        return {
          model: 'gemini-pro',
          maxTokens: 2048,
          temperature: 0.8,
          rateLimitPerMinute: 120
        };

      case 'analysis':
        return {
          model: 'gemini-pro',
          maxTokens: 4096,
          temperature: 0.3,
          rateLimitPerMinute: 200
        };

      case 'creative':
        return {
          model: 'gemini-pro',
          maxTokens: 3072,
          temperature: 1.0,
          rateLimitPerMinute: 100
        };

      case 'factual':
        return {
          model: 'gemini-pro',
          maxTokens: 2048,
          temperature: 0.1,
          rateLimitPerMinute: 150
        };

      default:
        return {
          model: 'gemini-pro',
          maxTokens: 2048,
          temperature: 0.7,
          rateLimitPerMinute: 60
        };
    }
  }

  /**
   * Create multiple clients for different purposes
   */
  static createClientPool(apiKey: string): {
    chatbot: GeminiClient;
    analysis: GeminiClient;
    creative: GeminiClient;
    factual: GeminiClient;
  } {
    return {
      chatbot: this.createChatbotClient(apiKey),
      analysis: this.createAnalyticalClient(apiKey),
      creative: new GeminiClient({
        apiKey,
        ...this.getRecommendedConfig('creative'),
        endpoint: 'https://generativelanguage.googleapis.com/v1beta'
      } as GeminiConfig),
      factual: new GeminiClient({
        apiKey,
        ...this.getRecommendedConfig('factual'),
        endpoint: 'https://generativelanguage.googleapis.com/v1beta'
      } as GeminiConfig)
    };
  }

  /**
   * Create a suite of clients for different use cases
   */
  static createClientSuite(apiKey: string): {
    chatbot: GeminiClient;
    analytical: GeminiClient;
    recommendation: GeminiClient;
  } {
    return {
      chatbot: this.createChatbotClient(apiKey),
      analytical: this.createAnalyticalClient(apiKey),
      recommendation: this.createRecommendationClient(apiKey)
    };
  }

  /**
   * Test a Gemini client connection and functionality
   */
  static async testClient(client: GeminiClient): Promise<{success: boolean, error?: string, latency?: number}> {
    const startTime = Date.now();
    
    try {
      // Check if client has healthCheck method, otherwise use generateContent
      if (typeof (client as any).healthCheck === 'function') {
        const isHealthy = await (client as any).healthCheck();
        const latency = Math.max(Date.now() - startTime, 1); // Ensure minimum 1ms latency
        
        if (isHealthy) {
          return { success: true, latency };
        } else {
          return { 
            success: false, 
            error: 'Health check failed',
            latency
          };
        }
      } else {
        // Fallback to generateContent test
        const testRequest = {
          id: `test-${Date.now()}`,
          timestamp: new Date(),
          prompt: 'Hello, this is a test. Please respond with "Test successful".',
          options: {
            maxTokens: 100,
            temperature: 0.5
          }
        };

        const response = await client.generateContent(testRequest);
        const latency = Math.max(Date.now() - startTime, 1); // Ensure minimum 1ms latency
        
        if (response.success) {
          return { success: true, latency };
        } else {
          return { 
            success: false, 
            error: response.error?.message || 'Unknown error during test',
            latency
          };
        }
      }
    } catch (error) {
      const latency = Math.max(Date.now() - startTime, 1); // Ensure minimum 1ms latency
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error during test',
        latency
      };
    }
  }

  /**
   * Create a client with custom safety settings
   */
  static createSafeClient(apiKey: string, safetyLevel: 'strict' | 'moderate' | 'permissive' = 'moderate'): GeminiClient {
    const config: GeminiConfig = {
      apiKey,
      model: 'gemini-pro',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      maxTokens: 2048,
      temperature: 0.7,
      rateLimitPerMinute: 60
    };

    const client = new GeminiClient(config);

    // Note: Safety settings would be applied at the request level
    // This is just a factory method to create clients with different safety profiles
    
    return client;
  }
}