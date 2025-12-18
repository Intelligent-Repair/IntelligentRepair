/**
 * Prompt builder for AI consultation flow
 * Simplified and optimized according to new chat structure
 * 
 * Key principles:
 * - No vehicle info sent to API (only for DB storage)
 * - Focus on general car problems, not model-specific
 * - Natural, friendly Hebrew prompts
 * - Safety warnings for dangerous situations
 * - Confidence-based early diagnosis (80% trigger)
 */

import type { UserAnswer } from "./types";
import { sanitizeInput } from "./sanitize";

const MAX_ANSWERS_LENGTH = 200; // Limit answer length to reduce tokens

/**
 * Build prompt for initial question or follow-up questions
 * This is the main prompt used throughout the chat flow
 */
export function buildChatPrompt(
  description: string,
  answers: UserAnswer[],
  hasImages: boolean,
  questionNumber: number = 0
): string {
  const sanitizedDescription = sanitizeInput(description, 1000);
  
  // Build answers context (limited length)
  const answersContext = answers.length > 0
    ? answers
        .map((a, i) => {
          const q = sanitizeInput(a.question || "", MAX_ANSWERS_LENGTH);
          const ans = sanitizeInput(a.answer || "", MAX_ANSWERS_LENGTH);
          return `שאלה ${i + 1}: ${q}\nתשובה: ${ans}`;
        })
        .join("\n\n")
    : "אין תשובות קודמות.";

  // Detect dangerous situations (red warning lights, explicit danger mentions)
  const isDangerous = hasImages && (
    sanitizedDescription.toLowerCase().includes('נורה אדומה') ||
    sanitizedDescription.toLowerCase().includes('אדום') ||
    sanitizedDescription.toLowerCase().includes('מסוכן') ||
    answers.some(a => a.answer?.toLowerCase().includes('אדום') || a.answer?.toLowerCase().includes('מסוכן'))
  );

  // Image analysis instructions
  const imageInstructions = hasImages ? `
קריטי: התמונה היא של נורת אזהרה בלוח המחוונים או חלק רכב בלבד. אין אנשים בתמונה.
זהה בדיוק איזו נורה מופיעה:
- נורת שמן (oil can עם טיפה) → שאל שאלות על מערכת השמן
- נורת לחץ אוויר (צמיג עם סימן קריאה) → שאל שאלות על צמיגים ולחץ אוויר
- נורת מנוע (check engine) → שאל שאלות על מערכת המנוע
- נורת בטרייה → שאל שאלות על מערכת החשמל
- נורה אחרת → תאר בדיוק מה אתה רואה ושאל שאלות רלוונטיות

השאלה חייבת להיות רלוונטית ישירות לנורה שאתה רואה בתמונה.` : "";

  // Safety warning section
  const safetyWarning = isDangerous ? `
⚠️ אזהרת בטיחות:
אם זיהית נורה אדומה או מצב מסוכן, תן אזהרה "חברית" למשתמש:
"נראה שיש כאן מצב שדורש תשומת לב. אני ממליץ לעצור את הרכב בצד בבטחה ולא להמשיך לנסוע עד שנבין מה הבעיה."
לאחר האזהרה, המשך לשאול שאלות מנחות לאבחון הבעיה.` : "";

  // Question guidance based on number
  const questionGuidance = questionNumber === 0
    ? "זו השאלה הראשונה. שאל שאלה מנחה הקשורה ישירות למידע שקיבלת (תיאור + תמונה אם יש)."
    : questionNumber >= 4
    ? "זו אחת השאלות האחרונות. התמקד בבעיה הסבירה ביותר לפי התשובות הקודמות."
    : "שאל שאלה מנחה שמתמקדת בבעיה הסבירה ביותר לפי התשובות הקודמות.";

  return `אתה מכונאי רכב מקצועי. עזור למשתמש לאבחן בעיות רכב בצורה פשוטה וברורה.

${imageInstructions}

תיאור הבעיה: "${sanitizedDescription}"

${answersContext !== "אין תשובות קודמות." ? `תשובות קודמות:\n${answersContext}` : ""}

${safetyWarning}

${questionGuidance}

הנחיות חשובות:
1. שאל שאלה אחת בלבד בעברית, פשוטה וברורה
2. החזר 3-5 אפשרויות בחירה (לא פחות מ-3, לא יותר מ-5)
3. השאלה חייבת להיות רלוונטית ישירות לנורה/בעיה שזיהית
4. אם יש תמונה - השאלה חייבת להתאים בדיוק לנורה שאתה רואה
5. אם זיהית נורת שמן - שאל על שמן. אם זיהית נורת לחץ אוויר - שאל על צמיגים
6. נהל את הביטחון שלך: אם אתה בטוח ב-80% או יותר שהזיהית את הבעיה, החזר אבחון במקום שאלה

${hasImages ? `תמונה: נורת אזהרה בלוח המחוונים. זהה איזו נורה זה ושאל שאלה רלוונטית.` : ""}

החזר JSON בלבד:
{
  "type": "question",
  "question": "שאלה אחת בעברית פשוטה",
  "options": ["אופציה 1", "אופציה 2", "אופציה 3", "אופציה 4"],
  "confidence": 0.7${isDangerous ? `,
  "safety_warning": "נראה שיש כאן מצב שדורש תשומת לב. אני ממליץ לעצור את הרכב בצד בבטחה ולא להמשיך לנסוע עד שנבין מה הבעיה."` : ""}
}`;
}

