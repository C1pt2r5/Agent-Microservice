/**
 * Chatbot agent implementation with conversational AI capabilities
 */
import { ConcreteBaseAgent } from '../base/base-agent';
import { AgentRequest, AgentResponse } from '../../types';
export interface ConversationSession {
    sessionId: string;
    userId: string;
    startTime: Date;
    lastActivity: Date;
    context: ConversationContext;
    history: ConversationTurn[];
    metadata: Record<string, any>;
}
export interface ConversationContext {
    currentTopic: string;
    userIntent: string;
    entities: Record<string, any>;
    customerInfo?: CustomerInfo;
    escalationLevel: number;
    requiresHumanHandoff: boolean;
    confidenceScore: number;
}
export interface ConversationTurn {
    id: string;
    timestamp: Date;
    role: 'user' | 'assistant' | 'system';
    message: string;
    intent?: string;
    entities?: Record<string, any>;
    confidence?: number;
    metadata?: Record<string, any>;
}
export interface CustomerInfo {
    userId: string;
    name?: string;
    accountType: string;
    accountStatus: string;
    preferredLanguage: string;
    interactionCount: number;
    lastInteraction?: Date;
    riskLevel?: string;
}
export interface ChatRequest {
    sessionId: string;
    userId: string;
    message: string;
    channel: 'web' | 'mobile' | 'api';
    metadata?: Record<string, any>;
}
export interface ChatResponse {
    sessionId: string;
    message: string;
    intent: string;
    confidence: number;
    suggestedActions?: string[];
    requiresEscalation: boolean;
    context: ConversationContext;
    processingTime: number;
}
export interface IntentClassification {
    intent: string;
    confidence: number;
    entities: Record<string, any>;
    alternatives: Array<{
        intent: string;
        confidence: number;
    }>;
}
export interface ResponseGeneration {
    message: string;
    tone: 'professional' | 'friendly' | 'empathetic' | 'urgent';
    suggestedActions: string[];
    followUpQuestions: string[];
    confidence?: number;
}
export declare class ChatbotAgent extends ConcreteBaseAgent {
    private sessions;
    private sessionTimeout;
    private maxHistoryLength;
    private supportedIntents;
    /**
     * Process a chat message and generate response
     */
    processChat(request: ChatRequest): Promise<ChatResponse>;
    /**
     * Get conversation session by ID
     */
    getSession(sessionId: string): ConversationSession | undefined;
    /**
     * Create new conversation session
     */
    createSession(sessionId: string, userId: string): Promise<ConversationSession>;
    /**
     * End conversation session
     */
    endSession(sessionId: string): void;
    /**
     * Classify user intent using AI
     */
    private classifyIntent;
    /**
     * Generate response using AI
     */
    private generateResponse;
    private buildIntentClassificationPrompt;
    private buildResponseGenerationPrompt;
    private parseResponseContent;
    private fallbackIntentClassification;
    private fallbackResponseGeneration;
    private updateContext;
    private shouldEscalate;
    private handleFraudReport;
    private getCustomerInfo;
    private getTopicForIntent;
    private getToneForIntent;
    private getSuggestedActions;
    private getFollowUpQuestions;
    private getDefaultContext;
    processRequest(request: AgentRequest): Promise<AgentResponse>;
    private createSuccessResponse;
    private createErrorResponse;
    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions(): void;
    /**
     * Get active session count
     */
    getActiveSessionCount(): number;
    /**
     * Get session statistics
     */
    getSessionStatistics(): {
        activeSessions: number;
        totalSessions: number;
        averageSessionDuration: number;
        topIntents: Array<{
            intent: string;
            count: number;
        }>;
    };
}
//# sourceMappingURL=chatbot-agent.d.ts.map