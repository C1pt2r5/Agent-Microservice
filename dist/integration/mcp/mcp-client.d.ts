/**
 * MCP client implementation
 */
import { MCPClient, MCPRequest, MCPResponse, MCPServiceDefinition, MCPConfig } from '../../types';
interface CircuitBreakerState {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
    lastFailureTime: Date | null;
    halfOpenAttempts: number;
}
export declare class MCPClientImpl implements MCPClient {
    private config;
    private httpClient;
    private authManager;
    private circuitBreakers;
    private rateLimiters;
    constructor(config: MCPConfig);
    request(request: MCPRequest): Promise<MCPResponse>;
    private executeRequest;
    private buildAuthHeaders;
    private isCircuitBreakerClosed;
    private recordFailure;
    private resetCircuitBreaker;
    private checkRateLimit;
    private calculateRetryDelay;
    private sleep;
    private createError;
    getServiceDefinition(serviceName: string): Promise<MCPServiceDefinition>;
    healthCheck(): Promise<boolean>;
    getCircuitBreakerState(serviceName: string): CircuitBreakerState | undefined;
    getRateLimitStatus(serviceName: string): {
        tokens: number;
        lastRefill: Date;
    } | undefined;
}
export {};
//# sourceMappingURL=mcp-client.d.ts.map