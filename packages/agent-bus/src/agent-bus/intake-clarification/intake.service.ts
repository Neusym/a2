import {
    InitialTaskRequest,
    TaskSpecification,
    TaskStatus,
    TaskId,
    TaskCreationPayload,
    DialogueState,
    DialogueStage
} from '../common/types';
import { ILogger } from '../common/utils/logger';
import { DialogueManager } from './dialogue.manager';
import { TaskFormatter } from './task.formatter';
import { IBackendClient } from '../integrations/backend-api/backend.client'; // Use Interface
import { IStorageClient } from '../integrations/storage/vercel.blob.storage.client'; // Use Interface
import { EventPublisher } from '../core/event.publisher'; // Use concrete class
import { TaskStateManager } from '../core/task.state.manager'; // Use concrete class
import { handleServiceError, AgentBusError, ValidationError } from '../common/utils/error.handler';
import axios from 'axios'; // Needed for finalizeAndRegisterTask

export class IntakeClarificationService {
    private readonly logger: ILogger;
    private readonly dialogueManager: DialogueManager; // Use concrete class
    private readonly taskFormatter: TaskFormatter; // Use concrete class
    private readonly backendClient: IBackendClient; // Inject interface
    private readonly storageClient: IStorageClient; // Inject interface
    private readonly eventPublisher: EventPublisher; // Inject concrete class
    private readonly taskStateManager: TaskStateManager; // Inject concrete class

    constructor(
        dialogueManager: DialogueManager,
        taskFormatter: TaskFormatter,
        backendClient: IBackendClient, // Use interface
        storageClient: IStorageClient, // Use interface
        eventPublisher: EventPublisher,
        taskStateManager: TaskStateManager,
        logger: ILogger
    ) {
        this.dialogueManager = dialogueManager;
        this.taskFormatter = taskFormatter;
        this.backendClient = backendClient;
        this.storageClient = storageClient;
        this.eventPublisher = eventPublisher;
        this.taskStateManager = taskStateManager;
        this.logger = logger.child({ service: 'IntakeClarificationService' });
    }

    /**
     * Handles the initial task request, starting the clarification dialogue.
     * @param initialRequest - The raw request from the user API.
     * @returns The initial dialogue state including the first assistant message.
     */
    async initiateTaskClarification(initialRequest: InitialTaskRequest): Promise<DialogueState> {
        this.logger.info(`Initiating task clarification for requester: ${initialRequest.requesterId}`);
        try {
            // DialogueManager handles validation and saving initial state to Redis
            const initialState = await this.dialogueManager.startDialogue(initialRequest);
            this.logger.info(`Dialogue ${initialState.taskId} started. State saved to cache.`);
            return initialState;
        } catch (error) {
            // Errors (incl. validation) are handled and logged by DialogueManager/handleServiceError
            // Re-throw for Hono API layer to catch and return appropriate response
            throw error;
        }
    }

    /**
     * Processes the next turn in the dialogue based on user input.
     * If dialogue completes, triggers finalization and registration.
     * @param dialogueId - Identifier for the ongoing dialogue (from Redis).
     * @param userResponse - The user's response to the last prompt.
     * @returns The updated dialogue state.
     */
    async continueClarification(dialogueId: string, userResponse: string): Promise<DialogueState> {
        this.logger.info(`Continuing clarification for dialogue: ${dialogueId}`);
        if (!userResponse || userResponse.trim() === '') {
            throw new ValidationError('User response cannot be empty.');
        }

        try {
            // DialogueManager handles state retrieval from Redis, LLM call, and state update in Redis
            const updatedState = await this.dialogueManager.processUserResponse(dialogueId, userResponse);

            // Check if dialogue completed or failed AFTER processing the response
            if (updatedState.currentState === DialogueStage.COMPLETED) {
                this.logger.info(`Dialogue ${dialogueId} completed. Triggering finalization.`);
                // Don't await, let it run in background after returning response to user quickly
                // Use setImmediate or similar to ensure response is sent before heavy lifting starts
                setImmediate(() => {
                     this.finalizeAndRegisterTask(updatedState).catch(err => {
                         this.logger.error(`Error during background finalization for dialogue ${dialogueId}: ${err.message}`, err);
                         // Update status to failed if finalization fails
                         this.taskStateManager.updateTaskStatus(dialogueId, TaskStatus.RegistrationFailed, `Finalization Error: ${err.message}`);
                     });
                });
            } else if (updatedState.currentState === DialogueStage.FAILED) {
                 this.logger.error(`Dialogue ${dialogueId} failed during clarification.`);
                 // State already updated by DialogueManager
            } else {
                this.logger.info(`Dialogue ${dialogueId} continuing. Next prompt generated.`);
            }

            return updatedState; // Return the latest state to the API caller

        } catch (error) {
            // Errors handled/logged by DialogueManager/handleServiceError
            // Attempt to update status to failed if not already (e.g., if getDialogueState failed)
             await this.taskStateManager.updateTaskStatus(dialogueId, TaskStatus.ClarificationFailed, `Error continuing dialogue: ${error instanceof Error ? error.message : String(error)}`);
             // Re-throw for Hono API layer
            throw error;
        }
    }

