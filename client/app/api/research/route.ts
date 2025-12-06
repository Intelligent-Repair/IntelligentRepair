import { NextResponse } from "next/server";
import { createGeminiClient } from "@/lib/ai/client";

const API_TIMEOUT_MS = 12000; // 12 seconds

interface VehicleInfo {
  manufacturer: string;
  model: string;
  year: number | null;
}

interface ResearchRequest {
  description: string;
  vehicle: VehicleInfo;
}

interface ResearchResponse {
  top_causes: string[];
  differentiating_factors: string[];
  summary: string;
  raw: string;
}

/**
 * Reusable saferJSON function
 * Extracts JSON from text, handling markdown code fences and malformed JSON
 * Returns null if extraction fails
 */
function saferJSON(text: string): any | null {
  if (!text || typeof text !== "string") {
    return null;
  }

  // Step 1: Remove markdown code fences
  let cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/gm, "")
    .replace(/```\s*$/gm, "")
    .trim();

  // Step 2: Try direct JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // Continue to extraction
  }

  // Step 3: Extract JSON object from text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  // Step 4: Try parsing extracted JSON
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    // Step 5: Try to fix common JSON issues
    try {
      const fixed = jsonMatch[0]
        .replace(/,\s*([}\]])/g, "$1") // Remove trailing commas
        .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":') // Quote unquoted keys
        .replace(/:\s*([^",\[\]{}]+)([,}\]])/g, ': "$1"$2'); // Quote unquoted string values
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

/**
 * Timeout wrapper to prevent hanging
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Build research prompt for initial vehicle analysis
 */
function buildResearchPrompt(vehicle: VehicleInfo, description: string): string {
  const yearStr = vehicle.year ? ` (${vehicle.year})` : "";
  return `You are a vehicle expert.
Vehicle: ${vehicle.manufacturer} ${vehicle.model}${yearStr}
Problem description:
"${description}"

Perform professional research:
- Common issues for this model
- TSBs (Technical Service Bulletins)
- Symptoms
- Leading causes
- Factors that differentiate between causes

Return JSON only:
{
  "top_causes": ["..."],
  "differentiating_factors": ["..."],
  "summary": "..."
}`;
}

/**
 * Create fallback research response
 */
function createFallbackResearch(rawText: string = ""): ResearchResponse {
  return {
    top_causes: [],
    differentiating_factors: [],
    summary: "Initial analysis completed. Unable to generate detailed research at this time.",
    raw: rawText,
  };
}

/**
 * POST handler for research endpoint
 * Performs initial research based on description and vehicle info
 */
export async function POST(req: Request) {
  try {
    // Parse request body with timeout protection
    const body: ResearchRequest = await withTimeout(req.json(), 5000).catch(() => {
      throw new Error("Failed to parse request body");
    });

    const { description, vehicle } = body;

    // Validate input
    if (!description || typeof description !== "string" || !description.trim()) {
      console.warn("Invalid description provided");
      return NextResponse.json(createFallbackResearch(""), { status: 400 });
    }

    if (!vehicle || !vehicle.manufacturer || !vehicle.model) {
      console.warn("Invalid vehicle data provided");
      return NextResponse.json(createFallbackResearch(""), { status: 400 });
    }

    // Validate API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY");
      return NextResponse.json(createFallbackResearch(""), { status: 500 });
    }

    // Create Gemini client with specified model
    const client = createGeminiClient(apiKey, "gemini-2.0-flash");

    // Build prompt
    const prompt = buildResearchPrompt(vehicle, description);

    // Generate content with 12 second timeout
    let rawResponse: string;
    try {
      rawResponse = await withTimeout(
        client.generateContent(prompt, {
          timeout: API_TIMEOUT_MS,
        }),
        API_TIMEOUT_MS
      );
    } catch (error: any) {
      console.error("Gemini API call failed:", error);
      // Return fallback instead of failing
      return NextResponse.json(createFallbackResearch(error?.message || "API call failed"));
    }

    // Extract JSON from response
    const extracted = saferJSON(rawResponse);

    // Validate and build response
    if (!extracted || typeof extracted !== "object") {
      console.warn("JSON extraction failed, using fallback");
      return NextResponse.json(createFallbackResearch(rawResponse));
    }

    // Ensure all required fields exist with correct types
    const researchResponse: ResearchResponse = {
      top_causes: Array.isArray(extracted.top_causes)
        ? extracted.top_causes.filter((item: any) => typeof item === "string")
        : [],
      differentiating_factors: Array.isArray(extracted.differentiating_factors)
        ? extracted.differentiating_factors.filter((item: any) => typeof item === "string")
        : [],
      summary:
        typeof extracted.summary === "string"
          ? extracted.summary
          : "Initial analysis completed.",
      raw: rawResponse,
    };

    return NextResponse.json(researchResponse);
  } catch (error: any) {
    console.error("Research route error:", error);

    // ALWAYS return a valid response - never hang
    const fallback = createFallbackResearch(error?.message || "Unknown error occurred");
    return NextResponse.json(fallback, { status: 500 });
  }
}

