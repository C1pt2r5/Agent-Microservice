"use strict";
/**
 * Agent-to-Agent (A2A) communication protocol type definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.A2A_TOPICS = exports.A2A_MESSAGE_TYPES = void 0;
// Predefined message types for common agent interactions
exports.A2A_MESSAGE_TYPES = {
    FRAUD_ALERT: 'fraud.alert',
    FRAUD_RISK_SCORE: 'fraud.risk_score',
    RECOMMENDATION_REQUEST: 'recommendation.request',
    RECOMMENDATION_RESPONSE: 'recommendation.response',
    CHAT_CONTEXT_UPDATE: 'chat.context_update',
    AGENT_STATUS_UPDATE: 'agent.status_update',
    SYSTEM_ALERT: 'system.alert'
};
exports.A2A_TOPICS = {
    FRAUD_DETECTION: 'fraud-detection',
    RECOMMENDATIONS: 'recommendations',
    CHAT_SUPPORT: 'chat-support',
    SYSTEM_EVENTS: 'system-events'
};
//# sourceMappingURL=a2a.types.js.map