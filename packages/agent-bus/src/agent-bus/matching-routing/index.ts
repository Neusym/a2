import {
    TaskId,
    RankedCandidate,
    WorkflowPlan
} from '../common/types';

// Define the interface for the main service if needed for dependency injection elsewhere
// This should match the public methods of MatchingService that are entry points
export interface IMatchingRoutingService {
  /**
   * Processes the entire matching flow for a task, typically triggered by an event.
   * Includes discovery, health check, evaluation, workflow generation (if needed),
   * and submitting results to the backend.
   * @param taskId The ID of the task to process.
   */
  processTaskMatching(taskId: TaskId): Promise<void>; // Main entry point

  // Optional: Expose sub-steps if needed for direct invocation (less common)
  // findAndRankCandidates(taskId: TaskId): Promise<RankedCandidate[]>;
  // generateWorkflowPlanIfComplex(taskId: TaskId): Promise<WorkflowPlan | null>;
}

// Export the core service and potentially supporting classes/interfaces
export * from './matching.service';
export * from './processor.discovery';
export * from './processor.health.checker';
export * from './candidate.evaluator';
export * from './workflow.generator'; 