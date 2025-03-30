import { ILogger } from '../../common/utils/logger';
import { AgentBusError } from '../../common/utils/error.handler';
import { promises as fs } from 'fs'; // Use promise-based fs
import path from 'path';

export interface IPromptManager {
    getPrompt(promptName: string): Promise<string>;
    formatPrompt(promptName: string, data: Record<string, any>): Promise<string>;
}

// Location for prompt files (relative to the execution context, adjust as needed)
// Vercel typically bundles files, so relative path from compiled output might work.
// Consider placing prompts in a `prompts` directory at the root or within `src`.
const PROMPT_DIR = path.join(process.cwd(), 'src', 'agent-bus', 'integrations', 'llm', 'prompts'); // Example path

// Fallback hardcoded templates if file loading fails or is not desired
// IMPORTANT: Keep these updated or rely solely on files.
const FALLBACK_PROMPT_TEMPLATES: Record<string, string> = {
    clarification_system_initial: `You are a helpful assistant for the 'Agent Bus' system. Your goal is to clarify a user's task request so it can be matched with the best automated processor (AI agent or service). Be concise and ask clarifying questions one at a time until you have a clear understanding of the inputs, desired outputs, constraints (like budget, deadline, quality), and any specific requirements (like platforms or competitors to consider). Start by asking about competitors relevant to their initial description. Assume the user's first message contains their initial request.`,
    clarification_user_initial: `Initial Task Request:\n- Description: "{description}"\n- Tags: {tags}\n- Budget: {budget}\n- Deadline: {deadline}\nPlease clarify this request.`,
    matching_llm_ranking: `You are an expert evaluator for the 'Agent Bus' system. Your task is to analyze a list of candidate processors (AI agents/services) and re-rank them based on their suitability for a specific task. Provide a brief justification for the top candidates' positions.\n\nTask Details:\n{taskDescription}\n\nCandidate Processors (Initial Algorithmic Ranking):\n\"\"\"json\n{candidates}\n\"\"\"\n\nInstructions:\n1. Review the task description and the candidate details (scores, price).\n2. Re-rank the candidates based on your assessment of the best fit, considering semantic relevance, cost-effectiveness, reputation, reliability, speed, and schema compatibility scores.\n3. Provide a brief (1-2 sentence) justification for why each of the top 3-5 candidates is ranked where they are.\n4. Output ONLY a JSON object containing a single key "ranking", which is an array of objects. Each object in the array must have an "id" (the processorId) and a "justification" string. The order in the array represents your final ranking.\n\nExample Output Format:\n{\n  "ranking": [\n    { "id": "processor_abc", "justification": "Best semantic match and good reputation, despite slightly higher price." },\n    { "id": "processor_xyz", "justification": "Excellent price and speed, suitable for less complex aspects of the task." },\n    { "id": "processor_123", "justification": "Good overall balance of scores, reliable choice." }\n  ]\n}\n\nGenerate the JSON output now.`,
    workflow_generation: `You are an expert workflow planner for the 'Agent Bus' system. Your task is to design a multi-step workflow plan to fulfill a complex user request by orchestrating multiple available processors (AI agents/services).\n\nTask Details:\n- Task ID: {taskId}\n- Description: {taskDescription}\n- Required Inputs: {inputs}\n- Expected Outputs: {outputs}\n- Constraints: {constraints}\n\nAvailable Processors:\n\"\"\"json\n{availableProcessors}\n\"\"\"\n\nInstructions:\n1. Analyze the task description, inputs, outputs, and constraints.\n2. Break down the task into logical sequential or parallel steps.\n3. For each step, assign the most suitable processor ID from the available list. Consider the processor's description, inputs, and outputs.\n4. Define the dependencies between steps (which step must complete before another starts). Use the 'stepId' for dependencies.\n5. Define the 'inputMapping' and 'outputMapping' for steps where necessary, showing how data flows (e.g., output 'summary' from step 's1' becomes input 'text' for step 's2'). Use "task.input.<key>" to refer to initial task inputs.\n6. Determine the overall 'executionMode' ('sequential' or 'parallel').\n7. Output ONLY a JSON object representing the workflow plan. The JSON object must have keys "executionMode" (string) and "steps" (array). Each object in the "steps" array must have "stepId" (string, unique), "description" (string), "assignedProcessorId" (string, from available list), and "dependencies" (array of strings). "inputMapping" and "outputMapping" (object) are optional.\n\nExample Step Format:\n{\n  "stepId": "s1_summarize",\n  "description": "Summarize the input document.",\n  "assignedProcessorId": "processor_summarizer_v2",\n  "dependencies": [],\n  "inputMapping": { "documentUrl": "task.input.sourceUrl" },\n  "outputMapping": { "summaryText": "stepOutput.summary" }\n}\n\nGenerate the JSON workflow plan now.`,
};


export class PromptManager implements IPromptManager {
    private readonly logger: ILogger;
    private promptCache: Map<string, string> = new Map();
    private readonly promptDir: string;
    private promptsLoadedFromFile: boolean = false; // Track if file loading was attempted

    constructor(logger: ILogger, promptDirectory: string = PROMPT_DIR) {
        this.logger = logger.child({ service: 'PromptManager' });
        this.promptDir = promptDirectory;
        this.logger.info(`Prompt directory set to: ${this.promptDir}`);
        // No pre-loading, load on demand
    }

