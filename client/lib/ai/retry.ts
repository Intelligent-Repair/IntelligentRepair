/**
 * Retry logic with exponential backoff
 * Used for OpenAI API calls and other async operations
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

export class TimeoutError extends Error {
  timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

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
  // TimeoutError is always retryable
  if (error?.name === "TimeoutError") return true;

  // Timeout errors - these are retryable
  if (error?.message?.includes("timed out") || error?.message?.includes("timeout") || error?.message?.includes("Operation timed out")) {
    return true;
  }

  // Network errors
  if (error?.message?.includes("network") || error?.message?.includes("fetch") || error?.message?.includes("ECONNRESET") || error?.message?.includes("ETIMEDOUT")) {
    return true;
  }

  // HTTP status codes
  const status = error?.status || error?.response?.status || error?.cause?.status || error?.code;
  if (status && retryableStatuses.includes(status)) {
    return true;
  }

  // HTTP status codes in error messages
  if (error?.message?.includes("429") || error?.message?.includes("500") || error?.message?.includes("503") || error?.message?.includes("502") || error?.message?.includes("504")) {
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

      // Wait with exponential backoff (+ small jitter)
      const backoff = opts.backoffMs[attempt] || opts.backoffMs[opts.backoffMs.length - 1];
      const jitter = Math.floor(Math.random() * 125); // 0-124ms
      await sleep(backoff + jitter);

      console.warn(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${backoff + jitter}ms`);
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
  timeoutMs: number = 30000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

