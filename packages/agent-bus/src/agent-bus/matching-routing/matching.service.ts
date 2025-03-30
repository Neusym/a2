import {
    TaskId,
    TaskSpecification,
    TaskStatus,
    ProcessorId,
    RankedCandidate,
    WorkflowPlan,
    TaskDetails,
    CandidateSubmissionPayload
} from '../common/types';
import { ILogger } from '../common/utils/logger';
import { ITaskRepository } from '../integrations/database/task.repository'; // Neon DB Repo Interface
import { ITaskStateRepository } from '../integrations/database/task.cache.repository'; // Redis Repo Interface
import { ProcessorDiscovery } from './processor.discovery'; // Concrete class
import { ProcessorHealthChecker } from './processor.health.checker'; // Concrete class
import { CandidateEvaluator } from './candidate.evaluator'; // Concrete class
import { WorkflowGenerator } from './workflow.generator'; // Concrete class
import { IStorageClient } from '../integrations/storage/vercel.blob.storage.client'; // Vercel Blob Client Interface
import { IBackendClient } from '../integrations/backend-api/backend.client'; // Backend Client Interface
import { handleServiceError, AgentBusError, MatchingError, DatabaseError } from '../common/utils/error.handler';
import { config } from '../config';
import { IMatchingRoutingService } from './index'; // Import the interface

export class MatchingService implements IMatchingRoutingService {
    private readonly logger: ILogger;
    private readonly taskRepository: ITaskRepository; // Use Interface
    private readonly taskStateRepository: ITaskStateRepository; // Use Interface
    private readonly storageClient: IStorageClient; // Use Interface
    private readonly processorDiscovery: ProcessorDiscovery; // Use concrete class
    private readonly healthChecker: ProcessorHealthChecker; // Use concrete class
    private readonly candidateEvaluator: CandidateEvaluator; // Use concrete class
    private readonly workflowGenerator: WorkflowGenerator; // Use concrete class
    private readonly backendClient: IBackendClient; // Use Interface

    constructor(
        taskRepository: ITaskRepository, // Inject interface
        taskStateRepository: ITaskStateRepository, // Inject interface
        storageClient: IStorageClient, // Inject interface
        processorDiscovery: ProcessorDiscovery,
        healthChecker: ProcessorHealthChecker,
        candidateEvaluator: CandidateEvaluator,
        workflowGenerator: WorkflowGenerator,
        backendClient: IBackendClient, // Inject interface
        logger: ILogger
    ) {
        this.taskRepository = taskRepository;
        this.taskStateRepository = taskStateRepository;
        this.storageClient = storageClient;
        this.processorDiscovery = processorDiscovery;
        this.healthChecker = healthChecker;
        this.candidateEvaluator = candidateEvaluator;
        this.workflowGenerator = workflowGenerator;
        this.backendClient = backendClient;
        this.logger = logger.child({ service: 'MatchingService' });
    }

