/**
 * Configuration management for agents
 */

import { AgentConfig, AgentCapability } from '../../types';

export interface AgentConfigTemplate {
  name: string;
  description: string;
  defaultConfig: Partial<AgentConfig>;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
}

export class AgentConfigManager {
  private static readonly CONFIG_TEMPLATES: Record<string, AgentConfigTemplate> = {
    chatbot: {
      name: 'Chatbot Agent',
      description: 'AI-powered customer support chatbot',
      defaultConfig: {
        type: 'chatbot',
        capabilities: [
          {
            name: 'natural-language-processing',
            description: 'Process and understand natural language queries',
            inputSchema: { type: 'string', description: 'User message' },
            outputSchema: { type: 'string', description: 'Bot response' }
          },
          {
            name: 'conversation-management',
            description: 'Manage multi-turn conversations with context',
            inputSchema: { type: 'object', description: 'Conversation context' },
            outputSchema: { type: 'object', description: 'Updated context' }
          }
        ]
      },
      requiredEnvVars: ['GEMINI_API_KEY'],
      optionalEnvVars: ['CHATBOT_PERSONALITY', 'CHATBOT_LANGUAGE', 'CHATBOT_MAX_CONTEXT']
    },

    'fraud-detection': {
      name: 'Fraud Detection Agent',
      description: 'Real-time fraud detection and risk assessment',
      defaultConfig: {
        type: 'fraud-detection',
        capabilities: [
          {
            name: 'transaction-analysis',
            description: 'Analyze transactions for fraudulent patterns',
            inputSchema: { type: 'object', description: 'Transaction data' },
            outputSchema: { type: 'object', description: 'Analysis result' }
          },
          {
            name: 'risk-scoring',
            description: 'Calculate risk scores for activities',
            inputSchema: { type: 'object', description: 'Activity data' },
            outputSchema: { type: 'number', description: 'Risk score (0-1)' }
          }
        ]
      },
      requiredEnvVars: ['GEMINI_API_KEY'],
      optionalEnvVars: ['FRAUD_THRESHOLD', 'FRAUD_MODEL_VERSION', 'FRAUD_ALERT_WEBHOOK']
    },

    recommendation: {
      name: 'Recommendation Agent',
      description: 'Personalized product and service recommendations',
      defaultConfig: {
        type: 'recommendation',
        capabilities: [
          {
            name: 'collaborative-filtering',
            description: 'Generate recommendations using collaborative filtering',
            inputSchema: { type: 'object', description: 'User preferences' },
            outputSchema: { type: 'array', description: 'Recommended items' }
          },
          {
            name: 'personalization',
            description: 'Personalize recommendations for individual users',
            inputSchema: { type: 'object', description: 'User profile' },
            outputSchema: { type: 'array', description: 'Personalized recommendations' }
          }
        ]
      },
      requiredEnvVars: ['GEMINI_API_KEY'],
      optionalEnvVars: ['RECOMMENDATION_ALGORITHM', 'RECOMMENDATION_COUNT', 'RECOMMENDATION_CACHE_TTL']
    }
  };

  /**
   * Load agent configuration from environment variables
   */
  static loadFromEnvironment(agentType: string, agentId?: string): AgentConfig {
    const template = this.CONFIG_TEMPLATES[agentType];
    if (!template) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    // Check required environment variables
    const missingVars = template.requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    const config: AgentConfig = {
      id: agentId || process.env.AGENT_ID || `${agentType}-${Date.now()}`,
      name: process.env.AGENT_NAME || template.name,
      version: process.env.AGENT_VERSION || '1.0.0',
      environment: (process.env.NODE_ENV as any) || 'development',
      type: agentType as any,
      
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

      capabilities: template.defaultConfig.capabilities || []
    };

    return config;
  }

  /**
   * Create a configuration for development environment
   */
  static createDevelopmentConfig(
    agentType: string, 
    agentId: string,
    overrides: Partial<AgentConfig> = {}
  ): AgentConfig {
    const template = this.CONFIG_TEMPLATES[agentType];
    if (!template) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    const baseConfig: AgentConfig = {
      id: agentId,
      name: `Dev ${template.name}`,
      version: '1.0.0-dev',
      environment: 'development',
      type: agentType as any,
      
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

      capabilities: template.defaultConfig.capabilities || []
    };

    return { ...baseConfig, ...overrides };
  }

