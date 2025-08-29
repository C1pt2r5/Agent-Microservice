/**
 * Chatbot Service with REST API and WebSocket interfaces
 */
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { AgentConfig } from '../../types';
export interface ChatbotServiceConfig extends AgentConfig {
    server: {
        port: number;
        host: string;
        cors: {
            enabled: boolean;
            origins: string[];
        };
    };
    websocket: {
        enabled: boolean;
        path: string;
        heartbeatInterval: number;
    };
    api: {
        rateLimit: {
            windowMs: number;
            maxRequests: number;
        };
        authentication: {
            enabled: boolean;
            apiKeyHeader: string;
        };
    };
    monitoring: {
        metricsEnabled: boolean;
        loggingLevel: 'debug' | 'info' | 'warn' | 'error';
    };
}
export interface WebSocketClient {
    id: string;
    userId: string;
    sessionId: string;
    socket: WebSocket;
    lastActivity: Date;
    metadata: Record<string, any>;
}
export interface ServiceMetrics {
    activeConnections: number;
    totalRequests: number;
    totalMessages: number;
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
}
export declare class ChatbotService extends EventEmitter {
    private agent;
    private config;
    private app;
    private server;
    private wss?;
    private wsClients;
    private isRunning;
    private startTime;
    private metrics;
    private rateLimitMap;
    constructor(config: ChatbotServiceConfig);
    /**
     * Initialize and start the chatbot service
     */
    initialize(): Promise<void>;
    /**
     * Shutdown the service gracefully
     */
    shutdown(): Promise<void>;
    /**
     * Get service health status
     */
    getHealthStatus(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        metrics: ServiceMetrics;
        agentHealth: boolean;
        activeConnections: number;
    };
    private setupExpress;
    private setupRoutes;
    private setupWebSocket;
    private handleWebSocketConnection;
    private handleWebSocketMessage;
    private processWebSocketChat;
    private sendWebSocketMessage;
    private setupHeartbeat;
    private handleChatMessage;
    private getSession;
    private endSession;
    private createSession;
    private listSessions;
    private getStatistics;
    private getMetrics;
    private authenticateRequest;
    private rateLimitMiddleware;
    private setupA2ASubscriptions;
    private handleA2AMessage;
    private handleFraudAlert;
    private handleRiskAssessment;
    private startBackgroundTasks;
    private startServer;
    private updateMetrics;
    private updateServiceMetrics;
    private setupEventListeners;
}
//# sourceMappingURL=chatbot-service.d.ts.map