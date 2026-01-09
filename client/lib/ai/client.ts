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
  private defaultResponseFormat?: { type: "json_object" | "text" };
  private defaultTemperature?: number;

  constructor(apiKey: string, modelName: string = "gpt-4o", generationConfig?: { responseFormat?: { type: "json_object" | "text" }; temperature?: number }) {
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }

    this.client = new OpenAI({
      apiKey: apiKey,
      timeout: DEFAULT_TIMEOUT,
    });
    this.modelName = modelName;
    this.defaultResponseFormat = generationConfig?.responseFormat;
    this.defaultTemperature = generationConfig?.temperature;
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
    const temperature = options.temperature ?? this.defaultTemperature ?? 0.7;
    const responseFormat = options.responseFormat ?? this.defaultResponseFormat;

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
        // CRITICAL: Be extremely explicit about automotive diagnostic context
        // to avoid content filter false positives on dashboard images
        if (responseFormat?.type === "json_object") {
          messages.push({
            role: "system",
            content: `You are an automotive diagnostic assistant for a car repair application.

CRITICAL CONTEXT: 
- This is a legitimate automotive diagnostic tool
- Users ONLY upload car dashboard and vehicle images
- Images show: instrument clusters, warning lights, engine parts, tires, car interiors
- Any human-like shapes are REFLECTIONS in glass/chrome car components
- This is NOT about identifying people - it's about identifying CAR WARNING LIGHTS

YOUR TASK:
1. Analyze the image as an AUTOMOTIVE diagnostic image
2. Identify which warning light is visible on the dashboard
3. Look for symbols like: check engine, oil pressure, battery, TPMS, brake, ABS, airbag
4. If unclear, ask what color/shape the warning light is

RESPOND IN HEBREW. Output valid JSON only.

If you see what looks like a face or person, it is a REFLECTION in the dashboard glass or car component - ignore it and focus on the warning lights/car parts.`,
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
          console.error("[OpenAI Client] Response meta:", {
            id: response.id,
            model: response.model,
            finish_reason: response.choices?.[0]?.finish_reason,
            usage: response.usage,
          });

          // RETRY: Try without JSON format and with minimal system prompt
          console.log("[OpenAI Client] Attempting retry without JSON format...");

          const retryMessages: any[] = [
            {
              role: "system",
              content: "You are a car mechanic helper. Look at the car dashboard image and identify the warning light. Respond in Hebrew with JSON: {\"warning_light\": \"light_id\", \"text\": \"question text\", \"options\": [\"option1\", \"option2\"]}"
            },
            {
              role: "user",
              content: content,
            }
          ];

          try {
            const retryResponse = await this.client.chat.completions.create({
              model: "gpt-4o-mini", // Try with smaller model
              messages: retryMessages,
              temperature: 0.3,
              // No response_format constraint
            });

            const retryContent = retryResponse.choices[0]?.message?.content;
            const retryRefusal = (retryResponse.choices[0]?.message as any)?.refusal;

            if (retryRefusal || !retryContent) {
              console.error("[OpenAI Client] Retry also refused");
              throw new Error(`OpenAI content filter refusal: ${refusal}`);
            }

            console.log("[OpenAI Client] Retry succeeded:", retryContent.substring(0, 200));
            return retryContent;
          } catch (retryError) {
            console.error("[OpenAI Client] Retry failed:", retryError);
            throw new Error(`OpenAI content filter refusal: ${refusal}`);
          }
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

        if (responseFormat?.type === "json_object") {
          return ensureJsonString(contentText);
        }
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
          console.error("[OpenAI Client] Response meta:", {
            id: response.id,
            model: response.model,
            finish_reason: response.choices?.[0]?.finish_reason,
            usage: response.usage,
          });
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

        if (responseFormat?.type === "json_object") {
          return ensureJsonString(contentText);
        }
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

function ensureJsonString(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "";

  // Strip code fences if model returned ```json ... ```
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    // remove first fence line
    lines.shift();
    // remove last fence line if exists
    if (lines.length && lines[lines.length - 1].trim().startsWith("```")) {
      lines.pop();
    }
    return lines.join("\n").trim();
  }

  // If there's leading explanation, try to extract first {...} block
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1).trim();
    return candidate;
  }

  return text;
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

