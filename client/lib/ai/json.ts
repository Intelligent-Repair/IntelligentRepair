/**
 * Safe JSON extraction utilities
 * Handles markdown fences, embedded JSON, validation, and fallbacks
 */

/**
 * Strip markdown code fences from text
 */
function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/gm, "")
    .replace(/```\s*$/gm, "")
    .trim();
}

/**
 * Auto-detect and extract embedded JSON from text
 */
function extractEmbeddedJSON(text: string): string | null {
  let cleaned = text.trim();

  // Try direct parse first
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // Continue to extraction
  }

  // Find JSON object boundaries
  let start = cleaned.indexOf("{");
  let end = cleaned.lastIndexOf("}");

  // If no object, try array
  if (start === -1) {
    start = cleaned.indexOf("[");
    end = cleaned.lastIndexOf("]");
  }

  if (start === -1 || end === -1 || start >= end) {
    return null;
  }

  return cleaned.substring(start, end + 1);
}

/**
 * Attempt to fix common JSON issues
 */
function fixJSON(jsonStr: string): string {
  return jsonStr
    .replace(/,\s*([}\]])/g, "$1") // Remove trailing commas
    .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":') // Quote unquoted keys
    .replace(/:\s*([^",\[\]{}]+)([,}\]])/g, ': "$1"$2'); // Quote unquoted string values
}

/**
 * Validate that object has required keys
 */
export function validateKeys<T extends Record<string, any>>(
  obj: any,
  requiredKeys: (keyof T)[]
): obj is T {
  if (!obj || typeof obj !== "object") return false;
  return requiredKeys.every((key) => key in obj);
}

/**
 * Extract JSON from text with fallback
 * - Strips markdown fences
 * - Auto-detects embedded JSON
 * - Attempts to fix common issues
 * - Returns null if extraction fails
 */
export function extractJSON(text: string): any | null {
  try {
    if (!text || typeof text !== "string") return null;

    let cleaned = stripFences(text);

    // Try direct parse
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Continue to extraction
    }

    // Extract embedded JSON
    const jsonStr = extractEmbeddedJSON(cleaned);
    if (!jsonStr) return null;

    // Try parsing extracted JSON
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Try fixing common issues
      try {
        const fixed = fixJSON(jsonStr);
        return JSON.parse(fixed);
      } catch {
        return null;
      }
    }
  } catch (err) {
    console.error("JSON extraction error:", err);
    return null;
  }

  return null;
}

/**
 * Extract JSON with fallback value
 * If extraction fails, returns the provided fallback
 */
export function extractJSONWithFallback<T>(text: string, fallback: T): T {
  const extracted = extractJSON(text);
  if (extracted && typeof extracted === "object") {
    return extracted as T;
  }

  console.warn("JSON extraction failed, using fallback");
  return fallback;
}