/**
 * Build prompt for final diagnosis
 * Called when confidence >= 80% or after 5 questions
 */
export function buildDiagnosisPrompt(
  description: string,
  answers: UserAnswer[],
  hasImages: boolean
): string {
  const sanitizedDescription = sanitizeInput(description, 1000);
  
  const answersContext = answers.length > 0
    ? answers
        .map((a, i) => {
          const q = sanitizeInput(a.question || "", MAX_ANSWERS_LENGTH);
          const ans = sanitizeInput(a.answer || "", MAX_ANSWERS_LENGTH);
          return `שאלה ${i + 1}: ${q}\nתשובה: ${ans}`;
        })
        .join("\n\n")
    : "אין תשובות קודמות.";

  const imageInstructions = hasImages ? `
קריטי: התמונה היא של נורת אזהרה בלוח המחוונים או חלק רכב בלבד. אין אנשים בתמונה.
האבחון חייב להיות רלוונטי בדיוק לנורה שאתה רואה בתמונה.
אם זו נורת לחץ אוויר - אבחן בעיות צמיגים/לחץ אוויר בלבד.
אם זו נורת שמן - אבחן בעיות שמן/מנוע בלבד.` : "";

  return `אתה מכונאי רכב מקצועי. עבוד בעברית, משפטים קצרים ופשוטים.

החזר רק JSON תקף. אין טקסט מחוץ ל-JSON.

${imageInstructions}

תיאור הבעיה: "${sanitizedDescription}"

${answersContext !== "אין תשובות קודמות." ? `תשובות קודמות:\n${answersContext}` : ""}

${hasImages ? `תמונה: נורת אזהרה בלוח המחוונים. האבחון חייב להתבסס על הנורה הזו.` : ""}

הנחיות לאבחון:
1. החזר עד 3 תקלות אפשריות, מדורגות לפי הסתברות (הגבוהה ביותר ראשונה)
2. לכל תקלה: "probability" מספרי (0-1). ההסתברויות לא חייבות לסכם ל-100
3. עברית בלבד, משפטים קצרים, ללא ז'רגון מקצועי
4. אל תשתמש בקודי תקלה, שמות חיישנים, OBD, ECU, PCM, CAN
5. הסבר במילים פשוטות לנהג רגיל שלא מבין ברכבים
6. מעל כל תקלה, תן הסבר קצר (2-3 משפטים) למה אתה חושב שזו הבעיה ואיך הגעת לאבחנה הזו - הסבר "קליל וחברי"

self_checks (רק לתקלה הראשונה - הסבירה ביותר):
- 3-5 בדיקות פשוטות ובטוחות שהמשתמש יכול לבצע לבד
- רק דברים שהמשתמש יכול לעשות באופן עצמאי (מילוי אוויר, מילוי שמן, מילוי מיכל קירור, פתיחת מכסה מנוע ובדיקה ויזואלית)
- לא דברים שדורשים איש מקצוע

do_not (רק לתקלה הראשונה):
- 2-4 אזהרות קצרות מתי לא להמשיך או מה לא לעשות

החזר רק JSON תקף. אין טקסט מחוץ ל-JSON.

פורמט JSON בלבד:
{
  "type": "diagnosis",
  "summary": "תקציר קצר בעברית פשוטה - למה אתה חושב שזו הבעיה ואיך הגעת לאבחנה",
  "results": [
    {
      "issue": "בעיה 1 בשפה פשוטה",
      "probability": 0.85,
      "explanation": "הסבר קצר (2-3 משפטים) למה זו הבעיה ואיך הגעת לאבחנה - קליל וחברי",
      "self_checks": ["בדיקה פשוטה 1", "בדיקה פשוטה 2", "בדיקה פשוטה 3"],
      "do_not": ["אזהרה קצרה 1", "אזהרה קצרה 2"]
    },
    {
      "issue": "בעיה 2 בשפה פשוטה",
      "probability": 0.10,
      "explanation": "הסבר קצר למה זו אפשרות נוספת"
    },
    {
      "issue": "בעיה 3 בשפה פשוטה",
      "probability": 0.05,
      "explanation": "הסבר קצר למה זו אפשרות נוספת"
    }
  ],
  "confidence": 0.85
}

החזר JSON בלבד.`;

}

/**
 * Build research prompt (optional - for initial analysis)
 * NOTE: According to new spec, vehicle info should NOT be sent to API
 * This is kept for backward compatibility but vehicle info is ignored
 */
export function buildResearchPrompt(
  description: string
): string {
  const sanitizedDescription = sanitizeInput(description, 1000);

  return `אתה מומחה רכב. עזור לאבחן בעיות רכב כלליות (לא ספציפיות לדגם).

תיאור הבעיה: "${sanitizedDescription}"

בצע מחקר מקצועי על תקלות רכב כלליות:
- בעיות נפוצות הקשורות לתיאור הזה
- סיבות אפשריות לתקלה
- גורמים שמבדילים בין סיבות שונות

החזר JSON בלבד:
{
  "top_causes": ["סיבה 1", "סיבה 2", "סיבה 3"],
  "differentiating_factors": ["גורם 1", "גורם 2"],
  "reasoning": "הסבר קצר"
}`;
}
