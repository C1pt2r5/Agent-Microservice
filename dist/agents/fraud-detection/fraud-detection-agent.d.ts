/**
 * Fraud detection agent implementation with AI-powered analysis
 */
import { ConcreteBaseAgent } from '../base/base-agent';
import { AgentRequest, AgentResponse } from '../../types';
export interface Transaction {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    merchant: string;
    merchantCategory: string;
    location: {
        country: string;
        city: string;
        coordinates?: {
            lat: number;
            lng: number;
        };
    };
    timestamp: Date;
    paymentMethod: string;
    deviceId?: string;
    ipAddress?: string;
    metadata?: Record<string, any>;
}
export interface CustomerProfile {
    userId: string;
    accountAge: number;
    avgTransactionAmount: number;
    frequentLocations: string[];
    frequentMerchants: string[];
    typicalSpendingPattern: {
        hourlyDistribution: number[];
        weeklyDistribution: number[];
        monthlyDistribution: number[];
    };
    riskHistory: RiskEvent[];
    fraudHistory: FraudEvent[];
}
export interface RiskEvent {
    timestamp: Date;
    riskScore: number;
    factors: string[];
    outcome: 'approved' | 'declined' | 'reviewed';
}
export interface FraudEvent {
    timestamp: Date;
    transactionId: string;
    fraudType: string;
    confirmed: boolean;
    amount: number;
}
export interface RiskAssessment {
    transactionId: string;
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: RiskFactor[];
    recommendation: 'approve' | 'review' | 'decline';
    confidence: number;
    explanation: string;
    processingTime: number;
}
export interface RiskFactor {
    type: string;
    severity: 'low' | 'medium' | 'high';
    score: number;
    description: string;
    evidence: Record<string, any>;
}
export interface PatternAnalysis {
    patternType: string;
    confidence: number;
    description: string;
    supportingTransactions: string[];
    riskImplication: string;
}
export declare class FraudDetectionAgent extends ConcreteBaseAgent {
    private riskThresholds;
    private fraudPatterns;
    /**
     * Analyze a transaction for fraud indicators
     */
    analyzeTransaction(transaction: Transaction, customerProfile: CustomerProfile, recentTransactions?: Transaction[]): Promise<RiskAssessment>;
    /**
     * Detect patterns across multiple transactions
     */
    detectPatterns(transactions: Transaction[]): Promise<PatternAnalysis[]>;
    /**
     * Process real-time transaction event
     */
    processTransactionEvent(event: any): Promise<void>;
    private performRuleBasedAnalysis;
    private performAIAnalysis;
    private analyzeAmount;
    private analyzeFrequency;
    private analyzeLocation;
    private analyzeTime;
    private analyzeMerchant;
    private analyzeDevice;
    private detectRapidSuccession;
    private detectAmountEscalation;
    private detectGeographicAnomalies;
    private detectAIPatterns;
    private calculateRiskScore;
    private getFactorWeight;
    private determineRiskLevel;
    private makeRecommendation;
    private calculateConfidence;
    private generateExplanation;
    private mapRiskScoreToSeverity;
    private validateTransaction;
    private parseTransactionEvent;
    private getCustomerProfile;
    private getRecentTransactions;
    private handleRiskAssessment;
    processRequest(request: AgentRequest): Promise<AgentResponse>;
    private createSuccessResponse;
    private createErrorResponse;
}
//# sourceMappingURL=fraud-detection-agent.d.ts.map