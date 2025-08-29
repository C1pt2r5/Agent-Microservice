/**
 * Unit tests for A2A message validator
 */

import { A2AMessageValidator } from '../message-validator';
import { A2AMessage } from '../../../types';

describe('A2AMessageValidator', () => {
  let validator: A2AMessageValidator;

  beforeEach(() => {
    validator = new A2AMessageValidator();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('validate', () => {
    const validMessage: A2AMessage = {
      id: 'test-message-1',
      timestamp: new Date(),
      sourceAgent: 'test-agent',
      targetAgent: 'target-agent',
      topic: 'test-topic',
      messageType: 'test.message',
      priority: 'normal',
      payload: { data: 'test' },
      metadata: {
        correlationId: 'corr-123',
        ttl: 300000,
        retryCount: 0,
        deliveryAttempts: 0
      }
    };

    it('should validate a correct message', () => {
      const result = validator.validate(validMessage);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject message without required fields', () => {
      const invalidMessage = { ...validMessage };
      delete (invalidMessage as any).id;
      delete (invalidMessage as any).sourceAgent;

      const result = validator.validate(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message ID is required');
      expect(result.errors).toContain('Source agent is required');
    });

    it('should reject message with invalid priority', () => {
      const invalidMessage = { ...validMessage, priority: 'invalid' as any };

      const result = validator.validate(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Priority must be low, normal, or high');
    });

    it('should reject message with invalid timestamp', () => {
      const invalidMessage = { ...validMessage, timestamp: 'invalid' as any };

      const result = validator.validate(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Timestamp must be a Date object');
    });

    it('should reject message with old timestamp', () => {
      const oldTimestamp = new Date(Date.now() - 2 * 3600000); // 2 hours ago
      const invalidMessage = { ...validMessage, timestamp: oldTimestamp };

      const result = validator.validate(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message timestamp is too old (more than 1 hour)');
    });

    it('should reject message with future timestamp', () => {
      const futureTimestamp = new Date(Date.now() + 10 * 60000); // 10 minutes in future
      const invalidMessage = { ...validMessage, timestamp: futureTimestamp };

      const result = validator.validate(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message timestamp is too far in the future (more than 5 minutes)');
    });

    it('should reject message with large payload', () => {
      const largePayload = { data: 'x'.repeat(1024 * 1024 + 1) }; // > 1MB
      const invalidMessage = { ...validMessage, payload: largePayload };

      const result = validator.validate(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Payload size must be less than 1MB');
    });

    it('should reject message with invalid metadata', () => {
      const invalidMessage = {
        ...validMessage,
        metadata: {
          correlationId: '',
          ttl: -1,
          retryCount: 15,
          deliveryAttempts: 25
        }
      };

      const result = validator.validate(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Correlation ID is required in metadata');
      expect(result.errors).toContain('TTL must be a positive number');
      expect(result.errors).toContain('Retry count must be 10 or less');
      expect(result.errors).toContain('Delivery attempts must be 20 or less');
    });
  });

  describe('validateMessageType', () => {
    it('should validate correct message type format', () => {
      const result = validator.validateMessageType('fraud.alert');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid message type format', () => {
      const result = validator.validateMessageType('InvalidFormat');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message type must follow pattern: category.action (lowercase, alphanumeric with underscores)');
    });

    it('should reject empty message type', () => {
      const result = validator.validateMessageType('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message type is required');
    });
  });

  describe('validateTopicName', () => {
    it('should validate correct topic name format', () => {
      const result = validator.validateTopicName('fraud-detection');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid topic name format', () => {
      const result = validator.validateTopicName('Invalid_Topic');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Topic name must be lowercase alphanumeric with hyphens');
    });

    it('should reject topic name with consecutive hyphens', () => {
      const result = validator.validateTopicName('fraud--detection');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Topic name cannot contain consecutive hyphens');
    });
  });

  describe('validateAgentId', () => {
    it('should validate correct agent ID format', () => {
      const result = validator.validateAgentId('fraud-agent-001');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short agent ID', () => {
      const result = validator.validateAgentId('ab');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agent ID must be at least 3 characters');
    });

    it('should reject long agent ID', () => {
      const longId = 'a'.repeat(51);
      const result = validator.validateAgentId(longId);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agent ID must be 50 characters or less');
    });
  });

  describe('sanitizePayload', () => {
    it('should sanitize HTML tags from string values', () => {
      const payload = {
        message: '<script>alert("xss")</script>Hello <b>World</b>',
        data: { nested: '<img src="x" onerror="alert(1)">' }
      };

      const sanitized = validator.sanitizePayload(payload);
      expect(sanitized.message).toBe('Hello World');
      expect(sanitized.data.nested).toBe('');
    });

    it('should preserve non-string values', () => {
      const payload = {
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        null: null
      };

      const sanitized = validator.sanitizePayload(payload);
      expect(sanitized.number).toBe(42);
      expect(sanitized.boolean).toBe(true);
      expect(sanitized.array).toEqual([1, 2, 3]);
      expect(sanitized.null).toBe(null);
    });

    it('should sanitize object keys', () => {
      const payload = {
        'key<script>': 'value',
        'normal_key': 'normal_value'
      };

      const sanitized = validator.sanitizePayload(payload);
      expect(sanitized['keyscript']).toBe('value');
      expect(sanitized['normal_key']).toBe('normal_value');
    });
  });
});