    /**
     * Main entry point triggered by an event (e.g., TaskPendingMatch).
     * Finds, evaluates, ranks candidates, generates workflow if needed,
     * and submits results via the BackendClient.
     * @param taskId - The ID of the task to process.
     */
    async processTaskMatching(taskId: TaskId): Promise<void> {
        this.logger.info(`Processing matching for task ${taskId}.`);
        let taskSpec: TaskSpecification | null = null;
        let taskDetails: TaskDetails | null = null;

        try {
            // 1. Get Task Details from Neon DB
            taskDetails = await this.taskRepository.getTaskById(taskId);
            if (!taskDetails) {
                // Task might not exist or was deleted. Log and exit gracefully.
                this.logger.warn(`Task ${taskId} not found in persistent storage during matching process. Skipping.`);
                // Optionally, update cache status if found there?
                await this.taskStateRepository.updateTaskStatus(taskId, TaskStatus.Failed, { errorMessage: "Task record not found in DB" });
                return;
            }

            // 2. Check Task Status (Idempotency Check)
            if (taskDetails.status !== TaskStatus.PendingMatch) {
                 // If already matched or being matched, log and exit.
                 if ([TaskStatus.Matching, TaskStatus.PendingConfirmation, TaskStatus.Confirmed, TaskStatus.Executing, TaskStatus.Completed].includes(taskDetails.status)) {
                     this.logger.warn(`Task ${taskId} is already in status '${taskDetails.status}'. Skipping matching.`);
                     return;
                 }
                 // Allow retrying failed matching? Only if status is explicitly failed/no-match.
                 if (taskDetails.status !== TaskStatus.MatchingFailed && taskDetails.status !== TaskStatus.NoMatchFound) {
                    this.logger.error(`Task ${taskId} is not in a matchable state (current: ${taskDetails.status}). Cannot start matching.`);
                    // Update cache status to reflect the unexpected state?
                    await this.taskStateRepository.updateTaskStatus(taskId, TaskStatus.Failed, { errorMessage: `Unexpected task status (${taskDetails.status}) during matching` });
                    return; // Exit gracefully
                 }
                 this.logger.info(`Retrying matching for previously failed/unmatched task ${taskId} (Status: ${taskDetails.status}).`);
            }

            // 3. Update Status to Matching (in Neon DB and Redis cache)
            // Use optimistic locking or check status again before proceeding? For now, assume single consumer.
            await this.updatePersistentStatus(taskId, TaskStatus.Matching); // Update DB first
            await this.taskStateRepository.updateTaskStatus(taskId, TaskStatus.Matching); // Update cache

            // 4. Fetch Task Specification from Vercel Blob using the URI from taskDetails
            taskSpec = await this.storageClient.getJson<TaskSpecification>(taskDetails.specificationUri);
            if (!taskSpec) {
                 throw new AgentBusError(`Failed to fetch or parse task specification from URI: ${taskDetails.specificationUri}`, 500, { taskId, uri: taskDetails.specificationUri });
            }

            // 5. Find Potential Processors
            const potentialProcessors = await this.processorDiscovery.findPotentialProcessors(taskSpec);
            if (potentialProcessors.length === 0) {
                // Use specific MatchingError for "no match found" scenarios
                throw new MatchingError(`No potential processors found for task ${taskId}.`, { taskId });
            }
            this.logger.info(`Found ${potentialProcessors.length} potential processors for task ${taskId}.`);

            // 6. Health Check
            const healthyProcessors = await this.healthChecker.filterHealthyProcessors(potentialProcessors);
            if (healthyProcessors.length === 0) {
                 // Use specific MatchingError
                throw new MatchingError(`No healthy processors found among potential candidates for task ${taskId}.`, { taskId, potentialCount: potentialProcessors.length });
            }
            this.logger.info(`${healthyProcessors.length} processors are healthy.`);

            // 7. Evaluate and Rank Candidates
            // Pass taskSpec directly, evaluator handles fetching if needed (though we already fetched)
            const rankedCandidates = await this.candidateEvaluator.evaluateAndRankCandidates(taskSpec, healthyProcessors);
            if (rankedCandidates.length === 0) {
                 // Should not happen if healthyProcessors > 0, but check defensively
                throw new MatchingError(`Evaluation resulted in zero ranked candidates for task ${taskId}.`, { taskId, healthyCount: healthyProcessors.length });
            }
            this.logger.info(`Ranked ${rankedCandidates.length} candidates.`);

            // 8. Generate Workflow Plan (if applicable)
            let workflowPlanUri: string | undefined;
            // Determine if workflow is needed based on spec or other logic
            const needsWorkflow = !config.DISABLE_MULTI_STEP_WORKFLOW && taskSpec.isComplex;
            if (needsWorkflow) {
                this.logger.info(`Task ${taskId} requires workflow generation.`);
                const workflowPlan = await this.workflowGenerator.generateWorkflow(taskId, taskSpec, healthyProcessors);
                if (workflowPlan) {
                    // Store workflow plan in Vercel Blob
                    const blobPath = `workflow-plans/${taskId}-${Date.now()}.json`;
                    workflowPlanUri = await this.storageClient.storeJson(blobPath, workflowPlan);
                    this.logger.info(`Workflow plan generated and stored at: ${workflowPlanUri}`);
                } else {
                     this.logger.warn(`Task ${taskId} marked as complex, but workflow generation failed or produced no plan. Proceeding with candidate list.`);
                     // Proceed with simple candidate list as fallback? Or fail? For now, proceed.
                }
            } else {
                 this.logger.info(`Workflow generation not required or disabled for task ${taskId}.`);
            }

            // 9. Prepare and Submit Candidates/Workflow via BackendClient
            const submissionPayload: CandidateSubmissionPayload = {
                taskId: taskId,
                // Submit URI if workflow exists, otherwise submit top N candidates
                workflowPlanUri: workflowPlanUri,
                candidateProcessorIds: workflowPlanUri ? undefined : rankedCandidates.map(c => c.processorId),
                candidatePrices: workflowPlanUri ? undefined : rankedCandidates.map(c => c.score.priceQuote ?? 0), // Ensure price is number
            };

            const submissionSuccess = await this.backendClient.updateTaskCandidates(submissionPayload);
            if (!submissionSuccess) {
                 // If backend submission fails, should we revert status? Mark as MatchingFailed?
                 throw new AgentBusError(`Failed to submit candidates/workflow via backend for task ${taskId}.`, 500, { taskId });
            }
            this.logger.info(`Successfully submitted candidates/workflow for task ${taskId} to backend.`);

            // 10. Update Final Status (PendingConfirmation)
            await this.updatePersistentStatus(taskId, TaskStatus.PendingConfirmation);
            await this.taskStateRepository.updateTaskStatus(taskId, TaskStatus.PendingConfirmation); // Update cache

            this.logger.info(`Matching process completed successfully for task ${taskId}. Status set to PendingConfirmation.`);

        } catch (error) {
            // Ensure error is an instance of AgentBusError or its subclasses
            const handledError = (error instanceof AgentBusError)
                ? error
                : handleServiceError(error, this.logger, { taskId, phase: 'processTaskMatching' });

            let finalStatus: TaskStatus;
            // Use specific status based on error type
            if (handledError instanceof MatchingError && handledError.statusCode === 404) {
                finalStatus = TaskStatus.NoMatchFound;
            } else {
                finalStatus = TaskStatus.MatchingFailed;
            }

            this.logger.error(`Matching process failed for task ${taskId}: ${handledError.message}`, { status: finalStatus, error: handledError });

            // Attempt to update status in persistent store and cache
            try {
                 // Update DB only if the task record was successfully fetched initially
                 if (taskDetails) {
                     await this.updatePersistentStatus(taskId, finalStatus, handledError.message);
                 }
                 // Always try to update cache status
                 await this.taskStateRepository.updateTaskStatus(taskId, finalStatus, { errorMessage: handledError.message });
            } catch (statusUpdateError) {
                 this.logger.error(`Failed to update task status to ${finalStatus} after matching error for task ${taskId}`, { statusUpdateError });
            }
            // Do not re-throw from here if this is triggered by an event queue consumer
            // The error is logged, and state is updated.
        }
    }

