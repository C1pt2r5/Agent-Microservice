/**
 * Agent-to-Agent (A2A) communication protocol type definitions
 */
import { SystemError } from './common.types';
export interface A2AConfig {
    hubUrl: string;
    agentId: string;
    subscriptions: A2ASubscription[];
    messageRetention: number;
    maxRetries: number;
}
export interface A2ASubscription {
    topic: string;
    messageTypes: string[];
    priority: 'low' | 'normal' | 'high';
    handler: string;
}
export interface A2AMessage {
    id: string;
    timestamp: Date;
    sourceAgent: string;
    targetAgent?: string;
    topic: string;
    messageType: string;
    priority: 'low' | 'normal' | 'high';
    payload: Record<string, any>;
    metadata: A2AMessageMetadata;
}
export interface A2AMessageMetadata {
    correlationId: string;
    ttl: number;
    retryCount: number;
    deliveryAttempts: number;
    routingKey?: string;
    replyTo?: string;
}
export interface A2ADeliveryReceipt {
    messageId: string;
    timestamp: Date;
    status: 'delivered' | 'failed' | 'expired';
    targetAgent: string;
    error?: SystemError;
}
export interface A2AMessageHandler {
    messageType: string;
    handle(message: A2AMessage): Promise<A2AMessageResponse>;
}
export interface A2AMessageResponse {
    success: boolean;
    responsePayload?: Record<string, any>;
    error?: SystemError;
    forwardTo?: string[];
}
export interface A2ATopicDefinition {
    name: string;
    description: string;
    messageTypes: A2AMessageType[];
    retentionPolicy: A2ARetentionPolicy;
}
export interface A2AMessageType {
    name: string;
    description: string;
    schema: Record<string, any>;
    priority: 'low' | 'normal' | 'high';
}
export interface A2ARetentionPolicy {
    maxMessages: number;
    maxAge: number;
    compressionEnabled: boolean;
}
export interface A2AAgentRegistration {
    agentId: string;
    agentType: string;
    capabilities: string[];
    subscriptions: A2ASubscription[];
    endpoint: string;
    heartbeatInterval: number;
}
export interface A2AClient {
    publish(message: A2AMessage): Promise<A2ADeliveryReceipt>;
    subscribe(subscription: A2ASubscription): Promise<void>;
    unsubscribe(topic: string): Promise<void>;
    registerAgent(registration: A2AAgentRegistration): Promise<void>;
    getTopicDefinition(topicName: string): Promise<A2ATopicDefinition>;
    healthCheck(): Promise<boolean>;
}
export declare const A2A_MESSAGE_TYPES: {
    readonly FRAUD_ALERT: "fraud.alert";
    readonly FRAUD_RISK_SCORE: "fraud.risk_score";
    readonly RECOMMENDATION_REQUEST: "recommendation.request";
    readonly RECOMMENDATION_RESPONSE: "recommendation.response";
    readonly CHAT_CONTEXT_UPDATE: "chat.context_update";
    readonly AGENT_STATUS_UPDATE: "agent.status_update";
    readonly SYSTEM_ALERT: "system.alert";
};
export declare const A2A_TOPICS: {
    readonly FRAUD_DETECTION: "fraud-detection";
    readonly RECOMMENDATIONS: "recommendations";
    readonly CHAT_SUPPORT: "chat-support";
    readonly SYSTEM_EVENTS: "system-events";
};
//# sourceMappingURL=a2a.types.d.ts.map