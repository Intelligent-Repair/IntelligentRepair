/**
 * Prompt builder for AI consultation flow
 * Simplified and optimized according to new chat structure
 * 
 * Key principles:
 * - No vehicle info sent to API (only for DB storage)
 * - Focus on general car problems, not model-specific
 * - Natural, friendly Hebrew prompts
 * - Safety warnings for dangerous situations
 * - Confidence-based early diagnosis (90% trigger)
 */

import type { UserAnswer } from "./types";
import { sanitizeInput } from "./sanitize";

const MAX_ANSWERS_LENGTH = 200; // Limit answer length to reduce tokens

// מילות מפתח לנורות אדומות קריטיות (שמן, מנוע, בלם, חום מנוע, מצבר, כרית אוויר) – סימן לסכנת נסיעה מיידית
export const DANGER_KEYWORDS = [
  "נורת שמן אדומה",
  "נורה אדומה של שמן",
  "נורת שמן",
  "שמן מנוע",
  "לחץ שמן",
  "נורת מנוע אדומה",
  "נורה אדומה של מנוע",
  "נורת מנוע אדומה במרכז הלוח",
  "נורת בלם אדומה",
  "נורת בלימה אדומה",
  "נורת בלמים אדומה",
  "בלם יד דולק בזמן נסיעה",
  "נורת טמפרטורת מנוע",
  "טמפרטורת מנוע גבוהה",
  "חום מנוע גבוה",
  "נורת מצבר אדומה",
  "נורת טעינת מצבר אדומה",
  "נורת כרית אוויר אדומה",
  "נורת airbag אדומה",
];

