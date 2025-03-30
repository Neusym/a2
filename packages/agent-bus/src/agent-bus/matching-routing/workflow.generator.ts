import {
    TaskId,
    TaskSpecification,
    ProcessorMetadata,
    WorkflowPlan,
    WorkflowStep,
} from '../common/types';
import { ILogger } from '../common/utils/logger';
import { handleServiceError, LlmError, AgentBusError } from '../common/utils/error.handler';
import { config } from '../config';
import { IPromptManager } from '../integrations/llm/prompt.manager'; // Use Interface
import { generateSimpleId } from '../common/utils/helpers';
import { z } from 'zod';
import { generateObject, CoreMessage } from 'ai';
import { openai } from '@ai-sdk/openai'; // Example: Use OpenAI provider

// Zod schema for validating the structure of the workflow plan returned by the LLM
const WorkflowStepSchema = z.object({
    stepId: z.string().min(1, "stepId is required and must be non-empty"),
    description: z.string().min(1, "description is required and must be non-empty"),
    assignedProcessorId: z.string().min(1, "assignedProcessorId is required and must be non-empty"),
    dependencies: z.array(z.string()).default([]),
    inputMapping: z.record(z.string()).optional(), // Key-value pairs { targetInput: sourceOutput }
    outputMapping: z.record(z.string()).optional(), // Key-value pairs { targetOutputAlias: sourceOutput }
    // Estimated cost/duration might be added by our logic, not LLM
}).strict(); // Disallow extra fields from LLM

const LlmWorkflowPlanSchema = z.object({
    executionMode: z.enum(['sequential', 'parallel']).default('sequential'),
    steps: z.array(WorkflowStepSchema).min(1, "Workflow must have at least one step"),
}).strict(); // Disallow extra fields like 'overall_description' unless added explicitly

export class WorkflowGenerator {
    private readonly logger: ILogger;
    // private readonly llmClient: ILlmClient; // Removed
    private readonly promptManager: IPromptManager; // Use Interface

    constructor(
        // llmClient: ILlmClient, // Removed
        promptManager: IPromptManager, // Inject interface
        logger: ILogger
    ) {
        // this.llmClient = llmClient; // Removed
        this.promptManager = promptManager;
        this.logger = logger.child({ service: 'WorkflowGenerator' });
    }

    /**
     * Attempts to generate a multi-step workflow plan for a complex task using an LLM.
     * @param taskId - The ID of the task.
     * @param taskSpec - The specification of the task.
     * @param availableProcessors - List of healthy processors that *could* be part of the workflow.
     * @returns A structured WorkflowPlan or null if generation fails or is not applicable.
     */
    async generateWorkflow(
        taskId: TaskId,
        taskSpec: TaskSpecification,
        availableProcessors: ProcessorMetadata[]
    ): Promise<WorkflowPlan | null> {
        this.logger.info(`Attempting workflow generation for task ${taskId}.`);

        if (availableProcessors.length === 0) {
            this.logger.warn('No healthy processors available for workflow generation.');
            return null;
        }

        // --- Prepare Input for LLM ---
        const promptData = {
            taskId: taskId,
            taskDescription: taskSpec.description,
            // Stringify inputs/outputs/constraints for the prompt
            inputs: JSON.stringify(taskSpec.inputs || {}, null, 2),
            outputs: JSON.stringify(taskSpec.outputs || {}, null, 2),
            constraints: JSON.stringify(taskSpec.constraints || {}, null, 2),
            // Provide concise processor info, including input/output keys if available
            availableProcessors: availableProcessors.map(p => ({
                id: p.processorId,
                name: p.name,
                description: p.description?.substring(0, 150) + (p.description?.length > 150 ? '...' : ''), // Keep description concise
                inputKeys: p.inputSchema ? Object.keys(p.inputSchema) : [], // Provide input keys
                outputKeys: p.outputSchema ? Object.keys(p.outputSchema) : [], // Provide output keys
            }))
        };

        const prompt = await this.promptManager.formatPrompt('workflow_generation', promptData);
        
        // Prepare messages for Vercel AI SDK
        const messages: CoreMessage[] = [
            // TODO: Add system prompt if needed/configured via promptManager
            { role: 'user', content: prompt }
        ];

        try {
             this.logger.info(`Sending request to LLM for workflow generation (Model: ${config.WORKFLOW_GENERATION_MODEL}).`);
            
             // Use Vercel AI SDK generateObject for structured JSON output
             const result = await generateObject({
                 model: openai(config.WORKFLOW_GENERATION_MODEL), // Use configured model
                 messages: messages,
                 temperature: 0.2, // Low temp for structured output
                 maxTokens: 2500, // Allow space for complex plans
                 schema: LlmWorkflowPlanSchema, // Provide the Zod schema for validation
             });

            this.logger.info(`LLM response received and parsed for workflow generation.`);
            // The result.object is already parsed and validated against LlmWorkflowPlanSchema
            const parsedValidatedPlan = result.object;

            // --- Perform *additional* validation and enrichment ---
            const workflowPlan = this.performAdditionalValidationAndEnrichment(
                taskId,
                parsedValidatedPlan, // Pass the validated object
                availableProcessors // Pass available processors for validation
            );

            if (workflowPlan) {
                this.logger.info(`Successfully generated and validated workflow plan with ${workflowPlan.steps.length} steps.`);
                return workflowPlan;
            } else {
                 this.logger.warn('Failed additional validation or enrichment for workflow plan.');
                 return null;
            }

        } catch (error) {
             // Includes errors from generateObject (API errors, parsing errors, schema validation errors)
             // and errors from performAdditionalValidationAndEnrichment
             handleServiceError(error, this.logger, { taskId, phase: 'generateWorkflow' });
             return null; // Return null indicating failure to generate
        }
    }

