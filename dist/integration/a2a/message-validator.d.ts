/**
 * A2A message validation
 */
import { A2AMessage } from '../../types';
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}
export declare class A2AMessageValidator {
    /**
     * Validate an A2A message
     */
    validate(message: A2AMessage): ValidationResult;
    /**
     * Validate message metadata
     */
    private validateMetadata;
    /**
     * Validate message type format
     */
    validateMessageType(messageType: string): ValidationResult;
    /**
     * Validate topic name format
     */
    validateTopicName(topic: string): ValidationResult;
    /**
     * Validate agent ID format
     */
    validateAgentId(agentId: string): ValidationResult;
    /**
     * Sanitize message payload to prevent injection attacks
     */
    sanitizePayload(payload: Record<string, any>): Record<string, any>;
}
//# sourceMappingURL=message-validator.d.ts.map