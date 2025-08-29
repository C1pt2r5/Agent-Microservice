"use strict";
/**
 * A2A message serialization and deserialization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.A2AMessageSerializer = void 0;
class A2AMessageSerializer {
    constructor() {
        this.SCHEMA_VERSION = '1.0.0';
    }
    /**
     * Serialize an A2A message to string
     */
    serialize(message, options = {}) {
        try {
            const serializable = this.prepareForSerialization(message, options);
            const jsonString = JSON.stringify(serializable);
            if (options.compress) {
                return this.compress(jsonString);
            }
            return jsonString;
        }
        catch (error) {
            throw new Error(`Message serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Deserialize a string to A2A message
     */
    deserialize(data, options = {}) {
        try {
            let jsonString = data;
            // Decompress if needed
            if (this.isCompressed(data)) {
                jsonString = this.decompress(data);
            }
            const parsed = JSON.parse(jsonString);
            return this.reconstructFromSerialized(parsed, options);
        }
        catch (error) {
            throw new Error(`Message deserialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Serialize message to binary format (for efficient storage/transmission)
     */
    serializeToBinary(message) {
        try {
            const jsonString = this.serialize(message, { compress: true });
            return Buffer.from(jsonString, 'utf8');
        }
        catch (error) {
            throw new Error(`Binary serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Deserialize from binary format
     */
    deserializeFromBinary(buffer) {
        try {
            const jsonString = buffer.toString('utf8');
            return this.deserialize(jsonString);
        }
        catch (error) {
            throw new Error(`Binary deserialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Create a message hash for deduplication
     */
    createMessageHash(message) {
        const hashableContent = {
            sourceAgent: message.sourceAgent,
            targetAgent: message.targetAgent,
            topic: message.topic,
            messageType: message.messageType,
            payload: JSON.stringify(message.payload), // Ensure payload content is included in hash
            correlationId: message.metadata.correlationId
        };
        const contentString = JSON.stringify(hashableContent, Object.keys(hashableContent).sort());
        return this.simpleHash(contentString);
    }
    /**
     * Prepare message for serialization
     */
    prepareForSerialization(message, options) {
        const serializable = {
            id: message.id,
            timestamp: message.timestamp.toISOString(),
            sourceAgent: message.sourceAgent,
            targetAgent: message.targetAgent,
            topic: message.topic,
            messageType: message.messageType,
            priority: message.priority,
            payload: message.payload,
            metadata: {
                correlationId: message.metadata.correlationId,
                ttl: message.metadata.ttl,
                retryCount: message.metadata.retryCount,
                deliveryAttempts: message.metadata.deliveryAttempts,
                routingKey: message.metadata.routingKey,
                replyTo: message.metadata.replyTo
            }
        };
        if (options.includeSchema) {
            serializable._schema = {
                version: this.SCHEMA_VERSION,
                serializedAt: new Date().toISOString()
            };
        }
        return serializable;
    }
    /**
     * Reconstruct message from serialized data
     */
    reconstructFromSerialized(data, options) {
        // Validate schema if present
        if (data._schema && options.validateOnDeserialize) {
            this.validateSchema(data._schema);
        }
        const message = {
            id: data.id,
            timestamp: new Date(data.timestamp),
            sourceAgent: data.sourceAgent,
            targetAgent: data.targetAgent,
            topic: data.topic,
            messageType: data.messageType,
            priority: data.priority,
            payload: data.payload,
            metadata: {
                correlationId: data.metadata.correlationId,
                ttl: data.metadata.ttl,
                retryCount: data.metadata.retryCount || 0,
                deliveryAttempts: data.metadata.deliveryAttempts || 0,
                routingKey: data.metadata.routingKey,
                replyTo: data.metadata.replyTo
            }
        };
        return message;
    }
    /**
     * Validate schema version compatibility
     */
    validateSchema(schema) {
        if (!schema.version) {
            throw new Error('Schema version is missing');
        }
        const [major, minor] = schema.version.split('.').map(Number);
        const [currentMajor, currentMinor] = this.SCHEMA_VERSION.split('.').map(Number);
        // Major version must match, minor version can be backward compatible
        if (major !== currentMajor) {
            throw new Error(`Incompatible schema version: ${schema.version} (current: ${this.SCHEMA_VERSION})`);
        }
        if (minor > currentMinor) {
            console.warn(`Message uses newer schema version: ${schema.version} (current: ${this.SCHEMA_VERSION})`);
        }
    }
    /**
     * Simple compression using basic string compression
     */
    compress(data) {
        // Simple compression: minify JSON and use dictionary compression for common patterns
        // In production, use a proper compression library like zlib
        let compressed = data
            .replace(/\s+/g, '') // Remove all whitespace
            .replace(/"timestamp":/g, '"t":')
            .replace(/"sourceAgent":/g, '"s":')
            .replace(/"targetAgent":/g, '"ta":')
            .replace(/"messageType":/g, '"mt":')
            .replace(/"correlationId":/g, '"c":')
            .replace(/"metadata":/g, '"m":')
            .replace(/"payload":/g, '"p":');
        return `COMPRESSED:${compressed}`;
    }
    /**
     * Decompress data
     */
    decompress(data) {
        if (!data.startsWith('COMPRESSED:')) {
            return data;
        }
        const compressed = data.substring('COMPRESSED:'.length);
        // Restore original field names and formatting
        const decompressed = compressed
            .replace(/"t":/g, '"timestamp":')
            .replace(/"s":/g, '"sourceAgent":')
            .replace(/"ta":/g, '"targetAgent":')
            .replace(/"mt":/g, '"messageType":')
            .replace(/"c":/g, '"correlationId":')
            .replace(/"m":/g, '"metadata":')
            .replace(/"p":/g, '"payload":');
        return decompressed;
    }
    /**
     * Check if data is compressed
     */
    isCompressed(data) {
        return data.startsWith('COMPRESSED:');
    }
    /**
     * Simple hash function for message deduplication
     */
    simpleHash(str) {
        let hash = 0;
        if (str.length === 0)
            return hash.toString();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }
    /**
     * Batch serialize multiple messages
     */
    serializeBatch(messages, options = {}) {
        try {
            const batch = {
                version: this.SCHEMA_VERSION,
                timestamp: new Date().toISOString(),
                count: messages.length,
                messages: messages.map(msg => this.prepareForSerialization(msg, options))
            };
            const jsonString = JSON.stringify(batch);
            if (options.compress) {
                return this.compress(jsonString);
            }
            return jsonString;
        }
        catch (error) {
            throw new Error(`Batch serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Batch deserialize multiple messages
     */
    deserializeBatch(data, options = {}) {
        try {
            let jsonString = data;
            if (this.isCompressed(data)) {
                jsonString = this.decompress(data);
            }
            const batch = JSON.parse(jsonString);
            if (!batch.messages || !Array.isArray(batch.messages)) {
                throw new Error('Invalid batch format');
            }
            return batch.messages.map((msgData) => this.reconstructFromSerialized(msgData, options));
        }
        catch (error) {
            throw new Error(`Batch deserialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get serialization statistics
     */
    getSerializationStats(message) {
        const original = JSON.stringify(message);
        const serialized = this.serialize(message);
        const compressed = this.serialize(message, { compress: true });
        const originalSize = Buffer.byteLength(original, 'utf8');
        const serializedSize = Buffer.byteLength(serialized, 'utf8');
        const compressedSize = Buffer.byteLength(compressed, 'utf8');
        return {
            originalSize,
            serializedSize,
            compressedSize,
            compressionRatio: compressedSize / originalSize
        };
    }
}
exports.A2AMessageSerializer = A2AMessageSerializer;
//# sourceMappingURL=message-serializer.js.map