import { TaskSpecification, ProcessorMetadata, ProcessorStatus } from '../common/types';
import { ILogger } from '../common/utils/logger';
import { IProcessorRepository } from '../integrations/database/processor.repository'; // Neon Repo interface
import { IEmbeddingService } from '../integrations/llm/embedding.service'; // Use interface
import { IVectorStoreClient, VectorMetadataFilter } from '../integrations/database/vector.store.client'; // Pinecone interface
import { handleServiceError, DatabaseError, LlmError } from '../common/utils/error.handler';
import { config } from '../config';

export class ProcessorDiscovery {
    private readonly logger: ILogger;
    private readonly processorRepo: IProcessorRepository; // Use Interface
    private readonly embeddingService: IEmbeddingService; // Use Interface
    private readonly vectorStore: IVectorStoreClient; // Use Interface

    constructor(
        processorRepo: IProcessorRepository, // Inject interface
        embeddingService: IEmbeddingService, // Inject interface
        vectorStore: IVectorStoreClient, // Inject interface
        logger: ILogger
    ) {
        this.processorRepo = processorRepo;
        this.embeddingService = embeddingService;
        this.vectorStore = vectorStore;
        this.logger = logger.child({ service: 'ProcessorDiscovery' });

        // Check if semantic search dependencies are available
        if (!embeddingService || !vectorStore) {
            this.logger.warn('EmbeddingService or VectorStoreClient not provided/initialized correctly. Semantic search will be disabled.');
        }
    }

    /**
     * Finds potential processors based on task requirements using keyword and semantic search.
     * @param taskSpec - The specification of the task.
     * @returns A list of potentially suitable, unique ProcessorMetadata objects.
     */
    async findPotentialProcessors(taskSpec: TaskSpecification): Promise<ProcessorMetadata[]> {
        this.logger.info('Starting processor discovery.');
        const startTime = Date.now();

        try {
            // If filtering is disabled, return all active processors from Neon DB
            if (config.DISABLE_PROCESSOR_FILTERING) {
                this.logger.warn('Processor filtering is disabled via config. Returning all active processors.');
                // Add pagination here to avoid fetching potentially huge numbers of processors
                const allActive = await this.processorRepo.getAllActive(500, 0); // Limit to 500 for safety
                if (allActive.length >= 500) {
                    this.logger.warn('Fetched maximum allowed active processors due to disabled filtering. Result might be incomplete.');
                }
                return allActive;
            }

            const resultIds = new Set<string>();
            let combinedResultsMap = new Map<string, ProcessorMetadata>();

            // --- 1. Keyword/Tag-based Search (Neon DB) ---
            const keywordCandidates = await this.findProcessorsByKeywords(taskSpec.tags);
            this.logger.debug(`Found ${keywordCandidates.length} candidates via keyword/tag search.`);
            keywordCandidates.forEach(p => {
                if (!resultIds.has(p.processorId)) {
                    combinedResultsMap.set(p.processorId, p);
                    resultIds.add(p.processorId);
                }
            });

            // --- 2. Semantic Search (Pinecone) ---
            // Check if dependencies are available before attempting semantic search
            if (this.embeddingService && this.vectorStore) {
                 try {
                     this.logger.debug('Performing semantic search.');
                     const semanticCandidates = await this.findProcessorsBySemantics(taskSpec.description);
                     this.logger.debug(`Found ${semanticCandidates.length} candidates via semantic search.`);
                     semanticCandidates.forEach(p => {
                         if (!resultIds.has(p.processorId)) {
                             combinedResultsMap.set(p.processorId, p);
                             resultIds.add(p.processorId);
                         } else {
                              // Optional: Merge metadata if semantic search found an existing processor?
                              // For now, just ensure it's in the map.
                         }
                     });
                 } catch (semanticError) {
                     // Log semantic search errors but don't fail the whole discovery if keyword search worked
                     this.logger.error('Semantic search failed, proceeding with keyword results only.', { error: semanticError });
                 }
            } else {
                 this.logger.warn('Skipping semantic search because EmbeddingService or VectorStoreClient is unavailable.');
            }


            // --- 3. Final Filter (Status) ---
            // Although queries might filter by status, double-check here
            const finalCandidates = Array.from(combinedResultsMap.values())
                                        .filter(p => p.status === ProcessorStatus.Active);

            const duration = Date.now() - startTime;
            this.logger.info(`Processor discovery completed in ${duration}ms. Found ${finalCandidates.length} unique, active potential processors.`);
            return finalCandidates;

        } catch (error) {
            // Log and wrap database/embedding errors
            throw handleServiceError(error, this.logger, { phase: 'findPotentialProcessors' });
        }
    }

