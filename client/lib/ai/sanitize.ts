/**
 * Input sanitization utilities
 * Removes HTML, scripts, unsafe characters, and enforces length limits
 */

const MAX_INPUT_LENGTH = 5000;
const MAX_DESCRIPTION_LENGTH = 2000;

/**
 * Sanitize free-text input
 * - Removes HTML tags
 * - Removes script tags
 * - Removes unsafe Unicode characters
 * - Collapses whitespace
 * - Enforces length limits
 */
export function sanitizeInput(text: string, maxLength: number = MAX_INPUT_LENGTH): string {
  if (!text || typeof text !== "string") return "";

  let sanitized = text.trim();

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, "");

  // Remove script tags (more aggressive)
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove style tags
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Remove Unicode control characters (except newlines, tabs, and carriage returns)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  // Collapse duplicate spaces (but preserve newlines)
  sanitized = sanitized.replace(/[ \t]+/g, " ");

  // Sanitize Hebrew special punctuation (common problematic chars)
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, ""); // Zero-width spaces

  // Enforce length limit
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim();
  }

  return sanitized.trim();
}

/**
 * Sanitize description input (shorter limit)
 */
export function sanitizeDescription(text: string): string {
  return sanitizeInput(text, MAX_DESCRIPTION_LENGTH);
}

/**
 * Normalize vehicle fields
 */
export function normalizeVehicle(vehicle: {
  manufacturer?: string;
  model?: string;
  year?: number | null;
}): { manufacturer: string; model: string; year: number | null } {
  return {
    manufacturer: sanitizeInput(vehicle.manufacturer || "", 100),
    model: sanitizeInput(vehicle.model || "", 100),
    year: vehicle.year && typeof vehicle.year === "number" && vehicle.year > 1900 && vehicle.year < 2100
      ? vehicle.year
      : null,
  };
}

