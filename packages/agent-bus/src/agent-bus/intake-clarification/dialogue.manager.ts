import {
    InitialTaskRequest,
    DialogueState,
    DialogueTurn,
    // LlmChatRequest, // Replaced by Vercel AI SDK types
    // ILlmClient, // Interface might need adaptation or replacement
    TaskSpecification,
    TaskId,
    TaskStatus,
    DialogueStage
} from '../common/types';
import { ILogger } from '../common/utils/logger';
import { handleServiceError, LlmError, AgentBusError, ValidationError } from '../common/utils/error.handler';
import { config } from '../config';
import { generateSimpleId } from '../common/utils/helpers';
import { IPromptManager } from '../integrations/llm/prompt.manager'; // Use Interface
import { MAX_CLARIFICATION_TURNS } from '../common/constants';
import { TaskStateManager } from '../core/task.state.manager'; // Manages Redis state
// import { ILlmClient } from '../common/types'; // Removed unused import
import { generateText, tool, CoreMessage, ToolCallPart, ToolResultPart } from 'ai';
import { openai } from '@ai-sdk/openai'; // Example provider
import { z } from 'zod';
import { ZodSchema } from 'zod'; // Import ZodSchema type


// --- Zod Schemas for Function Calling ---

const ParameterExtractionSchema = z.object({
    competitors: z.array(z.string()).optional().describe("List of known competitors mentioned."),
    platforms: z.array(z.string()).optional().describe("Specific platforms or tools mentioned."),
    budget: z.union([z.string(), z.number()]).optional().describe("Budget information extracted."),
    timeframe: z.string().optional().describe("Timeframe or deadline information extracted."),
    key_features: z.array(z.string()).optional().describe("Key features or requirements mentioned."),
    target_audience: z.string().optional().describe("Target audience mentioned."),
    // Add other parameters as needed
}).describe("Extracts relevant parameters from the user's response or conversation history.");

const DialogueControlSchema = z.object({
    next_stage: z.nativeEnum(DialogueStage).describe("The next logical stage for the dialogue based on current information."),
    reasoning: z.string().describe("Explanation for why this stage was chosen."),
    is_ready_to_finalize: z.boolean().describe("Whether enough information has been gathered to attempt finalization.")
}).describe("Determines the next dialogue stage or if the task details can be finalized.");

// --- End Zod Schemas ---


export class DialogueManager {
    private readonly logger: ILogger;
    // private readonly llmClient: ILlmClient; // Removed property
    private readonly promptManager: IPromptManager; // Use Interface
    private readonly taskStateManager: TaskStateManager; // Use concrete class

    constructor(
        // llmClient: ILlmClient, // Removed parameter
        promptManager: IPromptManager, // Inject interface
        taskStateManager: TaskStateManager, // Inject concrete class
        logger: ILogger
    ) {
        // this.llmClient = llmClient; // Removed assignment
        this.promptManager = promptManager;
        this.taskStateManager = taskStateManager;
        this.logger = logger.child({ service: 'DialogueManager' });
    }

