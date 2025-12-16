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
 * Build follow-up question prompt (multimodal-aware)
 */
export function buildQuestionPrompt(
  vehicle: VehicleInfo,
  description: string,
  researchData: ResearchData,
  answers: UserAnswer[],
  hasImages: boolean
): string {
  const sanitizedManufacturer = sanitizeInput(vehicle.manufacturer);
  const sanitizedModel = sanitizeInput(vehicle.model);
  const sanitizedDescription = sanitizeInput(description);
  const yearStr = vehicle.year ? ` (${vehicle.year})` : "";
  const imageFact = hasImages
    ? "בתמונה מופיעה נורת אזהרה בלוח המחוונים; זהו נתון קבוע שאינו פתוח לפרשנות."
    : "";

  const answersContext =
    answers.length > 0
      ? answers
          .map((a, i) => {
            const q = sanitizeInput(a.question);
            const ans = sanitizeInput(a.answer);
            return `שאלה ${i + 1}: ${q}\nתשובה: ${ans}`;
          })
          .join("\n\n")
      : "אין תשובות קודמות.";

  return `אתה מכונאי רכב רגוע ומנוסה. עבוד בעברית בלבד, משפטים קצרים.
רכב: ${sanitizedManufacturer} ${sanitizedModel}${yearStr}
תיאור תקלה:
"${sanitizedDescription}"

מחקר:
${JSON.stringify(researchData, null, 2)}

תשובות קודמות:
${answersContext}

${hasImages ? `עובדה מהתמונה (מחייבת): ${imageFact}` : "אין תמונות מצורפות."}

הנחיות חובה:
- נתח קודם את ${hasImages ? "התמונה המחייבת ואז ה" : ""}תיאור לפני ניסוח השאלה.
- אסור לשאול איזו נורה דולקת או מה צבעה; ההתייחסות לתמונה היא עובדה בסיסית שאינה ניתנת לערעור.
- אל תשאל על פרטים שנראים בתמונה; השתמש במידע הוויזואלי כנתון מוצק.
- אסור לשאול שאלות כן/לא.
- השאלה חייבת להיות רב-ברירה בלבד עם 3–5 אפשרויות בלעדיות ומשמעותיות.
- השתמש בתשובות הקודמות כדי לחדד את השאלה הבאה ולמנוע חזרתיות.
- טון: מכונאי מנוסה, רגוע, ברור.

פורמט JSON בלבד:
{
  "type": "question",
  "question": "שאלה קצרה וברורה",
  "options": ["אופציה 1", "אופציה 2", "אופציה 3"],
  "confidence": 0.xx
}`;
}

/**
 * Build diagnosis-only prompt
 */
export function buildDiagnosisPrompt(
  vehicle: VehicleInfo,
  description: string,
  researchData: ResearchData,
  answers: UserAnswer[],
  hasImages: boolean
): string {
  const sanitizedManufacturer = sanitizeInput(vehicle.manufacturer);
  const sanitizedModel = sanitizeInput(vehicle.model);
  const sanitizedDescription = sanitizeInput(description);
  const yearStr = vehicle.year ? ` (${vehicle.year})` : "";
  const imageFact = hasImages
    ? "בתמונה מופיעה נורת אזהרה בלוח המחוונים; זהו נתון קבוע שאינו פתוח לפרשנות."
    : "";

  const answersContext =
    answers.length > 0
      ? answers
          .map((a, i) => {
            const q = sanitizeInput(a.question);
            const ans = sanitizeInput(a.answer);
            return `שאלה ${i + 1}: ${q}\nתשובה: ${ans}`;
          })
          .join("\n\n")
      : "אין תשובות קודמות.";

  return `אתה מכונאי רכב רגוע ומנוסה. עבוד בעברית בלבד, משפטים קצרים.
אין לשאול שאלות. החזר רק אבחון סופי מובנה.

רכב: ${sanitizedManufacturer} ${sanitizedModel}${yearStr}
תיאור תקלה:
"${sanitizedDescription}"

מחקר:
${JSON.stringify(researchData, null, 2)}

תשובות קודמות:
${answersContext}

${hasImages ? `עובדה מהתמונה (מחייבת): ${imageFact}` : "אין תמונות מצורפות."}

הנחיות חובה לאבחון סופי:
- החזר עד 3 תקלות אפשריות בלבד (לא יותר מ-3), מדורגות לפי הסתברות מהגבוה לנמוך.
- לכל תקלה חייב להיות שדה "probability" מספרי. ההסתברויות חייבות לסכם ל-100 ולהיות בסדר יורד.
- השתמש בעברית בלבד, משפטים קצרים, ללא ז'רגון מקצועי.
- אל תשתמש בקודי תקלה, מספרי שגיאה, שמות חיישנים, מונחים מקצועיים של מוסכים או קיצורים כמו OBD.
- הסבר את התקלה במילים פשוטות שמתאימות לנהג רגיל ללא ידע ברכב.
- אל תזכיר לעולם: OBD, חיישנים ספציפיים, ECU, PCM, CAN, קודי P0xxx או דומים.

הנחיות מיוחדות ל-self_checks ול-do_not:
- רק לתקלה הסבירה ביותר (הראשונה ברשימה) מותר לכלול:
  - "self_checks": מערך של 3–5 בדיקות פשוטות ובטוחות שנהג רגיל יכול לבצע לבד.
    (לדוגמה בלבד, לא להעתיק: "בדוק את מפלס השמן במדיד לפי הוראות הרכב")
  - "do_not": מערך של 2–4 אזהרות קצרות מה לא לעשות.
    (לדוגמה בלבד, לא להעתיק: "אל תמשיך לנהוג אם הנורה האדומה ממשיכה להבהב")
- עבור כל שאר התקלות (השנייה והשלישית אם קיימות) אסור להחזיר שדות "self_checks" או "do_not" בכלל.
- אם אין בדיקות בטוחות שאפשר להמליץ עליהן, החזר עבור התקלה הראשונה:
  "self_checks": [] ו-"do_not": [] (מבלי להשמיט את השדות).

שפה וסגנון:
- כל ההסברים חייבים להיות בעברית, במשפטים קצרים וברורים.
- נא להשתמש במונחים פשוטים של נהגים, לא של מכונאים.
- אין להשתמש בקודי תקלות, שמות חיישנים, ראשי תיבות טכניים או מושגים של מערכות ניהול מנוע.

פורמט JSON בלבד, ללא טקסט מחוץ ל-JSON:
{
  "type": "diagnosis",
  "summary": "תקציר קצר בעברית פשוטה",
  "results": [
    {
      "issue": "בעיה 1 בשפה פשוטה",
      "probability": 0,
      "self_checks": ["בדיקה פשוטה 1", "בדיקה פשוטה 2", "בדיקה פשוטה 3"],
      "do_not": ["אזהרה קצרה 1", "אזהרה קצרה 2"]
    },
    {
      "issue": "בעיה 2 בשפה פשוטה",
      "probability": 0
    },
    {
      "issue": "בעיה 3 בשפה פשוטה",
      "probability": 0
    }
  ],
  "confidence": 0
}`;
}

