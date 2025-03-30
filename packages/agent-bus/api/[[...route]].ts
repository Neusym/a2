import { Hono } from 'hono';
import { handle } from 'hono/vercel';
// Import types and interfaces needed for setup (but setup function comes later)
import { ILogger, PinoLogger } from '../src/agent-bus/common/utils/logger'; // Use PinoLogger directly for initial setup logging
import { AgentBusError, ValidationError } from '../src/agent-bus/common/utils/error.handler';
import { AgentBusDependencies, setupDependencies, shutdownDependencies } from '../src/agent-bus/dependencies'; // Import type and setup function
import { config } from '../src/agent-bus/config'; // Need config early
import { z } from 'zod';
import { InitialTaskRequest } from '../src/agent-bus/common/types';
import { zValidator } from '@hono/zod-validator';

// Define the type for Hono's context variables
type HonoVariables = {
    dependencies: AgentBusDependencies;
    logger: ILogger;
};

// Initialize Hono app with typed context
export const app = new Hono<{ Variables: HonoVariables }>().basePath('/api'); // Set base path & export app

let dependencies: AgentBusDependencies | null = null; // Use null initially
let logger: ILogger; // Logger will be initialized during setup

// Temporary logger for setup phase before full DI is ready
const setupLogger = new PinoLogger({ level: config.LOG_LEVEL || 'info' });

// Middleware to simulate dependency injection setup (will be replaced in Part 4)
app.use('*', async (c, next) => {
    try {
        if (!dependencies) {
            // Initialize dependencies if not already done (handles cold starts)
            dependencies = await setupDependencies();
            logger = dependencies.logger;
            logger.info("Dependencies initialized for API handler request.");
        }
        // Add dependencies to context for easy access in route handlers
        c.set('dependencies', dependencies);
        c.set('logger', dependencies.logger); // Ensure logger is always set from potentially new dependencies obj
        await next();
    } catch (error) {
         // Log fatal initialization error
         console.error("FATAL: Failed to initialize dependencies in API middleware:", error);
         // Return a generic 500 error if dependencies fail
         return c.json({ error: 'Internal Server Error', message: 'Failed to initialize application dependencies.' }, 500);
    }
});

// --- API Routes ---

// Root endpoint that redirects to the health endpoint
app.get('/', (c) => {
    return c.json({ status: 'ok', message: 'Agent Bus API is running' });
});