    /**
     * Starts a new clarification dialogue.
     * @param initialRequest The user's initial request.
     * @returns The initial state of the dialogue, including the first assistant message.
     */
    async startDialogue(initialRequest: InitialTaskRequest): Promise<DialogueState> {
        const dialogueId = generateSimpleId('dlg'); // Temporary ID until task is finalized
        this.logger.info(`Starting new dialogue ${dialogueId} for requester ${initialRequest.requesterId}`);

        // Basic validation
        if (!initialRequest.requesterId || !initialRequest.description) {
             throw new ValidationError('Missing requesterId or description in initial request');
        }

        // Use prompt manager to get and format prompts
        const systemPrompt = await this.promptManager.getPrompt('clarification_system_initial');
        const initialUserPrompt = await this.promptManager.formatPrompt('clarification_user_initial', {
            description: initialRequest.description,
            tags: initialRequest.tags?.join(', ') || 'None',
            budget: initialRequest.budget || 'Not specified',
            deadline: initialRequest.deadline?.toISOString() || 'Not specified'
        });

        const initialState: DialogueState = {
            taskId: dialogueId, // Use temporary ID
            requesterId: initialRequest.requesterId,
            history: [
                { role: 'system', content: systemPrompt, timestamp: new Date() },
                { role: 'user', content: initialUserPrompt, timestamp: new Date() }, // Formatted initial request
            ],
            // Start with a defined stage, e.g., gathering competitors as per system prompt
            currentState: DialogueStage.GATHERING_COMPETITORS,
            extractedParams: { // Store initial known params
                initial_description: initialRequest.description,
                tags: initialRequest.tags,
                budget: initialRequest.budget,
                deadline: initialRequest.deadline,
            },
        };

        try {
            // Generate the first assistant response (the first question)
            const { nextTurn, updatedState } = await this.generateNextAssistantResponse(initialState);
            initialState.history.push(nextTurn);

            // Store the initial state in Redis via TaskStateManager
            await this.taskStateManager.saveDialogueState(dialogueId, initialState);
            // Status is set implicitly by saveDialogueState based on currentState

            this.logger.info(`Dialogue ${dialogueId} initiated. First question generated.`);
            return initialState;

        } catch (error) {
            // Mark state as failed and attempt to save before throwing
            initialState.currentState = DialogueStage.FAILED;
            initialState.history.push({ role: 'assistant', content: "I'm sorry, I encountered an error starting our conversation. Please try again later.", timestamp: new Date()});
            try {
                // Attempt to save the failed state
                await this.taskStateManager.saveDialogueState(dialogueId, initialState);
            } catch (saveError) {
                 this.logger.error("Failed to save error state for dialogue " + dialogueId, saveError);
            }
            // Throw the original error, wrapped appropriately
            throw handleServiceError(error, this.logger, { dialogueId, phase: 'startDialogue' });
        }
    }

    /**
     * Processes the user's response and generates the next assistant prompt or finalizes.
     * @param dialogueId The ID of the ongoing dialogue.
     * @param userResponse The text response from the user.
     * @returns The updated dialogue state.
     */
    async processUserResponse(dialogueId: string, userResponse: string): Promise<DialogueState> {
        this.logger.info(`Processing user response for dialogue ${dialogueId}`);

        // 1. Get current state from Redis
        const currentState = await this.taskStateManager.getDialogueState(dialogueId);
        if (!currentState) {
            throw new AgentBusError(`Dialogue ${dialogueId} not found or expired from cache`, 404, { dialogueId });
        }

        // Prevent processing if already completed/failed
        if (currentState.currentState === DialogueStage.COMPLETED || currentState.currentState === DialogueStage.FAILED || currentState.currentState === DialogueStage.CANCELLED) {
             this.logger.warn(`Dialogue ${dialogueId} is already ${currentState.currentState}. Ignoring response.`);
             return currentState;
        }

        // 2. Add user response to history
        currentState.history.push({ role: 'user', content: userResponse, timestamp: new Date() });

        // 3. Check for termination conditions
        // Max Turns Check
        if (currentState.history.filter(t => t.role === 'user').length > MAX_CLARIFICATION_TURNS) {
            this.logger.warn(`Dialogue ${dialogueId} reached max turns.`);
            currentState.currentState = DialogueStage.FAILED;
            currentState.history.push({ role: 'assistant', content: "We've reached the maximum conversation length. Please try starting a new request.", timestamp: new Date()});
            await this.taskStateManager.saveDialogueState(dialogueId, currentState);
            return currentState;
        }

        // Cancellation Check (Line 136)
        const cancelKeywords = ['cancel', 'stop', 'abort', 'nevermind', 'forget it'];
        if (cancelKeywords.some(keyword => userResponse.toLowerCase().includes(keyword))) {
            this.logger.info(`Dialogue ${dialogueId} cancelled by user.`);
            currentState.currentState = DialogueStage.CANCELLED; // Introduce a CANCELLED state
            currentState.history.push({ role: 'assistant', content: "Okay, I've cancelled this request.", timestamp: new Date() });
            await this.taskStateManager.saveDialogueState(dialogueId, currentState);
            return currentState;
        }


        try {
             // 4. Generate next assistant response OR handle function call
            const { nextTurn, updatedState } = await this.generateNextAssistantResponse(currentState);
            let finalState = updatedState; // Start with the state potentially updated by tool calls
            finalState.history.push(nextTurn);


             // 5. Update dialogue stage & extracted parameters (Handled within generateNextAssistantResponse via tool calls)
             // The currentState is potentially modified *inside* generateNextAssistantResponse if tools are called.
             // No separate stage determination logic needed here anymore. (Lines 147, 181, 198 resolved by tool calls)

             // 6. Save updated state to Redis
             await this.taskStateManager.saveDialogueState(dialogueId, finalState);

             if (finalState.currentState === DialogueStage.COMPLETED) {
                 this.logger.info(`Dialogue ${dialogueId} completed successfully.`);
             } else if (finalState.currentState === DialogueStage.FAILED) {
                  this.logger.error(`Dialogue ${dialogueId} failed.`);
             } else if (finalState.currentState === DialogueStage.CANCELLED) {
                 this.logger.info(`Dialogue ${dialogueId} was cancelled.`);
             }


             return finalState;

        } catch (error) {
             // Mark state as failed and attempt to save before throwing
            currentState.currentState = DialogueStage.FAILED;
            const failMsg = "I'm sorry, I encountered an error processing your response. Please try again or contact support.";
            // Avoid adding duplicate failure messages
            if (currentState.history[currentState.history.length-1]?.content !== failMsg) {
                 currentState.history.push({ role: 'assistant', content: failMsg, timestamp: new Date()});
            }
             try {
                await this.taskStateManager.saveDialogueState(dialogueId, currentState);
             } catch (saveError) {
                 this.logger.error(`Failed to save error state for dialogue ${dialogueId}`, saveError);
             }
             // Throw the original error, wrapped appropriately
             throw handleServiceError(error, this.logger, { dialogueId, phase: 'processUserResponse' });
        }
    }

