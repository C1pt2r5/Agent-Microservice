"use strict";
/**
 * A2A message validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.A2AMessageValidator = void 0;
class A2AMessageValidator {
    /**
     * Validate an A2A message
     */
    validate(message) {
        const errors = [];
        // Required fields validation
        if (!message.id) {
            errors.push('Message ID is required');
        }
        if (!message.timestamp) {
            errors.push('Timestamp is required');
        }
        else if (!(message.timestamp instanceof Date)) {
            errors.push('Timestamp must be a Date object');
        }
        if (!message.sourceAgent) {
            errors.push('Source agent is required');
        }
        if (!message.topic) {
            errors.push('Topic is required');
        }
        if (!message.messageType) {
            errors.push('Message type is required');
        }
        if (!message.priority) {
            errors.push('Priority is required');
        }
        else if (!['low', 'normal', 'high'].includes(message.priority)) {
            errors.push('Priority must be low, normal, or high');
        }
        if (!message.payload) {
            errors.push('Payload is required');
        }
        else if (typeof message.payload !== 'object') {
            errors.push('Payload must be an object');
        }
        if (!message.metadata) {
            errors.push('Metadata is required');
        }
        else {
            const metadataErrors = this.validateMetadata(message.metadata);
            errors.push(...metadataErrors);
        }
        // Business logic validation
        if (message.id && message.id.length > 100) {
            errors.push('Message ID must be 100 characters or less');
        }
        if (message.sourceAgent && message.sourceAgent.length > 50) {
            errors.push('Source agent name must be 50 characters or less');
        }
        if (message.targetAgent && message.targetAgent.length > 50) {
            errors.push('Target agent name must be 50 characters or less');
        }
        if (message.topic && message.topic.length > 100) {
            errors.push('Topic name must be 100 characters or less');
        }
        if (message.messageType && message.messageType.length > 100) {
            errors.push('Message type must be 100 characters or less');
        }
        // Payload size validation (max 1MB)
        if (message.payload) {
            const payloadSize = JSON.stringify(message.payload).length;
            if (payloadSize > 1024 * 1024) {
                errors.push('Payload size must be less than 1MB');
            }
        }
        // Timestamp validation
        if (message.timestamp) {
            const now = new Date();
            const messageTime = new Date(message.timestamp);
            const timeDiff = Math.abs(now.getTime() - messageTime.getTime());
            // Allow messages up to 1 hour in the past or 5 minutes in the future
            if (timeDiff > 3600000 && messageTime < now) {
                errors.push('Message timestamp is too old (more than 1 hour)');
            }
            if (timeDiff > 300000 && messageTime > now) {
                errors.push('Message timestamp is too far in the future (more than 5 minutes)');
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Validate message metadata
     */
    validateMetadata(metadata) {
        const errors = [];
        if (!metadata.correlationId) {
            errors.push('Correlation ID is required in metadata');
        }
        else if (metadata.correlationId.length > 100) {
            errors.push('Correlation ID must be 100 characters or less');
        }
        if (!metadata.ttl) {
            errors.push('TTL is required in metadata');
        }
        else if (typeof metadata.ttl !== 'number' || metadata.ttl <= 0) {
            errors.push('TTL must be a positive number');
        }
        else if (metadata.ttl > 86400000) { // 24 hours
            errors.push('TTL must be less than 24 hours');
        }
        if (metadata.retryCount !== undefined) {
            if (typeof metadata.retryCount !== 'number' || metadata.retryCount < 0) {
                errors.push('Retry count must be a non-negative number');
            }
            else if (metadata.retryCount > 10) {
                errors.push('Retry count must be 10 or less');
            }
        }
        if (metadata.deliveryAttempts !== undefined) {
            if (typeof metadata.deliveryAttempts !== 'number' || metadata.deliveryAttempts < 0) {
                errors.push('Delivery attempts must be a non-negative number');
            }
            else if (metadata.deliveryAttempts > 20) {
                errors.push('Delivery attempts must be 20 or less');
            }
        }
        if (metadata.routingKey && metadata.routingKey.length > 200) {
            errors.push('Routing key must be 200 characters or less');
        }
        if (metadata.replyTo && metadata.replyTo.length > 100) {
            errors.push('Reply-to must be 100 characters or less');
        }
        return errors;
    }
    /**
     * Validate message type format
     */
    validateMessageType(messageType) {
        const errors = [];
        if (!messageType) {
            errors.push('Message type is required');
            return { isValid: false, errors };
        }
        // Message type should follow pattern: category.action (e.g., fraud.alert, chat.message)
        const messageTypePattern = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
        if (!messageTypePattern.test(messageType)) {
            errors.push('Message type must follow pattern: category.action (lowercase, alphanumeric with underscores)');
        }
        if (messageType.length > 100) {
            errors.push('Message type must be 100 characters or less');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Validate topic name format
     */
    validateTopicName(topic) {
        const errors = [];
        if (!topic) {
            errors.push('Topic name is required');
            return { isValid: false, errors };
        }
        // Topic should follow pattern: category-subcategory (e.g., fraud-detection, chat-support)
        const topicPattern = /^[a-z][a-z0-9-]*$/;
        if (!topicPattern.test(topic)) {
            errors.push('Topic name must be lowercase alphanumeric with hyphens');
        }
        if (topic.length > 100) {
            errors.push('Topic name must be 100 characters or less');
        }
        if (topic.startsWith('-') || topic.endsWith('-')) {
            errors.push('Topic name cannot start or end with a hyphen');
        }
        if (topic.includes('--')) {
            errors.push('Topic name cannot contain consecutive hyphens');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Validate agent ID format
     */
    validateAgentId(agentId) {
        const errors = [];
        if (!agentId) {
            errors.push('Agent ID is required');
            return { isValid: false, errors };
        }
        // Agent ID should be alphanumeric with hyphens and underscores
        const agentIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
        if (!agentIdPattern.test(agentId)) {
            errors.push('Agent ID must be alphanumeric with hyphens and underscores');
        }
        if (agentId.length > 50) {
            errors.push('Agent ID must be 50 characters or less');
        }
        if (agentId.length < 3) {
            errors.push('Agent ID must be at least 3 characters');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Sanitize message payload to prevent injection attacks
     */
    sanitizePayload(payload) {
        const sanitized = {};
        for (const [key, value] of Object.entries(payload)) {
            // Sanitize key
            const sanitizedKey = key.replace(/[<>\"'&]/g, '');
            if (typeof value === 'string') {
                // Basic HTML/script tag removal for string values
                sanitized[sanitizedKey] = value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<[^>]*>/g, '')
                    .trim();
            }
            else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Recursively sanitize nested objects
                sanitized[sanitizedKey] = this.sanitizePayload(value);
            }
            else {
                // Keep other types as-is (numbers, booleans, arrays, null)
                sanitized[sanitizedKey] = value;
            }
        }
        return sanitized;
    }
}
exports.A2AMessageValidator = A2AMessageValidator;
//# sourceMappingURL=message-validator.js.map