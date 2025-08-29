/**
 * MCP gateway service implementation
 */
import { Express } from 'express';
import { AxiosInstance } from 'axios';
import { MCPConfig, MCPServiceConfig } from '../../types';
interface ServiceRegistry {
    [serviceName: string]: {
        config: MCPServiceConfig;
        client: AxiosInstance;
        circuitBreaker: CircuitBreakerState;
        rateLimiter: RateLimiterState;
    };
}
interface CircuitBreakerState {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
    lastFailureTime: Date | null;
    halfOpenAttempts: number;
}
interface RateLimiterState {
    tokens: number;
    lastRefill: Date;
    requestQueue: Array<{
        resolve: (value: any) => void;
        reject: (reason: any) => void;
        timestamp: Date;
    }>;
}
export declare class MCPGateway {
    private app;
    private config;
    private authManager;
    private serviceRegistry;
    private isRunning;
    constructor(config: MCPConfig);
    private setupMiddleware;
    private setupRoutes;
    private initializeServices;
    private handleMCPRequest;
    private isCircuitBreakerClosed;
    private recordFailure;
    private resetCircuitBreaker;
    private applyRateLimit;
    private processRateLimitQueue;
    private getServiceHealth;
    private getServiceDefinition;
    start(port?: number): Promise<void>;
    getServiceRegistry(): ServiceRegistry;
    getApp(): Express;
}
export {};
//# sourceMappingURL=mcp-gateway.d.ts.map