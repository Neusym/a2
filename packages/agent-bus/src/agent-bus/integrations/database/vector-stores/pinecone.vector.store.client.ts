import { Pinecone, Index } from '@pinecone-database/pinecone';
import { IVectorStoreClient, VectorMetadataFilter } from '../vector.store.client';
import { ProcessorId, ProcessorStatus } from '../../../common/types';
import { ILogger } from '../../../common/utils/logger';
import { DatabaseError, ConfigurationError } from '../../../common/utils/error.handler';
import { config } from '../../../config';
import { chunkArray, sleep } from '../../../common/utils/helpers';

// Define the structure expected by Pinecone's upsert/query
interface PineconeVector {
    id: string;
    values: number[];
    metadata?: Record<string, string | number | boolean | string[]>; // Pinecone metadata restrictions
}

type PineconeQueryFilter = Record<string, string | number | boolean | { $in?: (string | number | boolean)[] } | { $eq?: string | number | boolean } | { $ne?: string | number | boolean } | { $gt?: number } | { $gte?: number } | { $lt?: number } | { $lte?: number }>;


export class PineconeVectorStoreClient implements IVectorStoreClient {
    private readonly logger: ILogger;
    private readonly pinecone: Pinecone;
    private readonly indexName: string;
    private readonly namespace: string;
    private index: Index | undefined; // Cache the index object

    // Pinecone limits
    private readonly UPSERT_BATCH_SIZE = 100; // Vectors per upsert request
    private readonly MAX_METADATA_SIZE = 40 * 1024; // 40KB limit per vector

    constructor(logger: ILogger) {
        this.logger = logger.child({ service: 'PineconeVectorStoreClient' });

        if (!config.PINECONE_API_KEY || !config.PINECONE_INDEX_NAME) {
            throw new ConfigurationError('Missing Pinecone API key or Index Name');
        }

        this.indexName = config.PINECONE_INDEX_NAME;
        this.namespace = config.PINECONE_NAMESPACE || 'default'; // Use configured namespace or default

        try {
            // Newer Pinecone client instantiation doesn't require environment
            this.pinecone = new Pinecone({
                apiKey: config.PINECONE_API_KEY,
            });
            this.logger.info(`Pinecone client initialized for index: ${this.indexName}, namespace: ${this.namespace}`);
        } catch (error) {
             this.logger.error('Failed to initialize Pinecone client', { error });
            throw new ConfigurationError('Failed to initialize Pinecone client', {}, error instanceof Error ? error : undefined);
        }
    }

    /** Initialize connection and ensure index exists */
    async connect(): Promise<void> {
        try {
            // Check if index exists - this also verifies API key and connectivity
             this.logger.debug(`Checking existence of Pinecone index '${this.indexName}'...`);
            const indexList = await this.pinecone.listIndexes();
             const indexNames = indexList.indexes?.map(i => i.name) ?? []; // Handle potential undefined indexes array
             this.logger.debug(`Available Pinecone indexes: ${indexNames.join(', ')}`);

             if (!indexNames.includes(this.indexName)) {
                 this.logger.warn(`Pinecone index '${this.indexName}' not found. Creating with ${config.PINECONE_DIMENSIONS} dimensions...`);
                 await this.createIndexIfNotExists(config.PINECONE_DIMENSIONS);
            }
            this.index = this.pinecone.Index(this.indexName);
            // Optionally describe index to confirm readiness, but adds latency
            // const description = await this.index.describeIndexStats();
            // this.logger.debug(`Index description: ${JSON.stringify(description)}`);
            this.logger.info(`Successfully connected to Pinecone index '${this.indexName}'`);
        } catch (error: any) {
             const errorMessage = error.message || 'Unknown error during Pinecone connection';
             this.logger.error(`Failed to connect to Pinecone index '${this.indexName}': ${errorMessage}`, { error });
            throw new DatabaseError(`Failed to connect to Pinecone index '${this.indexName}': ${errorMessage}`, {}, error);
        }
    }

    private getIndex(): Index {
        if (!this.index) {
            // This should ideally not happen if connect() is called first
            this.logger.warn('Pinecone index object not cached. Re-initializing. Ensure connect() was called.');
            this.index = this.pinecone.Index(this.indexName);
        }
        return this.index;
    }