// מילות מפתח לנורות כתומות (אזהרה – אפשר לנסוע בזהירות אבל חשוב לטפל בהקדם)
export const CAUTION_KEYWORDS = [
  "נורת מנוע כתומה",
  "נורת מנוע",
  "check engine",
  "צ'ק אנג'ין",
  "צ'ק אינג'ין",
  "abs",
  "נורת abs",
  "נורת abs כתומה",
  "בקרת יציבות",
  "בקרת אחיזה",
  "traction control",
  "נורת החלקה",
  "נורת לחץ אוויר",
  "לחץ אוויר בצמיגים",
  "צמיג עם לחץ נמוך",
];

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

  // Detect immediate danger / caution situations לפי תיאור הבעיה והתשובות
  const lowerDesc = sanitizedDescription.toLowerCase();
  const answersText = answers
    .map((a) => `${a.question} ${a.answer}` || "")
    .join(" ")
    .toLowerCase();
  const combined = `${lowerDesc} ${answersText}`;

  const isDanger = DANGER_KEYWORDS.some((kw) => combined.includes(kw));
  const isCaution = !isDanger && CAUTION_KEYWORDS.some((kw) => combined.includes(kw));

  // Image analysis instructions - קיצור משמעותי להפחתת טוקנים
  const imageInstructions = hasImages ? `
תמונה: נורת אזהרה בלוח המחוונים. זהה את הנורה ושלב עם התיאור המילולי.
זהה: שמן/לחץ אוויר/מנוע/בטרייה/אחרת. שאל שאלות רלוונטיות לנורה + התיאור המילולי.` : "";

  // Safety / caution warning section – רק בשאלה הראשונה
  let safetyWarning = "";
  if (questionNumber === 0) {
    if (isDanger) {
      safetyWarning = `
⚠️ אזהרת בטיחות – נורת אזהרה אדומה (סכנת נסיעה מיידית):
אם זיהית נורת שמן אדומה, נורת מנוע אדומה, נורת בלם אדומה, נורת בלימה אדומה, נורת בלמים אדומה, בלם יד דולק בזמן נסיעה, נורת טמפרטורת מנוע, נורת מצבר אדומה או נורת כרית אוויר אדומה – מדובר בסכנת נסיעה מיידית.
התחל את התשובה במשפט בסגנון:
"נראה שנדלקה נורת אזהרה אדומה שמעידה על סכנה מיידית למנוע או למערכת הבלימה. אני ממליץ לעצור את הרכב בצד בבטחה ולא להמשיך בנסיעה עד שתבוצע בדיקה במוסך."
לאחר האזהרה, המשך לשאול שאלה מנחה על התסמינים כדי לדייק את האבחנה.`;
    } else if (isCaution) {
      safetyWarning = `
⚠️ אזהרת בטיחות – נורת אזהרה כתומה:
אם זו נורת Check Engine, נורת ABS, נורת בקרת יציבות/אחיזה או נורת לחץ אוויר בצמיגים – הדגש שמדובר בתקלה שצריך לטפל בה בהקדם, אבל בדרך כלל ניתן להמשיך בנסיעה בזהירות.
התחל את התשובה במשפט בסגנון:
"נראה שנדלקה נורת אזהרה במערכת הרכב (למשל מנוע, ABS, בקרת יציבות או לחץ אוויר בצמיגים). מומלץ להמשיך בנסיעה בזהירות, להימנע מנהיגה מהירה או אגרסיבית, ולפנות למוסך לבדיקה בהקדם."`;
    }
  }

  // Question guidance based on number - יותר ספציפי ומכוון
  let questionGuidance = "";
  if (questionNumber === 0) {
    questionGuidance = "זו השאלה הראשונה. אם יש תמונה, תאר בקצרה מה אתה רואה (לדוגמה: 'נראה שזו נורת מחסור בלחץ אוויר בצמיגים'), ואז שאל שאלה מנחה פשוטה שמכוונת לזיהוי הבעיה הספציפית.";
  } else if (questionNumber === 1) {
    questionGuidance = "זו השאלה השנייה. אל תחזור על תיאור התמונה. שאל שאלה ספציפית שמכוונת לזיהוי הבעיה: אם זו נורת שמן - שאל על מפלס השמן הנוכחי (לא מתי בדקת לאחרונה, אלא מה המפלס עכשיו), רעשים מהמנוע, או סימני נזילה. אם זו נורת לחץ אוויר - שאל על משיכה לצד, רעידות, או מתי הבחנת בבעיה. אם זו נורת מנוע - שאל על כוח המנוע, רעשים, או ריחות חריגים.";
  } else if (questionNumber === 2) {
    questionGuidance = "זו השאלה השלישית. התמקד בתסמינים ספציפיים: מתי הבעיה מתרחשת (בהתנעה, בנסיעה, אחרי עצירה), איך הרכב מתנהג (מושך לצד, רעידות, אובדן כוח), או מה הנהג מרגיש (רעשים, ריחות, שינויים בהגה/בלמים). שאל שאלה שמכוונת לזיהוי הגורם המדויק.";
  } else if (questionNumber >= 3) {
    questionGuidance = `זו השאלה ${questionNumber + 1}. אתה כבר יש לך מידע מהשאלות הקודמות. שאל שאלה מכוונת שמבדילה בין האפשרויות השונות. התמקד בפרטים ספציפיים: מתי בדיוק הבעיה מתרחשת, איך היא משפיעה על הנסיעה, או מה הנהג יכול לבדוק בעצמו. שאל שאלה שתעזור לך להגיע לאבחנה מדויקת.`;
  }

  // Add specific guidance for clear cases where diagnosis should be triggered
  let clearCaseGuidance = "";
  
  // Check for clear oil-related cases (using already computed combined string)
  const hasOilLight = combined.includes("נורת שמן") || combined.includes("שמן") || combined.includes("oil");
  const hasLowOil = combined.includes("שמן נמוך") || combined.includes("מפלס נמוך") || combined.includes("low oil") || 
                    combined.includes("שמן נראה נמוך") || combined.includes("השמן נראה נמוך");
  const hasEngineNoise = combined.includes("רעש") || combined.includes("רעשים") || combined.includes("noise") ||
                         combined.includes("ברזלים") || combined.includes("מטאלי");
  
  // Check if we already asked about current oil level
  const hasAskedAboutOilLevel = answers.some((a) => {
    const q = (a.question || "").toLowerCase();
    return q.includes("מפלס") || q.includes("שמן") || q.includes("oil level");
  });
  
  // Only show clear case guidance if we have explicit low oil confirmation (not just "last checked a month ago")
  if (hasOilLight && hasLowOil && hasEngineNoise && answers.length >= 2 && hasAskedAboutOilLevel) {
    clearCaseGuidance = `
⚠️ מקרה ברור - מחסור בשמן מנוע:
יש לך כבר מספיק מידע לאבחון ברור:
- נורת שמן אדומה דולקת
- מפלס שמן נמוך (אושר על ידי המשתמש)
- רעשים מהמנוע

זה מקרה ברור של מחסור בשמן מנוע. במקרים כאלה, אתה צריך להחזיר confidence גבוה (0.9 או יותר) ולהחזיר אבחון במקום שאלה נוספת. החזר type: "diagnosis" עם confidence גבוה.`;
  } else if (hasOilLight && !hasAskedAboutOilLevel && answers.length >= 1) {
    // If we have oil light but haven't asked about current oil level yet, guide to ask
    clearCaseGuidance = `
⚠️ חשוב: יש לך נורת שמן. לפני שאתה מאבחן, אתה חייב לשאול על מפלס השמן הנוכחי (לא מתי בדקו לאחרונה, אלא מה המפלס עכשיו). שאל שאלה על מפלס השמן הנוכחי לפני שאתה מאבחן.`;
  }

  return `אתה מכונאי רכב מקצועי. עזור למשתמש לאבחן בעיות רכב בצורה פשוטה וברורה.

${imageInstructions}

תיאור הבעיה שהמשתמש נתן: "${sanitizedDescription}"

${answersContext !== "אין תשובות קודמות." ? `תשובות קודמות:\n${answersContext}` : ""}

${safetyWarning}

${questionGuidance}

${clearCaseGuidance}

הנחיות חשובות:
1. שאל שאלה אחת בעברית, פשוטה וברורה.
2. החזר 3-5 אפשרויות בחירה.
3. השאלה חייבת להיות רלוונטית לנורה/בעיה + התיאור המילולי.
4. אם יש תמונה: בשאלה הראשונה בלבד, התחל בתיאור קצר של הנורה, ואז שאל. בשאלות הבאות - רק שאל, אל תתאר שוב.
5. שאל שאלות ספציפיות לפי סוג הנורה:
   - שמן: מפלס שמן, רעשים, נזילה
   - לחץ אוויר: משיכה לצד, רעידות
   - מנוע: כוח, רעשים, ריחות
   - בלמים: יעילות, רעשים
6. התמקד בתסמינים: מתי (התנעה/נסיעה/עצירה), איך (מושך/רעידות/אובדן כוח), מה הנהג מרגיש.
7. אם בטוח 90%+ ו-3+ תשובות → החזר אבחון. במקרים ברורים (שמן+נמוך+רעשים) → אפשר גם אחרי 2 תשובות, אבל רק אחרי ששאלת על מפלס שמן נוכחי.

${hasImages ? `תמונה: נורת אזהרה. זהה את הנורה ושלב עם התיאור המילולי.` : ""}

החזר JSON בלבד:
{
  "type": "question" | "diagnosis",
  "question": "שאלה אחת בעברית פשוטה (רק אם type הוא 'question')",
  "options": ["אופציה 1", "אופציה 2", "אופציה 3", "אופציה 4"] (רק אם type הוא 'question'),
  "confidence": 0.7-1.0,
  "safety_warning": "אזהרת בטיחות (רק בשאלה הראשונה, רק אם יש נורה אדומה קריטית - שמן, מנוע, בלם, חום מנוע, מצבר, כריות אוויר). אם אין נורה אדומה קריטית, אל תכלול שדה זה.",
  "caution_notice": "הודעת זהירות (רק בשאלה הראשונה, רק אם יש נורה כתומה - Check Engine, ABS, בקרת יציבות, לחץ אוויר בצמיגים). אם אין נורה כתומה, אל תכלול שדה זה."
}

⚠️ חשוב: אם יש לך מספיק מידע לאבחון ברור (למשל: נורת שמן + מפלס שמן נמוך + רעשים מהמנוע), החזר type: "diagnosis" עם confidence גבוה (0.9+) במקום שאלה. במקרה זה, השתמש בפורמט האבחון (ראה buildDiagnosisPrompt).`;
}