    /**
     * Retrieves the raw prompt template string.
     * Loads from file first, then falls back to hardcoded templates if file not found.
     * Caches prompts after loading.
     */
    async getPrompt(promptName: string): Promise<string> {
        if (this.promptCache.has(promptName)) {
            return this.promptCache.get(promptName)!;
        }

        try {
            // Construct file path (e.g., prompts/clarification_system_initial.prompt)
            // Use .prompt or .txt extension convention
            const filePath = path.join(this.promptDir, `${promptName}.prompt`);
            this.logger.debug(`Attempting to load prompt from file: ${filePath}`);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            this.promptCache.set(promptName, fileContent);
            this.promptsLoadedFromFile = true; // Mark that loading succeeded at least once
            this.logger.info(`Prompt '${promptName}' loaded and cached from file.`);
            return fileContent;
        } catch (error: any) {
             if (error.code === 'ENOENT') { // File not found
                 // Only warn if we haven't successfully loaded *any* prompt from file before
                 if (!this.promptsLoadedFromFile) {
                     this.logger.warn(`Prompt file not found for '${promptName}' at ${this.promptDir}. Falling back to hardcoded template. (Ensure prompts dir exists and is accessible)`);
                 } else {
                      this.logger.warn(`Prompt file not found for '${promptName}'. Falling back to hardcoded template.`);
                 }
                 const fallback = FALLBACK_PROMPT_TEMPLATES[promptName];
                 if (fallback) {
                     this.promptCache.set(promptName, fallback);
                     return fallback;
                 } else {
                      this.logger.error(`Prompt '${promptName}' not found in file system or hardcoded templates.`);
                      throw new AgentBusError(`Prompt '${promptName}' could not be loaded.`, 500);
                 }
             } else {
                  // Other file system error
                  this.logger.error(`Failed to load prompt '${promptName}' from file: ${error.message}`, { error });
                  throw new AgentBusError(`Error loading prompt '${promptName}': ${error.message}`, 500);
             }
        }
    }

    /**
     * Retrieves a prompt template and formats it with the provided data.
     * Uses string replacement for potentially nested placeholders like {key} or {object.nested.key}.
     */
    async formatPrompt(promptName: string, data: Record<string, any>): Promise<string> {
        this.logger.debug(`Formatting prompt '${promptName}' with data keys: ${Object.keys(data).join(', ')}`);
        let template = await this.getPrompt(promptName);

        // Enhanced placeholder replacement: {key.nested.key} -> data[key][nested][key]
        const formatted = template.replace(/\{([\w.]+)\}/g, (match, key) => {
            let value: any;
            let found = false;

            try {
                const pathSegments = key.split('.');
                // Use reduce to traverse the data object based on the path segments
                value = pathSegments.reduce((currentData: any, segment: any) => {
                    if (currentData && typeof currentData === 'object' && currentData !== null && currentData.hasOwnProperty(segment)) {
                        return currentData[segment];
                    } else {
                        // Path segment not found or currentData is not an object/null
                        throw new Error(`Path segment "${segment}" not found or invalid path in key "${key}"`);
                    }
                }, data); // Start reduction with the full data object
                
                // If reduce completes without error, the path is valid, but value could still be undefined
                found = true; 
            } catch (e: any) {
                // Path traversal failed, 'found' remains false
                if (e.message.startsWith('Path segment')) {
                    // This is expected if the placeholder path doesn't exist
                     this.logger.debug(`Placeholder traversal failed: ${e.message}`); 
                } else {
                    // Log unexpected errors during reduce
                     this.logger.error(`Unexpected error during placeholder evaluation for {${key}}: ${e.message}`, { error: e });
                }
            }

            if (found) {
                 // If the key *itself* suggests JSON content, or if the resolved value is an object/array,
                 // stringify it prettily. Explicitly check for undefined as well.
                 const isJsonObjectOrArray = typeof value === 'object' && value !== null;
                 const shouldStringify = value !== undefined && (key.toLowerCase().includes('json') || isJsonObjectOrArray);

                 if (shouldStringify) {
                     try {
                         // Handle null explicitly, otherwise stringify
                         return value === null ? 'null' : JSON.stringify(value, null, 2); // Pretty print JSON
                     } catch (stringifyError) {
                         this.logger.warn(`Failed to stringify value for placeholder {${key}}`, { value, error: stringifyError });
                          // Fallback to string conversion if stringify fails (might happen for complex objects with circular refs)
                          return String(value); 
                     }
                 } 
                 // For non-object/array values, return string representation
                 // Handle null/undefined explicitly
                 return value === null ? 'null' : value === undefined ? '' : String(value);
            }
            
            // Only warn if the path wasn't found during traversal (error handled in catch block)
            if (!found) {
                 this.logger.warn(`Placeholder {${key}} in prompt '${promptName}' could not be resolved from provided data.`);
            }
            return match; // Keep placeholder if data key not found or resolution failed
        });

        // this.logger.debug(`Formatted prompt for '${promptName}': ${formatted.substring(0, 200)}...`); // Log preview
        return formatted;
    }

    /** Clears the prompt cache. */
    clearCache(): void {
        this.promptCache.clear();
        this.logger.info('Prompt cache cleared.');
    }
}

/*
Reminder: Create dummy prompt files in `src/agent-bus/integrations/llm/prompts/` for testing:
- clarification_system_initial.prompt
- clarification_user_initial.prompt
- matching_llm_ranking.prompt
- workflow_generation.prompt
*/ 