    /**
     * Finds processors matching tags from the Neon database.
     */
    private async findProcessorsByKeywords(tags?: string[]): Promise<ProcessorMetadata[]> {
        const searchTags = tags?.filter(t => t && t.trim() !== ''); // Ensure tags are valid
        if (!searchTags || searchTags.length === 0) {
            this.logger.debug('No valid tags provided for keyword search.');
            return [];
        }

        this.logger.debug(`Searching Neon DB for processors with tags: ${searchTags.join(', ')}`);
        try {
            // Use the Neon repository method with appropriate criteria for tag matching
            const results = await this.processorRepo.findManyByCriteria({
                // Use the syntax expected by the Postgres implementation (e.g., array overlap '&&')
                tags: { $in: searchTags },
                status: ProcessorStatus.Active, // Filter only active ones
            });
            return results;
        } catch (dbError) {
            // Wrap error
            this.logger.error('Failed to query processors by keywords from Neon DB.', { error: dbError });
            throw new DatabaseError('Failed to query processors by keywords from Neon DB', {}, dbError instanceof Error ? dbError : undefined);
        }
    }

    /**
     * Finds processors based on semantic similarity using Pinecone.
     */
    private async findProcessorsBySemantics(taskDescription: string): Promise<ProcessorMetadata[]> {
         if (!taskDescription || taskDescription.trim() === '') {
             this.logger.warn('Task description is empty, skipping semantic search.');
             return [];
         }
        try {
            // 1. Generate task embedding
            this.logger.debug('Generating embedding for task description...');
            const taskEmbedding = await this.embeddingService.generateEmbedding(taskDescription); // Throws on failure
            this.logger.debug('Task embedding generated.');

            // 2. Query Pinecone
            this.logger.debug('Querying Pinecone vector store...');
            // Define filter for Pinecone query (only active processors)
            const filter: VectorMetadataFilter = { status: ProcessorStatus.Active };
            // Fetch more initially, ranking will narrow down later
            const topK = (config.DEFAULT_MAX_CANDIDATES || 5) * 3;
            const similarProcessorIds = await this.vectorStore.findSimilar(
                taskEmbedding,
                topK,
                filter
            );
            this.logger.debug(`Pinecone returned ${similarProcessorIds.length} potentially similar active IDs.`);

            if (similarProcessorIds.length === 0) {
                return [];
            }

            // 3. Fetch full metadata for the IDs from Neon DB
            // Ensure IDs are unique before fetching
            const uniqueIds = [...new Set(similarProcessorIds)];
            this.logger.debug(`Fetching metadata for ${uniqueIds.length} unique IDs from Neon DB.`);
            const results = await this.processorRepo.findManyByCriteria({
                processorId: { $in: uniqueIds },
                status: ProcessorStatus.Active, // Double-check status just in case
            });

            // Optional: Sort results based on the order returned by Pinecone? Pinecone results are already similarity-sorted.
            // We can create a map for quick lookup and then sort.
             const resultMap = new Map(results.map(r => [r.processorId, r]));
             const sortedResults = uniqueIds
                 .map(id => resultMap.get(id))
                 .filter((p): p is ProcessorMetadata => p !== undefined); // Filter out any misses and type guard

            return sortedResults;

        } catch (error) {
            // Handle errors from embedding generation or vector store query
            // Throw specific error types if possible
             if (error instanceof LlmError) throw error;
             if (error instanceof DatabaseError) throw error; // From Pinecone client or processor repo
             // Wrap generic errors
             throw handleServiceError(error, this.logger, { phase: 'findProcessorsBySemantics' });
        }
    }
} 