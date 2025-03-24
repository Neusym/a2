import { RetryConfig } from '../types';

/**
 * Executes a function with retries based on the given configuration
 */
export async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T> {
  const { maxAttempts, initialDelay, backoffFactor } = config;
  let attempt = 0;
  let lastError: Error | undefined;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;

      if (attempt >= maxAttempts) {
        break;
      }

      // Calculate delay for this attempt
      const delay = initialDelay * Math.pow(backoffFactor, attempt - 1);

      // Wait before next attempt
      await sleep(delay);
    }
  }

  throw new Error(`Max retry attempts (${maxAttempts}) reached: ${lastError?.message}`);
}

/**
 * Creates a sleep promise for the given milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines if an error should be retried based on its type or message
 */
export function isRetryableError(error: Error): boolean {
  // Network errors are often transient
  if (error.name === 'NetworkError' || error.name === 'TimeoutError') {
    return true;
  }

  // Rate limiting errors are usually retryable after a delay
  if (
    error.message.includes('rate limit') ||
    error.message.includes('429') ||
    error.message.includes('too many requests')
  ) {
    return true;
  }

  // Service unavailable errors
  if (error.message.includes('503') || error.message.includes('service unavailable')) {
    return true;
  }

  // Database connection errors
  if (
    error.message.includes('connection') &&
    (error.message.includes('timeout') || error.message.includes('refused'))
  ) {
    return true;
  }

  return false;
}

/**
 * Creates a default retry configuration based on the error type
 */
export function getDefaultRetryConfig(error?: Error): RetryConfig {
  // If we have a rate limit error, use a longer backoff
  if (error && (error.message.includes('rate limit') || error.message.includes('429'))) {
    return {
      maxAttempts: 5,
      initialDelay: 2000, // 2 seconds
      backoffFactor: 2,
    };
  }

  // Default retry config for general errors
  return {
    maxAttempts: 3,
    initialDelay: 500, // 500ms
    backoffFactor: 1.5,
  };
}
