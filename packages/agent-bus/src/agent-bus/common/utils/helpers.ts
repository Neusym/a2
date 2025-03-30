/**
 * Simple utility to pause execution for a specified duration.
 * @param ms - Duration in milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates a simple unique ID (e.g., for dialogue state or workflow steps).
 * Consider using a more robust UUID library like `uuid` if stronger uniqueness is required.
 * `pnpm add uuid @types/uuid`
 */
// import { v4 as uuidv4 } from 'uuid';
export function generateSimpleId(prefix: string = 'id'): string {
    // return `${prefix}-${uuidv4()}`; // Using UUID
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`; // Original simple ID
}

/**
 * Basic retry mechanism for async functions.
 * @param operation - The async function to retry.
 * @param retries - Maximum number of retries.
 * @param delayMs - Delay between retries in milliseconds.
 * @param operationName - Optional name for logging.
 * @param logger - Optional logger instance.
 */
export async function retryAsync<T>(
    operation: () => Promise<T>,
    retries: number,
    delayMs: number,
    operationName: string = 'operation',
    logger?: import('./logger').ILogger // Use import type to avoid circular dependency issues
): Promise<T> {
    let lastError: Error | null = null;
    for (let i = 0; i <= retries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(`Unknown error during ${operationName}: ${String(error)}`);
            if (i < retries) {
                const logFunc = logger?.warn || console.warn;
                const waitMs = delayMs * Math.pow(2, i); // Exponential backoff
                logFunc(`Retrying ${operationName} after error (attempt ${i + 1}/${retries + 1}, waiting ${waitMs}ms): ${lastError.message}`);
                await sleep(waitMs);
            }
        }
    }
    const logErrFunc = logger?.error || console.error;
    logErrFunc(`Operation ${operationName} failed after ${retries} retries.`);
    throw lastError; // Throw the last encountered error
}


/**
 * Utility to chunk an array into smaller arrays.
 * Useful for batching requests (e.g., embeddings).
 * @param array - The array to chunk.
 * @param size - The desired size of each chunk.
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
    if (size <= 0) {
        throw new Error("Chunk size must be greater than 0.");
    }
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

/**
 * Basic input validation helper (Example)
 * Replace with a robust validation library like Zod (as used in config) or integrate with Hono's validator.
 */
export function validateInput(schema: Record<string, string>, input: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const key in schema) {
        if (schema.hasOwnProperty(key)) {
            if (input[key] === undefined || input[key] === null) {
                errors.push(`Missing required field: ${key}`);
            } else if (typeof input[key] !== schema[key]) { // Very basic type check
                // errors.push(`Invalid type for field: ${key}. Expected ${schema[key]}, got ${typeof input[key]}`);
                // Be careful with typeof, it's not robust for arrays/objects etc.
            }
        }
    }
    return { isValid: errors.length === 0, errors };
} 