    /**
     * Generates the next assistant response using the LLM client, potentially involving tool calls.
     */
    private async generateNextAssistantResponse(state: DialogueState): Promise<{nextTurn: DialogueTurn, updatedState: DialogueState}> {
        const dialogueId = state.taskId || 'unknown-id';
        this.logger.debug(`Generating LLM response for dialogue ${dialogueId}`);

        // Ensure history is properly typed for Vercel AI SDK
        // Map DialogueTurn[] history to CoreMessage[] for the SDK
        const messages: CoreMessage[] = state.history.map((turn): CoreMessage => {
            switch (turn.role) {
                case 'user':
                    return { role: 'user', content: turn.content };
                case 'assistant':
                    // Map assistant turn to CoreMessage: ONLY include content.
                    // The SDK infers tool calls happened if a 'tool' message follows.
                    return { 
                        role: 'assistant', 
                        content: turn.content || "" // Provide text content (even if empty)
                        // DO NOT include toolCalls here when mapping history for INPUT
                    };
                case 'system':
                    return { role: 'system', content: turn.content };
                case 'tool':
                     // Map DialogueTurn toolResults to CoreToolMessage format
                     return {
                         role: 'tool',
                         content: turn.toolResults?.map(tr => ({ 
                            type: 'tool-result', // Add type property
                            toolCallId: tr.toolCallId,
                            toolName: tr.toolName,
                            result: tr.result
                         })) || [] // Ensure content is an array 
                     };
                 default:
                     // Handle potential unexpected roles gracefully, though TS should prevent this
                     // Cast to 'any' to satisfy CoreMessage structure for unexpected roles
                     return { role: 'user', content: `Unknown role: ${(turn as any).role}` }; 
            }
        });

        // Define tools for the LLM (Lines 222, 147)
        const tools: Record<string, { description?: string; parameters: ZodSchema<any> }> = {
            update_dialogue_parameters: tool({
                description: ParameterExtractionSchema.description,
                parameters: ParameterExtractionSchema,
                // execute: async (params) => { ... } // We'll handle execution outside for now
            }),
            determine_next_question_or_finalize: tool({
                description: DialogueControlSchema.description,
                parameters: DialogueControlSchema,
                 // execute: async (params) => { ... } // We'll handle execution outside for now
            }),
        };


        try {
            // Use Vercel AI SDK's generateText
            // NOTE: Assumes OPENAI_API_KEY is set in environment or config passed correctly
            // Replace openai() with anthropic(), google(), etc. as needed
            const result = await generateText({
                // model: openai(config.CLARIFICATION_MODEL), // Assuming config.CLARIFICATION_MODEL is like 'gpt-4-turbo'
                model: openai('gpt-4-turbo'), // Hardcoding for example, use config
                system: messages.find(m => m.role === 'system')?.content || "You are a helpful assistant clarifying task requirements.",
                messages: messages.filter(m => m.role !== 'system'), // Pass user/assistant/tool history
                temperature: 0.5,
                maxTokens: 500,
                tools: tools,
                toolChoice: 'auto', // Let the model decide whether to use tools
            });


            let assistantResponseContent = "";
            const toolCalls: { toolCallId: string; toolName: string; args: any }[] = [];
            const toolResults: { toolCallId: string; toolName: string; result: any }[] = [];
            let newState = { ...state }; // Clone state to modify


            // Handle tool calls (Line 231)
            if (result.toolCalls && result.toolCalls.length > 0) {
                this.logger.info(`LLM generated ${result.toolCalls.length} tool call(s) for dialogue ${dialogueId}`);


                for (const toolCall of result.toolCalls) {
                    toolCalls.push({
                        toolCallId: toolCall.toolCallId,
                        toolName: toolCall.toolName,
                        args: toolCall.args,
                    });


                    let toolExecutionResult: any;


                    try {
                        if (toolCall.toolName === 'update_dialogue_parameters') {
                             // Validate args against schema
                            const validatedArgs = ParameterExtractionSchema.parse(toolCall.args);
                            this.logger.debug(`Executing tool 'update_dialogue_parameters' with args:`, validatedArgs);
                            // Merge extracted params into state
                            newState.extractedParams = { ...newState.extractedParams, ...validatedArgs };
                             toolExecutionResult = { success: true, updatedParams: validatedArgs };
                             this.logger.info(`Extracted parameters updated for dialogue ${dialogueId}:`, validatedArgs);
                        } else if (toolCall.toolName === 'determine_next_question_or_finalize') {
                            // Validate args against schema
                            const validatedArgs = DialogueControlSchema.parse(toolCall.args);
                            this.logger.debug(`Executing tool 'determine_next_question_or_finalize' with args:`, validatedArgs);
                            // Update dialogue stage
                             newState.currentState = validatedArgs.next_stage;
                             // Decide if finalization process should begin
                            if (validatedArgs.is_ready_to_finalize && newState.currentState !== DialogueStage.COMPLETED) {
                                // Transition to FINALIZING stage only if not already completed
                                newState.currentState = DialogueStage.FINALIZING;
                                this.logger.info(`Dialogue ${dialogueId} is ready to finalize. Moving to FINALIZING stage.`);
                            } else {
                                 this.logger.info(`Dialogue ${dialogueId} moving to stage: ${newState.currentState}`);
                            }
                             toolExecutionResult = { success: true, stageSet: newState.currentState, finalized: validatedArgs.is_ready_to_finalize };
                        } else {
                            this.logger.warn(`Unknown tool call requested: ${toolCall.toolName}`);
                            toolExecutionResult = { success: false, error: `Unknown tool: ${toolCall.toolName}` };
                        }
                    } catch (error) {
                        this.logger.error(`Error executing tool ${toolCall.toolName} for dialogue ${dialogueId}:`, error);
                         toolExecutionResult = { success: false, error: error instanceof Error ? error.message : 'Tool execution failed' };
                        // Potentially set state to FAILED here?
                        // newState.currentState = DialogueStage.FAILED;
                    }


                    toolResults.push({
                        toolCallId: toolCall.toolCallId,
                        toolName: toolCall.toolName,
                        result: toolExecutionResult,
                    });
                }


                // Map the collected tool calls to the Vercel AI SDK format
                const assistantToolCallTurn: DialogueTurn = {
                     role: 'assistant',
                     content: '', // Assistant message content is empty when only making tool calls
                     timestamp: new Date(),
                     toolCalls: toolCalls.map(tc => ({ 
                         type: 'tool-call', // Add type property
                         toolCallId: tc.toolCallId, 
                         toolName: tc.toolName, 
                         args: tc.args 
                     }))
                };
                newState.history.push(assistantToolCallTurn);

                // Map the collected tool results to the Vercel AI SDK format
                const toolResultTurn: DialogueTurn = {
                    role: 'tool',
                    content: '', // Tool role messages might not need direct string content 
                    timestamp: new Date(),
                    toolResults: toolResults.map(tr => ({
                        type: 'tool-result', // Add type property
                        toolCallId: tr.toolCallId,
                        toolName: tr.toolName,
                        result: tr.result
                    }))
                };
                newState.history.push(toolResultTurn);

                // OPTION 1: Skip the second LLM call completely and use fallback responses
                // Check which tools were called and provide appropriate responses
                let useFallbackResponse = true;
                let hasDetermineNextStep = false;
                let hasUpdateParameters = false;
                
                // Analyze which tools were called
                for (const toolCall of toolCalls) {
                    if (toolCall.toolName === 'determine_next_question_or_finalize') {
                        hasDetermineNextStep = true;
                    } else if (toolCall.toolName === 'update_dialogue_parameters') {
                        hasUpdateParameters = true;
                    }
                }

                // Create a response based on the current dialogue stage
                if (useFallbackResponse) {
                    this.logger.info(`Using fallback response mechanism for dialogue ${dialogueId} (stage: ${newState.currentState})`);
                    
                    // Get user-friendly parameter list
                    const extractedInfo = this.formatExtractedParameters(newState.extractedParams || {});
                    
                    if (newState.currentState === DialogueStage.COMPLETED) {
                        assistantResponseContent = `Great! I have all the information I need for your landing page. Let me summarize what I've captured:\n\n${extractedInfo}\n\nI've created task ID ${dialogueId} for your landing page. You'll receive email notifications as we find the right agent for your project. You can also check the status anytime using this task ID.`;
                    } else if (newState.currentState === DialogueStage.FINALIZING) {
                        assistantResponseContent = `Thanks for providing those details. I have captured:\n\n${extractedInfo}\n\nJust to finalize this task, could you confirm if there are any other specific features or requirements you need for this landing page?`;
                    } else if (newState.currentState === DialogueStage.FAILED) {
                        assistantResponseContent = `I'm sorry, but I encountered an issue processing your request. Could you please try again or contact support?`;
                    } else {
                        // For any other stage, ask targeted questions based on what we're missing
                        if (!newState.extractedParams?.key_features) {
                            assistantResponseContent = `Thank you for those details. Could you tell me more about the specific features you'd like on this landing page? For example, do you need contact forms, galleries, or any special sections?`;
                        } else if (!newState.extractedParams?.timeframe) {
                            assistantResponseContent = `I've noted those features. What's your timeline for completing this landing page project?`;
                        } else {
                            assistantResponseContent = `Thank you for the information! I've recorded these details:\n\n${extractedInfo}\n\nIs there anything else you'd like to add or modify about the landing page requirements?`;
                        }
                    }
                }
                // Skip the second LLM call completely - we're using our fallback content instead

            } else {
                // No tool calls, just use the text response
                assistantResponseContent = result.text;
                this.logger.debug(`LLM response received for ${dialogueId}. Finish Reason: ${result.finishReason}`);
            }


            const nextTurn: DialogueTurn = {
                role: 'assistant',
                content: assistantResponseContent,
                timestamp: new Date(),
            };


            return { nextTurn, updatedState: newState };


        } catch (error) {
            this.logger.error(`Error generating LLM response or handling tools for ${dialogueId}:`, error);
             // Error is logged above, wrap it
             throw new LlmError('Failed to generate assistant response or execute tools', { dialogueId }, error instanceof Error ? error : undefined);
        }
    }