    // Helper to ensure metadata conforms to Pinecone limits
    private sanitizeMetadata(metadata?: Record<string, any>): Record<string, string | number | boolean | string[]> | undefined {
        if (!metadata) return undefined;

        const sanitized: Record<string, string | number | boolean | string[]> = {};
        let currentSize = 0;
        const processorIdForLog = metadata?.processorId || 'unknown'; // Get ID for logging

        for (const key in metadata) {
            // Skip internal fields or fields not meant for Pinecone metadata
            if (key === 'descriptionEmbedding' || key === 'processorId') continue;

            if (Object.prototype.hasOwnProperty.call(metadata, key)) {
                const value = metadata[key];
                let sanitizedValue: string | number | boolean | string[];

                // Pinecone supports string, number, boolean, or array of strings
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    sanitizedValue = value;
                } else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
                    // Keep string arrays, ensure elements are strings
                    sanitizedValue = value.filter(item => typeof item === 'string');
                    // Skip empty arrays as they are not useful for filtering
                    if (sanitizedValue.length === 0) continue;
                } else {
                    // Skip other types (like objects, Dates, mixed arrays) as they are not directly supported
                     this.logger.warn(`Metadata field '${key}' for processor '${processorIdForLog}' has unsupported type (${typeof value}). Skipping.`);
                    continue;
                }

                // Estimate size (very rough approximation)
                const entrySize = key.length + JSON.stringify(sanitizedValue).length; // Use JSON string length for size estimate

                if (currentSize + entrySize <= this.MAX_METADATA_SIZE) {
                    sanitized[key] = sanitizedValue;
                    currentSize += entrySize;
                } else {
                    this.logger.warn(`Metadata field '${key}' skipped for processor '${processorIdForLog}' due to size limit.`);
                    // Optionally truncate string values if needed, but skipping is safer
                }
            }
        }
        // Ensure essential fields like 'status' are present if expected for filtering
        if (metadata.status && !sanitized.status) {
             if (currentSize + 100 < this.MAX_METADATA_SIZE) { // Add status if space allows
                 sanitized.status = metadata.status;
             } else {
                  this.logger.warn(`Could not include 'status' metadata for processor '${processorIdForLog}' due to size limit.`);
             }
        }

        return Object.keys(sanitized).length > 0 ? sanitized : undefined; // Return undefined if no valid metadata
    }


    async upsertVectors(vectors: { id: ProcessorId; values: number[]; metadata?: Record<string, any> }[]): Promise<boolean> {
        if (vectors.length === 0) return true;
        this.logger.debug(`Upserting ${vectors.length} vectors to Pinecone index '${this.indexName}' (namespace: ${this.namespace}).`);

        const pineconeVectors: PineconeVector[] = vectors.map(vec => ({
            id: vec.id,
            values: vec.values,
            // Pass the full metadata object for sanitization, including processorId for logging
            metadata: this.sanitizeMetadata({ ...vec.metadata, processorId: vec.id })
        }));

        const index = this.getIndex();
        const chunks = chunkArray(pineconeVectors, this.UPSERT_BATCH_SIZE);

        try {
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                this.logger.debug(`Upserting batch ${i + 1}/${chunks.length} (${chunk.length} vectors)...`);
                 // Use the namespace method on the index object
                 const ns = index.namespace(this.namespace);
                 await ns.upsert(chunk);
            }
            this.logger.info(`Successfully submitted upsert request for ${vectors.length} vectors.`);
            return true; // Upsert is async, this confirms request submission
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error during Pinecone upsert';
            this.logger.error(`Error upserting vectors to Pinecone: ${errorMessage}`, { error });
            throw new DatabaseError(`Failed to upsert vectors to Pinecone: ${errorMessage}`, {}, error);
        }
    }

    async findSimilar(queryVector: number[], topK: number, filter?: VectorMetadataFilter): Promise<ProcessorId[]> {
        this.logger.debug(`Querying top ${topK} similar vectors in Pinecone. Filter: ${JSON.stringify(filter)}`);
        const index = this.getIndex();
        const ns = index.namespace(this.namespace);

        try {
            const pineconeFilter = this.convertFilterToPineconeFormat(filter);
            this.logger.debug(`Pinecone filter: ${JSON.stringify(pineconeFilter)}`);

            const queryResponse = await ns.query({
                topK,
                vector: queryVector,
                includeMetadata: false, // Only need IDs
                includeValues: false,
                filter: pineconeFilter,
            });

            const matches = queryResponse.matches || [];
            // Ensure IDs are strings before returning
            const results = matches.map(match => String(match.id));

            this.logger.debug(`Found ${results.length} similar processor IDs in Pinecone.`);
            return results;
        } catch (error: any) {
             const errorMessage = error.message || 'Unknown error during Pinecone query';
             this.logger.error(`Error querying vectors from Pinecone: ${errorMessage}`, { error });
            throw new DatabaseError(`Failed to query vectors from Pinecone: ${errorMessage}`, {}, error);
        }
    }

    async deleteVectors(ids: ProcessorId[]): Promise<boolean> {
        if (ids.length === 0) return true;
        this.logger.debug(`Deleting ${ids.length} vectors from Pinecone index '${this.indexName}' (namespace: ${this.namespace}).`);
        const index = this.getIndex();
        const ns = index.namespace(this.namespace);

        // Pinecone delete can handle up to 1000 IDs per request
        const chunks = chunkArray(ids, 1000);
        try {
             for (let i = 0; i < chunks.length; i++) {
                 const chunk = chunks[i];
                 this.logger.debug(`Deleting batch ${i + 1}/${chunks.length} (${chunk.length} IDs)...`);
                 await ns.deleteMany(chunk);
             }
             this.logger.info(`Successfully submitted delete request for ${ids.length} vectors.`);
             return true; // Note: Deletion is async in Pinecone, this confirms request submission.
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error during Pinecone delete';
            this.logger.error(`Error deleting vectors from Pinecone: ${errorMessage}`, { error });
            throw new DatabaseError(`Failed to delete vectors from Pinecone: ${errorMessage}`, {}, error);
        }
    }

    async checkConnection(): Promise<boolean> {
        try {
            // Re-check index listing as a basic health check
             this.logger.debug("Performing Pinecone connection check...");
            await this.pinecone.listIndexes();
             // Optionally describe index stats for a more thorough check
             // const stats = await this.getIndex().describeIndexStats();
             // this.logger.debug("Pinecone index stats:", stats);
             this.logger.debug("Pinecone connection check successful.");
            return true;
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error during Pinecone connection check';
            this.logger.error(`Pinecone connection check failed: ${errorMessage}`, { error });
            return false;
        }
    }

    // Convert our generic filter to Pinecone's filter format
    private convertFilterToPineconeFormat(filter?: VectorMetadataFilter): PineconeQueryFilter | undefined {
        if (!filter || Object.keys(filter).length === 0) return undefined;

        const pineconeFilter: PineconeQueryFilter = {};

        // Map status using $eq
        if (filter.status) {
            pineconeFilter.status = { $eq: filter.status };
        }

        // Map tags using $in (assuming tags are stored as string array in metadata)
        if (filter.tags && filter.tags.length > 0) {
            // Pinecone needs $in operator for array containment checks
            // Ensure the metadata field name matches what was sanitized and upserted (e.g., 'capabilitiesTags')
            pineconeFilter.capabilitiesTags = { $in: filter.tags };
        }

        // Add other filter mappings as needed based on VectorMetadataFilter and Pinecone capabilities
        // Example: if filter had minReputation: 4.0
        // if (filter.minReputation !== undefined) {
        //    pineconeFilter.reputationScore = { $gte: filter.minReputation };
        // }

        return Object.keys(pineconeFilter).length > 0 ? pineconeFilter : undefined;
    }

    // Optional: Helper to create index if it doesn't exist during initialization
    async createIndexIfNotExists(dimensions: number): Promise<void> {
         try {
             const indexList = await this.pinecone.listIndexes();
             const indexNames = indexList.indexes?.map(i => i.name) ?? [];
             if (!indexNames.includes(this.indexName)) {
                  this.logger.warn(`Index '${this.indexName}' not found. Creating with ${dimensions} dimensions...`);
                  await this.pinecone.createIndex({
                     name: this.indexName,
                     dimension: dimensions,
                     metric: 'cosine', // Hardcode to cosine since it's the most common for embeddings
                     spec: { // Use serverless spec for Vercel environments
                        serverless: {
                            cloud: 'aws',
                            region: config.PINECONE_ENVIRONMENT
                        }
                     }
                 });
                  // Wait for index to be ready
                  this.logger.info(`Waiting for index '${this.indexName}' to initialize...`);
                  let ready = false;
                  let attempts = 0;
                  while (!ready && attempts < 30) { // Wait up to 5 minutes (30 * 10s)
                       attempts++;
                       await sleep(10000); // Wait 10 seconds
                       try {
                           const stats = await this.pinecone.Index(this.indexName).describeIndexStats();
                           ready = true;
                           this.logger.info(`Index '${this.indexName}' appears ready.`);
                       } catch (describeError: any) {
                           this.logger.debug(`Index not ready yet (attempt ${attempts}): ${describeError.message}`);
                       }
                  }
                  if (!ready) {
                       throw new DatabaseError(`Index '${this.indexName}' did not become ready after creation.`);
                  }
                  this.logger.info(`Index '${this.indexName}' created successfully.`);
             }
         } catch (error: any) {
              const errorMessage = error.message || 'Unknown error during index creation/verification';
              this.logger.error(`Failed to create or verify Pinecone index '${this.indexName}': ${errorMessage}`, { error });
             throw new DatabaseError(`Failed to create/verify Pinecone index: ${errorMessage}`, {}, error);
         }
     }
} 