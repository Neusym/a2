// src/agent-bus/common/types/llm.types.ts
import { ToolCallPart, ToolResultPart } from 'ai'; // Import Vercel AI SDK types

// Represents a single turn in a dialogue
export interface DialogueTurn {
    role: 'user' | 'assistant' | 'system' | 'tool'; // Add 'tool' role
    content: string;
    timestamp: Date;
    toolCalls?: ToolCallPart[]; // Optional Vercel AI SDK Tool Calls
    toolResults?: ToolResultPart[]; // Optional Vercel AI SDK Tool Results
}

// Define the dialogue stages as an enum for better type safety
export enum DialogueStage {
    GATHERING_COMPETITORS = 'gathering_competitors',
    GATHERING_TIMEFRAME = 'gathering_timeframe',
    GATHERING_PLATFORMS = 'gathering_platforms',
    FINALIZING = 'finalizing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled' // Add CANCELLED stage
}

// Define a base interface for extracted parameters
export interface BaseExtractedParams {
    initial_description?: string;
    refined_description?: string;
    competitors?: string[];
    timeframe?: string;
    platforms?: string[];
    // Add other common expected parameters here
    // These will be extended by specific dialogue needs
    tags?: string[];
    budget?: number | string; // Allow string or number for budget
    deadline?: Date;
    quality?: string;
    required_platforms?: string[];
    inputs?: Record<string, any>;
    outputs?: Record<string, any>;
    isComplex?: boolean;
}

// Represents the state of an ongoing clarification dialogue
export interface DialogueState {
    taskId?: string; // Reference to the task being clarified (can be temp dialogue ID)
    requesterId: string;
    history: DialogueTurn[];
    currentState: DialogueStage; // Use the enum instead of string literals
    // Store extracted entities or parameters with improved typing
    extractedParams?: BaseExtractedParams & Record<string, any>;
} 