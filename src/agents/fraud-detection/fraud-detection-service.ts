/**
 * Fraud Detection Service Integration
 * Handles MCP integration, A2A messaging, and event stream processing
 */

import { EventEmitter } from 'events';
import { FraudDetectionAgent, Transaction, RiskAssessment } from './fraud-detection-agent';
import { AgentConfig } from '../../types';

export interface FraudDetectionServiceConfig extends AgentConfig {
  eventStream: {
    enabled: boolean;
    source: 'kafka' | 'redis' | 'webhook';
    connectionString: string;
    topics: string[];
    batchSize: number;
    processingInterval: number;
  };
  alerting: {
    enabled: boolean;
    channels: ('a2a' | 'webhook' | 'email')[];
    thresholds: {
      highRisk: number;
      critical: number;
    };
  };
  monitoring: {
    metricsEnabled: boolean;
    loggingLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface FraudAlert {
  id: string;
  timestamp: Date;
  transactionId: string;
  userId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: 'approve' | 'review' | 'decline';
  factors: string[];
  explanation: string;
  metadata?: Record<string, any>;
}

export interface ProcessingMetrics {
  transactionsProcessed: number;
  alertsGenerated: number;
  averageProcessingTime: number;
  errorRate: number;
  throughput: number; // transactions per second
  lastProcessedTimestamp: Date;
}

export class FraudDetectionService extends EventEmitter {
  private agent: FraudDetectionAgent;
  private config: FraudDetectionServiceConfig;
  private isRunning: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private metrics: ProcessingMetrics;
  private eventQueue: any[] = [];
  private processingBatch: boolean = false;

  constructor(config: FraudDetectionServiceConfig) {
    super();
    this.config = config;
    this.agent = new FraudDetectionAgent(config);
    
    this.metrics = {
      transactionsProcessed: 0,
      alertsGenerated: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      throughput: 0,
      lastProcessedTimestamp: new Date()
    };

    this.setupEventListeners();
  }

  /**
   * Initialize the fraud detection service
   */
  async initialize(): Promise<void> {
    try {
      // Initialize the agent
      await this.agent.initialize();

      // Set up MCP service mappings
      await this.setupMCPIntegration();

      // Set up A2A subscriptions
      await this.setupA2AIntegration();

      // Start event stream processing if enabled
      if (this.config.eventStream.enabled) {
        await this.startEventStreamProcessing();
      }

      this.isRunning = true;
      this.emit('serviceInitialized');
      
      console.log('Fraud Detection Service initialized successfully');

    } catch (error) {
      console.error('Failed to initialize Fraud Detection Service:', error);
      throw error;
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    try {
      this.isRunning = false;

      // Stop event processing
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
      }

      // Process remaining events in queue
      if (this.eventQueue.length > 0) {
        await this.processBatch(this.eventQueue);
        this.eventQueue = [];
      }

      // Shutdown agent
      await this.agent.shutdown();

      this.emit('serviceShutdown');
      console.log('Fraud Detection Service shutdown complete');

    } catch (error) {
      console.error('Error during service shutdown:', error);
      throw error;
    }
  }

  /**
   * Process a single transaction for fraud analysis
   */
  async analyzeTransaction(transactionData: any): Promise<RiskAssessment> {
    const startTime = Date.now();

    try {
      // Parse transaction data
      const transaction = this.parseTransactionData(transactionData);

      // Get customer profile via MCP
      const customerProfile = await this.getCustomerProfile(transaction.userId);

      // Get recent transactions via MCP
      const recentTransactions = await this.getRecentTransactions(transaction.userId);

      // Perform fraud analysis
      const assessment = await this.agent.analyzeTransaction(
        transaction,
        customerProfile,
        recentTransactions
      );

      // Handle the assessment result
      await this.handleAssessmentResult(transaction, assessment);

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);

      return assessment;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false);
      
      console.error('Transaction analysis error:', error);
      throw error;
    }
  }

