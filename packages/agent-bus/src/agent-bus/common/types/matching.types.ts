import { ProcessorId, ProcessorMetadata } from './processor.types';
import { TaskId } from './task.types';

// Represents a score calculated for a specific candidate processor
export interface CandidateScore {
    processorId: ProcessorId;
    scores: {
        semanticRelevance?: number; // Score based on embedding similarity (e.g., 0-1)
        priceScore?: number;        // Normalized score based on price (lower is better)
        reputationScore?: number;   // Normalized reputation score
        reliabilityScore?: number;  // Score based on historical success/uptime
        speedScore?: number;        // Score based on historical execution time
        schemaCompatibility?: number; // Score based on input/output schema match (e.g., 0 or 1)
        // Add other relevant scoring dimensions
    };
    overallScore: number; // Weighted composite score
    priceQuote?: number;   // The actual price quoted or estimated for *this* task
    estimatedDurationMs?: number; // Estimated time for *this* task
}

// A candidate processor ranked and ready for presentation
export interface RankedCandidate {
    processorId: ProcessorId;
    rank: number;
    score: CandidateScore;
    processorMetadata?: Partial<ProcessorMetadata>; // Include some useful metadata (name, price)
    justification?: string; // Optional LLM-generated reason for ranking
}

// Represents a single step in a multi-step workflow
export interface WorkflowStep {
    stepId: string; // Unique identifier for the step within the workflow
    description: string; // Description of what this step does
    assignedProcessorId: ProcessorId; // The processor assigned to this step
    estimatedCost?: number;
    estimatedDurationMs?: number;
    dependencies: string[]; // List of stepIds that must complete before this one starts
    inputMapping?: Record<string, string>; // How inputs map from previous steps or initial task inputs
    outputMapping?: Record<string, string>; // How outputs map to subsequent steps or final task outputs
}

// Represents a proposed plan involving multiple processors
export interface WorkflowPlan {
    workflowId: string; // Unique identifier for this plan
    taskId: TaskId;
    steps: WorkflowStep[];
    totalEstimatedCost: number;
    totalEstimatedDurationMs: number;
    executionMode: 'sequential' | 'parallel'; // How steps are generally organized
    generatedAt: Date;
}

// Data structure passed to BackendClient::updateTaskCandidates
// Could be a list of candidates or a URI (from Vercel Blob) to a workflow plan
export interface CandidateSubmissionPayload {
    taskId: TaskId;
    candidateProcessorIds?: ProcessorId[]; // For simple N-candidate presentation
    candidatePrices?: number[]; // Corresponding prices for the simple list
    workflowPlanUri?: string; // Vercel Blob URL to the detailed WorkflowPlan
    // Other relevant data needed by the backend/contract interaction
} 