/**
 * Build prompt for final diagnosis
 * Called when confidence >= 90% or after 5 questions
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
תמונה: נורת אזהרה בלוח המחוונים. שלב את מה שאתה רואה עם התיאור המילולי.
האבחון חייב להתבסס על שני המקורות: הנורה + התיאור המילולי (תסמינים, התנהגות, מתי הבעיה מתרחשת).` : "";

  return `אתה מכונאי רכב מקצועי. עבוד בעברית, משפטים קצרים ופשוטים.

החזר רק JSON תקף. אין טקסט מחוץ ל-JSON.

${imageInstructions}

תיאור הבעיה: "${sanitizedDescription}"

${answersContext !== "אין תשובות קודמות." ? `תשובות קודמות:\n${answersContext}` : ""}

${hasImages ? `תמונה: נורת אזהרה. האבחון חייב להתבסס על הנורה + התיאור המילולי.` : ""}

קריטי: זהה את הבעיה הסבירה ביותר על בסיס התיאור המילולי, התמונה (אם יש), והתשובות.
- אם יש תמונה: שים לב לנורה + השתמש בתיאור המילולי (תסמינים, התנהגות)
- תסמינים ספציפיים מהתיאור (רעשים, ירידה בכוח, מתי הבעיה מתרחשת) הם מידע קריטי
- אל תחזיר "בעיה לא מזוהה" - תמיד נסה לזהות בעיה ספציפית

הנחיות לאבחון:
1. החזר עד 3 תקלות, מדורגות לפי הסתברות (0-1)
2. עברית בלבד, משפטים קצרים, ללא ז'רגון מקצועי (אל תשתמש בקודי תקלה, OBD, ECU)
3. הסבר קצר (2-3 משפטים) לכל תקלה - למה זו הבעיה ואיך הגעת לאבחנה
4. אם יש נורה ספציפית - האבחון חייב להיות קשור אליה + התיאור המילולי
5. תסמינים מהתיאור (רעשים, משיכה, רעידות, ירידה בכוח) הם מידע קריטי - השתמש בהם
6. שים לב לפרטים מהתיאור: מתי הבעיה מתרחשת, איך הרכב מתנהג, כמה זמן קיימת

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

/**
 * Build prompt for generating a short description (up to 5 words)
 * Based on the AI diagnosis summary
 */
export function buildShortDescriptionPrompt(
  aiDiagnosis: string
): string {
  const sanitizedDiagnosis = sanitizeInput(aiDiagnosis, 500);

  return `אתה מכונאי רכב מקצועי. על בסיס האבחון הבא, צור תיאור קצר מאוד של הבעיה.

אבחון: "${sanitizedDiagnosis}"

הנחיות:
1. צור תיאור קצר בעברית - עד 5 מילים בלבד
2. התיאור צריך לתאר את הבעיה העיקרית במילים פשוטות
3. השתמש במילים שהמשתמש הממוצע יבין
4. התמקד בבעיה העיקרית, לא בפרטים טכניים

דוגמאות:
- "נורת שמן אדומה דולקת"
- "בעיית לחץ אוויר בצמיגים"
- "נורת מנוע כתומה"
- "בעיית בלמים"

החזר JSON בלבד:
{
  "description": "תיאור קצר עד 5 מילים"
}`;
}
