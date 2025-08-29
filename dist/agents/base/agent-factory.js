"use strict";
/**
 * Enhanced factory for creating different types of agents with dependency injection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentFactory = void 0;
const base_agent_1 = require("./base-agent");
const mcp_client_factory_1 = require("../../integration/mcp/mcp-client-factory");
const a2a_client_1 = require("../../integration/a2a/a2a-client");
const enhanced_gemini_client_1 = require("../../integration/gemini/enhanced-gemini-client");
class AgentFactory {
    /**
     * Create an agent with the specified configuration and options
     */
    static async createAgent(config, options = {}) {
        const { dependencies, autoInitialize = false, validateConfig = true } = options;
        // Validate configuration if requested
        if (validateConfig) {
            const validationErrors = this.validateConfig(config);
            if (validationErrors.length > 0) {
                throw new Error(`Invalid agent configuration: ${validationErrors.join(', ')}`);
            }
        }
        // Create dependencies if not provided
        const resolvedDependencies = await this.resolveDependencies(config, dependencies);
        // Create agent based on type
        let agent;
        switch (config.type) {
            case 'chatbot':
                // Will use specific chatbot agent when implemented
                agent = new base_agent_1.ConcreteBaseAgent(config, resolvedDependencies);
                break;
            case 'fraud-detection':
                // Will use specific fraud detection agent when implemented
                agent = new base_agent_1.ConcreteBaseAgent(config, resolvedDependencies);
                break;
            case 'recommendation':
                // Will use specific recommendation agent when implemented
                agent = new base_agent_1.ConcreteBaseAgent(config, resolvedDependencies);
                break;
            default:
                throw new Error(`Unknown agent type: ${config.type}`);
        }
        // Auto-initialize if requested
        if (autoInitialize) {
            await agent.initialize();
        }
        return agent;
    }
    /**
     * Create a development agent with default configuration
     */
    static async createDevelopmentAgent(agentId, agentType) {
        const config = {
            id: agentId,
            name: `Development ${agentType} Agent`,
            version: '1.0.0',
            environment: 'development',
            type: agentType,
            mcpEndpoint: {
                url: 'http://localhost:8080',
                timeout: 30000,
                retryAttempts: 3,
                circuitBreakerThreshold: 5
            },
            a2aEndpoint: {
                url: 'http://localhost:8081',
                timeout: 15000,
                retryAttempts: 3,
                circuitBreakerThreshold: 5
            },
            geminiConfig: {
                apiKey: process.env.GEMINI_API_KEY || 'dev-key',
                model: 'gemini-pro',
                endpoint: 'https://generativelanguage.googleapis.com/v1beta',
                maxTokens: 2048,
                temperature: 0.7,
                rateLimitPerMinute: 60
            },
            capabilities: this.getDefaultCapabilities(agentType)
        };
        return this.createAgent(config, { autoInitialize: true });
    }
    /**
     * Create a production agent with environment-based configuration
     */
    static async createProductionAgent(agentId, agentType) {
        const config = {
            id: agentId,
            name: process.env.AGENT_NAME || `${agentType} Agent`,
            version: process.env.AGENT_VERSION || '1.0.0',
            environment: 'production',
            type: agentType,
            mcpEndpoint: {
                url: process.env.MCP_ENDPOINT || 'http://mcp-gateway:8080',
                timeout: parseInt(process.env.MCP_TIMEOUT || '30000'),
                retryAttempts: parseInt(process.env.MCP_RETRY_ATTEMPTS || '5'),
                circuitBreakerThreshold: parseInt(process.env.MCP_CIRCUIT_BREAKER_THRESHOLD || '10')
            },
            a2aEndpoint: {
                url: process.env.A2A_ENDPOINT || 'http://a2a-hub:8081',
                timeout: parseInt(process.env.A2A_TIMEOUT || '15000'),
                retryAttempts: parseInt(process.env.A2A_RETRY_ATTEMPTS || '5'),
                circuitBreakerThreshold: parseInt(process.env.A2A_CIRCUIT_BREAKER_THRESHOLD || '10')
            },
            geminiConfig: {
                apiKey: process.env.GEMINI_API_KEY || '',
                model: process.env.GEMINI_MODEL || 'gemini-pro',
                endpoint: process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta',
                maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '4096'),
                temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
                rateLimitPerMinute: parseInt(process.env.GEMINI_RATE_LIMIT || '300')
            },
            capabilities: this.getDefaultCapabilities(agentType)
        };
        return this.createAgent(config, { autoInitialize: true });
    }
    /**
     * Validate agent configuration
     */
    static validateConfig(config) {
        const errors = [];
        // Required fields
        if (!config.id)
            errors.push('Agent ID is required');
        if (!config.name)
            errors.push('Agent name is required');
        if (!config.type)
            errors.push('Agent type is required');
        if (!config.version)
            errors.push('Agent version is required');
        if (!config.environment)
            errors.push('Agent environment is required');
        // Agent type validation
        if (config.type && !['chatbot', 'fraud-detection', 'recommendation'].includes(config.type)) {
            errors.push('Invalid agent type');
        }
        // Environment validation
        if (config.environment && !['development', 'staging', 'production'].includes(config.environment)) {
            errors.push('Invalid environment');
        }
        // MCP endpoint validation
        if (config.mcpEndpoint) {
            if (!config.mcpEndpoint.url)
                errors.push('MCP endpoint URL is required');
            if (config.mcpEndpoint.timeout <= 0)
                errors.push('MCP timeout must be positive');
            if (config.mcpEndpoint.retryAttempts < 0)
                errors.push('MCP retry attempts must be non-negative');
        }
        // A2A endpoint validation
        if (config.a2aEndpoint) {
            if (!config.a2aEndpoint.url)
                errors.push('A2A endpoint URL is required');
            if (config.a2aEndpoint.timeout <= 0)
                errors.push('A2A timeout must be positive');
            if (config.a2aEndpoint.retryAttempts < 0)
                errors.push('A2A retry attempts must be non-negative');
        }
        // Gemini configuration validation
        if (config.geminiConfig) {
            if (!config.geminiConfig.apiKey)
                errors.push('Gemini API key is required');
            if (!config.geminiConfig.model)
                errors.push('Gemini model is required');
            if (!config.geminiConfig.endpoint)
                errors.push('Gemini endpoint is required');
            if (config.geminiConfig.maxTokens <= 0)
                errors.push('Gemini max tokens must be positive');
            if (config.geminiConfig.temperature < 0 || config.geminiConfig.temperature > 2) {
                errors.push('Gemini temperature must be between 0 and 2');
            }
            if (config.geminiConfig.rateLimitPerMinute <= 0)
                errors.push('Gemini rate limit must be positive');
        }
        // Capabilities validation
        if (config.capabilities) {
            config.capabilities.forEach((capability, index) => {
                if (!capability.name)
                    errors.push(`Capability ${index}: name is required`);
                if (!capability.description)
                    errors.push(`Capability ${index}: description is required`);
            });
        }
        return errors;
    }
    /**
     * Resolve dependencies for an agent
     */
    static async resolveDependencies(config, providedDependencies) {
        const dependencies = {};
        // Use provided dependencies or create new ones
        if (providedDependencies?.mcpClient) {
            dependencies.mcpClient = providedDependencies.mcpClient;
        }
        else if (config.mcpEndpoint) {
            dependencies.mcpClient = mcp_client_factory_1.MCPClientFactory.createDevelopmentClient(config.mcpEndpoint.url);
        }
        if (providedDependencies?.a2aClient) {
            dependencies.a2aClient = providedDependencies.a2aClient;
        }
        else if (config.a2aEndpoint) {
            const a2aConfig = {
                hubUrl: config.a2aEndpoint.url,
                agentId: config.id,
                subscriptions: [],
                messageRetention: 86400000,
                maxRetries: config.a2aEndpoint.retryAttempts
            };
            dependencies.a2aClient = new a2a_client_1.A2AClientImpl(a2aConfig);
        }
        if (providedDependencies?.geminiClient) {
            dependencies.geminiClient = providedDependencies.geminiClient;
        }
        else if (config.geminiConfig) {
            dependencies.geminiClient = new enhanced_gemini_client_1.EnhancedGeminiClient(config.geminiConfig);
        }
        return dependencies;
    }
    /**
     * Get default capabilities for an agent type
     */
    static getDefaultCapabilities(agentType) {
        switch (agentType) {
            case 'chatbot':
                return [
                    {
                        name: 'natural-language-processing',
                        description: 'Process and understand natural language queries',
                        inputSchema: { type: 'string' },
                        outputSchema: { type: 'string' }
                    },
                    {
                        name: 'conversation-management',
                        description: 'Manage multi-turn conversations with context',
                        inputSchema: { type: 'object' },
                        outputSchema: { type: 'object' }
                    },
                    {
                        name: 'customer-support',
                        description: 'Provide customer support and assistance',
                        inputSchema: { type: 'object' },
                        outputSchema: { type: 'object' }
                    }
                ];
            case 'fraud-detection':
                return [
                    {
                        name: 'transaction-analysis',
                        description: 'Analyze transactions for fraudulent patterns',
                        inputSchema: { type: 'object' },
                        outputSchema: { type: 'object' }
                    },
                    {
                        name: 'risk-scoring',
                        description: 'Calculate risk scores for activities',
                        inputSchema: { type: 'object' },
                        outputSchema: { type: 'number' }
                    },
                    {
                        name: 'anomaly-detection',
                        description: 'Detect anomalous behavior patterns',
                        inputSchema: { type: 'object' },
                        outputSchema: { type: 'object' }
                    }
                ];
            case 'recommendation':
                return [
                    {
                        name: 'recommendation-engine',
                        description: 'Generate recommendations using collaborative filtering',
                        inputSchema: { type: 'object' },
                        outputSchema: { type: 'array' }
                    },
                    {
                        name: 'content-based-recommendation',
                        description: 'Generate recommendations based on content similarity',
                        inputSchema: { type: 'object' },
                        outputSchema: { type: 'array' }
                    },
                    {
                        name: 'personalized-recommendation',
                        description: 'Personalize recommendations for individual users',
                        inputSchema: { type: 'object' },
                        outputSchema: { type: 'array' }
                    }
                ];
            default:
                return [];
        }
    }
    /**
     * Create multiple agents from a configuration array
     */
    static async createAgentCluster(configs, options = {}) {
        const agents = [];
        for (const config of configs) {
            try {
                const agent = await this.createAgent(config, options);
                agents.push(agent);
            }
            catch (error) {
                console.error(`Failed to create agent ${config.id}:`, error);
                // Continue creating other agents
            }
        }
        return agents;
    }
    /**
     * Shutdown multiple agents gracefully
     */
    static async shutdownAgentCluster(agents) {
        const shutdownPromises = agents.map(agent => agent.shutdown().catch(error => console.error(`Error shutting down agent ${agent.getConfig().id}:`, error)));
        await Promise.allSettled(shutdownPromises);
    }
}
exports.AgentFactory = AgentFactory;
//# sourceMappingURL=agent-factory.js.map