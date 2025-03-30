import { TaskId, ProcessorId, TaskStatus } from '../common/types';
import { ILogger } from '../common/utils/logger';
import { handleServiceError, AgentBusError } from '../common/utils/error.handler';
import { ITaskRepository } from '../integrations/database/task.repository'; // Interface for Neon DB access
import { IMessageQueueClient } from '../integrations/message-queue/upstash.queue.client'; // Interface for Upstash QStash
import { config } from '../config'; // Needed for default topic

// Interface for the structured message payload on the queue
interface QueueMessagePayload {
    target: 'processor' | 'requester'; // Who the message is for
    targetId: string; // ProcessorId or RequesterId
    taskId: TaskId;
    senderRole: 'requester' | 'processor' | 'system'; // Added 'system' role
    contentType: 'text' | 'json' | 'status_update'; // Type hint for content
    content: any; // Can be string or structured JSON
    timestamp: Date;
}

// Interface for task repository to get minimal required data
// Define explicitly instead of importing full ITaskRepository if preferred
interface ITaskDataFetcher {
    getTaskById(taskId: TaskId): Promise<{
        taskId: TaskId;
        requesterId: string;
        assignedProcessorId?: string | null;
        status: TaskStatus;
    } | null>;
}

export class CommunicationService {
    private readonly logger: ILogger;
    private readonly queueClient: IMessageQueueClient; // Inject the Upstash queue client interface
    private readonly taskRepository: ITaskDataFetcher; // Inject Neon task repository interface
    private readonly messageTopic: string;

    constructor(
        queueClient: IMessageQueueClient, // Inject interface
        taskRepository: ITaskDataFetcher, // Inject interface
        logger: ILogger
    ) {
        this.queueClient = queueClient;
        this.taskRepository = taskRepository;
        this.logger = logger.child({ service: 'CommunicationService' });
        this.messageTopic = config.MESSAGE_QUEUE_TOPIC; // Get topic from config
    }

    /**
     * Publishes a message from a Requester onto the queue, intended for the assigned Processor.
     * Assumes the task is in an 'Executing' state.
     * @param taskId - The task context for the message.
     * @param requesterId - The ID of the sender (for validation).
     * @param messageContent - The content of the message (string or JSON).
     */
    async sendMessageToProcessor(taskId: TaskId, requesterId: string, messageContent: any): Promise<void> {
        this.logger.info(`Queueing message from requester ${requesterId} to processor for task ${taskId}`);
        try {
            // 1. Fetch Task Details (needed for validation and target processor ID)
            const task = await this.taskRepository.getTaskById(taskId);
            if (!task) throw new AgentBusError('Task not found', 404, { taskId });
            if (task.requesterId !== requesterId) throw new AgentBusError('Unauthorized sender', 403, { taskId, requesterId });
            // Allow sending messages in more states? Maybe PendingConfirmation, Confirmed too?
            // For now, strict check on Executing.
            if (task.status !== TaskStatus.Executing) {
                 this.logger.warn(`Attempt to send message to processor for task ${taskId} in non-executing state (${task.status}). Allowing for now.`);
                 // throw new AgentBusError('Task not in executing state', 400, { taskId, status: task.status });
            }

            const processorId = task.assignedProcessorId;
            if (!processorId) throw new AgentBusError('No processor assigned to task', 400, { taskId });

            // 2. Prepare Payload for Queue
            const payload: QueueMessagePayload = {
                target: 'processor',
                targetId: processorId,
                taskId: taskId,
                senderRole: 'requester',
                contentType: typeof messageContent === 'string' ? 'text' : 'json',
                content: messageContent,
                timestamp: new Date(),
            };

            // 3. Publish Message to Queue (using configured topic)
            await this.queueClient.publishMessage(payload, this.messageTopic);

            this.logger.info(`Message successfully published to queue topic ${this.messageTopic} for processor ${processorId}, task ${taskId}`);

        } catch (error) {
            // Let the generic error handler in the API layer wrap and log
            throw handleServiceError(error, this.logger, { taskId, requesterId, phase: 'sendMessageToProcessor' });
        }
    }

    /**
     * Publishes a message from an executing Processor onto the queue, intended for the Requester.
     * @param taskId - The task context.
     * @param processorId - The ID of the sender (for validation).
     * @param messageContent - The content of the message (string or JSON).
     */
    async sendMessageToRequester(taskId: TaskId, processorId: ProcessorId, messageContent: any): Promise<void> {
        this.logger.info(`Queueing message from processor ${processorId} to requester for task ${taskId}`);
        try {
            // 1. Fetch Task Details
            const task = await this.taskRepository.getTaskById(taskId);
            if (!task) throw new AgentBusError('Task not found', 404, { taskId });
            if (task.assignedProcessorId !== processorId) throw new AgentBusError('Unauthorized sender: Processor ID does not match assigned processor.', 403, { taskId, processorId, assigned: task.assignedProcessorId });
            // Allow sending messages in more states?
             if (task.status !== TaskStatus.Executing) {
                 this.logger.warn(`Attempt to send message to requester for task ${taskId} in non-executing state (${task.status}). Allowing for now.`);
                 // throw new AgentBusError('Task not in executing state', 400, { taskId, status: task.status });
             }
            const requesterId = task.requesterId;

            // 2. Prepare Payload for Queue
            const payload: QueueMessagePayload = {
                target: 'requester',
                targetId: requesterId,
                taskId: taskId,
                senderRole: 'processor',
                contentType: typeof messageContent === 'string' ? 'text' : 'json',
                content: messageContent, // Future enhancement: Potentially use LLM to summarize/translate before queueing
                timestamp: new Date(),
            };

            // 3. Publish Message to Queue (using configured topic)
            // The consumer for this message needs to handle delivery to the actual requester (WebSocket, notification, etc.)
            await this.queueClient.publishMessage(payload, this.messageTopic);

            this.logger.info(`Message successfully published to queue topic ${this.messageTopic} for requester ${requesterId}, task ${taskId}`);

        } catch (error) {
             // Let the generic error handler wrap and log
             throw handleServiceError(error, this.logger, { taskId, processorId, phase: 'sendMessageToRequester' });
        }
    }

    // Potential LLM enhancements for messages (could be separate service):
    // async summarizeMessageForRequester(...)
    // async translateProcessorQuery(...)
} 