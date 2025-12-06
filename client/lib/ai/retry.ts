/**
 * Retry logic with exponential backoff
 * Used for Gemini API calls and other async operations
 */

export interface RetryOptions {
  maxRetries?: number;
  backoffMs?: number[];
  retryableStatuses?: number[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  backoffMs: [300, 800, 1500],
  retryableStatuses: [429, 500, 503],
};

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any, retryableStatuses: number[]): boolean {
  // Network errors
  if (error?.message?.includes("network") || error?.message?.includes("fetch")) {
    return true;
  }

  // HTTP status codes
  const status = error?.status || error?.response?.status || error?.code;
  if (status && retryableStatuses.includes(status)) {
    return true;
  }

  // Google AI SDK specific errors
  if (error?.message?.includes("429") || error?.message?.includes("500") || error?.message?.includes("503")) {
    return true;
  }

  return false;
}

/**
 * Generic retry function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param options - Retry configuration
 * @returns Promise that resolves with the function result
 * @throws Last error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt >= opts.maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(error, opts.retryableStatuses)) {
        throw error; // Non-retryable error, throw immediately
      }

      // Wait with exponential backoff
      const backoff = opts.backoffMs[attempt] || opts.backoffMs[opts.backoffMs.length - 1];
      await sleep(backoff);

      console.log(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${backoff}ms`);
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Timeout wrapper for promises
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 12000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

