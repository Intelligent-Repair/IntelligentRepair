/**
 * Unified Gemini client
 * Handles timeout, retry, and safe error mapping
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { withRetry, withTimeout, type RetryOptions } from "./retry";
import { sanitizeInput } from "./sanitize";

export interface GeminiCallOptions {
  timeout?: number;
  retries?: RetryOptions;
}

const DEFAULT_TIMEOUT = 12000; // 12 seconds
const DEFAULT_RETRIES: RetryOptions = {
  maxRetries: 3,
  backoffMs: [300, 800, 1500],
};

/**
 * Gemini client wrapper
 */
export class GeminiClient {
  private model: GenerativeModel;

  constructor(apiKey: string, modelName: string = "gemini-2.0-flash") {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required");
    }

    const ai = new GoogleGenerativeAI(apiKey);
    this.model = ai.getGenerativeModel({ model: modelName });
  }

  /**
   * Generate content with retry and timeout
   */
  async generateContent(
    prompt: string,
    options: GeminiCallOptions = {}
  ): Promise<string> {
    const sanitizedPrompt = sanitizeInput(prompt);
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const retries = options.retries || DEFAULT_RETRIES;

    const callFn = async () => {
      const result = await this.model.generateContent(sanitizedPrompt);
      return result.response.text();
    };

    // Apply retry logic
    const retriedCall = () => withRetry(callFn, retries);

    // Apply timeout
    return withTimeout(retriedCall(), timeout);
  }
}

/**
 * Create a Gemini client instance
 */
export function createGeminiClient(
  apiKey: string,
  modelName?: string
): GeminiClient {
  return new GeminiClient(apiKey, modelName);
}

/**
 * Safe Gemini call (backward compatibility)
 * @deprecated Use GeminiClient instead
 */
export async function safeGeminiCall(
  model: GenerativeModel,
  prompt: string,
  options: GeminiCallOptions = {}
): Promise<string> {
  const sanitizedPrompt = sanitizeInput(prompt);
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const retries = options.retries || DEFAULT_RETRIES;

  const callFn = async () => {
    const result = await model.generateContent(sanitizedPrompt);
    return result.response.text();
  };

  const retriedCall = () => withRetry(callFn, retries);
  return withTimeout(retriedCall(), timeout);
}

