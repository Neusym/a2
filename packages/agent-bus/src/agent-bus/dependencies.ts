import { Hono } from 'hono'; // Import Hono if needed here, though usually in api/[[route]].ts
import { config } from './config';
import { PinoLogger, ILogger } from './common/utils/logger';
import { EmbeddingService, IEmbeddingService } from './integrations/llm/embedding.service';
import { PromptManager, IPromptManager } from './integrations/llm/prompt.manager';
import { IProcessorRepository } from './integrations/database/processor.repository';
import { PostgresProcessorRepository } from './integrations/database/postgresql/processor.repository';
import { ITaskStateRepository } from './integrations/database/task.cache.repository';
import { RedisTaskStateRepository } from './integrations/database/redis/task.state.repository';
import { ITaskRepository } from './integrations/database/task.repository';
import { PostgresTaskRepository } from './integrations/database/postgresql/task.repository';
import { IVectorStoreClient } from './integrations/database/vector.store.client';
import { PineconeVectorStoreClient } from './integrations/database/vector-stores/pinecone.vector.store.client';
import { IBackendClient, BackendClient } from './integrations/backend-api/backend.client';
import { IStorageClient, VercelBlobStorageClient } from './integrations/storage/vercel.blob.storage.client';
import { IProcessorRegistryClient, ProcessorRegistryClient } from './integrations/processor-registry/registry.client';
import { IMessageQueueClient, UpstashQStashClient } from './integrations/message-queue/upstash.queue.client';
import { IntakeClarificationService } from './intake-clarification/intake.service';
import { DialogueManager } from './intake-clarification/dialogue.manager';
import { TaskFormatter } from './intake-clarification/task.formatter';
import { MatchingService } from './matching-routing/matching.service';
import { IMatchingRoutingService } from './matching-routing'; // Import the interface
import { ProcessorDiscovery } from './matching-routing/processor.discovery';
import { ProcessorHealthChecker } from './matching-routing/processor.health.checker';
import { CandidateEvaluator } from './matching-routing/candidate.evaluator';
import { WorkflowGenerator } from './matching-routing/workflow.generator';
import { CommunicationService } from './communication/broker.service';
import { MessageHandler } from './communication/message.handler';
import { EventPublisher } from './core/event.publisher';
import { TaskStateManager } from './core/task.state.manager';
import { ConfigurationError } from './common/utils/error.handler';

// Structure to hold all instantiated dependencies
export interface AgentBusDependencies {
    logger: ILogger;
    promptManager: IPromptManager;
    embeddingService: IEmbeddingService;
    processorRepository: IProcessorRepository;
    taskRepository: ITaskRepository;
    taskStateRepository: ITaskStateRepository;
    vectorStoreClient: IVectorStoreClient;
    storageClient: IStorageClient;
    backendClient: IBackendClient;
    messageQueueClient: IMessageQueueClient;
    processorRegistryClient?: IProcessorRegistryClient; // Optional
    eventPublisher: EventPublisher;
    taskStateManager: TaskStateManager;
    dialogueManager: DialogueManager;
    taskFormatter: TaskFormatter;
    intakeClarificationService: IntakeClarificationService;
    processorDiscovery: ProcessorDiscovery;
    processorHealthChecker: ProcessorHealthChecker;
    candidateEvaluator: CandidateEvaluator;
    workflowGenerator: WorkflowGenerator;
    matchingRoutingService: IMatchingRoutingService; // Use interface
    communicationService: CommunicationService;
    messageHandler: MessageHandler;
}

// Singleton instance of dependencies
let dependenciesInstance: AgentBusDependencies | null = null;
let isInitializing = false; // Flag to prevent race conditions during initialization

/**
 * Initializes and wires up all dependencies for the Agent Bus.
 * Uses singleton pattern to avoid re-initialization on every serverless invocation.
 */
