import { ILogger } from '../../common/utils/logger';
import { config } from '../../config';
import { handleServiceError, LlmError, ConfigurationError } from '../../common/utils/error.handler';
import { chunkArray, retryAsync } from '../../common/utils/helpers';
import { embedMany, embed } from 'ai';
import { openai } from '@ai-sdk/openai';

// Interface specifically for embedding generation
export interface IEmbeddingService {
    generateEmbedding(text: string): Promise<number[]>; // Return non-null or throw error
    generateEmbeddingsBatch(texts: string[]): Promise<number[][]>; // Return non-null or throw error
}

export class EmbeddingService implements IEmbeddingService {
    private readonly logger: ILogger;
    private readonly embeddingModel;
    private readonly batchSize: number = 512;

    constructor(
        logger: ILogger
    ) {
        this.logger = logger.child({ service: 'EmbeddingService' });

        try {
             if (config.OPENAI_API_KEY) {
                 this.embeddingModel = openai.embedding(config.EMBEDDING_MODEL, { 
                 });
                 this.logger.info(`Using OpenAI embedding model: ${config.EMBEDDING_MODEL}`);
             } else {
                 this.logger.error('No suitable LLM provider API key found or configured for embeddings (only OpenAI checked).');
                 throw new ConfigurationError('No suitable LLM provider configured for EmbeddingService.');
             }
        } catch (error) {
             this.logger.error('Failed to initialize embedding model for EmbeddingService during initialization.', { error });
             if (error instanceof ConfigurationError) throw error;
             throw new ConfigurationError('Could not initialize embedding model for EmbeddingService.', {}, error instanceof Error ? error : undefined);
        }
        this.logger.info(`EmbeddingService initialized successfully.`);
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (!text || typeof text !== 'string' || text.trim() === '') {
            this.logger.warn('Invalid input provided to generateEmbedding: Text cannot be empty.');
            throw new LlmError('Invalid input: Text cannot be empty.', { text });
        }
        this.logger.debug('Generating embedding for single text.');

        const operation = async () => {
            const { embedding } = await embed({ 
                model: this.embeddingModel, 
                value: text 
            });
            
            if (!embedding || embedding.length === 0) {
                this.logger.error('Embedding response was empty or invalid for single text.');
                throw new LlmError('Embedding response was empty or invalid for single text.');
            }
            return embedding;
        };

        try {
            const embedding = await retryAsync(operation, 2, 1000, 'generateSingleEmbedding', this.logger);
            this.logger.debug('Single text embedding generated successfully.');
            return embedding;
        } catch (error) {
            throw handleServiceError(error, this.logger, { phase: 'generateEmbedding' });
        }
    }

    async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
        const validTexts = texts.filter(text => text && typeof text === 'string' && text.trim() !== '');
        if (validTexts.length === 0) {
            this.logger.warn('Attempted to generate embeddings for an empty or invalid batch of texts.');
            return [];
        }
        this.logger.info(`Generating embeddings for a batch of ${validTexts.length} texts.`);

        const textChunks = chunkArray(validTexts, this.batchSize);
        let allEmbeddings: number[][] = [];

        try {
            for (let i = 0; i < textChunks.length; i++) {
                const chunk = textChunks[i];
                this.logger.debug(`Processing embedding batch ${i + 1}/${textChunks.length} with ${chunk.length} texts.`);

                const operation = async () => {
                    const { embeddings } = await embedMany({
                        model: this.embeddingModel,
                        values: chunk,
                    });

                    if (!embeddings || embeddings.length !== chunk.length) {
                        this.logger.error(`Embedding response for batch ${i + 1} had unexpected length. Expected ${chunk.length}, Got: ${embeddings?.length ?? 0}`);
                        throw new LlmError(`Embedding response for batch ${i + 1} had unexpected length. Expected ${chunk.length}, Got: ${embeddings?.length ?? 0}`);
                    }
                    return embeddings;
                };

                const chunkEmbeddings = await retryAsync(operation, 2, 1500, `generateEmbeddingBatch_${i+1}`, this.logger);
                allEmbeddings = allEmbeddings.concat(chunkEmbeddings);
            }

            this.logger.info(`Batch embedding generation completed. Total embeddings: ${allEmbeddings.length}`);
            if (allEmbeddings.length !== validTexts.length) {
                 this.logger.error("Mismatch between processed texts and generated embeddings count after batching.", { expected: validTexts.length, actual: allEmbeddings.length });
                 throw new LlmError("Mismatch between processed texts and generated embeddings count after batching.");
            }
            return allEmbeddings;

        } catch (error) {
            throw handleServiceError(error, this.logger, { phase: 'generateEmbeddingsBatch', totalTexts: validTexts.length });
        }
    }
}