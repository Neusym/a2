import { TaskId, TaskSpecification, DialogueState, TaskStatus } from '../../common/types';

// Interface for temporary storage (Upstash Redis) during task intake/clarification

export interface ITaskSpecificationCacheRepository {
    // Methods for temporary spec storage *if* needed before blob upload
    saveTaskSpecification(taskId: TaskId | string, spec: TaskSpecification): Promise<boolean>;
    getTaskSpecification(taskId: TaskId | string): Promise<TaskSpecification | null>;
    deleteTaskSpecification(taskId: TaskId | string): Promise<boolean>;
}

export interface IDialogueStateCacheRepository {
    // Methods for managing dialogue state
    saveDialogueState(dialogueId: string, state: DialogueState): Promise<boolean>;
    getDialogueState(dialogueId: string): Promise<DialogueState | null>;
    deleteDialogueState(dialogueId: string): Promise<boolean>;
}

export interface ITaskStatusCacheRepository {
     // Methods specifically for managing status in the cache
     updateTaskStatus(taskIdOrDialogueId: string, status: TaskStatus, metadata?: Record<string, any>): Promise<boolean>;
     getTaskStatus(taskIdOrDialogueId: string): Promise<TaskStatus | null>;
     deleteTaskStatus(taskIdOrDialogueId: string): Promise<boolean>;
}

// Combined interface for the Redis repository implementation
export interface ITaskStateRepository extends
    ITaskSpecificationCacheRepository,
    IDialogueStateCacheRepository,
    ITaskStatusCacheRepository
{
    // No additional methods needed, combines the above interfaces
} 