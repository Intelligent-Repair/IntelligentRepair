/**
 * Simple JSON extraction utility
 * Removes markdown code blocks and extracts JSON from text
 */
export function extractJSON(text: string): any | null {
  if (!text || typeof text !== "string") return null;

  let cleaned = text.trim().replace(/^```(?:json)?/gm, "").replace(/```$/gm, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }

  return null;
}
