import { TaskId, TaskStatus, DialogueState, TaskSpecification } from '../common/types';
import { ILogger } from '../common/utils/logger';
import { ITaskStateRepository } from '../integrations/database/task.cache.repository'; // Interface for Redis
import { handleServiceError } from '../common/utils/error.handler';

/**
 * Provides a higher-level interface for managing the temporary state
 * of tasks during clarification and potentially other phases, primarily
 * interacting with the cache repository (Upstash Redis).
 */
export class TaskStateManager {
    private readonly logger: ILogger;
    private readonly taskStateRepo: ITaskStateRepository; // Use Redis repository interface

    constructor(
        taskStateRepo: ITaskStateRepository, // Inject interface
        logger: ILogger
    ) {
        this.taskStateRepo = taskStateRepo;
        this.logger = logger.child({ service: 'TaskStateManager' });
    }

    /**
     * Updates the status of a task in the cache.
     * @param taskIdOrDialogueId - The temporary dialogue ID or final Task ID.
     * @param status - The new status.
     * @param errorMessage - Optional error message if status indicates failure.
     * @param finalTaskId - Optional: The definitive TaskID, used for linking dialogue ID to final ID.
     */
    async updateTaskStatus(
        taskIdOrDialogueId: string,
        status: TaskStatus,
        errorMessage?: string,
        finalTaskId?: TaskId
    ): Promise<boolean> {
        this.logger.info(`Updating cache state for task/dialogue ${taskIdOrDialogueId} to ${status}. Final TaskID: ${finalTaskId}`);
        try {
            const metadata: Record<string, any> = {};
            if (errorMessage) metadata.errorMessage = errorMessage;
            if (finalTaskId) metadata.finalTaskId = finalTaskId; // Pass final ID for linking in Redis repo

            const success = await this.taskStateRepo.updateTaskStatus(taskIdOrDialogueId, status, metadata);
            if (!success) {
                 this.logger.warn(`Task state repository (cache) failed to update status for ${taskIdOrDialogueId}.`);
            }
            return success;
        } catch (error) {
             // Log and wrap error
             handleServiceError(error, this.logger, { taskIdOrDialogueId, status, phase: 'updateTaskStatus' });
             return false; // Indicate failure
        }
    }

     /**
      * Retrieves the current status of a task/dialogue from the cache.
      * @param taskIdOrDialogueId - The ID to check.
      * @returns The current TaskStatus or null if not found in cache.
      */
    async getTaskStatus(taskIdOrDialogueId: string): Promise<TaskStatus | null> {
        this.logger.debug(`Getting cached status for task/dialogue ${taskIdOrDialogueId}.`);
        try {
            return await this.taskStateRepo.getTaskStatus(taskIdOrDialogueId);
        } catch (error) {
             handleServiceError(error, this.logger, { taskIdOrDialogueId, phase: 'getTaskStatus' });
             return null; // Indicate failure/not found
        }
    }

    /**
     * Store or update task specification *temporarily* in cache if needed before blob storage.
     * NOTE: Final spec usually goes to Vercel Blob. This might be for intermediate steps.
     * @param taskId - The task identifier
     * @param specification - The task specification to store
     */
    async saveTemporaryTaskSpecification(taskId: TaskId | string, specification: TaskSpecification): Promise<boolean> {
        this.logger.debug(`Storing temporary specification in cache for task ${taskId}.`);
        try {
            // Assuming ITaskStateRepository has this method for temporary storage
            return await this.taskStateRepo.saveTaskSpecification(taskId, specification);
        } catch (error) {
            handleServiceError(error, this.logger, { taskId, phase: 'saveTemporaryTaskSpecification' });
            return false;
        }
    }

    /**
     * Retrieve a task specification *from cache*.
     * @param taskId - The task identifier
     */
    async getTemporaryTaskSpecification(taskId: TaskId | string): Promise<TaskSpecification | null> {
        this.logger.debug(`Retrieving temporary specification from cache for task ${taskId}.`);
        try {
            return await this.taskStateRepo.getTaskSpecification(taskId);
        } catch (error) {
            handleServiceError(error, this.logger, { taskId, phase: 'getTemporaryTaskSpecification' });
            return null;
        }
    }

    /**
     * Save dialogue state to the cache (Redis).
     * @param dialogueId - The dialogue identifier.
     * @param state - The dialogue state to save.
     */
    async saveDialogueState(dialogueId: string, state: DialogueState): Promise<boolean> {
        this.logger.debug(`Saving dialogue state to cache for ${dialogueId}`);
        try {
            return await this.taskStateRepo.saveDialogueState(dialogueId, state);
        } catch (error) {
             handleServiceError(error, this.logger, { dialogueId, phase: 'saveDialogueState' });
             return false;
        }
    }

    /**
     * Retrieve dialogue state from the cache (Redis).
     * @param dialogueId - The dialogue identifier.
     */
    async getDialogueState(dialogueId: string): Promise<DialogueState | null> {
        this.logger.debug(`Retrieving dialogue state from cache for ${dialogueId}`);
        try {
            return await this.taskStateRepo.getDialogueState(dialogueId);
        } catch (error) {
            handleServiceError(error, this.logger, { dialogueId, phase: 'getDialogueState' });
            return null;
        }
    }

    /**
     * Links a dialogue ID to a final task ID in the cache when the task is registered.
     * @param dialogueId - The temporary dialogue ID.
     * @param finalTaskId - The persistent task ID from Neon DB / Backend.
     */
    async linkDialogueToTask(dialogueId: string, finalTaskId: TaskId): Promise<boolean> {
        this.logger.info(`Linking dialogue ${dialogueId} to final task ID ${finalTaskId} in cache.`);
        try {
            // Update task status in cache, associating the final ID
            const currentStatus = await this.getTaskStatus(dialogueId) || TaskStatus.Clarified;
            // Pass finalTaskId in metadata to the updateTaskStatus method of the repository
            return await this.taskStateRepo.updateTaskStatus(dialogueId, currentStatus, { finalTaskId: finalTaskId });
        } catch (error) {
            handleServiceError(error, this.logger, { dialogueId, finalTaskId, phase: 'linkDialogueToTask' });
            return false;
        }
    }

    /**
     * Removes task state (dialogue, temporary spec) from the cache.
     * @param taskIdOrDialogueId - The identifier to remove.
     */
    async removeTaskState(taskIdOrDialogueId: string): Promise<boolean> {
        this.logger.info(`Removing state from cache for ${taskIdOrDialogueId}.`);
        try {
            // Delete both spec and dialogue state from Redis
            const specDeleted = await this.taskStateRepo.deleteTaskSpecification(taskIdOrDialogueId);
            const dialogueDeleted = await this.taskStateRepo.deleteDialogueState(taskIdOrDialogueId);
            // Status is deleted automatically when dialogue state is deleted by Redis repo implementation
            // const statusDeleted = await this.taskStateRepo.deleteTaskStatus(taskIdOrDialogueId);
            return specDeleted || dialogueDeleted; // Return true if any deletion succeeded
        } catch (error) {
            handleServiceError(error, this.logger, { taskIdOrDialogueId, phase: 'removeTaskState' });
            return false;
        }
    }
} 