  /**
   * Create a configuration for production environment
   */
  static createProductionConfig(
    agentType: string,
    agentId: string,
    overrides: Partial<AgentConfig> = {}
  ): AgentConfig {
    const template = this.CONFIG_TEMPLATES[agentType];
    if (!template) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    const baseConfig: AgentConfig = {
      id: agentId,
      name: template.name,
      version: '1.0.0',
      environment: 'production',
      type: agentType as any,
      
      mcpEndpoint: {
        url: process.env.MCP_ENDPOINT || 'http://mcp-gateway:8080',
        timeout: 30000,
        retryAttempts: 5,
        circuitBreakerThreshold: 10
      },

      a2aEndpoint: {
        url: process.env.A2A_ENDPOINT || 'http://a2a-hub:8081',
        timeout: 15000,
        retryAttempts: 5,
        circuitBreakerThreshold: 10
      },

      geminiConfig: {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-pro',
        endpoint: process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta',
        maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '4096'),
        temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
        rateLimitPerMinute: parseInt(process.env.GEMINI_RATE_LIMIT || '300')
      },

      capabilities: template.defaultConfig.capabilities || []
    };

    return { ...baseConfig, ...overrides };
  }

  /**
   * Validate agent configuration
   */
  static validateConfig(config: AgentConfig): string[] {
    const errors: string[] = [];

    // Basic validation
    if (!config.id) errors.push('Agent ID is required');
    if (!config.name) errors.push('Agent name is required');
    if (!config.type) errors.push('Agent type is required');
    if (!config.version) errors.push('Agent version is required');

    // Type-specific validation
    const template = this.CONFIG_TEMPLATES[config.type];
    if (!template) {
      errors.push(`Unknown agent type: ${config.type}`);
      return errors;
    }

    // Environment validation
    if (!['development', 'staging', 'production'].includes(config.environment)) {
      errors.push('Invalid environment');
    }

    // Endpoint validation
    if (!config.mcpEndpoint?.url) errors.push('MCP endpoint URL is required');
    if (!config.a2aEndpoint?.url) errors.push('A2A endpoint URL is required');

    // Gemini configuration validation
    if (!config.geminiConfig?.apiKey) errors.push('Gemini API key is required');
    if (!config.geminiConfig?.model) errors.push('Gemini model is required');

    // Capabilities validation
    if (!config.capabilities || config.capabilities.length === 0) {
      errors.push('At least one capability is required');
    }

    return errors;
  }

  /**
   * Get configuration template for an agent type
   */
  static getTemplate(agentType: string): AgentConfigTemplate | undefined {
    return this.CONFIG_TEMPLATES[agentType];
  }

  /**
   * List all available agent types
   */
  static getAvailableTypes(): string[] {
    return Object.keys(this.CONFIG_TEMPLATES);
  }

  /**
   * Generate environment file template for an agent type
   */
  static generateEnvTemplate(agentType: string): string {
    const template = this.CONFIG_TEMPLATES[agentType];
    if (!template) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    const lines: string[] = [
      `# ${template.name} Configuration`,
      '',
      '# Agent Settings',
      'AGENT_ID=my-agent-001',
      `AGENT_NAME=${template.name}`,
      'AGENT_VERSION=1.0.0',
      'NODE_ENV=development',
      '',
      '# MCP Configuration',
      'MCP_ENDPOINT=http://localhost:8080',
      'MCP_TIMEOUT=30000',
      'MCP_RETRY_ATTEMPTS=3',
      'MCP_CIRCUIT_BREAKER_THRESHOLD=5',
      '',
      '# A2A Configuration',
      'A2A_ENDPOINT=http://localhost:8081',
      'A2A_TIMEOUT=15000',
      'A2A_RETRY_ATTEMPTS=3',
      'A2A_CIRCUIT_BREAKER_THRESHOLD=5',
      '',
      '# Gemini AI Configuration',
      'GEMINI_API_KEY=your-gemini-api-key-here',
      'GEMINI_MODEL=gemini-pro',
      'GEMINI_ENDPOINT=https://generativelanguage.googleapis.com/v1beta',
      'GEMINI_MAX_TOKENS=2048',
      'GEMINI_TEMPERATURE=0.7',
      'GEMINI_RATE_LIMIT=60'
    ];

    // Add required environment variables
    if (template.requiredEnvVars.length > 0) {
      lines.push('', '# Required Variables');
      template.requiredEnvVars.forEach(varName => {
        if (!lines.some(line => line.startsWith(`${varName}=`))) {
          lines.push(`${varName}=`);
        }
      });
    }

    // Add optional environment variables
    if (template.optionalEnvVars.length > 0) {
      lines.push('', '# Optional Variables');
      template.optionalEnvVars.forEach(varName => {
        lines.push(`# ${varName}=`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Merge configurations with precedence
   */
  static mergeConfigs(base: AgentConfig, override: Partial<AgentConfig>): AgentConfig {
    return {
      ...base,
      ...override,
      mcpEndpoint: {
        ...base.mcpEndpoint,
        ...override.mcpEndpoint
      },
      a2aEndpoint: {
        ...base.a2aEndpoint,
        ...override.a2aEndpoint
      },
      geminiConfig: {
        ...base.geminiConfig,
        ...override.geminiConfig
      },
      capabilities: override.capabilities || base.capabilities
    };
  }
}