    /**
     * Background process: Formats the final specification, stores it in Vercel Blob,
     * calls the backend to register the task, and publishes the event for matching.
     * @param completedState - The dialogue state marked as completed.
     */
    private async finalizeAndRegisterTask(completedState: DialogueState): Promise<void> {
        const dialogueId = completedState.taskId || 'unknown-dialogue-id'; // Should always have taskId here
        this.logger.info(`Starting finalization process for dialogue: ${dialogueId}`);

        try {
            // Ensure necessary parameters are present
            if (!completedState.extractedParams) {
                throw new AgentBusError('Cannot finalize task: extracted parameters are missing.', 500, { dialogueId });
            }
            if (!completedState.requesterId) {
                 throw new AgentBusError('Cannot finalize task: requesterId is missing.', 500, { dialogueId });
            }

            // 1. Format the Task Specification
            const taskSpecification: TaskSpecification = this.taskFormatter.formatTaskSpecification(
                completedState.extractedParams
            );
            this.logger.info(`Task specification formatted for dialogue: ${dialogueId}`);

            // 2. Store Specification in Vercel Blob
            // Use dialogueId in path for traceability, ensure it doesn't start with /
            const blobPath = `task-specs/${dialogueId.replace(/^\//, '')}-${Date.now()}.json`;
            const specificationUri = await this.storageClient.storeJson(blobPath, taskSpecification);
            this.logger.info(`Task specification stored in Vercel Blob: ${specificationUri}`);

            // 3. Update Cache Status to PendingRegistration
            // Do this *before* calling the backend
            await this.taskStateManager.updateTaskStatus(dialogueId, TaskStatus.PendingRegistration);

            // 4. Prepare Payload for Backend (e.g., to trigger contract call)
            const payload: TaskCreationPayload = {
                requester: completedState.requesterId, // Use the stored requester ID
                specificationUri: specificationUri,
                // Add any other details the backend needs from the dialogue/spec
            };

            // 5. Call Backend to trigger Task Creation (e.g., on contract or internal DB)
            // This backend call is assumed to handle the actual persistent Task record creation.
            // It should return the final, persistent TaskId.
            this.logger.info(`Calling backend client to create task for dialogue ${dialogueId}`);
            const { taskId: finalTaskId, success, error } = await this.backendClient.createTaskOnContract(payload);

            if (!success || !finalTaskId) {
                 // Throw error to be caught below, triggering RegistrationFailed status update
                 throw new AgentBusError(`Backend task creation failed: ${error || 'Unknown error'}`, 500, { dialogueId });
            }
            this.logger.info(`Backend successfully created task. Final TaskID: ${finalTaskId}`);

            // 6. Link Dialogue ID to Final Task ID in Cache (Redis)
            // This updates the status entry for dialogueId to include finalTaskId
            await this.taskStateManager.linkDialogueToTask(dialogueId, finalTaskId);

            // 7. Publish TaskPendingMatch event to Upstash QStash
            // Use the *final* TaskID here
            await this.eventPublisher.publishTaskPendingMatch(finalTaskId, specificationUri, completedState.requesterId);

            // 8. Update final status in cache for the *final* taskId (optional, might be handled by consumer)
            await this.taskStateManager.updateTaskStatus(finalTaskId, TaskStatus.PendingMatch);

            // 9. Clean up dialogue state from Redis (optional - could keep for history/debugging with TTL)
            // await this.taskStateManager.removeTaskState(dialogueId); // Keep for now, rely on TTL

            this.logger.info(`Finalization and registration complete for TaskID: ${finalTaskId} (Dialogue: ${dialogueId})`);

        } catch (error) {
            const handledError = handleServiceError(error, this.logger, { dialogueId, phase: 'finalizeAndRegisterTask' });
            // Update status in cache to reflect failure, using dialogueId as the key
            await this.taskStateManager.updateTaskStatus(dialogueId, TaskStatus.RegistrationFailed, handledError.message);
            // Error is logged by handleServiceError. No need to re-throw in background task.
        }
    }
} 