// Health Check (Functional in Part 1)
app.get('/health', (c) => {
    const log = c.get('logger') as ILogger;
    log.info('Health check requested.');
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Intake/Clarification Routes ---

// Schema for starting a dialogue
const startDialogueSchema = z.object({
    requesterId: z.string().min(1, "requesterId is required"),
    description: z.string().min(10, "description must be at least 10 characters"),
    tags: z.array(z.string()).optional(),
    budget: z.number().positive().optional(),
    deadline: z.coerce.date().optional().refine(d => !d || d.getTime() > Date.now(), {
        message: "Deadline must be in the future",
    }),
});

app.post('/dialogue/start', zValidator('json', startDialogueSchema), async (c) => {
    const deps = c.get('dependencies') as AgentBusDependencies;
    const log = c.get('logger') as ILogger;
    // Type assertion is safe here due to zValidator middleware
    const initialRequest = c.req.valid('json') as InitialTaskRequest;

    log.info(`POST /api/dialogue/start called by ${initialRequest.requesterId}`);
    try {
        // Delegate to the service layer
        const initialState = await deps.intakeClarificationService.initiateTaskClarification(initialRequest);
        return c.json(initialState, 200); // Return 200 OK with initial state
    } catch (error) {
        // Error handling delegated to the generic error handler below
        throw error;
    }
});

// Schema for continuing a dialogue
const continueDialogueSchema = z.object({
    userResponse: z.string().min(1, "userResponse cannot be empty"),
});

app.post('/dialogue/:dialogueId/continue', zValidator('json', continueDialogueSchema), async (c) => {
    const deps = c.get('dependencies') as AgentBusDependencies;
    const log = c.get('logger') as ILogger;
    const dialogueId = c.req.param('dialogueId');
    const { userResponse } = c.req.valid('json');

    log.info(`POST /api/dialogue/${dialogueId}/continue`);
    try {
         // Delegate to the service layer
        const updatedState = await deps.intakeClarificationService.continueClarification(dialogueId, userResponse);
        return c.json(updatedState, 200); // Return 200 OK with updated state
    } catch (error) {
        throw error;
    }
});

// --- Communication Routes ---

// Schema for incoming messages (from Processor/Requester to AgentBus)
// Allow content to be any type, validation happens in handler/service if needed
const incomingMessageSchema = z.object({
    taskId: z.string().min(1, "taskId is required"),
    senderId: z.string().min(1, "senderId is required"),
    senderRole: z.enum(['requester', 'processor'], { errorMap: () => ({ message: "senderRole must be 'requester' or 'processor'" }) }),
    content: z.any().refine(val => val !== null && val !== undefined, { message: "Message content cannot be empty" })
});

app.post('/messages', zValidator('json', incomingMessageSchema), async (c) => {
    const deps = c.get('dependencies') as AgentBusDependencies;
    const log = c.get('logger') as ILogger;
    const incomingMessage = c.req.valid('json');

    log.info(`POST /api/messages received for task ${incomingMessage.taskId} from ${incomingMessage.senderRole} ${incomingMessage.senderId}`);
    try {
        // Message handler validates sender based on task state and publishes to the queue
        await deps.messageHandler.handleIncomingMessage(incomingMessage);
        // Return 202 Accepted: The request is accepted for processing, but processing is not complete.
        return c.json({ message: 'Message accepted for relay' }, 202);
    } catch (error) {
        throw error;
    }
});


// --- Task Status Route (Example) ---
app.get('/tasks/:taskId/status', async (c) => {
     const deps = c.get('dependencies') as AgentBusDependencies;
     const log = c.get('logger') as ILogger;
     const taskId = c.req.param('taskId');

     log.info(`GET /api/tasks/${taskId}/status`);
     try {
         // Prefer checking cache first for recent status
         let status = await deps.taskStateManager.getTaskStatus(taskId);
         if (!status) {
             // Fallback to persistent DB if not in cache
             log.debug(`Status for task ${taskId} not in cache, checking DB.`);
             const taskDetails = await deps.taskRepository.getTaskById(taskId);
             status = taskDetails?.status ?? null; // Get status from DB or null if task doesn't exist
         }

         if (status) {
             return c.json({ taskId, status }, 200);
         } else {
             return c.json({ error: 'Not Found', message: `Task ${taskId} not found.` }, 404);
         }
     } catch (error) {
         throw error;
     }
});


// --- Webhook for Task Processing (Example for QStash or direct trigger) ---
// This endpoint would be called by the message queue consumer (e.g., QStash)
const processTaskSchema = z.object({
     // Define the expected payload from the queue message (e.g., TaskPendingMatchEvent)
     taskId: z.string().min(1),
     specificationUri: z.string().url(),
     requesterId: z.string().min(1),
     timestamp: z.coerce.date(),
});

app.post('/webhooks/process-task', zValidator('json', processTaskSchema), async (c) => {
     const deps = c.get('dependencies') as AgentBusDependencies;
     const log = c.get('logger') as ILogger;
     const taskEvent = c.req.valid('json');

     log.info(`Webhook /api/webhooks/process-task received for task ${taskEvent.taskId}`);

     try {
         // Trigger the matching service asynchronously (don't await if webhook expects quick response)
         // Use setImmediate or similar to avoid holding up the webhook response
         setImmediate(() => {
             deps.matchingRoutingService.processTaskMatching(taskEvent.taskId)
                 .catch(err => {
                     // Log errors from the async processing
                     log.error(`Error during async task processing triggered by webhook for task ${taskEvent.taskId}: ${err.message}`, { error: err });
                 });
         });

         // Return 202 Accepted immediately to the webhook source
         return c.json({ message: `Accepted task ${taskEvent.taskId} for processing.` }, 202);

     } catch (error) {
         // Catch synchronous errors during validation or initial setup
         log.error(`Synchronous error in process-task webhook for task ${taskEvent.taskId}`, { error });
         // Throw error for the main error handler to catch and return 500
         throw error;
     }
});


// --- Error Handling ---
// Use a catch-all middleware to handle errors (must be after all other middleware/routes)
app.onError((error, c) => {
    const logger = c.get('logger') || dependencies?.logger || console;
    const reportError = error instanceof AgentBusError ? error : new AgentBusError('Unhandled server error', 500, {}, error instanceof Error ? error : undefined);
    
    const statusCode = reportError.statusCode || 500;
    logger.error(`API Error (${statusCode}): ${reportError.message}`, reportError.context || {});
    
    return c.json(
        {
            error: {
                name: reportError.name,
                message: reportError.message,
                // Optionally include context only in development
                ...(config.NODE_ENV === 'development' && reportError.context ? { context: reportError.context } : {}),
            },
        },
        statusCode as any // Type assertion to fix compatibility issue
    );
});

// --- Vercel Handler Export ---
// This makes the Hono app available as a Vercel Serverless Function
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
export const HEAD = handle(app);

// Log when the handler module is loaded (useful for cold start debugging)
setupLogger.info("Hono API handler module loaded (Final Version).");

// Graceful shutdown handling (optional but good practice for serverless)
// Vercel might not always trigger this reliably, but it can help release resources.
// process.on('SIGTERM', async () => {
//     console.log('SIGTERM received, shutting down dependencies...');
//     await shutdownDependencies();
//     console.log('Dependencies shut down.');
//     process.exit(0);
// }); 