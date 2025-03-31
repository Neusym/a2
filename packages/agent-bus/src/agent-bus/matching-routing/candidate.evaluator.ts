import {
    TaskSpecification,
    ProcessorMetadata,
    CandidateScore,
    RankedCandidate,
    ProcessorId
} from '../common/types';
import { ILogger } from '../common/utils/logger';
import { handleServiceError, LlmError, AgentBusError } from '../common/utils/error.handler';
import { config } from '../config';
import { IPromptManager } from '../integrations/llm/prompt.manager'; // Use Interface
import { DEFAULT_MAX_CANDIDATES } from '../common/constants';
import { IEmbeddingService } from '../integrations/llm/embedding.service'; // Use Interface
import { IStorageClient } from '../integrations/storage/vercel.blob.storage.client'; // Use Interface
import axios from 'axios'; // Needed for fetching spec if only URI is passed
import { z } from 'zod';
import { generateObject, CoreMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import Ajv from 'ajv'; // Import Ajv

// Define a basic interface for Processor Pricing (adjust based on actual structure)
interface ProcessorPricing {
    model?: 'fixed' | 'per_unit' | string; // Example models
    price?: number;
    unit?: string;
}

// Zod Schema for LLM Ranking Response
const LlmRankingListSchema = z.array(z.object({
    id: z.string().describe("The Processor ID being ranked."),
    justification: z.string().optional().describe("Reasoning for the candidate's position or suitability.")
})).describe("The re-ranked list of candidates with justifications.");

export class CandidateEvaluator {
    private readonly logger: ILogger;
    private readonly promptManager: IPromptManager; // Use Interface
    private readonly embeddingService: IEmbeddingService; // Use Interface
    private readonly storageClient: IStorageClient; // Use Interface
    private readonly ajv: Ajv; // Add Ajv instance

    // Define weights for scoring dimensions (consider making these configurable)
    private readonly scoreWeights = {
        semanticRelevance: 0.35,
        priceScore: 0.20,
        reputationScore: 0.15,
        reliabilityScore: 0.10,
        speedScore: 0.10,
        schemaCompatibility: 0.10,
    };

    constructor(
        promptManager: IPromptManager, // Inject interface
        embeddingService: IEmbeddingService, // Inject interface
        storageClient: IStorageClient, // Inject interface
        logger: ILogger
    ) {
        this.promptManager = promptManager;
        this.embeddingService = embeddingService;
        this.storageClient = storageClient;
        this.logger = logger.child({ service: 'CandidateEvaluator' });
        this.ajv = new Ajv({ allErrors: true }); // Initialize Ajv

        // Validate weights sum approximately to 1 (optional sanity check)
        const weightSum = Object.values(this.scoreWeights).reduce((sum, w) => sum + w, 0);
        if (Math.abs(weightSum - 1.0) > 0.01) {
             this.logger.warn(`Score weights sum (${weightSum}) is not close to 1.0. Normalization might be affected.`);
        }
    }

    /**
     * Evaluates, scores, and ranks healthy processor candidates for a given task specification.
     * Can accept either a full TaskSpecification object or a URI to fetch it.
     * @param taskSpecOrUri - The specification of the task or its storage URI.
     * @param healthyProcessors - List of processors that passed health checks.
     * @param taskEmbedding - Optional pre-computed embedding for the task description.
     * @returns A ranked list of the top N candidates.
     */
    async evaluateAndRankCandidates(
        taskSpecOrUri: TaskSpecification | string,
        healthyProcessors: ProcessorMetadata[],
        taskEmbedding?: number[] // Allow passing pre-computed embedding
    ): Promise<RankedCandidate[]> {
        this.logger.info(`Evaluating ${healthyProcessors.length} healthy processors.`);
        if (healthyProcessors.length === 0) {
            return [];
        }

        let taskSpec: TaskSpecification;

        try {
            // --- Fetch Task Spec if URI is provided ---
            if (typeof taskSpecOrUri === 'string') {
                 this.logger.debug(`Task specification provided as URI: ${taskSpecOrUri}. Fetching...`);
                 const fetchedSpec = await this.storageClient.getJson<TaskSpecification>(taskSpecOrUri);
                 if (!fetchedSpec) {
                     throw new AgentBusError(`Failed to fetch task specification from URI: ${taskSpecOrUri}`, 404, { uri: taskSpecOrUri });
                 }
                 taskSpec = fetchedSpec;
                 this.logger.debug(`Task specification fetched successfully.`);
            } else {
                 taskSpec = taskSpecOrUri;
            }

            // --- Ensure Task Embedding Exists ---
            let currentTaskEmbedding = taskEmbedding;
            if (!currentTaskEmbedding) {
                this.logger.debug("Task embedding not provided, generating...");
                // Use the potentially fetched taskSpec description
                currentTaskEmbedding = await this.embeddingService.generateEmbedding(taskSpec.description);
                 this.logger.debug("Task embedding generated.");
            }

            // --- Calculate Individual Scores Concurrently ---
            const scorePromises = healthyProcessors.map(proc =>
                this.calculateScores(taskSpec, proc, currentTaskEmbedding!) // Pass embedding
            );
            const scoredCandidates: CandidateScore[] = await Promise.all(scorePromises);
            this.logger.debug(`Individual scores calculated for ${scoredCandidates.length} candidates.`);

            // --- Rank Based on Overall Score (Algorithmic First) ---
            let rankedList = this.rankAlgorithmically(scoredCandidates);
            this.logger.debug('Initial algorithmic ranking complete.');

            // --- Optional: Re-rank / Justify with LLM ---
            // Only use LLM if configured and useful (e.g., > 1 candidate)
            if (config.MATCHING_REASONING_MODEL && rankedList.length > 1) {
                try {
                    this.logger.info('Attempting LLM re-ranking and justification.');
                    // Pass the algorithmically ranked list to LLM for potential re-ordering and justification
                    rankedList = await this.rankAndJustifyWithLlm(taskSpec, rankedList);
                    this.logger.info('LLM ranking/justification completed.');
                } catch (llmError) {
                    this.logger.warn('LLM ranking/justification failed. Using algorithmic ranking.', { error: llmError });
                    // Fallback to the already computed algorithmic ranking
                }
            } else {
                 this.logger.info('Skipping LLM ranking (not configured or not enough candidates).');
            }

            // --- Add Processor Metadata (Optional but helpful) ---
            const processorMap = new Map(healthyProcessors.map(p => [p.processorId, p]));
            rankedList.forEach(candidate => {
                 const meta = processorMap.get(candidate.processorId);
                 if (meta) {
                     // Include only essential metadata for the candidate list
                     candidate.processorMetadata = {
                         name: meta.name,
                         description: meta.description?.substring(0, 100) + (meta.description?.length > 100 ? '...' : ''), // Truncate
                         pricing: meta.pricing,
                         reputationScore: meta.reputationScore,
                         // Add status for context?
                         status: meta.status,
                     };
                 }
            });


            // --- Limit to Top N Candidates ---
            const topN = rankedList.slice(0, config.DEFAULT_MAX_CANDIDATES);
            this.logger.info(`Ranking complete. Returning top ${topN.length} candidates.`);
            // this.logger.debug('Top Candidates:', topN); // Avoid logging large objects if sensitive

            return topN;

        } catch (error) {
            // Includes errors from fetching spec, embedding generation or scoring
            throw handleServiceError(error, this.logger, { phase: 'evaluateAndRankCandidates' });
        }
    }

    /**
     * Calculates various scores for a single processor based on the task spec and pre-computed task embedding.
     */
    private async calculateScores(
        taskSpec: TaskSpecification,
        processor: ProcessorMetadata,
        taskEmbedding: number[] // Require task embedding
    ): Promise<CandidateScore> {
        const scores: CandidateScore['scores'] = {};

        // a) Semantic Relevance (using provided embeddings)
        if (processor.descriptionEmbedding && processor.descriptionEmbedding.length > 0) {
            try {
                scores.semanticRelevance = this.calculateCosineSimilarity(taskEmbedding, processor.descriptionEmbedding);
            } catch (simError) {
                this.logger.warn(`Failed to calculate similarity for ${processor.processorId}`, { error: simError });
                scores.semanticRelevance = 0; // Default on error
            }
        } else {
            this.logger.debug(`Processor ${processor.processorId} missing description embedding. Semantic score: 0.5`);
            scores.semanticRelevance = 0.5; // Default if processor has no embedding
        }

        // b) Price Score (Normalize - lower is better)
        const estimatedPrice = this.estimatePrice(taskSpec, processor);
        // Simple inverse normalization, capped to avoid division by zero or extreme values
        // Adjust scale (e.g., 10) based on typical price ranges
        const priceScaleFactor = 10;
        scores.priceScore = Math.max(0, Math.min(1, priceScaleFactor / (priceScaleFactor + estimatedPrice)));

        // c) Reputation Score (Normalize 0-1)
        scores.reputationScore = Math.max(0, Math.min(1, (processor.reputationScore ?? 3.0) / 5.0)); // Default 3/5 if missing

        // d) Reliability Score
        scores.reliabilityScore = Math.max(0, Math.min(1, processor.successRate ?? 0.90)); // Default 90% if missing

        // e) Speed Score (Normalize - lower time is better)
        const avgTimeMs = processor.averageExecutionTimeMs ?? 30000; // Default 30s if missing
        // Adjust scale (e.g., 5000ms baseline) based on typical execution times
        scores.speedScore = Math.max(0, Math.min(1, 5000 / (5000 + avgTimeMs)));

        // f) Schema Compatibility (Basic Check - can be enhanced)
        scores.schemaCompatibility = this.calculateSchemaCompatibility(taskSpec, processor);

        // --- Calculate Overall Score (Weighted Average) ---
         let overallScore = 0;
         let totalWeight = 0;
         for (const key in this.scoreWeights) {
             const scoreKey = key as keyof CandidateScore['scores'];
             const weightKey = key as keyof typeof this.scoreWeights;
             if (scores[scoreKey] !== undefined && scores[scoreKey] !== null) { // Check for valid score
                 overallScore += scores[scoreKey]! * this.scoreWeights[weightKey];
                 totalWeight += this.scoreWeights[weightKey];
             }
         }
         // Normalize by sum of weights actually used (handles cases where some scores are undefined)
         overallScore = totalWeight > 0 ? overallScore / totalWeight : 0;

        return {
            processorId: processor.processorId,
            scores,
            overallScore: overallScore,
            priceQuote: estimatedPrice,
            estimatedDurationMs: avgTimeMs
        };
    }

    /**
     * Estimates the price for a task based on processor pricing and task details.
     * Placeholder for more sophisticated logic (e.g., token-based, time-based).
     */
    private estimatePrice(taskSpec: TaskSpecification, processor: ProcessorMetadata): number {
        const defaultPrice = 1000; // High default if no pricing info
        const pricing: ProcessorPricing | undefined = processor.pricing as ProcessorPricing | undefined;

        if (!pricing || typeof pricing.price !== 'number') {
            this.logger.debug(`Processor ${processor.processorId} missing valid pricing info. Using default: ${defaultPrice}`);
            return defaultPrice;
        }

        let basePrice = pricing.price;

        // --- Placeholder for future enhancements ---
        // Example: Adjust price based on complexity or estimated usage
        // if (pricing.model === 'per_unit' && taskSpec.estimatedUnits) { 
        //    basePrice = pricing.price * taskSpec.estimatedUnits;
        // } else if (taskSpec.isComplex) {
        //    basePrice *= 1.2; // Increase price slightly for complex tasks
        // }
        // ----------------------------------------

        // For now, return the base price defined in metadata if valid
        return Math.max(0, basePrice); // Ensure price is not negative
    }

    /**
     * Calculates a basic schema compatibility score.
     * Checks if processor schemas exist and are potentially valid JSON Schema objects.
     * Does NOT perform deep validation against taskSpec data.
     */
    private calculateSchemaCompatibility(taskSpec: TaskSpecification, processor: ProcessorMetadata): number {
        const hasInputSchema = processor.inputSchema && typeof processor.inputSchema === 'object';
        const hasOutputSchema = processor.outputSchema && typeof processor.outputSchema === 'object';

        if (!hasInputSchema || !hasOutputSchema) {
            this.logger.debug(`Processor ${processor.processorId} missing input or output schema. Compatibility: 0.2`);
            return 0.2; // Low score if schemas are missing
        }

        let inputSchemaValid = false;
        let outputSchemaValid = false;

        // Safely attempt to validate input schema
        try {
            // Ensure processor.inputSchema is treated as an object before validation
            if (processor.inputSchema && typeof processor.inputSchema === 'object' && Object.keys(processor.inputSchema).length > 0) {
                // Explicitly cast result to boolean to satisfy types
                inputSchemaValid = !!this.ajv.validateSchema(processor.inputSchema); 
            } else {
                inputSchemaValid = false; // Explicitly false if not a valid object
                this.logger.debug(`Processor ${processor.processorId} input schema is not a valid object or is empty.`);
            }
        } catch (e) {
            this.logger.warn(`Processor ${processor.processorId} input schema validation threw an error.`, { schema: processor.inputSchema, error: e });
            inputSchemaValid = false; // Treat errors during validation as invalid
        }

        // Safely attempt to validate output schema
        try {
             // Ensure processor.outputSchema is treated as an object before validation
            if (processor.outputSchema && typeof processor.outputSchema === 'object' && Object.keys(processor.outputSchema).length > 0) {
                 // Explicitly cast result to boolean to satisfy types
                outputSchemaValid = !!this.ajv.validateSchema(processor.outputSchema); 
            } else {
                outputSchemaValid = false; // Explicitly false if not a valid object
                this.logger.debug(`Processor ${processor.processorId} output schema is not a valid object or is empty.`);
            }
        } catch (e) {
            this.logger.warn(`Processor ${processor.processorId} output schema validation threw an error.`, { schema: processor.outputSchema, error: e });
            outputSchemaValid = false; // Treat errors during validation as invalid
        }

        if (inputSchemaValid && outputSchemaValid) {
            // Further checks could involve comparing schema structures if needed.
            // E.g., check if taskSpec.inputs keys loosely match inputSchema properties.
            this.logger.debug(`Processor ${processor.processorId} has valid-looking schemas. Compatibility: 1.0`);
            return 1.0; // High score if both schemas look valid
        } else if (inputSchemaValid || outputSchemaValid) {
            this.logger.debug(`Processor ${processor.processorId} has one valid-looking schema. Compatibility: 0.6`);
            return 0.6; // Medium score if only one looks valid
        } else {
            this.logger.debug(`Processor ${processor.processorId} schemas look invalid. Compatibility: 0.3`);
            return 0.3; // Low score if schemas exist but seem invalid
        }
        // Note: True compatibility requires validating task *data* against schemas, 
        // or deeper structural comparison, which is not implemented here.
    }

    /**
     * Uses an LLM to re-rank and add justifications to an existing ranked list.
     */
    private async rankAndJustifyWithLlm(taskSpec: TaskSpecification, rankedList: RankedCandidate[]): Promise<RankedCandidate[]> {
        
        // Limit candidates sent to LLM for performance/cost
        const candidatesToRank = rankedList.slice(0, 10); 

        // Format input for the LLM
        const candidatesForLlm = candidatesToRank.map(c => ({
            id: c.processorId,
            initialRank: c.rank,
            overallScore: c.score.overallScore.toFixed(3),
            scores: Object.entries(c.score.scores).reduce((acc, [key, value]) => {
                acc[key] = typeof value === 'number' ? parseFloat(value.toFixed(3)) : value;
                return acc;
            }, {} as Record<string, any>),
            price: c.score.priceQuote,
            estimatedDurationMs: c.score.estimatedDurationMs,
            name: c.processorMetadata?.name,
        }));

        const promptData = {
            taskDescription: taskSpec.description,
            // Include inputs/outputs/constraints for context?
            inputs: JSON.stringify(taskSpec.inputs || {}),
            outputs: JSON.stringify(taskSpec.outputs || {}),
            constraints: JSON.stringify(taskSpec.constraints || {}),
            candidates: candidatesForLlm
        };
        
        const prompt = await this.promptManager.formatPrompt('candidate_ranking_justification', promptData);
        const messages: CoreMessage[] = [
            // TODO: Add system prompt if needed/configured
            { role: 'user', content: prompt }
        ];

        try {
            this.logger.info(`Requesting LLM ranking/justification (Model: ${config.MATCHING_REASONING_MODEL}).`);
            
            // Use generateObject to get structured JSON output
            const result = await generateObject({
                 model: openai(config.MATCHING_REASONING_MODEL),
                 messages: messages,
                 temperature: 0.3, // Slightly higher temp for justification creativity?
                 schema: LlmRankingListSchema, // Use the defined Zod schema
             });

            const llmRanking = result.object; // Already parsed and validated
             this.logger.info(`LLM ranking/justification received and parsed successfully.`);
            // this.logger.debug('LLM Ranking:', llmRanking); // Avoid logging potentially large/sensitive data

            // --- Merge LLM ranking and justifications back into the original list --- 
            // Create a map for quick lookup of LLM results
            const llmRankMap = new Map(llmRanking.map((item, index) => [
                item.id,
                 { rank: index + 1, justification: item.justification }
            ]));

            const reRankedList: RankedCandidate[] = [];
            const processedIds = new Set<string>();

            // 1. Add candidates ranked by LLM in the new order
            for (const llmItem of llmRanking) {
                const originalCandidate = rankedList.find(c => c.processorId === llmItem.id);
                if (originalCandidate) {
                    originalCandidate.rank = llmRankMap.get(llmItem.id)!.rank;
                    originalCandidate.justification = llmRankMap.get(llmItem.id)!.justification;
                    reRankedList.push(originalCandidate);
                    processedIds.add(llmItem.id);
                } else {
                    this.logger.warn(`LLM ranked processor ID ${llmItem.id} which was not in the original top candidates list.`);
                }
            }

            // 2. Append remaining candidates (not ranked by LLM) in their original relative order
            let nextRank = reRankedList.length + 1;
            for (const originalCandidate of rankedList) {
                if (!processedIds.has(originalCandidate.processorId)) {
                    originalCandidate.rank = nextRank++;
                    // No justification from LLM for these
                    originalCandidate.justification = undefined; 
                    reRankedList.push(originalCandidate);
                }
            }
            
            this.logger.info(`Successfully merged LLM ranking. Final list size: ${reRankedList.length}`);
            return reRankedList;

        } catch (error) {
             // Handle errors from generateObject (API, parsing, validation) or merging logic
             // Logged by handleServiceError wrapper
             this.logger.warn(`LLM ranking/justification failed: ${error instanceof Error ? error.message : String(error)}. Falling back to algorithmic ranking.`, { error });
             // Re-throw or allow handleServiceError to manage?
             // For now, re-throw to indicate failure to the caller, which will use algorithmic ranking.
             throw new LlmError('LLM ranking/justification phase failed', { candidatesCount: rankedList.length }, error instanceof Error ? error : undefined);
        }
    }

    /**
     * @deprecated Parsing is now handled by generateObject with a schema.
     * Parses the LLM response (expected JSON array) for ranking.
     */
    /*
    private parseLlmRankingResponse(llmOutput: string, originalCandidates: RankedCandidate[]): { id: ProcessorId; justification?: string }[] {
        // ... (Removed implementation) ...
        return []; // Placeholder, should not be called
    }
    */

    /** Ranks candidates based solely on their calculated overall score. */
    private rankAlgorithmically(scoredCandidates: CandidateScore[]): RankedCandidate[] {
        return scoredCandidates
            .sort((a, b) => b.overallScore - a.overallScore) // Sort descending
            .map((score, index) => ({
                processorId: score.processorId,
                rank: index + 1,
                score: score,
                // justification: `Algorithmic Rank ${index + 1}` // Optional basic justification
            }));
    }

    /** Calculates cosine similarity between two vectors. */
    private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
        if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
             // Log as warning, return 0 similarity
             this.logger.warn('Cannot calculate cosine similarity for invalid or mismatched vectors.', { lenA: vecA?.length, lenB: vecB?.length });
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        // Handle zero vectors
        if (normA === 0 || normB === 0) {
             this.logger.debug('Cosine similarity denominator is zero (zero vector detected).');
             return 0;
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        if (denominator === 0) { // Should be caught by norm check, but defense in depth
            this.logger.debug('Cosine similarity denominator is zero.');
            return 0;
        }

        const similarity = dotProduct / denominator;

        // Clamp result between -1 and 1 (standard cosine range), though embeddings often yield 0 to 1.
        // Return 0 if similarity is negative, as negative similarity isn't meaningful here.
        return Math.max(0, Math.min(1, similarity));
    }
} 