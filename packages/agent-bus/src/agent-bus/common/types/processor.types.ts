export type ProcessorId = string; // Unique identifier for the processor (e.g., blockchain address, UUID)

export enum ProcessorStatus {
    Active = 'Active',     // Available for tasks
    Inactive = 'Inactive', // Not currently available
    Busy = 'Busy',       // Currently executing a task
    Unhealthy = 'Unhealthy' // Health check failed
}

// Metadata stored about each processor (Agent/Creator) in Neon DB
export interface ProcessorMetadata {
    processorId: ProcessorId;
    name: string;
    description: string;        // Detailed description of capabilities
    capabilitiesTags: string[]; // Keywords describing what the agent does
    inputSchema?: Record<string, any>; // JSON schema for expected input
    outputSchema?: Record<string, any>; // JSON schema for produced output
    endpointUrl: string;        // URL for health checks and potentially task execution triggers/communication
    status: ProcessorStatus;
    ownerAddress?: string;      // Blockchain address of the owner/creator (if applicable)
    registeredAt: Date;
    lastCheckedAt?: Date;       // Last health check timestamp

    // Reputation & Performance (could be enriched from reviews/history)
    reputationScore?: number;   // Aggregate score (e.g., 0-5)
    completedTasks?: number;
    successRate?: number;       // Percentage of successfully completed tasks
    averageExecutionTimeMs?: number;

    // Pricing Model (simplified example)
    pricing?: {
        model: 'fixed' | 'per_call' | 'usage_based'; // Type of pricing
        price?: number; // Fixed price or price per call (in platform tokens or fiat equivalent)
        unit?: string;  // e.g., 'token', 'usd_cents', 'per_gb'
    };

    // Embedding of the description/capabilities for semantic search (stored in Pinecone)
    descriptionEmbedding?: number[]; // This might not be stored in Postgres, but conceptually belongs here
} 