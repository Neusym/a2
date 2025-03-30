import { TaskId, ProcessorId } from '../common/types';
import { ILogger } from '../common/utils/logger';
import { CommunicationService } from './broker.service'; // To call publish methods
import { handleServiceError, AgentBusError, ValidationError } from '../common/utils/error.handler';
import { z } from 'zod'; // For validation

// Define the schema for incoming messages via API/Webhook
// Allow content to be any type initially, specific handlers might parse later
const incomingMessageSchema = z.object({
    taskId: z.string().min(1),
    senderId: z.string().min(1),
    senderRole: z.enum(['requester', 'processor']),
    content: z.any().refine(val => val !== null && val !== undefined, { message: "Message content cannot be empty" })
});

// Type for validated incoming message data
export type IncomingMessage = z.infer<typeof incomingMessageSchema>;

/**
 * Handles incoming messages received by the Agent Bus API/Webhook,
 * validates them, and uses the CommunicationService to publish them
 * to the appropriate queue for delivery.
 */
export class MessageHandler {
    private readonly logger: ILogger;
    private readonly communicationService: CommunicationService; // Use concrete class

    constructor(
        communicationService: CommunicationService, // Inject concrete class
        logger: ILogger
    ) {
        this.communicationService = communicationService;
        this.logger = logger.child({ service: 'MessageHandler' });
    }

    /**
     * Handles an incoming message received by the Hono API endpoint.
     * Validates the message and calls the appropriate publish method on the CommunicationService.
     * @param message - The raw incoming message data (e.g., from request body).
     */
    async handleIncomingMessage(message: unknown): Promise<void> {
        let validatedMessage: IncomingMessage;
        try {
            // 1. Validate the incoming message structure
            const validationResult = incomingMessageSchema.safeParse(message);
            if (!validationResult.success) {
                throw new ValidationError(
                    'Invalid message format',
                    { errors: validationResult.error.flatten() }
                );
            }
            validatedMessage = validationResult.data;

            this.logger.info(`Handling incoming message for task ${validatedMessage.taskId} from ${validatedMessage.senderRole} ${validatedMessage.senderId}`);

            // 2. Determine direction and call CommunicationService to publish
            if (validatedMessage.senderRole === 'requester') {
                await this.communicationService.sendMessageToProcessor(
                    validatedMessage.taskId,
                    validatedMessage.senderId, // senderId is requesterId here
                    validatedMessage.content // Pass content directly
                );
            } else if (validatedMessage.senderRole === 'processor') {
                await this.communicationService.sendMessageToRequester(
                    validatedMessage.taskId,
                    validatedMessage.senderId, // senderId is processorId here
                    validatedMessage.content // Pass content directly
                );
            }
            // No 'else' needed due to enum validation

            this.logger.info(`Successfully processed and queued incoming message for task ${validatedMessage.taskId}`);

        } catch (error) {
            // Log the error here, but re-throw for the API layer (Hono) to handle the response
            const context = {
                taskId: (message as any)?.taskId, // Add taskId if available even if validation failed
                senderId: (message as any)?.senderId,
                senderRole: (message as any)?.senderRole
            };
            // Use handleServiceError to ensure consistent logging and error type
            const handledError = handleServiceError(error, this.logger, { ...context, phase: 'handleIncomingMessage' });
            throw handledError; // Re-throw the handled error
        }
    }
} 