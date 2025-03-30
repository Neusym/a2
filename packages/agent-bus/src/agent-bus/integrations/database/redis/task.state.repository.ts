import { Redis } from '@upstash/redis';
import { TaskId, TaskSpecification, DialogueState, TaskStatus, DialogueStage } from '../../../common/types';
import { ITaskStateRepository } from '../task.cache.repository';
import { ILogger } from '../../../common/utils/logger';
import { DatabaseError, ConfigurationError } from '../../../common/utils/error.handler';
import { config } from '../../../config';

export class RedisTaskStateRepository implements ITaskStateRepository {
    private readonly logger: ILogger;
    private client: Redis;
    private readonly ttlSeconds: number;

    // Prefixes for Redis keys
    private readonly TASK_SPEC_PREFIX = 'task:spec:'; // For temporary specs if needed
    private readonly DIALOGUE_STATE_PREFIX = 'task:dialogue:';
    private readonly TASK_STATUS_PREFIX = 'task:status:'; // Stores status and related metadata

    constructor(logger: ILogger) {
        this.logger = logger.child({ service: 'RedisTaskStateRepository' });
        this.ttlSeconds = config.REDIS_TTL_SECONDS;

        if (!config.UPSTASH_REDIS_URL || !config.UPSTASH_REDIS_TOKEN) {
            this.logger.error('Missing Redis configuration', {
                hasUrl: !!config.UPSTASH_REDIS_URL,
                hasToken: !!config.UPSTASH_REDIS_TOKEN,
                url: config.UPSTASH_REDIS_URL ? 'present' : 'missing',
                token: config.UPSTASH_REDIS_TOKEN ? 'present' : 'missing'
            });
            throw new ConfigurationError('Upstash Redis URL or Token not configured.');
        }

        try {
            this.logger.debug('Attempting to initialize Redis client with URL:', {
                url: config.UPSTASH_REDIS_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') // Hide credentials
            });
            
            // Initialize the client
            this.client = new Redis({
                url: config.UPSTASH_REDIS_URL,
                token: config.UPSTASH_REDIS_TOKEN,
            });

            // Test the connection
            this.logger.debug('Testing Redis connection...');
            this.client.ping().then(() => {
                this.logger.info('Redis connection test successful');
                this.logger.info(`Upstash Redis Task State Repository initialized. Default TTL: ${this.ttlSeconds}s`);
            }).catch(error => {
                this.logger.error('Redis ping failed', { 
                    error,
                    errorName: error instanceof Error ? error.name : 'Unknown',
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined
                });
                throw new DatabaseError('Redis connection test failed', {}, error);
            });
        } catch (error) {
            this.logger.error('Failed to initialize Upstash Redis client', { 
                error,
                errorName: error instanceof Error ? error.name : 'Unknown',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
            throw new DatabaseError('Failed to initialize Upstash Redis client', {}, error instanceof Error ? error : undefined);
        }
    }

    // --- Task Specification Methods (Primarily for temporary specs during clarification) ---

    async saveTaskSpecification(taskId: TaskId | string, spec: TaskSpecification): Promise<boolean> {
        this.logger.debug(`Saving temporary task specification in cache for TaskID: ${taskId}`);
        try {
            const key = this.TASK_SPEC_PREFIX + taskId;
            const result = await this.client.set(key, JSON.stringify(spec), { ex: this.ttlSeconds });
            return result === 'OK';
        } catch (error) {
            this.logger.error(`Error saving temporary task specification: ${taskId}`, { error });
            throw new DatabaseError(`Failed to save temporary task spec to Redis: ${taskId}`, {}, error instanceof Error ? error : undefined);
        }
    }

    async getTaskSpecification(taskId: TaskId | string): Promise<TaskSpecification | null> {
        this.logger.debug(`Getting temporary task specification from cache for TaskID: ${taskId}`);
        try {
            const key = this.TASK_SPEC_PREFIX + taskId;
            const result = await this.client.get<TaskSpecification>(key); // Specify type for parsing
            return result; // Upstash client handles JSON parsing
        } catch (error) {
            this.logger.error(`Error getting temporary task specification: ${taskId}`, { error });
            throw new DatabaseError(`Failed to get temporary task spec from Redis: ${taskId}`, {}, error instanceof Error ? error : undefined);
        }
    }

    async deleteTaskSpecification(taskId: TaskId | string): Promise<boolean> {
        this.logger.debug(`Deleting temporary task specification from cache for TaskID: ${taskId}`);
        try {
            const key = this.TASK_SPEC_PREFIX + taskId;
            const result = await this.client.del(key);
            return result > 0;
        } catch (error) {
            this.logger.error(`Error deleting temporary task specification: ${taskId}`, { error });
            throw new DatabaseError(`Failed to delete temporary task spec from Redis: ${taskId}`, {}, error instanceof Error ? error : undefined);
        }
    }

    // --- Dialogue State Methods ---

    async saveDialogueState(dialogueId: string, state: DialogueState): Promise<boolean> {
        this.logger.debug(`Saving dialogue state in cache for ID: ${dialogueId}`);
        try {
            const key = this.DIALOGUE_STATE_PREFIX + dialogueId;
            const result = await this.client.set(key, JSON.stringify(state), { ex: this.ttlSeconds });

            // Also update/set the simple status based on dialogue state
            const taskStatus = this.mapDialogueStageToTaskStatus(state.currentState);
            await this.updateTaskStatus(dialogueId, taskStatus);

            return result === 'OK';
        } catch (error) {
            this.logger.error(`Error saving dialogue state: ${dialogueId}`, { error });
            throw new DatabaseError(`Failed to save dialogue state to Redis: ${dialogueId}`, {}, error instanceof Error ? error : undefined);
        }
    }

    async getDialogueState(dialogueId: string): Promise<DialogueState | null> {
        this.logger.debug(`Getting dialogue state from cache for ID: ${dialogueId}`);
        try {
            const key = this.DIALOGUE_STATE_PREFIX + dialogueId;
            const result = await this.client.get<DialogueState>(key);
            return result;
        } catch (error) {
            this.logger.error(`Error getting dialogue state: ${dialogueId}`, { error });
            throw new DatabaseError(`Failed to get dialogue state from Redis: ${dialogueId}`, {}, error instanceof Error ? error : undefined);
        }
    }

    async deleteDialogueState(dialogueId: string): Promise<boolean> {
        this.logger.debug(`Deleting dialogue state from cache for ID: ${dialogueId}`);
        try {
            const key = this.DIALOGUE_STATE_PREFIX + dialogueId;
            const result = await this.client.del(key);
            // Also delete the associated status entry
            await this.deleteTaskStatus(dialogueId);
            return result > 0;
        } catch (error) {
            this.logger.error(`Error deleting dialogue state: ${dialogueId}`, { error });
            throw new DatabaseError(`Failed to delete dialogue state from Redis: ${dialogueId}`, {}, error instanceof Error ? error : undefined);
        }
    }

    // --- Task Status Methods ---

    async updateTaskStatus(taskIdOrDialogueId: string, status: TaskStatus, metadata?: Record<string, any>): Promise<boolean> {
        this.logger.debug(`Updating cache status for Task/Dialogue ID ${taskIdOrDialogueId} to ${status}`);
        try {
            const key = this.TASK_STATUS_PREFIX + taskIdOrDialogueId;
            const finalTaskId = metadata?.finalTaskId;

            // Fetch existing status data if linking dialogueId to finalTaskId
            let existingData: any = {};
            if (finalTaskId && taskIdOrDialogueId !== finalTaskId) {
                 // Only fetch if the key we are about to overwrite is the dialogue ID's status key
                 if (key === this.TASK_STATUS_PREFIX + taskIdOrDialogueId) {
                     existingData = await this.client.get(key) || {};
                 }
            }

            const statusData = {
                status: status,
                error: metadata?.errorMessage || existingData.error || null,
                finalTaskId: finalTaskId || existingData.finalTaskId || null, // Persist finalTaskId if already set
                updatedAt: new Date().toISOString()
            };

            // Use MULTI/EXEC for atomic update if linking
            const tx = this.client.multi();
            tx.set(key, JSON.stringify(statusData), { ex: this.ttlSeconds });

            // If linking a dialogue ID to a final TaskId, create/update the final TaskId entry as well
            if (finalTaskId && taskIdOrDialogueId !== finalTaskId) {
                const finalKey = this.TASK_STATUS_PREFIX + finalTaskId;
                // Store the same status object under the final task ID key
                tx.set(finalKey, JSON.stringify(statusData), { ex: this.ttlSeconds });

                // Optionally rename/copy other related keys (like temp spec) - less critical usually
                // const specKey = this.TASK_SPEC_PREFIX + taskIdOrDialogueId;
                // tx.rename(specKey, this.TASK_SPEC_PREFIX + finalTaskId); // Be careful with RENAME if key might not exist
            }

            const results = await tx.exec();
            // Check if all commands in the transaction succeeded
            // SET returns 'OK', DEL/RENAME return number. exec() returns array of results.
            const success = results.every(res => res === 'OK' || typeof res === 'number');
            if (!success) {
                 this.logger.warn(`Redis transaction failed or partially failed for updateTaskStatus: ${taskIdOrDialogueId}`);
                 // Attempt individual set as fallback? Might lead to inconsistency. Best to log and potentially retry later.
                 return false;
            }
            return true;

        } catch (error) {
            this.logger.error(`Error updating task status in cache: ${taskIdOrDialogueId}`, { error });
            throw new DatabaseError(`Failed to update task status in Redis: ${taskIdOrDialogueId}`, {}, error instanceof Error ? error : undefined);
        }
    }

    async getTaskStatus(taskIdOrDialogueId: string): Promise<TaskStatus | null> {
        this.logger.debug(`Getting status from cache for Task/Dialogue ID: ${taskIdOrDialogueId}`);
        try {
            const key = this.TASK_STATUS_PREFIX + taskIdOrDialogueId;
            const statusData = await this.client.get<{ status: TaskStatus, finalTaskId?: string }>(key);

            if (!statusData) {
                // Fallback: Check if dialogue state exists (implies PendingClarification or failed)
                const dialogueState = await this.getDialogueState(taskIdOrDialogueId);
                if (dialogueState) {
                    return this.mapDialogueStageToTaskStatus(dialogueState.currentState);
                }
                return null; // Not found in cache
            }

            // If this key points to a finalTaskId, fetch the status using that ID instead
            // This handles cases where we query using the original dialogue ID after it's linked
            if (statusData.finalTaskId && statusData.finalTaskId !== taskIdOrDialogueId) {
                 this.logger.debug(`Status key ${key} linked to final ID ${statusData.finalTaskId}. Fetching final ID status.`);
                 const finalKey = this.TASK_STATUS_PREFIX + statusData.finalTaskId;
                 const finalStatusData = await this.client.get<{ status: TaskStatus }>(finalKey);
                 return finalStatusData?.status || null; // Return status from final key or null if not found
            }

            return statusData.status;

        } catch (error) {
            this.logger.error(`Error getting task status from cache: ${taskIdOrDialogueId}`, { error });
            throw new DatabaseError(`Failed to get task status from Redis: ${taskIdOrDialogueId}`, {}, error instanceof Error ? error : undefined);
        }
    }

    async deleteTaskStatus(taskIdOrDialogueId: string): Promise<boolean> {
         this.logger.debug(`Deleting status from cache for Task/Dialogue ID: ${taskIdOrDialogueId}`);
         try {
             const key = this.TASK_STATUS_PREFIX + taskIdOrDialogueId;
             const result = await this.client.del(key);
             return result > 0;
         } catch (error) {
             this.logger.error(`Error deleting task status from cache: ${taskIdOrDialogueId}`, { error });
             throw new DatabaseError(`Failed to delete task status from Redis: ${taskIdOrDialogueId}`, {}, error instanceof Error ? error : undefined);
         }
    }

    // Helper to map dialogue stage to task status
    private mapDialogueStageToTaskStatus(stage: DialogueStage): TaskStatus {
        switch (stage) {
            case DialogueStage.COMPLETED: return TaskStatus.Clarified;
            case DialogueStage.FAILED: return TaskStatus.ClarificationFailed;
            default: return TaskStatus.PendingClarification;
        }
    }

    // Note: No explicit close() method needed for Upstash Redis serverless client.
} 