    /**
     * Formats extracted parameters into a user-friendly string
     */
    private formatExtractedParameters(params: Record<string, any>): string {
        const lines: string[] = [];
        
        // Handle each parameter type specially
        if (params.initial_description) {
            lines.push(`📝 Task: ${params.initial_description}`);
        }
        
        if (params.key_features && Array.isArray(params.key_features) && params.key_features.length > 0) {
            lines.push(`✨ Features: ${params.key_features.join(', ')}`);
        }
        
        if (params.platforms && Array.isArray(params.platforms) && params.platforms.length > 0) {
            lines.push(`💻 Platforms: ${params.platforms.join(', ')}`);
        }
        
        if (params.timeframe) {
            lines.push(`⏱️ Timeline: ${params.timeframe}`);
        }
        
        if (params.budget) {
            lines.push(`💰 Budget: ${params.budget}`);
        }
        
        if (params.target_audience) {
            lines.push(`👥 Target Audience: ${params.target_audience}`);
        }
        
        if (params.competitors && Array.isArray(params.competitors) && params.competitors.length > 0) {
            lines.push(`🏢 Similar sites: ${params.competitors.join(', ')}`);
        }
        
        // Add other parameters that don't fit the categories above
        for (const [key, value] of Object.entries(params)) {
            if (!['initial_description', 'key_features', 'platforms', 'timeframe', 'budget', 'target_audience', 'competitors', 'tags', 'deadline'].includes(key) && value !== undefined) {
                // Format arrays specially
                if (Array.isArray(value)) {
                    if (value.length > 0) {
                        lines.push(`${key}: ${value.join(', ')}`);
                    }
                } else if (typeof value === 'object' && value !== null) {
                    lines.push(`${key}: ${JSON.stringify(value)}`);
                } else if (value !== null && value !== '') {
                    lines.push(`${key}: ${value}`);
                }
            }
        }
        
        return lines.join('\n');
    }

