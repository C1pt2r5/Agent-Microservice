/**
 * Enhanced factory for creating different types of agents with dependency injection
 */
import { AgentConfig, BaseAgent } from '../../types';
import { AgentDependencies } from './base-agent';
export interface AgentFactoryOptions {
    dependencies?: AgentDependencies;
    autoInitialize?: boolean;
    validateConfig?: boolean;
}
export declare class AgentFactory {
    /**
     * Create an agent with the specified configuration and options
     */
    static createAgent(config: AgentConfig, options?: AgentFactoryOptions): Promise<BaseAgent>;
    /**
     * Create a development agent with default configuration
     */
    static createDevelopmentAgent(agentId: string, agentType: 'chatbot' | 'fraud-detection' | 'recommendation'): Promise<BaseAgent>;
    /**
     * Create a production agent with environment-based configuration
     */
    static createProductionAgent(agentId: string, agentType: 'chatbot' | 'fraud-detection' | 'recommendation'): Promise<BaseAgent>;
    /**
     * Validate agent configuration
     */
    static validateConfig(config: AgentConfig): string[];
    /**
     * Resolve dependencies for an agent
     */
    private static resolveDependencies;
    /**
     * Get default capabilities for an agent type
     */
    private static getDefaultCapabilities;
    /**
     * Create multiple agents from a configuration array
     */
    static createAgentCluster(configs: AgentConfig[], options?: AgentFactoryOptions): Promise<BaseAgent[]>;
    /**
     * Shutdown multiple agents gracefully
     */
    static shutdownAgentCluster(agents: BaseAgent[]): Promise<void>;
}
//# sourceMappingURL=agent-factory.d.ts.map