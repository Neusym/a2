import { Client as QStashClient } from "@upstash/qstash"; // Using QStash
import { ILogger } from '../../common/utils/logger';
import { config } from '../../config';
import { QueueError, ConfigurationError } from '../../common/utils/error.handler';

// Interface for publishing messages
export interface IMessageQueueClient {
    /**
     * Publishes a message payload to a specified topic/queue or the default queue.
     * @param payload The message payload (will be JSON stringified).
     * @param topicOrQueue Optional topic/queue name override.
     */
    publishMessage(payload: any, topicOrQueue?: string): Promise<void>;

    /** Disconnects the client if applicable. */
    disconnect(): Promise<void>;

    // Add consume/subscribe methods if this client also handles consumption
    // consumeMessages?(topic: string, handler: (message: any) => Promise<void>): Promise<void>;
}

 
// --- QStash Implementation ---

export class UpstashQStashClient implements IMessageQueueClient {
    private readonly logger: ILogger;
    private client: QStashClient;
    private readonly defaultUrl: string; // URL of the consuming Vercel function

    constructor(logger: ILogger) {
        this.logger = logger.child({ service: 'UpstashQStashClient' });

        if (!config.QSTASH_TOKEN || !config.QSTASH_URL) { // Check QStash specific config
            throw new ConfigurationError('Missing QStash configuration (QSTASH_TOKEN, QSTASH_URL)');
        }
        this.client = new QStashClient({ token: config.QSTASH_TOKEN });
        this.defaultUrl = config.QSTASH_URL; // The API endpoint that will receive the message
        this.logger.info(`Upstash QStash client configured. Default Target URL: ${this.defaultUrl}`);
    }

    async publishMessage(payload: any, topicOrQueue?: string): Promise<void> {
        // QStash pushes to an HTTP endpoint or uses topics which also map to endpoints
        const url = this.defaultUrl; // Use default consumer URL from config
        // Use topicOrQueue as the QStash topic name if provided, otherwise default
        const queueName = topicOrQueue || config.MESSAGE_QUEUE_TOPIC || config.TASK_EVENT_TOPIC;

        if (!url) {
             throw new ConfigurationError('QSTASH_URL (target endpoint) is not configured.');
        }
        if (!queueName) {
             throw new QueueError('No topic/queue name specified or configured for QStash message.');
        }

        this.logger.debug(`Publishing message via QStash to URL: ${url} (Topic/Queue: ${queueName})`);
        try {
            const response = await this.client.publishJSON({
                url: url, // The API endpoint (Hono route) that processes the message
                body: payload, // QStash sends the payload as the request body
                retries: 3, // Example: Add retries
                headers: { // Add content type header
                    'Content-Type': 'application/json'
                }
            });
            this.logger.info(`Message published successfully via QStash`, { 
                url: response.url,
                messageId: response.messageId || 'unknown',
                topic: queueName 
            });
        } catch (error: any) {
             const errorMessage = error.message || 'Unknown QStash publish error';
             this.logger.error(`Failed to publish message via QStash: ${errorMessage}`, { error });
            throw new QueueError(`Failed to publish message via QStash: ${errorMessage}`, { url, queueName }, error);
        }
    }

    // Disconnect not applicable for QStash client
    async disconnect(): Promise<void> {
         this.logger.debug("Disconnect called on QStash client (no-op).");
         return Promise.resolve();
    }
} 