export async function setupDependencies(): Promise<AgentBusDependencies> {
    // Return existing instance if already initialized
    if (dependenciesInstance) {
        return dependenciesInstance;
    }

    // Prevent race conditions if multiple requests hit a cold start simultaneously
    if (isInitializing) {
         // Wait for initialization to complete
         await new Promise<void>(resolve => {
             const interval = setInterval(() => {
                 if (!isInitializing) {
                     clearInterval(interval);
                     resolve();
                 }
             }, 100); // Check every 100ms
         });
         // Return the now-initialized instance
         return dependenciesInstance!;
    }

    isInitializing = true;
    const logger = new PinoLogger({ level: config.LOG_LEVEL }); // Create logger first
    logger.info('🚀 Initializing Agent Bus dependencies...');
    const startTime = Date.now();

    try {
        // --- LLM Related (Prompt Manager, Embeddings) ---
        const promptManager = new PromptManager(logger);
        const embeddingService = new EmbeddingService(logger);

        // --- Storage ---
        const storageClient = new VercelBlobStorageClient(logger);

        // --- Databases ---
        // Neon (PostgreSQL)
        if (!config.NEON_DATABASE_URL) throw new ConfigurationError("NEON_DATABASE_URL is required.");
        const processorRepository = new PostgresProcessorRepository(config.NEON_DATABASE_URL, logger);
        const taskRepository = new PostgresTaskRepository(config.NEON_DATABASE_URL, logger);
        // Initialize DB schemas concurrently
        await Promise.all([
             processorRepository.initialize(),
             taskRepository.initialize()
        ]);
        logger.info('✅ PostgreSQL repositories initialized.');

        // Upstash Redis
        const taskStateRepository = new RedisTaskStateRepository(logger); // Handles config internally
        logger.info('✅ Redis repository initialized.');

        // Pinecone
        const vectorStoreClient = new PineconeVectorStoreClient(logger); // Handles config internally
        await vectorStoreClient.connect(); // Connect and verify index
        logger.info('✅ Pinecone client connected.');

        // --- Message Queue ---
        const messageQueueClient = new UpstashQStashClient(logger); // Using QStash client
        logger.info(`✅ Message Queue client initialized (${messageQueueClient.constructor.name}).`);

        // --- Other Integrations ---
        const backendClient = new BackendClient(logger);
        const processorRegistryClient = config.PROCESSOR_REGISTRY_URL
                                ? new ProcessorRegistryClient(config.PROCESSOR_REGISTRY_URL, logger)
                                : undefined;
        if (processorRegistryClient) {
            logger.info('✅ Processor Registry client initialized.');
        } else {
            logger.info('ℹ️ Processor Registry client disabled (no URL configured).');
        }

        // --- Core Services & Managers ---
        const eventPublisher = new EventPublisher(messageQueueClient, logger);
        const taskStateManager = new TaskStateManager(taskStateRepository, logger);

        // Intake & Clarification
        const dialogueManager = new DialogueManager(promptManager, taskStateManager, logger);
        const taskFormatter = new TaskFormatter(logger);
        const intakeClarificationService = new IntakeClarificationService(
            dialogueManager,
            taskFormatter,
            backendClient,
            storageClient,
            eventPublisher,
            taskStateManager,
            logger
        );

        // Matching & Routing
        const processorDiscovery = new ProcessorDiscovery(processorRepository, embeddingService, vectorStoreClient, logger);
        const processorHealthChecker = new ProcessorHealthChecker(processorRepository, logger);
        const candidateEvaluator = new CandidateEvaluator(promptManager, embeddingService, storageClient, logger);
        const workflowGenerator = new WorkflowGenerator(promptManager, logger);
        // Instantiate the concrete MatchingService
        const matchingService = new MatchingService(
            taskRepository,
            taskStateRepository,
            storageClient,
            processorDiscovery,
            processorHealthChecker,
            candidateEvaluator,
            workflowGenerator,
            backendClient,
            logger
        );
        // Assign the instance to the interface type for export
        const matchingRoutingService: IMatchingRoutingService = matchingService;

        // Communication
        const communicationService = new CommunicationService(
            messageQueueClient, // Use queue for brokering
            taskRepository, // Use persistent repo to get task details
            logger
        );
        const messageHandler = new MessageHandler(communicationService, logger);

        const duration = Date.now() - startTime;
        logger.info(`✅ Agent Bus dependencies setup complete in ${duration}ms.`);

        // Store the initialized instance
        dependenciesInstance = {
            logger,
            promptManager,
            embeddingService,
            processorRepository,
            taskRepository,
            taskStateRepository,
            vectorStoreClient,
            storageClient,
            backendClient,
            messageQueueClient,
            processorRegistryClient,
            eventPublisher,
            taskStateManager,
            dialogueManager,
            taskFormatter,
            intakeClarificationService,
            processorDiscovery,
            processorHealthChecker,
            candidateEvaluator,
            workflowGenerator,
            matchingRoutingService,
            communicationService,
            messageHandler,
        };

        isInitializing = false; // Release the lock
        return dependenciesInstance;

    } catch (error) {
        logger.error('❌ FATAL: Failed to initialize Agent Bus dependencies.', { error });
        isInitializing = false; // Release lock on error
        // Gracefully attempt cleanup if possible, although difficult if basic clients failed
        await shutdownDependencies(); // Attempt cleanup
        throw error; // Re-throw to prevent application start
    }
}

/**
 * Gracefully shuts down dependencies like database connections.
 */
export async function shutdownDependencies(): Promise<void> {
    if (!dependenciesInstance) {
        return; // Nothing to shut down
    }
    const logger = dependenciesInstance.logger || new PinoLogger(); // Use instance logger or default
    logger.info('🔌 Shutting down Agent Bus dependencies...');
    const shutdownStartTime = Date.now();
    try {
        await Promise.allSettled([
            dependenciesInstance.processorRepository?.close(), // Add null checks
            dependenciesInstance.taskRepository?.close(),
            // Redis client doesn't need explicit close usually
            // Pinecone client doesn't need explicit close
            // Message Queue client might need disconnect
            dependenciesInstance.messageQueueClient?.disconnect(), // Call disconnect if it exists
        ].filter(p => p)); // Filter out undefined promises if optional dependencies weren't created

        const duration = Date.now() - shutdownStartTime;
        logger.info(`✅ Dependencies shut down gracefully in ${duration}ms.`);
    } catch (error) {
        logger.error('⚠️ Error during dependency shutdown.', { error });
    } finally {
        dependenciesInstance = null; // Clear the singleton instance
    }
}

// Optional: Handle process exit signals to trigger shutdown
// This is less critical in serverless but good practice for local dev/other environments
// process.on('SIGTERM', () => shutdownDependencies().finally(() => process.exit(0)));
// process.on('SIGINT', () => shutdownDependencies().finally(() => process.exit(0))); 