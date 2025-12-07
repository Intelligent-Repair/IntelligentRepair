/**
 * Prompt builder for AI consultation flow
 * Assembles all prompts cleanly and consistently
 */

import type { ResearchData, UserAnswer, VehicleInfo } from "./types";
import { sanitizeInput } from "./sanitize";

/**
 * Build research prompt for initial vehicle analysis
 */
export function buildResearchPrompt(
  vehicle: VehicleInfo,
  description: string
): string {
  const sanitizedManufacturer = sanitizeInput(vehicle.manufacturer);
  const sanitizedModel = sanitizeInput(vehicle.model);
  const sanitizedDescription = sanitizeInput(description);
  const yearStr = vehicle.year ? ` (${vehicle.year})` : "";

  return `
אתה מומחה רכב.
רכב: ${sanitizedManufacturer} ${sanitizedModel}${yearStr}
נתוני תקלה:
"${sanitizedDescription}"

בצע מחקר מקצועי:
- בעיות נפוצות בדגם
- TSBs
- סימפטומים
- סיבות מובילות
- גורמים שמבדילים בין הסיבות

החזר JSON בלבד:
{
 "top_causes":[ "..."],
 "differentiating_factors":[ "..."],
 "reasoning":"..."
}`;
}

/**
 * Build adaptive follow-up prompt for questions
 */
export function buildAdaptivePrompt(
  vehicle: VehicleInfo,
  description: string,
  researchData: ResearchData,
  answers: UserAnswer[]
): string {
  const sanitizedManufacturer = sanitizeInput(vehicle.manufacturer);
  const sanitizedModel = sanitizeInput(vehicle.model);
  const sanitizedDescription = sanitizeInput(description);
  const yearStr = vehicle.year ? ` (${vehicle.year})` : "";

  // Build answers context
  const answersContext = answers.length > 0
    ? answers
        .map((a, i) => {
          const sanitizedQ = sanitizeInput(a.question);
          const sanitizedA = sanitizeInput(a.answer);
          return `שאלה ${i + 1}: ${sanitizedQ}\nתשובה: ${sanitizedA}`;
        })
        .join("\n\n")
    : "אין תשובות קודמות.";

  return `
אתה מבצע אבחון רכב.

רכב: ${sanitizedManufacturer} ${sanitizedModel}${yearStr}

מחקר מקצועי:
${JSON.stringify(researchData, null, 2)}

תיאור התקלה:
"${sanitizedDescription}"

תשובות קודמות:
${answersContext}

מטרה:
- אם יש מספיק מידע → החזר אבחון סופי should_finish=true
- אם אין מספיק מידע → צור שאלה חדשה

בחירת סוג השאלה:
אתה יכול ליצור:
- שאלת כן/לא (2 אפשרויות): ["כן", "לא"] - כאשר ההבחנה היא בינארית
- שאלה רב-ברירה (3-5 אפשרויות) - כאשר נדרש ניואנס או הבחנה עדינה יותר

בחר את הפורמט שמספק את הצעד האבחוני המשמעותי ביותר.
אם ההבחנה דורשת ניואנס, השתמש ב-3-5 אפשרויות רב-ברירה.
אם ההבחנה היא בינארית, השתמש בשאלת כן/לא.

השאלה חייבת להיות קצרה, בעברית, ללא שם רכב / דגם.

החזר JSON בלבד:
{
 "should_finish": boolean,
 "confidence": number,
 "question": "שאלה בעברית" | null,
 "type": "yesno" | "multi",
 "options": ["כן", "לא"] | ["אפשרות 1", "אפשרות 2", "אפשרות 3", ...],
 "shouldStop": boolean,
 "final_diagnosis": {
    "diagnosis":[ "..."],
    "self_checks":[ "..."],
    "warnings":[ "..."],
    "disclaimer":"...",
    "safety_notice": "..." | null,
    "recommendations": ["..."] | null
 } | null
}`;
}

/**
 * Build final diagnosis prompt (if needed separately)
 */
export function buildFinalDiagnosisPrompt(
  vehicle: VehicleInfo,
  description: string,
  researchData: ResearchData,
  answers: UserAnswer[]
): string {
  const sanitizedManufacturer = sanitizeInput(vehicle.manufacturer);
  const sanitizedModel = sanitizeInput(vehicle.model);
  const sanitizedDescription = sanitizeInput(description);
  const yearStr = vehicle.year ? ` (${vehicle.year})` : "";

  const answersContext = answers
    .map((a, i) => {
      const sanitizedQ = sanitizeInput(a.question);
      const sanitizedA = sanitizeInput(a.answer);
      return `שאלה ${i + 1}: ${sanitizedQ}\nתשובה: ${sanitizedA}`;
    })
    .join("\n\n");

  return `
אתה מבצע אבחון סופי לרכב.

רכב: ${sanitizedManufacturer} ${sanitizedModel}${yearStr}

מחקר מקצועי:
${JSON.stringify(researchData, null, 2)}

תיאור התקלה:
"${sanitizedDescription}"

תשובות המשתמש:
${answersContext}

החזר אבחון סופי מפורט ב-JSON:
{
 "diagnosis": ["אבחון 1", "אבחון 2", ...],
 "self_checks": ["בדיקה 1", "בדיקה 2", ...],
 "warnings": ["אזהרה 1", "אזהרה 2", ...],
 "disclaimer": "אבחון זה אינו תחליף לבדיקה מקצועית.",
 "safety_notice": "הודעה בטיחותית אם נדרש" | null,
 "recommendations": ["המלצה 1", "המלצה 2", ...] | null
}`;
}

