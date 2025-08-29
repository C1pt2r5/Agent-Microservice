/**
 * A2A message routing and delivery mechanisms
 */
import { EventEmitter } from 'events';
import { A2AMessage, A2ADeliveryReceipt, A2ASubscription, A2AAgentRegistration } from '../../types';
export interface RoutingRule {
    id: string;
    name: string;
    condition: (message: A2AMessage) => boolean;
    action: RoutingAction;
    priority: number;
    enabled: boolean;
}
export interface RoutingAction {
    type: 'forward' | 'transform' | 'filter' | 'duplicate' | 'delay';
    parameters: Record<string, any>;
}
export interface DeliveryOptions {
    maxRetries: number;
    retryDelay: number;
    timeout: number;
    persistMessage: boolean;
}
export declare class A2AMessageRouter extends EventEmitter {
    private agentRegistry;
    private subscriptions;
    private routingRules;
    private messageQueue;
    private deliveryOptions;
    constructor(deliveryOptions?: Partial<DeliveryOptions>);
    /**
     * Register an agent with the router
     */
    registerAgent(registration: A2AAgentRegistration): void;
    /**
     * Unregister an agent
     */
    unregisterAgent(agentId: string): void;
    /**
     * Add a subscription for an agent
     */
    addSubscription(agentId: string, subscription: A2ASubscription): void;
    /**
     * Remove a subscription for an agent
     */
    removeSubscription(agentId: string, topic: string): void;
    /**
     * Route a message to appropriate recipients
     */
    routeMessage(message: A2AMessage): Promise<A2ADeliveryReceipt[]>;
    /**
     * Apply routing rules to a message
     */
    private applyRoutingRules;
    /**
     * Execute a routing action
     */
    private executeRoutingAction;
    /**
     * Forward message to specific agents
     */
    private forwardMessage;
    /**
     * Transform message content
     */
    private transformMessage;
    /**
     * Filter message based on conditions
     */
    private filterMessage;
    /**
     * Duplicate message with modifications
     */
    private duplicateMessage;
    /**
     * Delay message delivery
     */
    private delayMessage;
    /**
     * Determine recipients for a message
     */
    private determineRecipients;
    /**
     * Deliver message to a specific agent
     */
    private deliverToAgent;
    /**
     * Add a routing rule
     */
    addRoutingRule(rule: RoutingRule): void;
    /**
     * Remove a routing rule
     */
    removeRoutingRule(ruleId: string): void;
    /**
     * Get queued messages for an agent
     */
    getQueuedMessages(agentId: string): A2AMessage[];
    /**
     * Clear message queue for an agent
     */
    clearMessageQueue(agentId: string): void;
    /**
     * Get routing statistics
     */
    getRoutingStats(): {
        totalAgents: number;
        totalSubscriptions: number;
        totalRules: number;
        queuedMessages: number;
    };
    /**
     * Helper method to get nested object values
     */
    private getNestedValue;
}
//# sourceMappingURL=message-router.d.ts.map