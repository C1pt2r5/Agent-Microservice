/**
 * Factory for creating MCP clients with different configurations
 */
import { MCPConfig, MCPClient, AuthConfig } from '../../types';
export declare class MCPClientFactory {
    /**
     * Create an MCP client with the provided configuration
     */
    static createClient(config: MCPConfig): MCPClient;
    /**
     * Create an MCP client with default configuration for development
     */
    static createDevelopmentClient(gatewayUrl?: string): MCPClient;
    /**
     * Create an MCP client configured for production use
     */
    static createProductionClient(gatewayUrl: string, services: Record<string, {
        endpoint: string;
        auth: AuthConfig;
    }>): MCPClient;
    /**
     * Create an MCP client for testing with mock services
     */
    static createTestClient(mockGatewayUrl?: string): MCPClient;
    /**
     * Validate MCP configuration
     */
    static validateConfig(config: MCPConfig): string[];
}
//# sourceMappingURL=mcp-client-factory.d.ts.map