"use strict";
/**
 * Configuration management utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
class ConfigManager {
    static loadConfig(configPath) {
        // Basic configuration loading - will be enhanced in later tasks
        const config = {
            id: process.env.AGENT_ID || 'default-agent',
            name: process.env.AGENT_NAME || 'Default Agent',
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            type: process.env.AGENT_TYPE || 'chatbot',
            mcpEndpoint: {
                url: process.env.MCP_ENDPOINT || 'http://localhost:8080',
                timeout: parseInt(process.env.MCP_TIMEOUT || '30000'),
                retryAttempts: parseInt(process.env.MCP_RETRY_ATTEMPTS || '3'),
                circuitBreakerThreshold: parseInt(process.env.MCP_CIRCUIT_BREAKER_THRESHOLD || '5')
            },
            a2aEndpoint: {
                url: process.env.A2A_ENDPOINT || 'http://localhost:8081',
                timeout: parseInt(process.env.A2A_TIMEOUT || '15000'),
                retryAttempts: parseInt(process.env.A2A_RETRY_ATTEMPTS || '3'),
                circuitBreakerThreshold: parseInt(process.env.A2A_CIRCUIT_BREAKER_THRESHOLD || '5')
            },
            geminiConfig: {
                apiKey: process.env.GEMINI_API_KEY || '',
                model: process.env.GEMINI_MODEL || 'gemini-pro',
                endpoint: process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta',
                maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '2048'),
                temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
                rateLimitPerMinute: parseInt(process.env.GEMINI_RATE_LIMIT || '60')
            },
            capabilities: []
        };
        return config;
    }
    static validateConfig(config) {
        const errors = [];
        if (!config.id)
            errors.push('Agent ID is required');
        if (!config.name)
            errors.push('Agent name is required');
        if (!config.type)
            errors.push('Agent type is required');
        if (!config.geminiConfig.apiKey)
            errors.push('Gemini API key is required');
        return errors;
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=config-manager.js.map