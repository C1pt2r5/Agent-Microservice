/**
 * Unit tests for A2A message serializer
 */

import { A2AMessageSerializer } from '../message-serializer';
import { A2AMessage } from '../../../types';

describe('A2AMessageSerializer', () => {
  let serializer: A2AMessageSerializer;

  beforeEach(() => {
    serializer = new A2AMessageSerializer();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  const testMessage: A2AMessage = {
    id: 'test-message-1',
    timestamp: new Date('2025-01-21T10:30:00Z'),
    sourceAgent: 'test-agent',
    targetAgent: 'target-agent',
    topic: 'test-topic',
    messageType: 'test.message',
    priority: 'normal',
    payload: { data: 'test', number: 42 },
    metadata: {
      correlationId: 'corr-123',
      ttl: 300000,
      retryCount: 0,
      deliveryAttempts: 0,
      routingKey: 'test.route',
      replyTo: 'reply-agent'
    }
  };

  describe('serialize and deserialize', () => {
    it('should serialize and deserialize a message correctly', () => {
      const serialized = serializer.serialize(testMessage);
      const deserialized = serializer.deserialize(serialized);

      expect(deserialized.id).toBe(testMessage.id);
      expect(deserialized.sourceAgent).toBe(testMessage.sourceAgent);
      expect(deserialized.targetAgent).toBe(testMessage.targetAgent);
      expect(deserialized.topic).toBe(testMessage.topic);
      expect(deserialized.messageType).toBe(testMessage.messageType);
      expect(deserialized.priority).toBe(testMessage.priority);
      expect(deserialized.payload).toEqual(testMessage.payload);
      expect(deserialized.metadata.correlationId).toBe(testMessage.metadata.correlationId);
      expect(deserialized.timestamp).toEqual(testMessage.timestamp);
    });

    it('should serialize with schema when requested', () => {
      const serialized = serializer.serialize(testMessage, { includeSchema: true });
      const parsed = JSON.parse(serialized);

      expect(parsed._schema).toBeDefined();
      expect(parsed._schema.version).toBe('1.0.0');
      expect(parsed._schema.serializedAt).toBeDefined();
    });

    it('should handle compression', () => {
      const serialized = serializer.serialize(testMessage, { compress: true });
      expect(serialized).toMatch(/^COMPRESSED:/);

      const deserialized = serializer.deserialize(serialized);
      expect(deserialized.id).toBe(testMessage.id);
    });

    it('should throw error for invalid JSON during deserialization', () => {
      expect(() => {
        serializer.deserialize('invalid json');
      }).toThrow('Message deserialization failed');
    });
  });

  describe('binary serialization', () => {
    it('should serialize and deserialize to/from binary', () => {
      const binary = serializer.serializeToBinary(testMessage);
      expect(binary).toBeInstanceOf(Buffer);

      const deserialized = serializer.deserializeFromBinary(binary);
      expect(deserialized.id).toBe(testMessage.id);
      expect(deserialized.payload).toEqual(testMessage.payload);
    });
  });

  describe('message hash', () => {
    it('should create consistent hash for same message content', () => {
      const hash1 = serializer.createMessageHash(testMessage);
      const hash2 = serializer.createMessageHash(testMessage);
      expect(hash1).toBe(hash2);
    });

    it('should create different hash for different message content', () => {
      const message2 = { ...testMessage, payload: { data: 'different' } };
      const hash1 = serializer.createMessageHash(testMessage);
      const hash2 = serializer.createMessageHash(message2);
      expect(hash1).not.toBe(hash2);
    });

    it('should ignore timestamp and ID in hash calculation', () => {
      const message2 = {
        ...testMessage,
        id: 'different-id',
        timestamp: new Date('2025-01-21T11:00:00Z')
      };
      const hash1 = serializer.createMessageHash(testMessage);
      const hash2 = serializer.createMessageHash(message2);
      expect(hash1).toBe(hash2);
    });
  });

  describe('batch operations', () => {
    it('should serialize and deserialize message batches', () => {
      const messages = [
        testMessage,
        { ...testMessage, id: 'test-message-2', payload: { data: 'test2' } }
      ];

      const serialized = serializer.serializeBatch(messages);
      const deserialized = serializer.deserializeBatch(serialized);

      expect(deserialized).toHaveLength(2);
      expect(deserialized[0].id).toBe('test-message-1');
      expect(deserialized[1].id).toBe('test-message-2');
      expect(deserialized[1].payload.data).toBe('test2');
    });

    it('should handle compressed batch serialization', () => {
      const messages = [testMessage];
      const serialized = serializer.serializeBatch(messages, { compress: true });
      expect(serialized).toMatch(/^COMPRESSED:/);

      const deserialized = serializer.deserializeBatch(serialized);
      expect(deserialized).toHaveLength(1);
      expect(deserialized[0].id).toBe(testMessage.id);
    });

    it('should throw error for invalid batch format', () => {
      expect(() => {
        serializer.deserializeBatch('{"invalid": "batch"}');
      }).toThrow('Invalid batch format');
    });
  });

  describe('serialization statistics', () => {
    it('should provide serialization statistics', () => {
      const stats = serializer.getSerializationStats(testMessage);

      expect(stats.originalSize).toBeGreaterThan(0);
      expect(stats.serializedSize).toBeGreaterThan(0);
      expect(stats.compressedSize).toBeGreaterThan(0);
      expect(stats.compressionRatio).toBeGreaterThan(0);
      expect(stats.compressionRatio).toBeLessThanOrEqual(1);
    });

    it('should show compression benefits for large messages', () => {
      const largeMessage = {
        ...testMessage,
        payload: {
          data: 'x'.repeat(1000),
          moreData: 'y'.repeat(1000)
        }
      };

      const stats = serializer.getSerializationStats(largeMessage);
      expect(stats.compressedSize).toBeLessThan(stats.originalSize);
      expect(stats.compressionRatio).toBeLessThan(1);
    });
  });

  describe('error handling', () => {
    it('should handle serialization errors gracefully', () => {
      const circularMessage = { ...testMessage };
      circularMessage.payload = { self: circularMessage };

      expect(() => {
        serializer.serialize(circularMessage);
      }).toThrow('Message serialization failed');
    });

    it('should handle binary serialization errors', () => {
      const circularMessage = { ...testMessage };
      circularMessage.payload = { self: circularMessage };

      expect(() => {
        serializer.serializeToBinary(circularMessage);
      }).toThrow('Binary serialization failed');
    });

    it('should handle binary deserialization errors', () => {
      const invalidBuffer = Buffer.from('invalid json', 'utf8');

      expect(() => {
        serializer.deserializeFromBinary(invalidBuffer);
      }).toThrow('Binary deserialization failed');
    });
  });
});