export type TaskId = string; // Standardized on string for compatibility with external systems

export enum TaskStatus {
    Initial = 'Initial',               // Just received, pre-clarification
    PendingClarification = 'PendingClarification', // LLM dialogue ongoing (State in Redis)
    Clarified = 'Clarified',           // Ready for storage & backend registration (State in Redis)
    PendingRegistration = 'PendingRegistration', // Specification stored, waiting for backend/contract call
    PendingMatch = 'PendingMatch',     // Task created on contract/backend, awaiting matching (event published)
    Matching = 'Matching',             // Task is currently in the matching process (triggered by event consumer)
    ProcessorAssigned = 'ProcessorAssigned', // A processor has been assigned to the task
    WorkflowAssigned = 'WorkflowAssigned', // A workflow has been assigned to the task
    PendingConfirmation = 'PendingConfirmation', // Candidates submitted, awaiting Requester approval
    Confirmed = 'Confirmed',           // Requester approved, ready for potential execution agreement
    Executing = 'Executing',           // Task execution underway (if communication brokerage is needed)
    Completed = 'Completed',           // Task finished successfully

    // Error states
    Failed = 'Failed',                 // Task failed during execution or processing
    Cancelled = 'Cancelled',           // Task cancelled
    NoMatchFound = 'NoMatchFound',     // Agent Bus couldn't find suitable processors
    MatchingFailed = 'MatchingFailed', // Matching process failed
    ClarificationFailed = 'ClarificationFailed', // Dialogue failed
    RegistrationFailed = 'RegistrationFailed', // Failed to register task via backend
    Rejected = 'Rejected',             // Requester rejected candidates/workflow
}

// Input provided by the Requester initially (via API)
export interface InitialTaskRequest {
    requesterId: string; // Identifier for the user/entity requesting the task (e.g., user ID, wallet address)
    description: string; // Initial, possibly vague, description
    tags?: string[];
    budget?: number; // Optional initial budget constraint
    deadline?: Date; // Optional initial deadline
}

// Structured details after clarification (Stored in Vercel Blob, referenced in Neon DB)
export interface TaskSpecification {
    description: string;        // Refined, detailed description
    inputs: Record<string, any>; // Defined inputs (e.g., { url: 'string', keywords: 'string[]' })
    outputs: Record<string, any>; // Expected outputs (e.g., { report_url: 'string', summary: 'string' })
    constraints?: {           // Specific constraints
        budget?: number;
        deadline?: Date;
        quality?: string; // e.g., 'high', 'medium', 'low'
        required_platforms?: string[];
        // Add other potential constraints extracted during dialogue
        timeframe?: string;
        competitors?: string[]; // Example
    };
    tags?: string[];            // Relevant tags for matching
    isComplex?: boolean;       // Indicates if task requires a multi-step workflow
}

// Represents the full task details stored in Neon DB
export interface TaskDetails {
    taskId: TaskId;             // Unique ID for the task (generated or from backend/contract)
    requesterId: string;
    specificationUri: string;   // Vercel Blob URL pointing to the TaskSpecification JSON
    status: TaskStatus;
    assignedProcessorId?: string | null;
    workflowPlanUri?: string | null; // Vercel Blob URL to the detailed plan if multi-step
    resultUri?: string | null;       // Vercel Blob URL to the task results
    error?: string | null;           // Store error messages if failed
    createdAt: Date;
    updatedAt: Date;
    // Removed initialRequest and specification content, using URI instead
}

// Data structure passed to BackendClient::createTaskOnContract
// Includes the Blob URL for the specification
export interface TaskCreationPayload {
    requester: string; // Identifier (e.g., blockchain address or user ID)
    specificationUri: string; // Vercel Blob URL for task specification JSON
    // Potentially other on-chain relevant details like initial reward, deadline?
}

// Event payload published to Upstash QStash when task is ready for matching
export interface TaskPendingMatchEvent {
    taskId: TaskId;
    specificationUri: string;
    requesterId: string;
    timestamp: Date;
} 