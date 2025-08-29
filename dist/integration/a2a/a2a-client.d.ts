/**
 * A2A client implementation
 */
import { EventEmitter } from 'events';
import { A2AClient, A2AMessage, A2ADeliveryReceipt, A2ASubscription, A2AAgentRegistration, A2ATopicDefinition, A2AConfig, A2AMessageHandler } from '../../types';
export declare class A2AClientImpl extends EventEmitter implements A2AClient {
    private config;
    private httpClient;
    private wsClient;
    private messageValidator;
    private messageSerializer;
    private messageHandlers;
    private subscriptions;
    private isConnected;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectInterval;
    constructor(config: A2AConfig);
    private setupWebSocketConnection;
    private attemptReconnection;
    private reestablishSubscriptions;
    private handleIncomingMessage;
    publish(message: A2AMessage): Promise<A2ADeliveryReceipt>;
    private publishViaWebSocket;
    private publishViaHttp;
    subscribe(subscription: A2ASubscription): Promise<void>;
    unsubscribe(topic: string): Promise<void>;
    registerAgent(registration: A2AAgentRegistration): Promise<void>;
    getTopicDefinition(topicName: string): Promise<A2ATopicDefinition>;
    healthCheck(): Promise<boolean>;
    registerMessageHandler(handler: A2AMessageHandler): void;
    unregisterMessageHandler(messageType: string): void;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getConfig(): A2AConfig;
    getSubscriptions(): A2ASubscription[];
    getMessageHandlers(): string[];
    isClientConnected(): boolean;
}
//# sourceMappingURL=a2a-client.d.ts.map