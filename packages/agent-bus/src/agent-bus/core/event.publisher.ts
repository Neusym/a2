import { TaskId, TaskPendingMatchEvent } from '../common/types';
import { ILogger } from '../common/utils/logger';
import { IMessageQueueClient } from '../integrations/message-queue/upstash.queue.client'; // Use Interface
import { config } from '../config';
import { handleServiceError } from '../common/utils/error.handler';

/**
 * Service responsible for publishing domain events (like TaskPendingMatch)
 * to the message queue (Upstash QStash).
 */
export class EventPublisher {
    private readonly logger: ILogger;
    private readonly queueClient: IMessageQueueClient; // Depends on the interface
    private readonly taskTopic: string;

    constructor(
        queueClient: IMessageQueueClient, // Inject the interface
        logger: ILogger
    ) {
        this.queueClient = queueClient;
        this.logger = logger.child({ service: 'EventPublisher' });
        this.taskTopic = config.TASK_EVENT_TOPIC; // Get topic name from config
    }

    /**
     * Publishes an event indicating a task is ready for matching.
     * @param taskId The ID of the task.
     * @param specificationUri The URI (Vercel Blob URL) of the task specification.
     * @param requesterId The ID of the requester.
     */
    async publishTaskPendingMatch(taskId: TaskId, specificationUri: string, requesterId: string): Promise<void> {
        this.logger.info(`Publishing TaskPendingMatch event for task ${taskId} to topic ${this.taskTopic}`);

        const eventPayload: TaskPendingMatchEvent = {
            taskId,
            specificationUri,
            requesterId,
            timestamp: new Date(),
        };

        try {
            // The queueClient implementation (added in Part 4) handles the actual sending
            await this.queueClient.publishMessage(eventPayload, this.taskTopic);
            this.logger.info(`Successfully published TaskPendingMatch event for task ${taskId}`);
        } catch (error) {
            // Let the calling service handle the error propagation
            throw handleServiceError(error, this.logger, { taskId, topic: this.taskTopic, phase: 'publishTaskPendingMatch' });
        }
    }

    // Add other event publishing methods as needed
    // async publishTaskCompleted(taskId: TaskId, resultUri: string): Promise<void> { ... }
    // async publishTaskFailed(taskId: TaskId, error: string): Promise<void> { ... }
} 