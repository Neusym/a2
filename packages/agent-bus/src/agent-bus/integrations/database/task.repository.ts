import { TaskId, TaskStatus, TaskDetails, TaskSpecification, WorkflowPlan } from '../../common/types';
import { ProcessorId } from '../../common/types';

/**
 * Interface for persistent task repository operations (Neon DB).
 * This interacts with the main Task records, referencing data stored elsewhere (Vercel Blob).
 */
export interface ITaskRepository {
    /** Initialize schema if necessary */
    initialize(): Promise<void>;

    /**
     * Retrieves a task by its ID from the persistent store.
     * @param taskId The ID of the task to retrieve.
     * @returns The task details or null if not found.
     */
    getTaskById(taskId: TaskId): Promise<TaskDetails | null>;

    /**
     * Creates a new task record in the persistent store.
     * Typically called by the backend after specification is stored.
     * @param taskId The unique ID for the new task.
     * @param requesterId The ID of the user requesting the task.
     * @param specificationUri The Vercel Blob URL for the task specification.
     * @returns The created task details or null on failure.
     */
    createTask(taskId: TaskId, requesterId: string, specificationUri: string): Promise<TaskDetails | null>;

    /**
     * Updates the status and optionally error message of a task in the persistent store.
     * @param taskId The ID of the task to update.
     * @param status The new status.
     * @param error Optional error message if the task failed.
     * @returns Whether the update was successful.
     */
    updateTaskStatus(taskId: TaskId, status: TaskStatus, error?: string): Promise<boolean>;

    /**
     * Assigns a processor to a task in the persistent store.
     * @param taskId The ID of the task.
     * @param processorId The ID of the processor to assign.
     * @returns Whether the assignment was successful.
     */
    assignProcessor(taskId: TaskId, processorId: ProcessorId): Promise<boolean>;

    /**
     * Assigns a workflow plan URI (Vercel Blob URL) to a task in the persistent store.
     * @param taskId The ID of the task.
     * @param workflowPlanUri The Vercel Blob URL of the workflow plan JSON.
     * @returns Whether the assignment was successful.
     */
    assignWorkflowUri(taskId: TaskId, workflowPlanUri: string): Promise<boolean>;

    /** Close database connections */
    close(): Promise<void>;

    // Removed assignWorkflow - now uses assignWorkflowUri
} 