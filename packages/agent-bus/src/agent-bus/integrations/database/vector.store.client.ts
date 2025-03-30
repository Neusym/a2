import { ProcessorId, ProcessorStatus } from '../../common/types';

// Define filter structure supported by Pinecone and potentially others
export interface VectorMetadataFilter {
    status?: ProcessorStatus; // Filter by processor status
    tags?: string[];          // Filter by capabilities tags (requires $in operator support)
    // Add other potential filter fields stored in vector metadata
    // e.g., minReputation?: number;
    // e.g., ownerAddress?: string;
}

// Interface for vector store operations (Pinecone)
export interface IVectorStoreClient {
    /** Connect to the vector store and verify index */
    connect(): Promise<void>;

    /** Upsert (insert or update) vectors with metadata */
    upsertVectors(vectors: { id: ProcessorId; values: number[]; metadata?: Record<string, any> }[]): Promise<boolean>;

    /** Find vectors similar to a query vector, with filtering */
    findSimilar(queryVector: number[], topK: number, filter?: VectorMetadataFilter): Promise<ProcessorId[]>;

    /** Delete vectors by ID */
    deleteVectors(ids: ProcessorId[]): Promise<boolean>;

    /** Check if the vector store is healthy/connected */
    checkConnection(): Promise<boolean>;

    // Optional: Method to create index if needed during setup
    // createIndexIfNotExists(dimensions: number): Promise<void>;
} 