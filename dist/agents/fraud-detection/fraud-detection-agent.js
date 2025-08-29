"use strict";
/**
 * Fraud detection agent implementation with AI-powered analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FraudDetectionAgent = void 0;
const base_agent_1 = require("../base/base-agent");
const prompt_templates_1 = require("../../integration/gemini/prompt-templates");
class FraudDetectionAgent extends base_agent_1.ConcreteBaseAgent {
    constructor() {
        super(...arguments);
        this.riskThresholds = {
            low: 30,
            medium: 60,
            high: 80,
            critical: 95
        };
        this.fraudPatterns = {
            rapidSuccession: { timeWindow: 300000, maxTransactions: 5 }, // 5 minutes
            amountEscalation: { escalationFactor: 2.0, timeWindow: 3600000 }, // 1 hour
            geographicAnomaly: { maxDistance: 1000 }, // km
            velocityCheck: { maxAmount: 10000, timeWindow: 86400000 }, // 24 hours
            deviceFingerprint: { suspiciousDeviceThreshold: 0.8 }
        };
    }
    /**
     * Analyze a transaction for fraud indicators
     */
    async analyzeTransaction(transaction, customerProfile, recentTransactions = []) {
        const startTime = Date.now();
        try {
            // Validate transaction data
            this.validateTransaction(transaction);
            // Perform rule-based analysis
            const ruleBasedFactors = await this.performRuleBasedAnalysis(transaction, customerProfile, recentTransactions);
            // Perform AI-powered pattern analysis
            const aiFactors = await this.performAIAnalysis(transaction, customerProfile, recentTransactions);
            // Combine risk factors
            const allFactors = [...ruleBasedFactors, ...aiFactors];
            // Calculate overall risk score
            const riskScore = this.calculateRiskScore(allFactors);
            // Determine risk level and recommendation
            const riskLevel = this.determineRiskLevel(riskScore);
            const recommendation = this.makeRecommendation(riskScore, allFactors);
            // Generate explanation
            const explanation = this.generateExplanation(allFactors, riskScore);
            const processingTime = Date.now() - startTime;
            const assessment = {
                transactionId: transaction.id,
                riskScore,
                riskLevel,
                riskFactors: allFactors,
                recommendation,
                confidence: this.calculateConfidence(allFactors),
                explanation,
                processingTime
            };
            // Emit assessment event
            this.emit('riskAssessment', { transaction, assessment });
            return assessment;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            // Return safe default assessment on error
            return {
                transactionId: transaction.id || 'unknown',
                riskScore: 100, // High risk on error
                riskLevel: 'critical',
                riskFactors: [{
                        type: 'analysis_error',
                        severity: 'high',
                        score: 100,
                        description: 'Error occurred during fraud analysis',
                        evidence: { error: error instanceof Error ? error.message : 'Unknown error' }
                    }],
                recommendation: 'review',
                confidence: 0,
                explanation: 'Transaction requires manual review due to analysis error',
                processingTime
            };
        }
    }
    /**
     * Detect patterns across multiple transactions
     */
    async detectPatterns(transactions) {
        const patterns = [];
        try {
            // Rapid succession pattern
            const rapidPattern = this.detectRapidSuccession(transactions);
            if (rapidPattern)
                patterns.push(rapidPattern);
            // Amount escalation pattern
            const escalationPattern = this.detectAmountEscalation(transactions);
            if (escalationPattern)
                patterns.push(escalationPattern);
            // Geographic anomaly pattern
            const geoPattern = this.detectGeographicAnomalies(transactions);
            if (geoPattern)
                patterns.push(geoPattern);
            // Use AI for complex pattern detection
            const aiPatterns = await this.detectAIPatterns(transactions);
            patterns.push(...aiPatterns);
            return patterns;
        }
        catch (error) {
            console.error('Pattern detection error:', error);
            return [];
        }
    }
    /**
     * Process real-time transaction event
     */
    async processTransactionEvent(event) {
        try {
            const transaction = this.parseTransactionEvent(event);
            // Get customer profile
            const customerProfile = await this.getCustomerProfile(transaction.userId);
            // Get recent transactions
            const recentTransactions = await this.getRecentTransactions(transaction.userId);
            // Analyze transaction
            const assessment = await this.analyzeTransaction(transaction, customerProfile, recentTransactions);
            // Take action based on assessment
            await this.handleRiskAssessment(transaction, assessment);
        }
        catch (error) {
            console.error('Transaction event processing error:', error);
            this.emit('processingError', { event, error });
        }
    }
    async performRuleBasedAnalysis(transaction, customerProfile, recentTransactions) {
        const factors = [];
        // Amount analysis
        const amountFactor = this.analyzeAmount(transaction, customerProfile);
        if (amountFactor)
            factors.push(amountFactor);
        // Frequency analysis
        const frequencyFactor = this.analyzeFrequency(transaction, recentTransactions);
        if (frequencyFactor)
            factors.push(frequencyFactor);
        // Location analysis
        const locationFactor = this.analyzeLocation(transaction, customerProfile);
        if (locationFactor)
            factors.push(locationFactor);
        // Time analysis
        const timeFactor = this.analyzeTime(transaction, customerProfile);
        if (timeFactor)
            factors.push(timeFactor);
        // Merchant analysis
        const merchantFactor = this.analyzeMerchant(transaction, customerProfile);
        if (merchantFactor)
            factors.push(merchantFactor);
        // Device analysis
        const deviceFactor = this.analyzeDevice(transaction, recentTransactions);
        if (deviceFactor)
            factors.push(deviceFactor);
        return factors;
    }
    async performAIAnalysis(transaction, customerProfile, recentTransactions) {
        if (!this.geminiClient) {
            return [];
        }
        try {
            const prompt = prompt_templates_1.PromptTemplateManager.renderTemplate('fraud-transaction-analysis', {
                transaction: {
                    amount: transaction.amount,
                    merchant: transaction.merchant,
                    location: `${transaction.location.city}, ${transaction.location.country}`,
                    timestamp: transaction.timestamp.toISOString(),
                    payment_method: transaction.paymentMethod
                },
                customer_profile: {
                    avg_transaction_amount: customerProfile.avgTransactionAmount,
                    frequent_locations: customerProfile.frequentLocations.join(', '),
                    account_age: customerProfile.accountAge,
                    fraud_history: customerProfile.fraudHistory.length
                },
                recent_transactions: recentTransactions.slice(0, 5).map(t => `${t.amount} ${t.currency} at ${t.merchant} on ${t.timestamp.toISOString()}`).join('\n')
            });
            const request = {
                id: `fraud_analysis_${transaction.id}`,
                timestamp: new Date(),
                prompt,
                options: {
                    temperature: 0.3, // Lower temperature for more consistent analysis
                    maxTokens: 1000
                }
            };
            const response = await this.geminiClient.generateStructuredResponse(request);
            if (response.success && response.structuredData) {
                const aiAnalysis = response.structuredData;
                return [{
                        type: 'ai_analysis',
                        severity: this.mapRiskScoreToSeverity(aiAnalysis.risk_score || 0),
                        score: aiAnalysis.risk_score || 0,
                        description: aiAnalysis.explanation || 'AI-powered risk analysis',
                        evidence: {
                            risk_factors: aiAnalysis.risk_factors || [],
                            recommendation: aiAnalysis.recommendation || 'review',
                            ai_confidence: response.usage?.totalTokens || 0
                        }
                    }];
            }
            return [];
        }
        catch (error) {
            console.error('AI analysis error:', error);
            return [];
        }
    }
    analyzeAmount(transaction, customerProfile) {
        const avgAmount = customerProfile.avgTransactionAmount;
        const ratio = transaction.amount / avgAmount;
        if (ratio > 10) {
            return {
                type: 'unusual_amount',
                severity: 'high',
                score: Math.min(ratio * 5, 100),
                description: `Transaction amount is ${ratio.toFixed(1)}x higher than average`,
                evidence: { amount: transaction.amount, average: avgAmount, ratio }
            };
        }
        else if (ratio > 5) {
            return {
                type: 'unusual_amount',
                severity: 'medium',
                score: ratio * 8,
                description: `Transaction amount is ${ratio.toFixed(1)}x higher than average`,
                evidence: { amount: transaction.amount, average: avgAmount, ratio }
            };
        }
        return null;
    }
    analyzeFrequency(transaction, recentTransactions) {
        const timeWindow = this.fraudPatterns.rapidSuccession.timeWindow;
        const maxTransactions = this.fraudPatterns.rapidSuccession.maxTransactions;
        const recentCount = recentTransactions.filter(t => transaction.timestamp.getTime() - t.timestamp.getTime() < timeWindow).length;
        if (recentCount >= maxTransactions) {
            return {
                type: 'rapid_succession',
                severity: 'high',
                score: (recentCount / maxTransactions) * 80,
                description: `${recentCount} transactions in ${timeWindow / 60000} minutes`,
                evidence: { count: recentCount, timeWindow, threshold: maxTransactions }
            };
        }
        return null;
    }
    analyzeLocation(transaction, customerProfile) {
        const isFrequentLocation = customerProfile.frequentLocations.some(loc => loc.includes(transaction.location.country) || loc.includes(transaction.location.city));
        if (!isFrequentLocation) {
            return {
                type: 'unusual_location',
                severity: 'medium',
                score: 40,
                description: `Transaction from unfamiliar location: ${transaction.location.city}, ${transaction.location.country}`,
                evidence: {
                    location: transaction.location,
                    frequentLocations: customerProfile.frequentLocations
                }
            };
        }
        return null;
    }
    analyzeTime(transaction, customerProfile) {
        const hour = transaction.timestamp.getHours();
        const typicalHourlyPattern = customerProfile.typicalSpendingPattern.hourlyDistribution;
        // Check if transaction time is unusual (low activity period)
        const hourlyActivity = typicalHourlyPattern[hour] || 0;
        if (hourlyActivity < 0.1) { // Less than 10% of typical activity
            return {
                type: 'unusual_time',
                severity: 'low',
                score: 25,
                description: `Transaction at unusual time: ${hour}:00`,
                evidence: { hour, typicalActivity: hourlyActivity }
            };
        }
        return null;
    }
    analyzeMerchant(transaction, customerProfile) {
        const isFrequentMerchant = customerProfile.frequentMerchants.includes(transaction.merchant);
        if (!isFrequentMerchant) {
            return {
                type: 'new_merchant',
                severity: 'low',
                score: 15,
                description: `Transaction with new merchant: ${transaction.merchant}`,
                evidence: {
                    merchant: transaction.merchant,
                    frequentMerchants: customerProfile.frequentMerchants
                }
            };
        }
        return null;
    }
    analyzeDevice(transaction, recentTransactions) {
        if (!transaction.deviceId)
            return null;
        const recentDevices = recentTransactions
            .filter(t => t.deviceId && t.deviceId !== transaction.deviceId)
            .map(t => t.deviceId);
        if (recentDevices.length > 0) {
            return {
                type: 'new_device',
                severity: 'medium',
                score: 35,
                description: 'Transaction from new device',
                evidence: {
                    deviceId: transaction.deviceId,
                    recentDevices: [...new Set(recentDevices)]
                }
            };
        }
        return null;
    }
    detectRapidSuccession(transactions) {
        if (transactions.length < 3)
            return null;
        const sortedTransactions = transactions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        let rapidCount = 0;
        let maxRapidCount = 0;
        const rapidTransactions = [];
        for (let i = 1; i < sortedTransactions.length; i++) {
            const timeDiff = sortedTransactions[i].timestamp.getTime() -
                sortedTransactions[i - 1].timestamp.getTime();
            if (timeDiff < 60000) { // Less than 1 minute apart
                rapidCount++;
                rapidTransactions.push(sortedTransactions[i].id);
            }
            else {
                maxRapidCount = Math.max(maxRapidCount, rapidCount);
                rapidCount = 0;
            }
        }
        maxRapidCount = Math.max(maxRapidCount, rapidCount);
        if (maxRapidCount >= 2) {
            return {
                patternType: 'rapid_succession',
                confidence: Math.min(maxRapidCount * 30, 100),
                description: `${maxRapidCount + 1} transactions in rapid succession`,
                supportingTransactions: rapidTransactions,
                riskImplication: 'Possible automated or fraudulent activity'
            };
        }
        return null;
    }
    detectAmountEscalation(transactions) {
        if (transactions.length < 3)
            return null;
        const sortedTransactions = transactions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        let escalationCount = 0;
        const escalatingTransactions = [];
        for (let i = 1; i < sortedTransactions.length; i++) {
            const currentAmount = sortedTransactions[i].amount;
            const previousAmount = sortedTransactions[i - 1].amount;
            if (currentAmount > previousAmount * 1.5) { // 50% increase
                escalationCount++;
                escalatingTransactions.push(sortedTransactions[i].id);
            }
        }
        if (escalationCount >= 2) {
            return {
                patternType: 'amount_escalation',
                confidence: Math.min(escalationCount * 25, 100),
                description: `Progressive increase in transaction amounts`,
                supportingTransactions: escalatingTransactions,
                riskImplication: 'Testing limits before larger fraudulent transactions'
            };
        }
        return null;
    }
    detectGeographicAnomalies(transactions) {
        if (transactions.length < 2)
            return null;
        const locations = transactions.map(t => t.location);
        const anomalousTransactions = [];
        // Simple geographic anomaly detection (would use proper geolocation in production)
        for (let i = 1; i < transactions.length; i++) {
            const current = locations[i];
            const previous = locations[i - 1];
            if (current.country !== previous.country) {
                anomalousTransactions.push(transactions[i].id);
            }
        }
        if (anomalousTransactions.length > 0) {
            return {
                patternType: 'geographic_anomaly',
                confidence: Math.min(anomalousTransactions.length * 40, 100),
                description: `Transactions from multiple countries`,
                supportingTransactions: anomalousTransactions,
                riskImplication: 'Impossible travel or compromised credentials'
            };
        }
        return null;
    }
    async detectAIPatterns(transactions) {
        if (!this.geminiClient || transactions.length < 3) {
            return [];
        }
        try {
            const prompt = prompt_templates_1.PromptTemplateManager.renderTemplate('fraud-pattern-detection', {
                transaction_sequence: transactions.map(t => `${t.id}: ${t.amount} ${t.currency} at ${t.merchant} (${t.location.city}, ${t.location.country}) on ${t.timestamp.toISOString()}`).join('\n'),
                customer_baseline: 'Standard customer behavior patterns'
            });
            const request = {
                id: `pattern_analysis_${Date.now()}`,
                timestamp: new Date(),
                prompt,
                options: {
                    temperature: 0.2,
                    maxTokens: 800
                }
            };
            const response = await this.geminiClient.generateContent(request);
            if (response.success && response.content) {
                // Parse AI response for patterns (simplified)
                return [{
                        patternType: 'ai_detected_pattern',
                        confidence: 70,
                        description: response.content.substring(0, 200),
                        supportingTransactions: transactions.slice(0, 3).map(t => t.id),
                        riskImplication: 'AI-identified suspicious pattern'
                    }];
            }
            return [];
        }
        catch (error) {
            console.error('AI pattern detection error:', error);
            return [];
        }
    }
    calculateRiskScore(factors) {
        if (factors.length === 0)
            return 0;
        // Weighted average with diminishing returns
        const totalWeight = factors.reduce((sum, factor) => {
            const weight = this.getFactorWeight(factor.type);
            return sum + weight;
        }, 0);
        const weightedScore = factors.reduce((sum, factor) => {
            const weight = this.getFactorWeight(factor.type);
            return sum + (factor.score * weight);
        }, 0);
        return Math.min(Math.round(weightedScore / totalWeight), 100);
    }
    getFactorWeight(factorType) {
        const weights = {
            'ai_analysis': 0.4,
            'unusual_amount': 0.3,
            'rapid_succession': 0.25,
            'unusual_location': 0.2,
            'new_device': 0.15,
            'unusual_time': 0.1,
            'new_merchant': 0.05,
            'analysis_error': 1.0
        };
        return weights[factorType] || 0.1;
    }
    determineRiskLevel(riskScore) {
        if (riskScore >= this.riskThresholds.critical)
            return 'critical';
        if (riskScore >= this.riskThresholds.high)
            return 'high';
        if (riskScore >= this.riskThresholds.medium)
            return 'medium';
        return 'low';
    }
    makeRecommendation(riskScore, factors) {
        // Check for critical factors
        const hasCriticalFactors = factors.some(f => f.type === 'analysis_error' || f.severity === 'high');
        if (hasCriticalFactors) {
            return 'review'; // Review for analysis errors
        }
        if (riskScore >= this.riskThresholds.critical) {
            return 'decline'; // Decline for extremely high risk scores
        }
        if (riskScore >= this.riskThresholds.high) {
            return 'review'; // Review for high risk scores
        }
        if (riskScore >= this.riskThresholds.medium) {
            return 'review'; // Review for medium risk scores
        }
        return 'approve'; // Approve for low risk scores
    }
    calculateConfidence(factors) {
        if (factors.length === 0)
            return 100;
        // Higher confidence with more factors and AI analysis
        const hasAI = factors.some(f => f.type === 'ai_analysis');
        const baseConfidence = Math.min(factors.length * 20, 80);
        return hasAI ? Math.min(baseConfidence + 20, 100) : baseConfidence;
    }
    generateExplanation(factors, riskScore) {
        if (factors.length === 0) {
            return 'No risk factors detected. Transaction appears normal.';
        }
        const topFactors = factors
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
        const explanations = topFactors.map(f => f.description);
        return `Risk score: ${riskScore}/100. Key factors: ${explanations.join('; ')}.`;
    }
    mapRiskScoreToSeverity(score) {
        if (score >= 70)
            return 'high';
        if (score >= 40)
            return 'medium';
        return 'low';
    }
    validateTransaction(transaction) {
        if (!transaction) {
            throw new Error('Transaction is required');
        }
        if (!transaction.id || typeof transaction.id !== 'string') {
            throw new Error('Transaction ID is required and must be a string');
        }
        if (!transaction.userId || typeof transaction.userId !== 'string') {
            throw new Error('User ID is required and must be a string');
        }
        if (typeof transaction.amount !== 'number' || transaction.amount <= 0) {
            throw new Error('Transaction amount must be a positive number');
        }
        if (!transaction.merchant || typeof transaction.merchant !== 'string') {
            throw new Error('Merchant is required and must be a string');
        }
        if (!transaction.location || !transaction.location.country || !transaction.location.city) {
            throw new Error('Transaction location with country and city is required');
        }
        if (!transaction.timestamp || !(transaction.timestamp instanceof Date)) {
            throw new Error('Transaction timestamp is required and must be a Date object');
        }
    }
    parseTransactionEvent(event) {
        // Parse incoming transaction event (implementation depends on event format)
        return {
            id: event.transaction_id || event.id,
            userId: event.user_id || event.userId,
            amount: parseFloat(event.amount),
            currency: event.currency || 'USD',
            merchant: event.merchant || 'Unknown',
            merchantCategory: event.merchant_category || 'Other',
            location: {
                country: event.location?.country || 'Unknown',
                city: event.location?.city || 'Unknown',
                coordinates: event.location?.coordinates
            },
            timestamp: new Date(event.timestamp || Date.now()),
            paymentMethod: event.payment_method || 'Unknown',
            deviceId: event.device_id,
            ipAddress: event.ip_address,
            metadata: event.metadata || {}
        };
    }
    async getCustomerProfile(userId) {
        try {
            // Get customer profile from MCP service
            const profileData = await this.queryMCP('user-service', 'getUserProfile', { userId });
            return {
                userId,
                accountAge: profileData.accountAge || 30,
                avgTransactionAmount: profileData.avgTransactionAmount || 100,
                frequentLocations: profileData.frequentLocations || [],
                frequentMerchants: profileData.frequentMerchants || [],
                typicalSpendingPattern: profileData.typicalSpendingPattern || {
                    hourlyDistribution: new Array(24).fill(1 / 24),
                    weeklyDistribution: new Array(7).fill(1 / 7),
                    monthlyDistribution: new Array(12).fill(1 / 12)
                },
                riskHistory: profileData.riskHistory || [],
                fraudHistory: profileData.fraudHistory || []
            };
        }
        catch (error) {
            console.error('Error getting customer profile:', error);
            // Return default profile
            return {
                userId,
                accountAge: 30,
                avgTransactionAmount: 100,
                frequentLocations: [],
                frequentMerchants: [],
                typicalSpendingPattern: {
                    hourlyDistribution: new Array(24).fill(1 / 24),
                    weeklyDistribution: new Array(7).fill(1 / 7),
                    monthlyDistribution: new Array(12).fill(1 / 12)
                },
                riskHistory: [],
                fraudHistory: []
            };
        }
    }
    async getRecentTransactions(userId) {
        try {
            // Get recent transactions from MCP service
            const transactionData = await this.queryMCP('transaction-service', 'getRecentTransactions', {
                userId,
                limit: 10,
                timeWindow: 86400000 // 24 hours
            });
            return transactionData.transactions || [];
        }
        catch (error) {
            console.error('Error getting recent transactions:', error);
            return [];
        }
    }
    async handleRiskAssessment(transaction, assessment) {
        try {
            // Send A2A message based on risk level
            if (assessment.riskLevel === 'high' || assessment.riskLevel === 'critical') {
                await this.sendA2AMessage('fraud-alerts', 'high-risk-transaction', {
                    transactionId: transaction.id,
                    userId: transaction.userId,
                    riskScore: assessment.riskScore,
                    riskLevel: assessment.riskLevel,
                    recommendation: assessment.recommendation,
                    explanation: assessment.explanation
                }, 'chatbot' // Notify chatbot agent
                );
            }
            // Log assessment for monitoring
            this.emit('assessmentCompleted', { transaction, assessment });
        }
        catch (error) {
            console.error('Error handling risk assessment:', error);
        }
    }
    // Override base agent request processing
    async processRequest(request) {
        try {
            const { action, payload } = request.payload;
            switch (action) {
                case 'analyze_transaction':
                    const assessment = await this.analyzeTransaction(payload.transaction, payload.customerProfile, payload.recentTransactions);
                    return this.createSuccessResponse(request, { assessment });
                case 'detect_patterns':
                    const patterns = await this.detectPatterns(payload.transactions);
                    return this.createSuccessResponse(request, { patterns });
                case 'process_event':
                    await this.processTransactionEvent(payload.event);
                    return this.createSuccessResponse(request, { processed: true });
                default:
                    return this.createErrorResponse(request, 'Unknown action', 'INVALID_ACTION');
            }
        }
        catch (error) {
            return this.createErrorResponse(request, error instanceof Error ? error.message : 'Unknown error', 'PROCESSING_ERROR');
        }
    }
    createSuccessResponse(request, payload) {
        return {
            id: `response_${Date.now()}`,
            requestId: request.id,
            timestamp: new Date(),
            success: true,
            payload,
            processingTime: 0 // Will be set by base class
        };
    }
    createErrorResponse(request, message, code) {
        const error = {
            code: code,
            message,
            timestamp: new Date(),
            correlationId: request.correlationId
        };
        return {
            id: `error_${Date.now()}`,
            requestId: request.id,
            timestamp: new Date(),
            success: false,
            error,
            processingTime: 0 // Will be set by base class
        };
    }
}
exports.FraudDetectionAgent = FraudDetectionAgent;
//# sourceMappingURL=fraud-detection-agent.js.map