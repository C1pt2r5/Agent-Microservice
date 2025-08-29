/**
 * Fraud Detection Service Integration
 * Handles MCP integration, A2A messaging, and event stream processing
 */
import { EventEmitter } from 'events';
import { RiskAssessment } from './fraud-detection-agent';
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
    throughput: number;
    lastProcessedTimestamp: Date;
}
export declare class FraudDetectionService extends EventEmitter {
    private agent;
    private config;
    private isRunning;
    private processingInterval?;
    private metrics;
    private eventQueue;
    private processingBatch;
    constructor(config: FraudDetectionServiceConfig);
    /**
     * Initialize the fraud detection service
     */
    initialize(): Promise<void>;
    /**
     * Shutdown the service gracefully
     */
    shutdown(): Promise<void>;
    /**
     * Process a single transaction for fraud analysis
     */
    analyzeTransaction(transactionData: any): Promise<RiskAssessment>;
    /**
     * Process multiple transactions in batch
     */
    analyzeBatch(transactions: any[]): Promise<RiskAssessment[]>;
    /**
     * Get service health status
     */
    getHealthStatus(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        metrics: ProcessingMetrics;
        queueSize: number;
        agentHealth: boolean;
    };
    /**
     * Get processing metrics
     */
    getMetrics(): ProcessingMetrics;
    private setupMCPIntegration;
    private setupA2AIntegration;
    private startEventStreamProcessing;
    private processBatch;
    private parseTransactionData;
    private parseEventToTransaction;
    private getCustomerProfile;
    private getRecentTransactions;
    private getDefaultCustomerProfile;
    private handleAssessmentResult;
    private updateTransactionRisk;
    private shouldGenerateAlert;
    private createFraudAlert;
    private publishAlert;
    private publishRiskAssessment;
    private publishWebhookAlert;
    private handleA2AMessage;
    private handleUserBehaviorUpdate;
    private handleMerchantRiskUpdate;
    private updateMetrics;
    private setupEventListeners;
    private simulateEventStream;
}
//# sourceMappingURL=fraud-detection-service.d.ts.map