/**
 * Configuration management for MCP Gateway
 */
import { MCPConfig } from '../../types';
export declare class GatewayConfigManager {
    /**
     * Load gateway configuration from environment variables
     */
    static loadFromEnvironment(): MCPConfig;
    /**
     * Load configuration for a specific service
     */
    private static loadServiceConfig;
    /**
     * Load authentication credentials based on auth type
     */
    private static loadAuthCredentials;
    /**
     * Create a development configuration with mock services
     */
    static createDevelopmentConfig(): MCPConfig;
    /**
     * Create a production configuration template
     */
    static createProductionConfig(services: Array<{
        name: string;
        endpoint: string;
        authType: 'bearer' | 'api-key' | 'oauth2';
        credentials: Record<string, string>;
    }>): MCPConfig;
    /**
     * Validate gateway configuration
     */
    static validateConfig(config: MCPConfig): string[];
    /**
     * Validate individual service configuration
     */
    private static validateServiceConfig;
}
//# sourceMappingURL=gateway-config.d.ts.map