    /**
     * Performs additional validation (beyond basic schema) and enriches the plan
     * with estimates based on available processors.
     * Assumes input `parsedPlan` has already passed Zod schema validation.
     */
    private performAdditionalValidationAndEnrichment(
        taskId: TaskId,
        // llmOutput: string, // Changed input from string
        parsedPlan: z.infer<typeof LlmWorkflowPlanSchema>, // Takes the schema-validated object
        availableProcessors: ProcessorMetadata[]
    ): WorkflowPlan | null {
        this.logger.debug('Performing additional validation and enrichment on workflow plan.');
        try {
            // const llmJson = JSON.parse(llmOutput); // No longer needed
            // const validationResult = LlmWorkflowPlanSchema.safeParse(llmJson); // No longer needed
            // if (!validationResult.success) { ... } // No longer needed
            // const parsedPlan = validationResult.data; // Input parameter is already this
            
            const availableProcessorMap = new Map(availableProcessors.map(p => [p.processorId, p]));
            const validatedSteps: WorkflowStep[] = [];
            const stepIds = new Set<string>();
            let totalCost = 0;
            let maxSequentialDuration = 0;
            let parallelDurations: number[] = [];

            // Validate steps and enrich with estimates
            for (const stepData of parsedPlan.steps) {
                // 1. Check if step ID is unique
                if (stepIds.has(stepData.stepId)) {
                    this.logger.warn(`Duplicate stepId '${stepData.stepId}' found in workflow plan. Skipping duplicate.`);
                    continue;
                }
                stepIds.add(stepData.stepId);

                // 2. Check if assigned processor is valid and available
                const processor = availableProcessorMap.get(stepData.assignedProcessorId);
                if (!processor) {
                    this.logger.error(`LLM assigned invalid/unavailable processor '${stepData.assignedProcessorId}' to step '${stepData.stepId}'. Cannot create plan.`);
                    return null; 
                }

                // 3. Estimate cost and duration from processor metadata
                const estimatedCost = processor.pricing?.price ?? 0;
                const estimatedDuration = processor.averageExecutionTimeMs ?? 15000; 

                validatedSteps.push({
                    ...stepData,
                    estimatedCost: estimatedCost,
                    estimatedDurationMs: estimatedDuration,
                });
                
                totalCost += estimatedCost;
                if (parsedPlan.executionMode === 'sequential') {
                    maxSequentialDuration += estimatedDuration;
                } else {
                    parallelDurations.push(estimatedDuration);
                }
            }

             // Refine total duration estimate
             let totalDuration = 0;
             if (parsedPlan.executionMode === 'sequential') {
                 totalDuration = maxSequentialDuration;
             } else {
                 // Simplistic parallel: assume longest step dominates, or sum if few steps?
                 // A proper calculation requires analyzing the DAG based on dependencies.
                 // For now, use the maximum duration of any parallel step as a rough estimate.
                 totalDuration = parallelDurations.length > 0 ? Math.max(...parallelDurations) : 0;
                 // Could also sum if steps < N? Or use a more complex heuristic.
             }

            // 4. Validate dependencies (ensure they refer to existing step IDs in *this* plan)
            const currentPlanStepIds = new Set(validatedSteps.map(s => s.stepId));
            for (const step of validatedSteps) {
                for (const depId of step.dependencies) {
                    if (!currentPlanStepIds.has(depId)) {
                         this.logger.error(`Workflow plan invalid: Step '${step.stepId}' has unmet dependency '${depId}' (not found in plan steps).`);
                         return null; // Indicate validation failure
                    }
                    // TODO: Check for circular dependencies (requires graph traversal)
                }
            }

            // Ensure at least one step was validated
            if (validatedSteps.length === 0) {
                 this.logger.warn("LLM workflow plan resulted in zero valid steps after validation.");
                 return null;
            }

            // If we reached here, the plan is structurally valid
            const finalPlan: WorkflowPlan = {
                 workflowId: generateSimpleId('wf'),
                 taskId: taskId,
                 steps: validatedSteps,
                 totalEstimatedCost: totalCost,
                 totalEstimatedDurationMs: totalDuration, 
                 executionMode: parsedPlan.executionMode,
                 generatedAt: new Date(),
            };

            return finalPlan;

        } catch (error) {
            // Catch any unexpected errors during the *additional* validation/enrichment phase
            // Errors from JSON parsing or basic schema validation are caught in the calling method
            // if (error instanceof SyntaxError) { ... } // No longer applicable here
            this.logger.error(`Unexpected error during workflow validation/enrichment: ${error instanceof Error ? error.message : String(error)}`, { error });
            // We might want to re-throw specific validation errors if needed upstream
            // throw new AgentBusError(`Workflow validation failed: ${error.message}`, 400, error);
            return null; // Indicate failure during this phase
        }
    }
} 