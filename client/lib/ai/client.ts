/**
 * Unified AI client (OpenAI ChatGPT)
 * Handles timeout, retry, and safe error mapping
 */

import OpenAI from "openai";
import { withRetry, withTimeout, type RetryOptions } from "./retry";
import { sanitizeInput } from "./sanitize";

export interface OpenAICallOptions {
  timeout?: number;
  retries?: RetryOptions;
  responseFormat?: { type: "json_object" | "text" };
  temperature?: number;
  images?: Array<{ inlineData: { mimeType: string; data: string } }>;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds (increased for multimodal calls with images)
const DEFAULT_RETRIES: RetryOptions = {
  maxRetries: 2,
  backoffMs: [1000, 2000],
};

/**
 * AI client wrapper (OpenAI ChatGPT)
 */
export class OpenAIClient {
  private client: OpenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = "gpt-4o", generationConfig?: { responseFormat?: { type: "json_object" | "text" }; temperature?: number }) {
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }

    this.client = new OpenAI({
      apiKey: apiKey,
      timeout: DEFAULT_TIMEOUT,
    });
    this.modelName = modelName;
  }

  /**
   * Generate content with retry and timeout
   * Supports both text-only and multimodal (text + images) calls
   */
  async generateContent(
    prompt: string,
    options: OpenAICallOptions = {}
  ): Promise<string> {
    const sanitizedPrompt = sanitizeInput(prompt);
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const retries = options.retries || DEFAULT_RETRIES;
    const images = options.images || [];
    const temperature = options.temperature ?? 0.7;
    const responseFormat = options.responseFormat;

    const callFn = async () => {
      // If we have images, use multimodal API (vision)
      if (images.length > 0) {
        // Build content array for multimodal
        const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
          { type: "text", text: sanitizedPrompt },
        ];

        // Add images
        for (const img of images) {
          content.push({
            type: "image_url",
            image_url: {
              url: `data:${img.inlineData.mimeType};base64,${img.inlineData.data}`,
            },
          });
        }

        const messages: any[] = [];
        
        // Add system message if response format is JSON
        // Explicitly state this is car diagnostic images only (no people)
        // Also emphasize combining text description with image analysis
        if (responseFormat?.type === "json_object") {
          messages.push({
            role: "system",
            content: "You are a car mechanic assistant. Analyze car dashboard warning lights and vehicle diagnostic images. Images show car warning lights, dashboard displays, or vehicle parts only - no people. This is a car diagnostic tool. CRITICAL: You must combine the user's text description (symptoms, vehicle behavior, when the problem occurs) with what you see in the image. Do not rely only on the image - use the text description to understand the full problem. Respond with valid JSON only.",
          });
        }
        
        messages.push({
          role: "user",
          content: content,
        });

        const response = await this.client.chat.completions.create({
          model: this.modelName,
          messages: messages,
          temperature,
          ...(responseFormat && { response_format: responseFormat }),
        });

        // Log full response for debugging
        const choice = response.choices[0];
        if (!choice) {
          console.error("[OpenAI Client] No choices in response:", JSON.stringify(response, null, 2));
          throw new Error("No choices in OpenAI response");
        }

        const finishReason = choice.finish_reason;
        const contentText = choice.message?.content;
        const refusal = (choice.message as any)?.refusal;

        // Check for refusal (content filter triggered)
        if (refusal) {
          console.error("[OpenAI Client] Content filter refusal:", refusal);
          console.error("[OpenAI Client] Full response:", JSON.stringify(response, null, 2));
          throw new Error(`OpenAI content filter refusal: ${refusal}`);
        }

        // Log finish reason for debugging
        if (finishReason !== "stop") {
          console.warn("[OpenAI Client] Unexpected finish_reason:", finishReason, "Response:", JSON.stringify(response, null, 2));
        }

        if (!contentText) {
          // Log more details about the empty response
          console.error("[OpenAI Client] Empty response details:", {
            finish_reason: finishReason,
            refusal: refusal,
            response_id: response.id,
            model: response.model,
            usage: response.usage,
            full_response: JSON.stringify(response, null, 2),
          });
          throw new Error(`Empty response from OpenAI (finish_reason: ${finishReason || "unknown"}, refusal: ${refusal || "none"})`);
        }
        
        // Log successful response for debugging
        console.log("[OpenAI Client] Response received (multimodal):", {
          length: contentText.length,
          preview: contentText.substring(0, 200),
          finish_reason: finishReason,
        });
        
        return contentText;
      } else {
        // Text-only call
        const messages: any[] = [];
        
        // Add system message if response format is JSON
        // Explicitly state this is car diagnostic context only
        if (responseFormat?.type === "json_object") {
          messages.push({
            role: "system",
            content: "You are a car mechanic assistant. You analyze car diagnostic information and vehicle problems only. Always respond with valid JSON only.",
          });
        }
        
        messages.push({
          role: "user",
          content: sanitizedPrompt,
        });

        const response = await this.client.chat.completions.create({
          model: this.modelName,
          messages: messages,
          temperature,
          ...(responseFormat && { response_format: responseFormat }),
        });

        // Log full response for debugging
        const choice = response.choices[0];
        if (!choice) {
          console.error("[OpenAI Client] No choices in response:", JSON.stringify(response, null, 2));
          throw new Error("No choices in OpenAI response");
        }

        const finishReason = choice.finish_reason;
        const contentText = choice.message?.content;
        const refusal = (choice.message as any)?.refusal;

        // Check for refusal (content filter triggered)
        if (refusal) {
          console.error("[OpenAI Client] Content filter refusal:", refusal);
          console.error("[OpenAI Client] Full response:", JSON.stringify(response, null, 2));
          throw new Error(`OpenAI content filter refusal: ${refusal}`);
        }

        // Log finish reason for debugging
        if (finishReason !== "stop") {
          console.warn("[OpenAI Client] Unexpected finish_reason:", finishReason, "Response:", JSON.stringify(response, null, 2));
        }

        if (!contentText) {
          // Log more details about the empty response
          console.error("[OpenAI Client] Empty response details:", {
            finish_reason: finishReason,
            refusal: refusal,
            response_id: response.id,
            model: response.model,
            usage: response.usage,
            full_response: JSON.stringify(response, null, 2),
          });
          throw new Error(`Empty response from OpenAI (finish_reason: ${finishReason || "unknown"}, refusal: ${refusal || "none"})`);
        }
        
        // Log successful response for debugging
        console.log("[OpenAI Client] Response received (text-only):", {
          length: contentText.length,
          preview: contentText.substring(0, 200),
          finish_reason: finishReason,
        });
        
        return contentText;
      }
    };

    // Apply timeout to each individual call, then retry logic
    const callWithTimeout = async () => {
      return withTimeout(callFn(), timeout);
    };

    // Apply retry logic (each retry will have its own timeout)
    return withRetry(callWithTimeout, retries);
  }
}

/**
 * Create an AI client instance
 */
export function createOpenAIClient(
  apiKey: string,
  modelName?: string,
  generationConfig?: { responseFormat?: { type: "json_object" | "text" }; temperature?: number }
): OpenAIClient {
  return new OpenAIClient(apiKey, modelName || "gpt-4o", generationConfig);
}

