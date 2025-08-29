/**
 * Enhanced base agent implementation with comprehensive functionality
 */
import { EventEmitter } from 'events';
import { BaseAgent, AgentConfig, AgentRequest, AgentResponse, SystemError } from '../../types';
import { MCPClientImpl } from '../../integration/mcp/mcp-client';
import { A2AClientImpl } from '../../integration/a2a/a2a-client';
import { EnhancedGeminiClient } from '../../integration/gemini/enhanced-gemini-client';
export interface AgentDependencies {
    mcpClient?: MCPClientImpl;
    a2aClient?: A2AClientImpl;
    geminiClient?: EnhancedGeminiClient;
}
export declare class ConcreteBaseAgent extends BaseAgent {
    protected eventEmitter: EventEmitter;
    protected mcpClient?: MCPClientImpl;
    protected a2aClient?: A2AClientImpl;
    protected geminiClient?: EnhancedGeminiClient;
    protected isInitialized: boolean;
    protected heartbeatInterval?: NodeJS.Timeout;
    protected metricsInterval?: NodeJS.Timeout;
    constructor(config: AgentConfig, dependencies?: AgentDependencies);
    initialize(): Promise<void>;
    processRequest(request: AgentRequest): Promise<AgentResponse>;
    protected handleRequest(request: AgentRequest): Promise<AgentResponse>;
    shutdown(): Promise<void>;
    protected performCleanup(): Promise<void>;
    protected validateRequest(request: AgentRequest): void;
    protected setupEventListeners(): void;
    protected registerWithA2AHub(): Promise<void>;
    protected startHeartbeat(): void;
    protected startMetricsCollection(): void;
    protected updateHeartbeat(): void;
    protected updateResponseTimeMetrics(processingTime: number): void;
    protected updateErrorMetrics(): void;
    protected updateSystemMetrics(): void;
    protected logError(error: SystemError): void;
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    sendA2AMessage(topic: string, messageType: string, payload: any, targetAgent?: string): Promise<void>;
    queryMCP(service: string, operation: string, parameters: any): Promise<any>;
    getHealthStatus(): {
        status: string;
        uptime: number;
        metrics: any;
        lastError?: SystemError;
    };
    isAgentHealthy(): boolean;
}
//# sourceMappingURL=base-agent.d.ts.map