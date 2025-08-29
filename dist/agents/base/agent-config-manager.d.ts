/**
 * Configuration management for agents
 */
import { AgentConfig } from '../../types';
export interface AgentConfigTemplate {
    name: string;
    description: string;
    defaultConfig: Partial<AgentConfig>;
    requiredEnvVars: string[];
    optionalEnvVars: string[];
}
export declare class AgentConfigManager {
    private static readonly CONFIG_TEMPLATES;
    /**
     * Load agent configuration from environment variables
     */
    static loadFromEnvironment(agentType: string, agentId?: string): AgentConfig;
    /**
     * Create a configuration for development environment
     */
    static createDevelopmentConfig(agentType: string, agentId: string, overrides?: Partial<AgentConfig>): AgentConfig;
    /**
     * Create a configuration for production environment
     */
    static createProductionConfig(agentType: string, agentId: string, overrides?: Partial<AgentConfig>): AgentConfig;
    /**
     * Validate agent configuration
     */
    static validateConfig(config: AgentConfig): string[];
    /**
     * Get configuration template for an agent type
     */
    static getTemplate(agentType: string): AgentConfigTemplate | undefined;
    /**
     * List all available agent types
     */
    static getAvailableTypes(): string[];
    /**
     * Generate environment file template for an agent type
     */
    static generateEnvTemplate(agentType: string): string;
    /**
     * Merge configurations with precedence
     */
    static mergeConfigs(base: AgentConfig, override: Partial<AgentConfig>): AgentConfig;
}
//# sourceMappingURL=agent-config-manager.d.ts.map