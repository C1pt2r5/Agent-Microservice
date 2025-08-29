/**
 * A2A communication hub implementation
 */
import { EventEmitter } from 'events';
import { A2ATopicDefinition } from '../../types';
interface HubConfig {
    port: number;
    maxConnections: number;
    heartbeatInterval: number;
    messageRetention: number;
    enablePersistence: boolean;
    enableMetrics: boolean;
}
export declare class A2AHub extends EventEmitter {
    private app;
    private server;
    private wsServer;
    private config;
    private messageValidator;
    private messageSerializer;
    private messageRouter;
    private connectedAgents;
    private topics;
    private messageHistory;
    private deliveryReceipts;
    private isRunning;
    private heartbeatTimer;
    private cleanupTimer;
    constructor(config?: Partial<HubConfig>);
    private setupMiddleware;
    private setupRoutes;
    private setupWebSocketHandlers;
    private setupMessageRouterHandlers;
    private initializeDefaultTopics;
    private handleWebSocketMessage;
    private sendWebSocketError;
    private registerAgent;
    private unregisterAgent;
    private addSubscription;
    private removeSubscription;
    private publishMessage;
    private storeMessageInHistory;
    private deliverQueuedMessages;
    private deliverMessageToAgent;
    private handleAgentDisconnection;
    private createTopic;
    private startHeartbeatMonitoring;
    private startCleanupTasks;
    private getHubStatistics;
    start(): Promise<void>;
    stop(): Promise<void>;
    getConnectedAgents(): string[];
    getTopics(): A2ATopicDefinition[];
    getConfig(): HubConfig;
    isHubRunning(): boolean;
}
export {};
//# sourceMappingURL=a2a-hub.d.ts.map