  /**
   * Process multiple transactions in batch
   */
  async analyzeBatch(transactions: any[]): Promise<RiskAssessment[]> {
    const results: RiskAssessment[] = [];
    const batchSize = Math.min(transactions.length, this.config.eventStream.batchSize);

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const batchPromises = batch.map(txn => this.analyzeTransaction(txn));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error(`Batch item ${i + index} failed:`, result.reason);
          }
        });

      } catch (error) {
        console.error('Batch processing error:', error);
      }
    }

    return results;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: ProcessingMetrics;
    queueSize: number;
    agentHealth: boolean;
  } {
    const agentHealth = this.agent.isAgentHealthy();
    const queueSize = this.eventQueue.length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!agentHealth || this.metrics.errorRate > 0.1) {
      status = 'unhealthy';
    } else if (queueSize > 1000 || this.metrics.errorRate > 0.05) {
      status = 'degraded';
    }

    return {
      status,
      metrics: { ...this.metrics },
      queueSize,
      agentHealth
    };
  }

  /**
   * Get processing metrics
   */
  getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }

  private async setupMCPIntegration(): Promise<void> {
    // Configure MCP service endpoints for fraud detection
    const mcpServices = {
      'user-service': {
        operations: {
          'getUserProfile': {
            endpoint: '/api/users/{userId}/profile',
            method: 'GET'
          },
          'getUserRiskHistory': {
            endpoint: '/api/users/{userId}/risk-history',
            method: 'GET'
          }
        }
      },
      'transaction-service': {
        operations: {
          'getRecentTransactions': {
            endpoint: '/api/transactions/recent',
            method: 'GET'
          },
          'getTransactionDetails': {
            endpoint: '/api/transactions/{transactionId}',
            method: 'GET'
          },
          'updateTransactionRisk': {
            endpoint: '/api/transactions/{transactionId}/risk',
            method: 'PUT'
          }
        }
      },
      'merchant-service': {
        operations: {
          'getMerchantProfile': {
            endpoint: '/api/merchants/{merchantId}/profile',
            method: 'GET'
          },
          'getMerchantRiskData': {
            endpoint: '/api/merchants/{merchantId}/risk',
            method: 'GET'
          }
        }
      }
    };

    // Register MCP services (this would be done through MCP client configuration)
    console.log('MCP integration configured for fraud detection');
  }

  private async setupA2AIntegration(): Promise<void> {
    // Set up A2A subscriptions and publications
    const a2aConfig = {
      subscriptions: [
        'transaction-events',
        'user-behavior-updates',
        'merchant-risk-updates'
      ],
      publications: [
        'fraud-alerts',
        'risk-assessments',
        'pattern-detections'
      ]
    };

    // Subscribe to relevant topics
    if (this.agent['a2aClient']) {
      // Set up message handlers
      this.agent['a2aClient'].on('messageReceived', this.handleA2AMessage.bind(this));
    }

    console.log('A2A integration configured for fraud detection');
  }

  private async startEventStreamProcessing(): Promise<void> {
    const interval = this.config.eventStream.processingInterval || 5000; // 5 seconds default

    this.processingInterval = setInterval(async () => {
      if (this.eventQueue.length > 0 && !this.processingBatch) {
        await this.processBatch(this.eventQueue.splice(0, this.config.eventStream.batchSize));
      }
    }, interval);

    // Simulate event stream (in production, this would connect to actual event source)
    this.simulateEventStream();

    console.log('Event stream processing started');
  }

  private async processBatch(events: any[]): Promise<void> {
    if (events.length === 0) return;

    this.processingBatch = true;

    try {
      const transactions = events.map(event => this.parseEventToTransaction(event));
      await this.analyzeBatch(transactions);

      this.emit('batchProcessed', { count: events.length });

    } catch (error) {
      console.error('Batch processing error:', error);
      this.emit('batchError', { error, count: events.length });

    } finally {
      this.processingBatch = false;
    }
  }

  private parseTransactionData(data: any): Transaction {
    return {
      id: data.id || data.transaction_id,
      userId: data.userId || data.user_id,
      amount: parseFloat(data.amount),
      currency: data.currency || 'USD',
      merchant: data.merchant || 'Unknown',
      merchantCategory: data.merchantCategory || data.merchant_category || 'Other',
      location: {
        country: data.location?.country || data.country || 'Unknown',
        city: data.location?.city || data.city || 'Unknown',
        coordinates: data.location?.coordinates
      },
      timestamp: new Date(data.timestamp || Date.now()),
      paymentMethod: data.paymentMethod || data.payment_method || 'Unknown',
      deviceId: data.deviceId || data.device_id,
      ipAddress: data.ipAddress || data.ip_address,
      metadata: data.metadata || {}
    };
  }

  private parseEventToTransaction(event: any): any {
    // Parse event stream data to transaction format
    return {
      id: event.transaction_id,
      userId: event.user_id,
      amount: event.amount,
      currency: event.currency,
      merchant: event.merchant,
      location: event.location,
      timestamp: event.timestamp,
      paymentMethod: event.payment_method,
      deviceId: event.device_id,
      ipAddress: event.ip_address
    };
  }

  private async getCustomerProfile(userId: string): Promise<any> {
    try {
      return await this.agent['queryMCP']('user-service', 'getUserProfile', { userId });
    } catch (error) {
      console.error('Error getting customer profile:', error);
      return this.getDefaultCustomerProfile(userId);
    }
  }

  private async getRecentTransactions(userId: string): Promise<Transaction[]> {
    try {
      const result = await this.agent['queryMCP']('transaction-service', 'getRecentTransactions', { 
        userId,
        limit: 10,
        timeWindow: 86400000 // 24 hours
      });
      return result.transactions || [];
    } catch (error) {
      console.error('Error getting recent transactions:', error);
      return [];
    }
  }

  private getDefaultCustomerProfile(userId: string): any {
    return {
      userId,
      accountAge: 30,
      avgTransactionAmount: 100,
      frequentLocations: [],
      frequentMerchants: [],
      typicalSpendingPattern: {
        hourlyDistribution: new Array(24).fill(1/24),
        weeklyDistribution: new Array(7).fill(1/7),
        monthlyDistribution: new Array(12).fill(1/12)
      },
      riskHistory: [],
      fraudHistory: []
    };
  }

  private async handleAssessmentResult(transaction: Transaction, assessment: RiskAssessment): Promise<void> {
    try {
      // Update transaction risk score via MCP
      await this.updateTransactionRisk(transaction.id, assessment);

      // Generate alert if necessary
      if (this.shouldGenerateAlert(assessment)) {
        const alert = this.createFraudAlert(transaction, assessment);
        await this.publishAlert(alert);
      }

      // Publish assessment via A2A
      await this.publishRiskAssessment(transaction, assessment);

    } catch (error) {
      console.error('Error handling assessment result:', error);
    }
  }

  private async updateTransactionRisk(transactionId: string, assessment: RiskAssessment): Promise<void> {
    try {
      await this.agent['queryMCP']('transaction-service', 'updateTransactionRisk', {
        transactionId,
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        recommendation: assessment.recommendation,
        factors: assessment.riskFactors.map(f => f.type)
      });
    } catch (error) {
      console.error('Error updating transaction risk:', error);
    }
  }

  private shouldGenerateAlert(assessment: RiskAssessment): boolean {
    if (!this.config.alerting.enabled) return false;

    const { thresholds } = this.config.alerting;
    
    return assessment.riskScore >= thresholds.highRisk ||
           assessment.riskLevel === 'critical' ||
           assessment.recommendation === 'decline';
  }

  private createFraudAlert(transaction: Transaction, assessment: RiskAssessment): FraudAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
      transactionId: transaction.id,
      userId: transaction.userId,
      riskScore: assessment.riskScore,
      riskLevel: assessment.riskLevel,
      recommendation: assessment.recommendation,
      factors: assessment.riskFactors.map(f => f.type),
      explanation: assessment.explanation,
      metadata: {
        merchant: transaction.merchant,
        amount: transaction.amount,
        location: transaction.location
      }
    };
  }

  private async publishAlert(alert: FraudAlert): Promise<void> {
    try {
      // Publish via A2A
      if (this.config.alerting.channels.includes('a2a')) {
        await this.agent['sendA2AMessage'](
          'fraud-alerts',
          'high-risk-transaction',
          alert,
          'chatbot' // Notify chatbot for customer communication
        );
      }

      // Publish via webhook (if configured)
      if (this.config.alerting.channels.includes('webhook')) {
        await this.publishWebhookAlert(alert);
      }

      this.metrics.alertsGenerated++;
      this.emit('alertGenerated', alert);

    } catch (error) {
      console.error('Error publishing alert:', error);
    }
  }

  private async publishRiskAssessment(transaction: Transaction, assessment: RiskAssessment): Promise<void> {
    try {
      await this.agent['sendA2AMessage'](
        'risk-assessments',
        'transaction-assessed',
        {
          transactionId: transaction.id,
          userId: transaction.userId,
          assessment: {
            riskScore: assessment.riskScore,
            riskLevel: assessment.riskLevel,
            recommendation: assessment.recommendation,
            confidence: assessment.confidence
          }
        }
      );
    } catch (error) {
      console.error('Error publishing risk assessment:', error);
    }
  }

  private async publishWebhookAlert(alert: FraudAlert): Promise<void> {
    // Implementation would depend on webhook configuration
    console.log('Webhook alert published:', alert.id);
  }

  private handleA2AMessage(message: any): void {
    try {
      switch (message.messageType) {
        case 'transaction-event':
          this.eventQueue.push(message.payload);
          break;
        
        case 'user-behavior-update':
          this.handleUserBehaviorUpdate(message.payload);
          break;
        
        case 'merchant-risk-update':
          this.handleMerchantRiskUpdate(message.payload);
          break;
        
        default:
          console.log('Unknown A2A message type:', message.messageType);
      }
    } catch (error) {
      console.error('Error handling A2A message:', error);
    }
  }

  private handleUserBehaviorUpdate(payload: any): void {
    // Handle user behavior updates that might affect risk assessment
    console.log('User behavior update received:', payload.userId);
  }

  private handleMerchantRiskUpdate(payload: any): void {
    // Handle merchant risk updates
    console.log('Merchant risk update received:', payload.merchantId);
  }

  private updateMetrics(processingTime: number, success: boolean): void {
    this.metrics.transactionsProcessed++;
    
    // Update average processing time
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.transactionsProcessed - 1) + processingTime;
    this.metrics.averageProcessingTime = totalTime / this.metrics.transactionsProcessed;
    
    // Update error rate
    if (!success) {
      const errorCount = this.metrics.errorRate * (this.metrics.transactionsProcessed - 1) + 1;
      this.metrics.errorRate = errorCount / this.metrics.transactionsProcessed;
    } else {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.transactionsProcessed - 1)) / this.metrics.transactionsProcessed;
    }
    
    // Update throughput (simplified calculation)
    const now = new Date();
    const timeDiff = now.getTime() - this.metrics.lastProcessedTimestamp.getTime();
    if (timeDiff > 0) {
      this.metrics.throughput = 1000 / timeDiff; // transactions per second
    }
    
    this.metrics.lastProcessedTimestamp = now;
  }

  private setupEventListeners(): void {
    this.agent.on('riskAssessment', ({ transaction, assessment }) => {
      this.emit('transactionAssessed', { transaction, assessment });
    });

    this.agent.on('assessmentCompleted', ({ transaction, assessment }) => {
      this.emit('assessmentCompleted', { transaction, assessment });
    });
  }

  private simulateEventStream(): void {
    // Simulate incoming transaction events for testing
    if (process.env.NODE_ENV === 'development') {
      setInterval(() => {
        const mockEvent = {
          transaction_id: `txn_${Date.now()}`,
          user_id: `user_${Math.floor(Math.random() * 1000)}`,
          amount: Math.floor(Math.random() * 1000) + 10,
          currency: 'USD',
          merchant: 'Test Merchant',
          location: { country: 'USA', city: 'New York' },
          timestamp: new Date().toISOString(),
          payment_method: 'credit_card'
        };

        this.eventQueue.push(mockEvent);
      }, 10000); // Every 10 seconds
    }
  }
}