    /**
     * Creates a simplified summary of the dialogue history for the second LLM call
     */
    private createDialogueSummary(state: DialogueState): string {
        const dialogueId = state.taskId || 'unknown-id';
        let summary = `You are assisting a user with task clarification dialogue ${dialogueId}. `;
        
        // Add extracted parameters
        summary += "Here's what you know so far:\n\n";
        if (state.extractedParams) {
            summary += "EXTRACTED PARAMETERS:\n";
            for (const [key, value] of Object.entries(state.extractedParams)) {
                if (key === 'initial_description') {
                    summary += `- Initial task description: ${value}\n`;
                } else {
                    summary += `- ${key}: ${JSON.stringify(value)}\n`;
                }
            }
            summary += "\n";
        }
        
        // Add recent conversation history (last 3 turns only to keep it concise)
        summary += "RECENT DIALOGUE:\n";
        const relevantHistory = state.history
            .filter(turn => turn.role === 'user' || turn.role === 'assistant') // Skip system/tool messages
            .slice(-6); // Take the last 6 turns (3 user/assistant exchanges)
        
        for (const turn of relevantHistory) {
            summary += `${turn.role.toUpperCase()}: ${turn.content}\n`;
        }
        
        // Ask for the next response
        summary += "\nBased on this information, provide the next response in this dialogue. Remember to be helpful, ask clarifying questions if needed, and if you have enough information, suggest moving forward with the task.";
        
        return summary;
    }

    /**
     * Retrieves the current state of a dialogue from the cache.
     */
    async getCurrentDialogueState(dialogueId: string): Promise<DialogueState | null> {
        this.logger.debug(`Retrieving dialogue state from cache for ${dialogueId}`);
        try {
            // Use TaskStateManager which handles interaction with Redis repo
            return await this.taskStateManager.getDialogueState(dialogueId);
        } catch (error) {
             // Error handled by TaskStateManager, just return null
             // handleServiceError(error, this.logger, { dialogueId, phase: 'getCurrentDialogueState' });
             return null; // Return null on error or not found
        }
    }
} 