import { TaskStatus } from '../types/task.types';

// Task Statuses - Can re-export if needed, or define constants based on them
export const PENDING_MATCH_STATUS = TaskStatus.PendingMatch;
export const PENDING_CONFIRMATION_STATUS = TaskStatus.PendingConfirmation;
export const NO_MATCH_FOUND_STATUS = TaskStatus.NoMatchFound;


// Default values
export const DEFAULT_MAX_CANDIDATES = 5; // Default number of candidates to return
export const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 5000; // 5 seconds


// LLM Related
export const DEFAULT_CLARIFICATION_MODEL = 'gpt-4-turbo-preview'; // Example
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-ada-002'; // Example
export const DEFAULT_MATCHING_REASONING_MODEL = 'claude-3-opus-20240229'; // Example
export const DEFAULT_WORKFLOW_GENERATION_MODEL = 'claude-3-opus-20240229'; // Example


// Other constants
export const MAX_CLARIFICATION_TURNS = 10; // Limit conversation length
export const TASK_EVENT_TOPIC = 'agent-bus-task-events'; // Upstash QStash Topic Name
export const MESSAGE_QUEUE_TOPIC = 'agent-bus-messages'; // For processor/requester comms


// Add more constants as needed 