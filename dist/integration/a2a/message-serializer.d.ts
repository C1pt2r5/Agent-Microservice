/**
 * A2A message serialization and deserialization
 */
import { A2AMessage } from '../../types';
export interface SerializationOptions {
    compress?: boolean;
    includeSchema?: boolean;
    validateOnDeserialize?: boolean;
}
export declare class A2AMessageSerializer {
    private readonly SCHEMA_VERSION;
    /**
     * Serialize an A2A message to string
     */
    serialize(message: A2AMessage, options?: SerializationOptions): string;
    /**
     * Deserialize a string to A2A message
     */
    deserialize(data: string, options?: SerializationOptions): A2AMessage;
    /**
     * Serialize message to binary format (for efficient storage/transmission)
     */
    serializeToBinary(message: A2AMessage): Buffer;
    /**
     * Deserialize from binary format
     */
    deserializeFromBinary(buffer: Buffer): A2AMessage;
    /**
     * Create a message hash for deduplication
     */
    createMessageHash(message: A2AMessage): string;
    /**
     * Prepare message for serialization
     */
    private prepareForSerialization;
    /**
     * Reconstruct message from serialized data
     */
    private reconstructFromSerialized;
    /**
     * Validate schema version compatibility
     */
    private validateSchema;
    /**
     * Simple compression using basic string compression
     */
    private compress;
    /**
     * Decompress data
     */
    private decompress;
    /**
     * Check if data is compressed
     */
    private isCompressed;
    /**
     * Simple hash function for message deduplication
     */
    private simpleHash;
    /**
     * Batch serialize multiple messages
     */
    serializeBatch(messages: A2AMessage[], options?: SerializationOptions): string;
    /**
     * Batch deserialize multiple messages
     */
    deserializeBatch(data: string, options?: SerializationOptions): A2AMessage[];
    /**
     * Get serialization statistics
     */
    getSerializationStats(message: A2AMessage): {
        originalSize: number;
        serializedSize: number;
        compressedSize: number;
        compressionRatio: number;
    };
}
//# sourceMappingURL=message-serializer.d.ts.map