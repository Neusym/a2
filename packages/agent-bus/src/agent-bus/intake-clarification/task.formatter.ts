import { TaskSpecification, BaseExtractedParams } from '../common/types';
import { ILogger } from '../common/utils/logger';

// Interface merging BaseExtractedParams with potential others from DialogueState
interface ExtractedParams extends BaseExtractedParams, Record<string, any> {}

export class TaskFormatter {
    private readonly logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger.child({ service: 'TaskFormatter' });
    }

    /**
     * Formats the parameters extracted during dialogue into a structured TaskSpecification.
     * @param extractedParams - Key-value pairs of details extracted by the LLM/dialogue.
     * @returns A structured TaskSpecification.
     */
    formatTaskSpecification(extractedParams: ExtractedParams | undefined): TaskSpecification {
        this.logger.info('Formatting task specification from extracted parameters.');

        if (!extractedParams) {
             this.logger.warn('No extracted parameters provided to formatTaskSpecification. Returning default spec.');
             // Return a minimal default spec or throw error? Returning default for now.
             return {
                 description: 'No description provided.',
                 inputs: {},
                 outputs: {},
                 tags: [],
                 isComplex: false,
             };
        }

        this.logger.debug('Raw Extracted Params:', extractedParams);

        // Validate and clean the extracted parameters
        const params = this.validateAndCleanParams(extractedParams);
        this.logger.debug('Validated Params:', params);

        const spec: TaskSpecification = {
            description: params.refined_description || params.initial_description || 'No description provided.',
            // Note: Robust input/output handling relies on the upstream LLM providing structured, validatable data.
            // The current validation ensures these are objects, defaulting to {}.
            inputs: params.inputs || {},
            outputs: params.outputs || {},
            constraints: {},
            tags: this.normalizeTags(params.tags || []),
            // Determine complexity based on extracted params or LLM hint
            isComplex: params.isComplex ?? this.inferComplexity(params),
        };

        // Add constraints if they exist and are valid
        // Ensure constraints object exists
        if (!spec.constraints) {
            spec.constraints = {};
        }
        // Explicitly check if budget is a valid number before assigning
        if (typeof params.budget === 'number') { 
            spec.constraints.budget = params.budget;
        }
        if (params.deadline) { // Assuming deadline is already Date | undefined
             spec.constraints.deadline = params.deadline;
        }
        if (params.quality) { // Assuming quality is already string | undefined
            spec.constraints.quality = params.quality;
        }
        if (params.required_platforms && params.required_platforms.length > 0) {
            spec.constraints.required_platforms = params.required_platforms;
        }
        if (params.timeframe) {
             spec.constraints.timeframe = params.timeframe;
        }
        if (params.competitors && params.competitors.length > 0) {
            spec.constraints.competitors = params.competitors; // Store as constraint
        }
        // Add other constraints extracted...

        // Remove constraints object if it's empty
        // Use optional chaining and nullish coalescing for safety
        if (Object.keys(spec.constraints ?? {}).length === 0) {
            delete spec.constraints;
        }

        // Add competitors/platforms to tags as well for matching?
        if (params.competitors) spec.tags!.push(...params.competitors.map(c => `competitor:${c.toLowerCase()}`));
        if (params.platforms) spec.tags!.push(...params.platforms.map(p => `platform:${p.toLowerCase()}`));
        if (params.required_platforms) spec.tags!.push(...params.required_platforms.map(p => `platform:${p.toLowerCase()}`));
        spec.tags = [...new Set(spec.tags)]; // Ensure unique tags


        this.logger.info('Task specification formatted successfully.');
        return spec;
    }

     /**
      * Infers task complexity based on LLM hints or heuristics.
      * If `params.llm_complexity_hint` is provided (e.g., 'complex', 'simple'), it's used.
      * Otherwise, falls back to heuristics based on platform count, quality, or competitors.
      */
     private inferComplexity(params: Partial<TaskSpecification> & ExtractedParams): boolean {
         // Prefer LLM hint if available
         if (typeof params.llm_complexity_hint === 'string') {
             // Example: Assume 'complex' maps to true, others to false. Adapt as needed.
             return params.llm_complexity_hint.toLowerCase() === 'complex';
         }

         // Fallback heuristic
         const platformCount = (params.required_platforms?.length ?? 0); // Only count required platforms for complexity heuristic now
         const hasQuality = !!params.quality;
         const hasCompetitors = !!params.competitors?.length;
         const hasMultipleInputsOutputs = (Object.keys(params.inputs || {}).length > 1) || (Object.keys(params.outputs || {}).length > 1);


         return platformCount > 1 || hasQuality || hasCompetitors || hasMultipleInputsOutputs; // Refined heuristic
     }

    /**
     * Validates and cleans the extracted parameters according to expected types.
     * Tries to be lenient with input types (e.g., budget as string).
     */
    private validateAndCleanParams(params: ExtractedParams): Partial<TaskSpecification> & ExtractedParams {
        const cleaned: Partial<TaskSpecification> & ExtractedParams = { ...params }; // Start with a copy

        // Descriptions
        cleaned.refined_description = this.cleanString(params.refined_description);
        cleaned.initial_description = this.cleanString(params.initial_description);
        if (!cleaned.refined_description && cleaned.initial_description) {
            cleaned.refined_description = cleaned.initial_description; // Use initial if refined is empty
        }

        // Inputs/Outputs (ensure they are objects)
        cleaned.inputs = (params.inputs && typeof params.inputs === 'object' && !Array.isArray(params.inputs)) ? params.inputs : {};
        cleaned.outputs = (params.outputs && typeof params.outputs === 'object' && !Array.isArray(params.outputs)) ? params.outputs : {};

        // Budget (parse number from string/number)
        cleaned.budget = this.parsePositiveNumber(params.budget);

        // Deadline (parse date from string/date)
        cleaned.deadline = this.parseFutureDate(params.deadline);

        // Quality (lowercase string)
        cleaned.quality = this.cleanString(params.quality)?.toLowerCase();

        // Tags, Platforms, Competitors (array of strings)
        cleaned.tags = this.normalizeStringArray(params.tags);
        // Combine platforms/required_platforms, ensure uniqueness
        cleaned.required_platforms = [...new Set([
             ...this.normalizeStringArray(params.required_platforms),
             ...this.normalizeStringArray(params.platforms)
         ])];
        cleaned.competitors = this.normalizeStringArray(params.competitors);
        // Keep original platforms if needed separately for some reason? Usually combined into required_platforms.
        // cleaned.platforms = this.normalizeStringArray(params.platforms);

        // Timeframe (string)
        cleaned.timeframe = this.cleanString(params.timeframe);

        // isComplex (boolean) - Let inferComplexity handle the final boolean value based on hint or heuristics
        // cleaned.isComplex = typeof params.isComplex === 'boolean' ? params.isComplex : undefined;
        // Instead, clean the hint if provided
        cleaned.llm_complexity_hint = this.cleanString(params.llm_complexity_hint)?.toLowerCase();

        // Remove undefined/null/empty values for cleaner output
        Object.keys(cleaned).forEach(key => {
            const typedKey = key as keyof typeof cleaned;
            if (cleaned[typedKey] === undefined || cleaned[typedKey] === null) {
                delete cleaned[typedKey];
            } else if (Array.isArray(cleaned[typedKey]) && (cleaned[typedKey] as any[]).length === 0) {
                 delete cleaned[typedKey];
            } else if (typeof cleaned[typedKey] === 'object' && !Array.isArray(cleaned[typedKey]) && cleaned[typedKey] !== null && Object.keys(cleaned[typedKey] as object).length === 0) {
                 delete cleaned[typedKey];
             }
        });


        return cleaned;
    }

    private cleanString(value: any): string | undefined {
        return (typeof value === 'string' && value.trim().length > 0) ? value.trim() : undefined;
    }

    private parsePositiveNumber(value: any): number | undefined {
        if (typeof value === 'number' && value > 0) return value;
        if (typeof value === 'string') {
            // Remove currency symbols, commas etc. Be careful with locale differences.
            const num = parseFloat(value.replace(/[^0-9.-]+/g,""));
            if (!isNaN(num) && num > 0) return num;
        }
        return undefined;
    }

    private parseFutureDate(value: any): Date | undefined {
        if (value instanceof Date && value.getTime() > Date.now()) {
             return value;
        }
        if (typeof value === 'string' || typeof value === 'number') {
            try {
                // Attempt to parse various date formats
                const date = new Date(value);
                // Check if valid date and in the future
                if (!isNaN(date.getTime()) && date.getTime() > Date.now()) {
                    return date;
                }
            } catch { /* Ignore parsing errors */ }
        }
        return undefined;
    }

    private normalizeStringArray(value: any): string[] {
        let result: string[] = [];
        if (Array.isArray(value)) {
            result = value
                .map(item => typeof item === 'string' ? item.trim() : String(item).trim()) // Convert non-strings, then trim
                .filter(item => item.length > 0);
        } else if (typeof value === 'string' && value.trim().length > 0) {
            // Split comma-separated strings, then normalize
            result = value.split(',')
                .map(item => item.trim())
                .filter(item => item.length > 0);
        }
        // Return unique values
        return [...new Set(result)];
    }

    /**
     * Normalizes tags by converting to lowercase, removing duplicates, and trimming whitespace.
     */
    private normalizeTags(tags: string[]): string[] {
        // Use normalizeStringArray which handles trimming and uniqueness, then lowercase
        return this.normalizeStringArray(tags).map(tag => tag.toLowerCase());
    }
} 