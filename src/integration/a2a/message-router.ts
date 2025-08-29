/**
 * A2A message routing and delivery mechanisms
 */

import { EventEmitter } from 'events';
import { 
  A2AMessage, 
  A2ADeliveryReceipt, 
  A2ASubscription,
  A2AAgentRegistration,
  SystemError 
} from '../../types';

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

export class A2AMessageRouter extends EventEmitter {
  private agentRegistry: Map<string, A2AAgentRegistration> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // topic -> Set<agentId>
  private routingRules: RoutingRule[] = [];
  private messageQueue: Map<string, A2AMessage[]> = new Map(); // agentId -> messages
  private deliveryOptions: DeliveryOptions;

  constructor(deliveryOptions: Partial<DeliveryOptions> = {}) {
    super();
    this.deliveryOptions = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      persistMessage: true,
      ...deliveryOptions
    };
  }

  /**
   * Register an agent with the router
   */
  registerAgent(registration: A2AAgentRegistration): void {
    this.agentRegistry.set(registration.agentId, registration);

    // Register subscriptions
    registration.subscriptions.forEach(subscription => {
      this.addSubscription(registration.agentId, subscription);
    });

    this.emit('agentRegistered', registration);
    console.log(`Agent registered: ${registration.agentId}`);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    const registration = this.agentRegistry.get(agentId);
    if (!registration) {
      return;
    }

    // Remove subscriptions
    registration.subscriptions.forEach(subscription => {
      this.removeSubscription(agentId, subscription.topic);
    });

    this.agentRegistry.delete(agentId);
    this.messageQueue.delete(agentId);

    this.emit('agentUnregistered', { agentId, registration });
    console.log(`Agent unregistered: ${agentId}`);
  }

  /**
   * Add a subscription for an agent
   */
  addSubscription(agentId: string, subscription: A2ASubscription): void {
    if (!this.subscriptions.has(subscription.topic)) {
      this.subscriptions.set(subscription.topic, new Set());
    }

    this.subscriptions.get(subscription.topic)!.add(agentId);
    this.emit('subscriptionAdded', { agentId, subscription });
    console.log(`Subscription added: ${agentId} -> ${subscription.topic}`);
  }

  /**
   * Remove a subscription for an agent
   */
  removeSubscription(agentId: string, topic: string): void {
    const subscribers = this.subscriptions.get(topic);
    if (subscribers) {
      subscribers.delete(agentId);
      if (subscribers.size === 0) {
        this.subscriptions.delete(topic);
      }
    }

    this.emit('subscriptionRemoved', { agentId, topic });
    console.log(`Subscription removed: ${agentId} -> ${topic}`);
  }

  /**
   * Route a message to appropriate recipients
   */
  async routeMessage(message: A2AMessage): Promise<A2ADeliveryReceipt[]> {
    try {
      // Apply routing rules
      const processedMessage = await this.applyRoutingRules(message);
      if (!processedMessage) {
        // Message was filtered out
        return [{
          messageId: message.id,
          timestamp: new Date(),
          status: 'delivered',
          targetAgent: 'filtered'
        }];
      }

      // Determine recipients
      const recipients = this.determineRecipients(processedMessage);
      
      if (recipients.length === 0) {
        console.warn(`No recipients found for message ${message.id} on topic ${message.topic}`);
        return [{
          messageId: message.id,
          timestamp: new Date(),
          status: 'failed',
          targetAgent: 'none',
          error: {
            code: 'A2A_ERROR',
            message: 'No recipients found',
            timestamp: new Date()
          }
        }];
      }

      // Deliver to recipients
      const deliveryPromises = recipients.map(agentId => 
        this.deliverToAgent(processedMessage, agentId)
      );

      const receipts = await Promise.allSettled(deliveryPromises);
      
      return receipts.map((result, index) => {
        const agentId = recipients[index];
        
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            messageId: message.id,
            timestamp: new Date(),
            status: 'failed' as const,
            targetAgent: agentId,
            error: {
              code: 'A2A_ERROR',
              message: result.reason instanceof Error ? result.reason.message : 'Delivery failed',
              timestamp: new Date()
            }
          };
        }
      });

    } catch (error) {
      const receipt: A2ADeliveryReceipt = {
        messageId: message.id,
        timestamp: new Date(),
        status: 'failed',
        targetAgent: 'unknown',
        error: {
          code: 'A2A_ERROR',
          message: error instanceof Error ? error.message : 'Routing failed',
          timestamp: new Date()
        }
      };

      this.emit('routingError', { message, error, receipt });
      return [receipt];
    }
  }

  /**
   * Apply routing rules to a message
   */
  private async applyRoutingRules(message: A2AMessage): Promise<A2AMessage | null> {
    let processedMessage = { ...message };

    // Sort rules by priority (higher priority first)
    const sortedRules = this.routingRules
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      try {
        if (rule.condition(processedMessage)) {
          const result = await this.executeRoutingAction(processedMessage, rule.action);
          
          if (result === null) {
            // Message was filtered out
            this.emit('messageFiltered', { message: processedMessage, rule });
            return null;
          }
          
          processedMessage = result;
          this.emit('ruleApplied', { message: processedMessage, rule });
        }
      } catch (error) {
        console.error(`Error applying routing rule ${rule.id}:`, error);
        this.emit('ruleError', { message: processedMessage, rule, error });
      }
    }

    return processedMessage;
  }

  /**
   * Execute a routing action
   */
  private async executeRoutingAction(message: A2AMessage, action: RoutingAction): Promise<A2AMessage | null> {
    switch (action.type) {
      case 'forward':
        return this.forwardMessage(message, action.parameters);
      
      case 'transform':
        return this.transformMessage(message, action.parameters);
      
      case 'filter':
        return this.filterMessage(message, action.parameters);
      
      case 'duplicate':
        return this.duplicateMessage(message, action.parameters);
      
      case 'delay':
        return this.delayMessage(message, action.parameters);
      
      default:
        console.warn(`Unknown routing action type: ${action.type}`);
        return message;
    }
  }

  /**
   * Forward message to specific agents
   */
  private forwardMessage(message: A2AMessage, parameters: Record<string, any>): A2AMessage {
    const { targetAgents } = parameters;
    
    if (Array.isArray(targetAgents)) {
      // Create copies for each target agent
      targetAgents.forEach((agentId: string) => {
        const forwardedMessage: A2AMessage = {
          ...message,
          id: `${message.id}_forward_${agentId}`,
          targetAgent: agentId,
          timestamp: new Date()
        };
        
        this.deliverToAgent(forwardedMessage, agentId);
      });
    }

    return message;
  }

  /**
   * Transform message content
   */
  private transformMessage(message: A2AMessage, parameters: Record<string, any>): A2AMessage {
    const { transformations } = parameters;
    let transformedMessage = { ...message };

    if (transformations) {
      // Apply payload transformations
      if (transformations.payload) {
        transformedMessage.payload = {
          ...transformedMessage.payload,
          ...transformations.payload
        };
      }

      // Apply metadata transformations
      if (transformations.metadata) {
        transformedMessage.metadata = {
          ...transformedMessage.metadata,
          ...transformations.metadata
        };
      }

      // Change message type if specified
      if (transformations.messageType) {
        transformedMessage.messageType = transformations.messageType;
      }

      // Change priority if specified
      if (transformations.priority) {
        transformedMessage.priority = transformations.priority;
      }
    }

    return transformedMessage;
  }

  /**
   * Filter message based on conditions
   */
  private filterMessage(message: A2AMessage, parameters: Record<string, any>): A2AMessage | null {
    const { condition } = parameters;

    if (condition) {
      // Simple condition evaluation (in production, use a proper expression evaluator)
      if (condition.field && condition.operator && condition.value !== undefined) {
        const fieldValue = this.getNestedValue(message, condition.field);
        
        switch (condition.operator) {
          case 'equals':
            return fieldValue === condition.value ? message : null;
          case 'not_equals':
            return fieldValue !== condition.value ? message : null;
          case 'contains':
            return String(fieldValue).includes(condition.value) ? message : null;
          case 'greater_than':
            return fieldValue > condition.value ? message : null;
          case 'less_than':
            return fieldValue < condition.value ? message : null;
          default:
            return message;
        }
      }
    }

    return message;
  }

  /**
   * Duplicate message with modifications
   */
  private duplicateMessage(message: A2AMessage, parameters: Record<string, any>): A2AMessage {
    const { count = 1, modifications = {} } = parameters;

    for (let i = 0; i < count; i++) {
      const duplicatedMessage: A2AMessage = {
        ...message,
        id: `${message.id}_dup_${i}`,
        timestamp: new Date(),
        ...modifications
      };

      // Route the duplicated message
      this.routeMessage(duplicatedMessage);
    }

    return message;
  }

  /**
   * Delay message delivery
   */
  private async delayMessage(message: A2AMessage, parameters: Record<string, any>): Promise<A2AMessage> {
    const { delay = 0 } = parameters;

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return message;
  }

  /**
   * Determine recipients for a message
   */
  private determineRecipients(message: A2AMessage): string[] {
    // If message has a specific target agent, use that
    if (message.targetAgent) {
      return [message.targetAgent];
    }

    // Otherwise, find all subscribers to the topic
    const subscribers = this.subscriptions.get(message.topic);
    if (!subscribers) {
      return [];
    }

    // Filter subscribers based on message type preferences
    const recipients: string[] = [];
    
    for (const agentId of subscribers) {
      const registration = this.agentRegistry.get(agentId);
      if (!registration) {
        continue;
      }

      // Check if agent is interested in this message type
      const subscription = registration.subscriptions.find(sub => sub.topic === message.topic);
      if (subscription && 
          (subscription.messageTypes.length === 0 || 
           subscription.messageTypes.includes(message.messageType))) {
        recipients.push(agentId);
      }
    }

    return recipients;
  }

  /**
   * Deliver message to a specific agent
   */
  private async deliverToAgent(message: A2AMessage, agentId: string): Promise<A2ADeliveryReceipt> {
    try {
      // Check if agent is registered
      const registration = this.agentRegistry.get(agentId);
      if (!registration) {
        throw new Error(`Agent ${agentId} not registered`);
      }

      // Queue message for delivery
      if (!this.messageQueue.has(agentId)) {
        this.messageQueue.set(agentId, []);
      }

      this.messageQueue.get(agentId)!.push(message);

      // Emit delivery event (actual delivery would be handled by the hub)
      this.emit('messageQueued', { message, agentId });

      const receipt: A2ADeliveryReceipt = {
        messageId: message.id,
        timestamp: new Date(),
        status: 'delivered',
        targetAgent: agentId
      };

      this.emit('messageDelivered', { message, agentId, receipt });
      return receipt;

    } catch (error) {
      const receipt: A2ADeliveryReceipt = {
        messageId: message.id,
        timestamp: new Date(),
        status: 'failed',
        targetAgent: agentId,
        error: {
          code: 'A2A_ERROR',
          message: error instanceof Error ? error.message : 'Delivery failed',
          timestamp: new Date()
        }
      };

      this.emit('deliveryError', { message, agentId, error, receipt });
      return receipt;
    }
  }

  /**
   * Add a routing rule
   */
  addRoutingRule(rule: RoutingRule): void {
    this.routingRules.push(rule);
    this.routingRules.sort((a, b) => b.priority - a.priority);
    this.emit('routingRuleAdded', rule);
  }

  /**
   * Remove a routing rule
   */
  removeRoutingRule(ruleId: string): void {
    const index = this.routingRules.findIndex(rule => rule.id === ruleId);
    if (index !== -1) {
      const removedRule = this.routingRules.splice(index, 1)[0];
      this.emit('routingRuleRemoved', removedRule);
    }
  }

  /**
   * Get queued messages for an agent
   */
  getQueuedMessages(agentId: string): A2AMessage[] {
    return this.messageQueue.get(agentId) || [];
  }

  /**
   * Clear message queue for an agent
   */
  clearMessageQueue(agentId: string): void {
    this.messageQueue.delete(agentId);
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): {
    totalAgents: number;
    totalSubscriptions: number;
    totalRules: number;
    queuedMessages: number;
  } {
    const queuedMessages = Array.from(this.messageQueue.values())
      .reduce((total, queue) => total + queue.length, 0);

    return {
      totalAgents: this.agentRegistry.size,
      totalSubscriptions: this.subscriptions.size,
      totalRules: this.routingRules.length,
      queuedMessages
    };
  }

  /**
   * Helper method to get nested object values
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}