    // Helper to update status in the persistent Neon DB store
    private async updatePersistentStatus(taskId: TaskId, status: TaskStatus, error?: string): Promise<void> {
        try {
            const success = await this.taskRepository.updateTaskStatus(taskId, status, error);
            if (!success) {
                 // This might happen if the task was deleted between initial fetch and update
                 this.logger.warn(`Failed to update persistent status for task ${taskId} to ${status}. Task might no longer exist.`);
            }
        } catch (dbError) {
             // Log error but don't let it stop the main flow if possible
             this.logger.error(`Failed to update persistent task status for ${taskId} to ${status}`, { error: dbError });
             // Depending on severity, might re-throw or just log. Logging for now.
             // throw dbError; // Re-throwing might be appropriate in some contexts
        }
    }

     // --- Interface method implementations (May not be needed if only processTaskMatching is used) ---

     /** Finds and ranks candidates (part of the main processing logic) */
     async findAndRankCandidates(taskId: TaskId): Promise<RankedCandidate[]> {
         // This method might be called directly in some scenarios,
         // but usually processTaskMatching handles the full flow.
         this.logger.info(`Directly finding and ranking candidates for task ${taskId}.`);
         const taskDetails = await this.taskRepository.getTaskById(taskId);
         if (!taskDetails) throw new AgentBusError(`Task ${taskId} not found.`, 404);
         const taskSpec = await this.storageClient.getJson<TaskSpecification>(taskDetails.specificationUri);
         if (!taskSpec) throw new AgentBusError(`Failed to fetch spec for task ${taskId}`, 500);

         const potential = await this.processorDiscovery.findPotentialProcessors(taskSpec);
         const healthy = await this.healthChecker.filterHealthyProcessors(potential);
         return this.candidateEvaluator.evaluateAndRankCandidates(taskSpec, healthy);
     }

     /** Generates workflow plan if task is complex (part of the main processing logic) */
     async generateWorkflowPlanIfComplex(taskId: TaskId): Promise<WorkflowPlan | null> {
         this.logger.info(`Directly checking for workflow generation for task ${taskId}.`);
         const taskDetails = await this.taskRepository.getTaskById(taskId);
         if (!taskDetails) throw new AgentBusError(`Task ${taskId} not found.`, 404);
         const taskSpec = await this.storageClient.getJson<TaskSpecification>(taskDetails.specificationUri);
         if (!taskSpec) throw new AgentBusError(`Failed to fetch spec for task ${taskId}`, 500);

         if (!config.DISABLE_MULTI_STEP_WORKFLOW && taskSpec.isComplex) {
             const potential = await this.processorDiscovery.findPotentialProcessors(taskSpec);
             const healthy = await this.healthChecker.filterHealthyProcessors(potential);
             if (healthy.length > 0) {
                 return this.workflowGenerator.generateWorkflow(taskId, taskSpec, healthy);
             } else {
                  this.logger.warn(`No healthy processors found for workflow generation for task ${taskId}.`);
                  return null;
             }
         }
         this.logger.info(`Workflow generation skipped for task ${taskId} (not complex or disabled).`);
         return null;
     }
} 