/**
 * A2A message serialization and deserialization
 */

import { A2AMessage } from '../../types';

export interface SerializationOptions {
  compress?: boolean;
  includeSchema?: boolean;
  validateOnDeserialize?: boolean;
}

export class A2AMessageSerializer {
  private readonly SCHEMA_VERSION = '1.0.0';

  /**
   * Serialize an A2A message to string
   */
  serialize(message: A2AMessage, options: SerializationOptions = {}): string {
    try {
      const serializable = this.prepareForSerialization(message, options);
      const jsonString = JSON.stringify(serializable);

      if (options.compress) {
        return this.compress(jsonString);
      }

      return jsonString;
    } catch (error) {
      throw new Error(`Message serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deserialize a string to A2A message
   */
  deserialize(data: string, options: SerializationOptions = {}): A2AMessage {
    try {
      let jsonString = data;

      // Decompress if needed
      if (this.isCompressed(data)) {
        jsonString = this.decompress(data);
      }

      const parsed = JSON.parse(jsonString);
      return this.reconstructFromSerialized(parsed, options);
    } catch (error) {
      throw new Error(`Message deserialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Serialize message to binary format (for efficient storage/transmission)
   */
  serializeToBinary(message: A2AMessage): Buffer {
    try {
      const jsonString = this.serialize(message, { compress: true });
      return Buffer.from(jsonString, 'utf8');
    } catch (error) {
      throw new Error(`Binary serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deserialize from binary format
   */
  deserializeFromBinary(buffer: Buffer): A2AMessage {
    try {
      const jsonString = buffer.toString('utf8');
      return this.deserialize(jsonString);
    } catch (error) {
      throw new Error(`Binary deserialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a message hash for deduplication
   */
  createMessageHash(message: A2AMessage): string {
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
  private prepareForSerialization(message: A2AMessage, options: SerializationOptions): any {
    const serializable: any = {
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
  private reconstructFromSerialized(data: any, options: SerializationOptions): A2AMessage {
    // Validate schema if present
    if (data._schema && options.validateOnDeserialize) {
      this.validateSchema(data._schema);
    }

    const message: A2AMessage = {
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
  private validateSchema(schema: any): void {
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
  private compress(data: string): string {
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
  private decompress(data: string): string {
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
  private isCompressed(data: string): boolean {
    return data.startsWith('COMPRESSED:');
  }

  /**
   * Simple hash function for message deduplication
   */
  private simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
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
  serializeBatch(messages: A2AMessage[], options: SerializationOptions = {}): string {
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
    } catch (error) {
      throw new Error(`Batch serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch deserialize multiple messages
   */
  deserializeBatch(data: string, options: SerializationOptions = {}): A2AMessage[] {
    try {
      let jsonString = data;

      if (this.isCompressed(data)) {
        jsonString = this.decompress(data);
      }

      const batch = JSON.parse(jsonString);

      if (!batch.messages || !Array.isArray(batch.messages)) {
        throw new Error('Invalid batch format');
      }

      return batch.messages.map((msgData: any) => 
        this.reconstructFromSerialized(msgData, options)
      );
    } catch (error) {
      throw new Error(`Batch deserialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get serialization statistics
   */
  getSerializationStats(message: A2AMessage): {
    originalSize: number;
    serializedSize: number;
    compressedSize: number;
    compressionRatio: number;
  } {
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