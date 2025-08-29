"use strict";
/**
 * Chatbot agent implementation with conversational AI capabilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotAgent = void 0;
const base_agent_1 = require("../base/base-agent");
const prompt_templates_1 = require("../../integration/gemini/prompt-templates");
class ChatbotAgent extends base_agent_1.ConcreteBaseAgent {
    constructor() {
        super(...arguments);
        this.sessions = new Map();
        this.sessionTimeout = 1800000; // 30 minutes
        this.maxHistoryLength = 50;
        this.supportedIntents = [
            'greeting',
            'account_inquiry',
            'transaction_inquiry',
            'balance_check',
            'payment_issue',
            'fraud_report',
            'general_support',
            'complaint',
            'compliment',
            'goodbye'
        ];
    }
    /**
     * Process a chat message and generate response
     */
    async processChat(request) {
        const startTime = Date.now();
        try {
            // Get or create conversation session
            let session = this.getSession(request.sessionId);
            if (!session) {
                session = await this.createSession(request.sessionId, request.userId);
            }
            // Update session activity
            session.lastActivity = new Date();
            // Add user message to history
            const userTurn = {
                id: `turn_${Date.now()}`,
                timestamp: new Date(),
                role: 'user',
                message: request.message,
                metadata: request.metadata
            };
            // Classify intent and extract entities
            const classification = await this.classifyIntent(request.message, session.context);
            userTurn.intent = classification.intent;
            userTurn.entities = classification.entities;
            userTurn.confidence = classification.confidence;
            session.history.push(userTurn);
            // Update conversation context
            await this.updateContext(session, classification);
            // Generate response
            const response = await this.generateResponse(session, classification);
            // Add assistant response to history
            const assistantTurn = {
                id: `turn_${Date.now() + 1}`,
                timestamp: new Date(),
                role: 'assistant',
                message: response.message,
                intent: classification.intent,
                confidence: response.confidence || classification.confidence
            };
            session.history.push(assistantTurn);
            // Trim history if too long
            if (session.history.length > this.maxHistoryLength) {
                session.history = session.history.slice(-this.maxHistoryLength);
            }
            // Update session
            this.sessions.set(request.sessionId, session);
            const processingTime = Date.now() - startTime;
            const chatResponse = {
                sessionId: request.sessionId,
                message: response.message,
                intent: classification.intent,
                confidence: classification.confidence,
                suggestedActions: response.suggestedActions,
                requiresEscalation: session.context.requiresHumanHandoff,
                context: session.context,
                processingTime
            };
            // Emit events
            this.emit('chatProcessed', { request, response: chatResponse, session });
            return chatResponse;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            console.error('Chat processing error:', error);
            return {
                sessionId: request.sessionId,
                message: 'I apologize, but I encountered an error processing your request. Please try again or contact support.',
                intent: 'error',
                confidence: 0,
                requiresEscalation: true,
                context: this.getDefaultContext(),
                processingTime
            };
        }
    }
    /**
     * Get conversation session by ID
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        // Check if session has expired
        if (session && Date.now() - session.lastActivity.getTime() > this.sessionTimeout) {
            this.sessions.delete(sessionId);
            return undefined;
        }
        return session;
    }
    /**
     * Create new conversation session
     */
    async createSession(sessionId, userId) {
        // Get customer information
        const customerInfo = await this.getCustomerInfo(userId);
        const session = {
            sessionId,
            userId,
            startTime: new Date(),
            lastActivity: new Date(),
            context: {
                currentTopic: 'greeting',
                userIntent: 'greeting',
                entities: {},
                customerInfo,
                escalationLevel: 0,
                requiresHumanHandoff: false,
                confidenceScore: 1.0
            },
            history: [],
            metadata: {}
        };
        this.sessions.set(sessionId, session);
        this.emit('sessionCreated', { session });
        return session;
    }
    /**
     * End conversation session
     */
    endSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.sessions.delete(sessionId);
            this.emit('sessionEnded', { session });
        }
    }
    /**
     * Classify user intent using AI
     */
    async classifyIntent(message, context) {
        if (!this.geminiClient) {
            return this.fallbackIntentClassification(message);
        }
        try {
            const prompt = this.buildIntentClassificationPrompt(message, context);
            const request = {
                id: `intent_${Date.now()}`,
                timestamp: new Date(),
                prompt,
                options: {
                    temperature: 0.3, // Lower temperature for more consistent classification
                    maxTokens: 500
                }
            };
            const response = await this.geminiClient.generateStructuredResponse(request);
            if (response.success && response.structuredData) {
                const classification = response.structuredData;
                return {
                    intent: classification.primary_category || 'general_support',
                    confidence: classification.confidence_score || 0.5,
                    entities: classification.entities || {},
                    alternatives: classification.alternatives || []
                };
            }
            return this.fallbackIntentClassification(message);
        }
        catch (error) {
            console.error('Intent classification error:', error);
            return this.fallbackIntentClassification(message);
        }
    }
    /**
     * Generate response using AI
     */
    async generateResponse(session, classification) {
        if (!this.geminiClient) {
            return this.fallbackResponseGeneration(classification.intent);
        }
        try {
            const prompt = this.buildResponseGenerationPrompt(session, classification);
            const request = {
                id: `response_${Date.now()}`,
                timestamp: new Date(),
                prompt,
                systemInstruction: 'You are a helpful customer support assistant. Be professional, empathetic, and concise.',
                options: {
                    temperature: 0.7,
                    maxTokens: 800
                }
            };
            const response = await this.geminiClient.generateContent(request);
            if (response.success && response.content) {
                return this.parseResponseContent(response.content, classification.intent);
            }
            return this.fallbackResponseGeneration(classification.intent);
        }
        catch (error) {
            console.error('Response generation error:', error);
            return this.fallbackResponseGeneration(classification.intent);
        }
    }
    buildIntentClassificationPrompt(message, context) {
        return prompt_templates_1.PromptTemplateManager.renderTemplate('general-classification', {
            input_text: message,
            categories: this.supportedIntents.join(', '),
            classification_criteria: `
          - greeting: Hello, hi, good morning, etc.
          - account_inquiry: Questions about account details, status, settings
          - transaction_inquiry: Questions about specific transactions, payments
          - balance_check: Requests for account balance information
          - payment_issue: Problems with payments, failed transactions
          - fraud_report: Reporting suspicious activity or fraud
          - general_support: General help requests
          - complaint: Complaints about service or issues
          - compliment: Positive feedback or thanks
          - goodbye: Farewell messages
          
          Current context: ${context.currentTopic}
          Previous intent: ${context.userIntent}
        `
        });
    }
    buildResponseGenerationPrompt(session, classification) {
        const recentHistory = session.history.slice(-5).map(turn => `${turn.role}: ${turn.message}`).join('\n');
        const customerContext = session.context.customerInfo ? {
            account_type: session.context.customerInfo.accountType,
            interaction_count: session.context.customerInfo.interactionCount,
            id: session.context.customerInfo.userId
        } : undefined;
        return prompt_templates_1.PromptTemplateManager.renderTemplate('chatbot-customer-support', {
            company_name: 'Bank of Anthos',
            customer_info: customerContext,
            conversation_history: recentHistory,
            user_message: session.history[session.history.length - 1]?.message || ''
        });
    }
    parseResponseContent(content, intent) {
        // Simple parsing - in production, this would be more sophisticated
        const lines = content.split('\n').filter(line => line.trim());
        const message = lines[0] || 'How can I help you today?';
        const suggestedActions = this.getSuggestedActions(intent);
        return {
            message,
            tone: this.getToneForIntent(intent),
            suggestedActions,
            followUpQuestions: this.getFollowUpQuestions(intent)
        };
    }
    fallbackIntentClassification(message) {
        const lowerMessage = message.toLowerCase();
        // Simple keyword-based classification - check more specific intents first
        if (lowerMessage.includes('fraud') || lowerMessage.includes('suspicious') || lowerMessage.includes('unauthorized')) {
            return { intent: 'fraud_report', confidence: 0.9, entities: {}, alternatives: [] };
        }
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
            return { intent: 'greeting', confidence: 0.8, entities: {}, alternatives: [] };
        }
        if (lowerMessage.includes('balance')) {
            return { intent: 'balance_check', confidence: 0.8, entities: {}, alternatives: [] };
        }
        if (lowerMessage.includes('complaint') || lowerMessage.includes('problem') || lowerMessage.includes('issue')) {
            return { intent: 'complaint', confidence: 0.7, entities: {}, alternatives: [] };
        }
        if (lowerMessage.includes('payment') && (lowerMessage.includes('failed') || lowerMessage.includes('error') || lowerMessage.includes('issue'))) {
            return { intent: 'payment_issue', confidence: 0.8, entities: {}, alternatives: [] };
        }
        if (lowerMessage.includes('transaction')) {
            return { intent: 'transaction_inquiry', confidence: 0.7, entities: {}, alternatives: [] };
        }
        if (lowerMessage.includes('account')) {
            return { intent: 'account_inquiry', confidence: 0.7, entities: {}, alternatives: [] };
        }
        if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye') || lowerMessage.includes('farewell')) {
            return { intent: 'goodbye', confidence: 0.8, entities: {}, alternatives: [] };
        }
        if (lowerMessage.includes('thank') || lowerMessage.includes('thanks') || lowerMessage.includes('great') || lowerMessage.includes('good')) {
            return { intent: 'compliment', confidence: 0.6, entities: {}, alternatives: [] };
        }
        return { intent: 'general_support', confidence: 0.5, entities: {}, alternatives: [] };
    }
    fallbackResponseGeneration(intent) {
        const responses = {
            greeting: 'Hello! Welcome to Bank of Anthos. How can I assist you today?',
            account_inquiry: 'I can help you with your account information. What would you like to know?',
            transaction_inquiry: 'I can help you with transaction details. Could you provide more information?',
            balance_check: 'I can help you check your account balance. Let me retrieve that information.',
            payment_issue: 'I understand you\'re having payment issues. Let me help you resolve this.',
            fraud_report: 'Thank you for reporting this. Security is our priority. Let me escalate this immediately.',
            general_support: 'I\'m here to help. Could you please provide more details about what you need?',
            complaint: 'I apologize for any inconvenience. Let me help resolve your concern.',
            compliment: 'Thank you for your kind words! Is there anything else I can help you with?',
            goodbye: 'Thank you for contacting Bank of Anthos. Have a great day!'
        };
        return {
            message: responses[intent] || responses.general_support,
            tone: this.getToneForIntent(intent),
            suggestedActions: this.getSuggestedActions(intent),
            followUpQuestions: this.getFollowUpQuestions(intent)
        };
    }
    async updateContext(session, classification) {
        const context = session.context;
        // Update intent and topic
        context.userIntent = classification.intent;
        context.currentTopic = this.getTopicForIntent(classification.intent);
        // Merge entities
        context.entities = { ...context.entities, ...classification.entities };
        // Update confidence
        context.confidenceScore = classification.confidence;
        // Check for escalation triggers
        if (this.shouldEscalate(session, classification)) {
            context.escalationLevel++;
            context.requiresHumanHandoff = context.escalationLevel >= 3;
        }
        // Handle fraud reports immediately
        if (classification.intent === 'fraud_report') {
            context.requiresHumanHandoff = true;
            await this.handleFraudReport(session);
        }
    }
    shouldEscalate(session, classification) {
        // Escalate if confidence is low
        if (classification.confidence < 0.3)
            return true;
        // Escalate for certain intents
        const escalationIntents = ['fraud_report', 'complaint'];
        if (escalationIntents.includes(classification.intent))
            return true;
        // Escalate if conversation is going in circles
        const recentIntents = session.history.slice(-3).map(turn => turn.intent);
        if (recentIntents.length >= 3 && recentIntents.every(intent => intent === 'general_support')) {
            return true;
        }
        return false;
    }
    async handleFraudReport(session) {
        try {
            // Send A2A message to fraud detection agent
            await this.sendA2AMessage('fraud-reports', 'customer-fraud-report', {
                sessionId: session.sessionId,
                userId: session.userId,
                timestamp: new Date(),
                reportDetails: session.history.slice(-3) // Last 3 messages for context
            }, 'fraud-detection');
            this.emit('fraudReported', { session });
        }
        catch (error) {
            console.error('Error handling fraud report:', error);
        }
    }
    async getCustomerInfo(userId) {
        try {
            const profileData = await this.queryMCP('user-service', 'getUserProfile', { userId });
            return {
                userId,
                name: profileData.name,
                accountType: profileData.accountType || 'standard',
                accountStatus: profileData.accountStatus || 'active',
                preferredLanguage: profileData.preferredLanguage || 'en',
                interactionCount: profileData.interactionCount || 0,
                lastInteraction: profileData.lastInteraction ? new Date(profileData.lastInteraction) : undefined,
                riskLevel: profileData.riskLevel
            };
        }
        catch (error) {
            console.error('Error getting customer info:', error);
            return {
                userId,
                accountType: 'standard',
                accountStatus: 'active',
                preferredLanguage: 'en',
                interactionCount: 0
            };
        }
    }
    getTopicForIntent(intent) {
        const topicMap = {
            greeting: 'welcome',
            account_inquiry: 'account',
            transaction_inquiry: 'transactions',
            balance_check: 'balance',
            payment_issue: 'payments',
            fraud_report: 'security',
            general_support: 'support',
            complaint: 'complaints',
            compliment: 'feedback',
            goodbye: 'farewell'
        };
        return topicMap[intent] || 'general';
    }
    getToneForIntent(intent) {
        const toneMap = {
            greeting: 'friendly',
            account_inquiry: 'professional',
            transaction_inquiry: 'professional',
            balance_check: 'professional',
            payment_issue: 'empathetic',
            fraud_report: 'urgent',
            general_support: 'friendly',
            complaint: 'empathetic',
            compliment: 'friendly',
            goodbye: 'friendly'
        };
        return toneMap[intent] || 'professional';
    }
    getSuggestedActions(intent) {
        const actionMap = {
            greeting: ['Check Balance', 'View Transactions', 'Contact Support'],
            account_inquiry: ['Update Profile', 'Change Settings', 'View Statements'],
            transaction_inquiry: ['View Details', 'Dispute Transaction', 'Download Receipt'],
            balance_check: ['View Transactions', 'Transfer Money', 'Pay Bills'],
            payment_issue: ['Retry Payment', 'Update Payment Method', 'Contact Support'],
            fraud_report: ['Freeze Account', 'Contact Security', 'File Report'],
            general_support: ['FAQ', 'Contact Human Agent', 'Schedule Callback'],
            complaint: ['File Formal Complaint', 'Speak to Manager', 'Escalate Issue'],
            compliment: ['Leave Review', 'Refer Friend', 'Explore Services'],
            goodbye: ['Rate Experience', 'Schedule Follow-up', 'Save Conversation']
        };
        return actionMap[intent] || ['Contact Support', 'FAQ', 'Main Menu'];
    }
    getFollowUpQuestions(intent) {
        const questionMap = {
            greeting: ['What can I help you with today?', 'Are you looking for account information?'],
            account_inquiry: ['Which account would you like to inquire about?', 'What specific information do you need?'],
            transaction_inquiry: ['Which transaction are you asking about?', 'Do you have the transaction ID?'],
            balance_check: ['Which account balance would you like to check?'],
            payment_issue: ['What type of payment issue are you experiencing?', 'When did this issue occur?'],
            fraud_report: ['When did you notice this suspicious activity?', 'Which account is affected?'],
            general_support: ['Can you provide more details about your request?', 'What specific help do you need?'],
            complaint: ['Can you describe the issue in more detail?', 'When did this problem occur?'],
            compliment: ['Is there anything else I can help you with?'],
            goodbye: ['Was I able to resolve your issue today?']
        };
        return questionMap[intent] || ['Is there anything else I can help you with?'];
    }
    getDefaultContext() {
        return {
            currentTopic: 'general',
            userIntent: 'general_support',
            entities: {},
            escalationLevel: 0,
            requiresHumanHandoff: false,
            confidenceScore: 0.5
        };
    }
    // Override base agent request processing
    async processRequest(request) {
        try {
            const { action, payload } = request.payload;
            switch (action) {
                case 'process_chat':
                    const chatResponse = await this.processChat(payload);
                    return this.createSuccessResponse(request, { chatResponse });
                case 'get_session':
                    const session = this.getSession(payload.sessionId);
                    return this.createSuccessResponse(request, { session });
                case 'end_session':
                    this.endSession(payload.sessionId);
                    return this.createSuccessResponse(request, { ended: true });
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
    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        const expiredSessions = [];
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastActivity.getTime() > this.sessionTimeout) {
                expiredSessions.push(sessionId);
            }
        }
        expiredSessions.forEach(sessionId => {
            this.sessions.delete(sessionId);
            this.emit('sessionExpired', { sessionId });
        });
        if (expiredSessions.length > 0) {
            console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
        }
    }
    /**
     * Get active session count
     */
    getActiveSessionCount() {
        return this.sessions.size;
    }
    /**
     * Get session statistics
     */
    getSessionStatistics() {
        const activeSessions = this.sessions.size;
        let totalDuration = 0;
        const intentCounts = {};
        for (const session of this.sessions.values()) {
            totalDuration += Date.now() - session.startTime.getTime();
            for (const turn of session.history) {
                if (turn.intent) {
                    intentCounts[turn.intent] = (intentCounts[turn.intent] || 0) + 1;
                }
            }
        }
        const averageSessionDuration = activeSessions > 0 ? totalDuration / activeSessions : 0;
        const topIntents = Object.entries(intentCounts)
            .map(([intent, count]) => ({ intent, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        return {
            activeSessions,
            totalSessions: activeSessions, // In production, this would track historical data
            averageSessionDuration,
            topIntents
        };
    }
}
exports.ChatbotAgent = ChatbotAgent;
//# sourceMappingURL=chatbot-agent.js.map