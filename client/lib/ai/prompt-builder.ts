/**
 * Prompt builder for AI consultation flow
<<<<<<< HEAD
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

  // Image analysis instructions - עם הדגשה על שילוב התיאור המילולי
  const imageInstructions = hasImages ? `
קריטי: התמונה היא של נורת אזהרה בלוח המחוונים או חלק רכב בלבד. אין אנשים בתמונה.

חשוב מאוד: אתה חייב לשלב את התיאור המילולי שהמשתמש נתן עם מה שאתה רואה בתמונה. אל תתייחס רק לתמונה - השתמש גם בתיאור המילולי כדי להבין את הבעיה המלאה.

זהה בדיוק איזו נורה מופיעה בתמונה:
- נורת שמן (oil can עם טיפה) → שאל שאלות על מערכת השמן
- נורת לחץ אוויר (צמיג עם סימן קריאה) → שאל שאלות על צמיגים ולחץ אוויר
- נורת מנוע (check engine) → שאל שאלות על מערכת המנוע
- נורת בטרייה → שאל שאלות על מערכת החשמל
- נורה אחרת → תאר בדיוק מה אתה רואה ושאל שאלות רלוונטיות

השאלות שלך חייבות להתבסס גם על התיאור המילולי שהמשתמש נתן (תסמינים, התנהגות הרכב, מתי הבעיה מתרחשת) וגם על הנורה שאתה רואה בתמונה.` : "";

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
    questionGuidance = "זו השאלה השנייה. אל תחזור על תיאור התמונה. שאל שאלה ספציפית שמכוונת לזיהוי הבעיה: אם זו נורת שמן - שאל על מפלס שמן, רעשים מהמנוע, או סימני נזילה. אם זו נורת לחץ אוויר - שאל על משיכה לצד, רעידות, או מתי הבחנת בבעיה. אם זו נורת מנוע - שאל על כוח המנוע, רעשים, או ריחות חריגים.";
  } else if (questionNumber === 2) {
    questionGuidance = "זו השאלה השלישית. התמקד בתסמינים ספציפיים: מתי הבעיה מתרחשת (בהתנעה, בנסיעה, אחרי עצירה), איך הרכב מתנהג (מושך לצד, רעידות, אובדן כוח), או מה הנהג מרגיש (רעשים, ריחות, שינויים בהגה/בלמים). שאל שאלה שמכוונת לזיהוי הגורם המדויק.";
  } else if (questionNumber >= 3) {
    questionGuidance = `זו השאלה ${questionNumber + 1}. אתה כבר יש לך מידע מהשאלות הקודמות. שאל שאלה מכוונת שמבדילה בין האפשרויות השונות. התמקד בפרטים ספציפיים: מתי בדיוק הבעיה מתרחשת, איך היא משפיעה על הנסיעה, או מה הנהג יכול לבדוק בעצמו. שאל שאלה שתעזור לך להגיע לאבחנה מדויקת.`;
  }

  return `אתה מכונאי רכב מקצועי. עזור למשתמש לאבחן בעיות רכב בצורה פשוטה וברורה.

${imageInstructions}

תיאור הבעיה שהמשתמש נתן: "${sanitizedDescription}"

${answersContext !== "אין תשובות קודמות." ? `תשובות קודמות:\n${answersContext}` : ""}

${safetyWarning}

${questionGuidance}

קריטי - שילוב תיאור מילולי ותמונה:
- אם יש תמונה, אתה חייב לשלב את מה שאתה רואה בתמונה עם התיאור המילולי שהמשתמש נתן
- התיאור המילולי מכיל מידע חשוב על התסמינים, ההתנהגות של הרכב, מתי הבעיה מתרחשת
- אל תתייחס רק לתמונה - השתמש גם בתיאור המילולי כדי להבין את הבעיה המלאה
- השאלות שלך חייבות להתבסס על שני המקורות: התמונה (איזו נורה) והתיאור המילולי (מה המשתמש חווה)

הנחיות חשובות:
1. שאל שאלה אחת בלבד בעברית, פשוטה וברורה.
2. החזר 3-5 אפשרויות בחירה (לא פחות מ-3, לא יותר מ-5).
3. השאלה חייבת להיות רלוונטית ישירות לנורה/בעיה שזיהית, אבל גם להתבסס על התיאור המילולי.
4. אם יש תמונה - השאלה חייבת להתאים לנורה שאתה רואה, אבל גם לקחת בחשבון את התיאור המילולי (תסמינים, התנהגות, מתי הבעיה מתרחשת).
5. בשאלה הראשונה בלבד, אם יש תמונה, התחל את המשפט בתיאור קצר של מה שאתה רואה (לדוגמה: \"נראה שזו נורת מחסור בלחץ אוויר בצמיגים\"), ואז המשך לשאלה שמתבססת גם על התיאור המילולי.
6. בשאלות הבאות (שאלה שנייה, שלישית וכו') אסור לך לתאר שוב את הנורה או לכתוב שוב \"נראה שזו\". אל תכתוב שום תיאור של התמונה, רק את השאלה עצמה שמתבססת על התיאור המילולי והתשובות הקודמות.
7. שאל שאלות מכוונות שמכוונות לזיהוי הבעיה הספציפית, תוך שילוב המידע מהתיאור המילולי:
   - אם זו נורת שמן: שאל על מפלס שמן, רעשים מהמנוע, סימני נזילה, או מתי הבחנת בבעיה.
   - אם זו נורת לחץ אוויר: שאל על משיכה לצד, רעידות, מתי הבחנת בבעיה, או בדיקת לחץ אוויר.
   - אם זו נורת מנוע: שאל על כוח המנוע, רעשים, ריחות חריגים, או מתי הבעיה מתרחשת.
   - אם זו נורת בלמים: שאל על יעילות הבלימה, רעשים מהבלמים, או מתי הבחנת בבעיה.
8. התמקד בתסמינים ספציפיים שהנהג יכול לזהות: מתי הבעיה מתרחשת (בהתנעה, בנסיעה, אחרי עצירה), איך הרכב מתנהג (מושך לצד, רעידות, אובדן כוח), או מה הנהג מרגיש (רעשים, ריחות, שינויים בהגה/בלמים). השתמש במידע מהתיאור המילולי שהמשתמש נתן.
9. אל תשאל שאלות כלליות מדי כמו \"האם יש תסמינים נוספים?\" - שאל שאלות ספציפיות שמכוונות לזיהוי הבעיה, תוך התייחסות למידע מהתיאור המילולי.
10. נהל את הביטחון שלך: אם אתה בטוח ב-90% או יותר והמשתמש כבר ענה על 3 שאלות או יותר, תוכל להחזיר אבחון במקום שאלה.

${hasImages ? `תמונה: נורת אזהרה בלוח המחוונים. זהה איזו נורה זה, אבל זכור: השאלות שלך חייבות להתבסס גם על התיאור המילולי שהמשתמש נתן (תסמינים, התנהגות, מתי הבעיה מתרחשת) ולא רק על התמונה.` : ""}

החזר JSON בלבד:
{
  "type": "question",
  "question": "שאלה אחת בעברית פשוטה",
  "options": ["אופציה 1", "אופציה 2", "אופציה 3", "אופציה 4"],
  "confidence": 0.7,
  "safety_warning": "אזהרת בטיחות (רק בשאלה הראשונה, רק אם יש נורה אדומה קריטית - שמן, מנוע, בלם, חום מנוע, מצבר, כריות אוויר). אם אין נורה אדומה קריטית, אל תכלול שדה זה.",
  "caution_notice": "הודעת זהירות (רק בשאלה הראשונה, רק אם יש נורה כתומה - Check Engine, ABS, בקרת יציבות, לחץ אוויר בצמיגים). אם אין נורה כתומה, אל תכלול שדה זה."
}`;
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
קריטי: התמונה היא של נורת אזהרה בלוח המחוונים או חלק רכב בלבד. אין אנשים בתמונה.

חשוב מאוד: אתה חייב לשלב את התיאור המילולי שהמשתמש נתן עם מה שאתה רואה בתמונה. אל תתייחס רק לתמונה - השתמש גם בתיאור המילולי כדי להבין את הבעיה המלאה ולהגיע לאבחנה מדויקת.

האבחון חייב להיות רלוונטי גם לנורה שאתה רואה בתמונה וגם לתיאור המילולי (תסמינים, התנהגות הרכב, מתי הבעיה מתרחשת).
אם זו נורת לחץ אוויר - אבחן בעיות צמיגים/לחץ אוויר, אבל גם קח בחשבון את התיאור המילולי.
אם זו נורת שמן - אבחן בעיות שמן/מנוע, אבל גם קח בחשבון את התיאור המילולי.
אם זו נורת מנוע (check engine) - אבחן בעיות מנוע, אבל גם קח בחשבון את התיאור המילולי (למשל: אם המשתמש תיאר שהמנוע עולה בטורים, זה מידע קריטי לאבחון).` : "";

  return `אתה מכונאי רכב מקצועי. עבוד בעברית, משפטים קצרים ופשוטים.

החזר רק JSON תקף. אין טקסט מחוץ ל-JSON.

${imageInstructions}

תיאור הבעיה: "${sanitizedDescription}"

${answersContext !== "אין תשובות קודמות." ? `תשובות קודמות:\n${answersContext}` : ""}

${hasImages ? `תמונה: נורת אזהרה בלוח המחוונים. האבחון חייב להתבסס גם על הנורה הזו וגם על התיאור המילולי שהמשתמש נתן.` : ""}

קריטי: על בסיס התיאור המילולי, התמונה (אם יש), והתשובות שקיבלת, זהה את הבעיה הסבירה ביותר. 
- אם יש תמונה, שים לב לנורה שאתה רואה, אבל גם השתמש בתיאור המילולי כדי להבין את התסמינים וההתנהגות
- אם המשתמש תיאר תסמינים ספציפיים (למשל: "המנוע עולה בטורים", "יש ירידה בכוח", "הנורה דולקת כחודש"), זה מידע קריטי לאבחון
- אל תחזיר "בעיה לא מזוהה" - תמיד נסה לזהות בעיה ספציפית על בסיס המידע שיש לך (תיאור מילולי + תמונה + תשובות)

הנחיות לאבחון:
1. החזר עד 3 תקלות אפשריות, מדורגות לפי הסתברות (הגבוהה ביותר ראשונה)
2. לכל תקלה: "probability" מספרי (0-1). ההסתברויות לא חייבות לסכם ל-100
3. עברית בלבד, משפטים קצרים, ללא ז'רגון מקצועי
4. אל תשתמש בקודי תקלה, שמות חיישנים, OBD, ECU, PCM, CAN
5. הסבר במילים פשוטות לנהג רגיל שלא מבין ברכבים
6. מעל כל תקלה, תן הסבר קצר (2-3 משפטים) למה אתה חושב שזו הבעיה ואיך הגעת לאבחנה הזו - הסבר "קליל וחברי"
7. אם יש נורת אזהרה ספציפית (שמן, לחץ אוויר, מנוע, בלמים) - האבחון חייב להיות קשור ישירות לנורה הזו, אבל גם לקחת בחשבון את התיאור המילולי
8. אם המשתמש תיאר תסמינים ספציפיים (רעשים, משיכה לצד, רעידות, המנוע עולה בטורים, ירידה בכוח) - זה מידע קריטי לאבחון. השתמש בהם כדי לדייק את האבחון
9. שים לב במיוחד לפרטים מהתיאור המילולי: מתי הבעיה מתרחשת, איך הרכב מתנהג, כמה זמן הבעיה קיימת - כל אלה עוזרים לזהות את הבעיה המדויקת

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
=======
 *
 * Anti-Gravity Design (Hybrid Modes):
 * - KB_COORDINATION: When detectedLightType exists → inject only that light's KB slice.
 * - OPTION_MAPPER: Map free-text answers to predefined option labels.
 * - BRIDGE_TO_KB: Ask up to 3 questions to identify warning_light or scenario.
 * - EXPERT_FALLBACK: General expertise when KB bridging fails.
 *
 * All modes return JSON only (no Markdown).
 */

import type { UserAnswer } from './types';
import { sanitizeInput } from './sanitize';
import warningLightsKB from '@/lib/knowledge/warning-lights.json';

// =============================================================================
// TYPES
// =============================================================================

export interface PromptContext {
  mode?: 'option_map' | 'bridge' | 'expert' | null;
  currentQuestionOptions?: string[];
  bridgeQuestionCount?: number;
  [key: string]: unknown;
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

const MAX_ANSWERS_CHARS = 2000;

function clampText(s: string, max: number): string {
  const t = (s || '').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

function buildAnswersContext(answers: UserAnswer[]): string {
  if (!answers || answers.length === 0) return 'אין תשובות קודמות.';
  const recent = answers.slice(-6);

  const lines = recent.map((a, idx) => {
    const q = clampText((a as any)?.question ?? '', 120);
    const ans = clampText((a as any)?.answer ?? '', 120);
    return `${idx + 1}) Q: "${q}" | A: "${ans}"`;
  });

  return clampText(lines.join('\n'), MAX_ANSWERS_CHARS);
}

/**
 * Surgical KB injection:
 * - If targetLightId exists, inject ONLY that light JSON.
 * - Else inject a minimal list for identification.
 */
function buildKnowledgeBaseContext(targetLightId?: string | null): string {
  const lights = warningLightsKB as Record<string, any>;

  if (targetLightId && lights[targetLightId]) {
    const lightData = lights[targetLightId];
    return JSON.stringify({ lightId: targetLightId, lightData }, null, 2);
  }

  const list = Object.entries(lights).map(([lightId, lightData]) => ({
    lightId,
    names_he: lightData?.names?.he ?? [],
    names_en: lightData?.names?.en ?? []
  }));

  return JSON.stringify({ available_lights: list }, null, 2);
}

/**
 * JSON-only response contract shared by all modes.
 */
function jsonOnlyContract(mode: string): string {
  if (mode === 'OPTION_MAPPER') {
    return `
Return ONLY a valid JSON object. No markdown, no extra text.

Schema for OPTION_MAPPER mode:
{
  "type": "option_map",
  "selectedOptionLabel": "<exact label from options | null>",
  "needClarification": "<clarifying question string | null>"
}

Rules:
- selectedOptionLabel MUST be exactly one of the provided option labels, or null if no match.
- If null, provide a short clarification question in needClarification.
`.trim();
  }

  return `
Return ONLY a valid JSON object. No markdown, no extra text.

Schema:
{
  "type": "question" | "ai_response",
  "warning_light"?: "<lightId>",
  "text": "<string>",
  "options"?: ["<string>", ...]
}

Rules:
- Do NOT invent technical diagnosis.
- If you choose a warning_light, it must be one of the provided KB IDs.
- If detectedLightType exists, ONLY use the KB slice injected for that light.
- Always include options as an array of strings when type is "question".
`.trim();
}

/**
 * Try to pick a followup question based on the user's last answer and KB structure.
 * Supports:
 * - new: first_question.followups[optionId]
 * - old: first_question.followup_for_steady / followup_for_flashing
 */
function suggestFollowupQuestion(lightData: any, lastAnswerRaw: string): any | null {
  const last = (lastAnswerRaw || '').toLowerCase();

  const firstQ = lightData?.first_question;
  if (!firstQ) return null;

  // New structure: followups map keyed by optionId
  const options = Array.isArray(firstQ.options) ? firstQ.options : [];
  const followups = firstQ.followups;

  if (followups && typeof followups === 'object' && options.length > 0) {
    const matched = options.find((o: any) => {
      const id = String(o?.id ?? '').toLowerCase();
      const label = String(o?.label ?? o ?? '').toLowerCase();
      return (id && last.includes(id)) || (label && last.includes(label));
    });

    if (matched) {
      const f = followups[String(matched.id)];
      if (f?.text) return f;
    }
  }

  // Old structure fallback
  if (last.includes('מהבהב') || last.includes('flashing')) {
    const f = firstQ.followup_for_flashing;
    if (f?.text) return f;
  }
  if (last.includes('קבוע') || last.includes('steady')) {
    const f = firstQ.followup_for_steady;
    if (f?.text) return f;
  }

  return null;
}

// =============================================================================
// MAIN EXPORTS
// =============================================================================

/**
 * Build prompt for chat-based AI coordination.
 *
 * Modes resolved internally:
 * - OPTION_MAPPER: ctx.mode === 'option_map' with ctx.currentQuestionOptions
 * - KB_COORDINATION: detectedLightType present
 * - IMAGE_IDENTIFICATION: hasImages && no detected light
 * - BRIDGE_TO_KB: no light, trying to identify
 */
export function buildChatPrompt(
  description: string,
  answers: UserAnswer[],
  hasImages: boolean,
  questionNumber: number = 0,
  detectedLightType?: string | null,
  ctx?: PromptContext | null
): string {
  const sanitizedDescription = sanitizeInput(description || '', 1000);
  const answersContext = buildAnswersContext(answers);

  // -------------------------------------------------------------------------
  // MODE: OPTION_MAPPER
  // -------------------------------------------------------------------------
  if (ctx?.mode === 'option_map' && Array.isArray(ctx.currentQuestionOptions) && ctx.currentQuestionOptions.length > 0) {
    const optionsList = ctx.currentQuestionOptions.map((o, i) => `${i + 1}. "${o}"`).join('\n');

    return `
You are an Option Mapper assistant.

User's free-text answer:
"${sanitizedDescription}"

Available options (choose EXACTLY one label or null):
${optionsList}

${jsonOnlyContract('OPTION_MAPPER')}
`.trim();
  }

  // -------------------------------------------------------------------------
  // MODE: KB_COORDINATION / IMAGE_IDENTIFICATION / BRIDGE_TO_KB
  // -------------------------------------------------------------------------
  const lights = warningLightsKB as Record<string, any>;
  const lightData = detectedLightType ? lights[detectedLightType] : null;
  const lightHebrewName = lightData?.names?.he?.[0] || detectedLightType || '';

  const kbContext = buildKnowledgeBaseContext(detectedLightType);

  const needsImageIdentification =
    hasImages && (!detectedLightType || detectedLightType === 'unidentified_light');

  const lastAnswer = (answers?.[answers.length - 1] as any)?.answer ?? '';
  const followup = lightData ? suggestFollowupQuestion(lightData, lastAnswer) : null;

  let mode: string;
  if (needsImageIdentification) {
    mode = 'IMAGE_IDENTIFICATION';
  } else if (detectedLightType && detectedLightType !== 'unidentified_light') {
    mode = 'KB_COORDINATION';
  } else {
    mode = 'BRIDGE_TO_KB';
  }

  const bridgeCount = ctx?.bridgeQuestionCount ?? 0;
  const remainingBridgeQuestions = Math.max(0, 3 - bridgeCount);

  const instruction = `
You are a Data Coordinator for a car diagnostics assistant.

Mode: ${mode}

User input:
"${sanitizedDescription}"

Recent Q/A history:
${answersContext}

Detected warning light (if any): ${detectedLightType ? `"${detectedLightType}" (${lightHebrewName})` : 'none'}

${mode === 'IMAGE_IDENTIFICATION' ? `
Instructions for IMAGE_IDENTIFICATION:
- Identify the warning_light ID from the provided available_lights list.
- Return a JSON object with type="question", include warning_light, and ask the first KB question if possible.
- Do NOT guess if unclear; ask the user to describe the light.
` : ''}

${mode === 'KB_COORDINATION' ? `
Instructions for KB_COORDINATION:
- Do NOT invent new questions.
- Use the injected KB slice ONLY.
- If a followup question is relevant, ask it.
- Otherwise, ask the KB first_question or a clarifying KB question derived ONLY from injected KB.
- Always return options as an array of strings.

Followup hint (if present): ${followup?.text ? `"${followup.text}"` : 'none'}
` : ''}

${mode === 'BRIDGE_TO_KB' ? `
Instructions for BRIDGE_TO_KB:
- Your goal: identify which warning_light (from available_lights) matches the user's problem.
- You may ask UP TO ${remainingBridgeQuestions} more bridging question(s).
- Do NOT diagnose or give technical advice.
- If you identify a warning_light, include it in your response.
- Keep questions short and focused.
` : ''}

KB Context (JSON):
${kbContext}

${jsonOnlyContract(mode)}
`.trim();

  return instruction;
}

/**
 * Build prompt for expert fallback mode.
 *
 * Used when:
 * - context-analyzer returns CONSULT_AI
 * - No recognized light or scenario in KB
 * - Bridge attempts exhausted
 */
export function buildGeneralExpertPrompt(
  description: string,
  answers: UserAnswer[],
  hasImages: boolean = false,
  ctx?: PromptContext | null
): string {
  const sanitizedDescription = sanitizeInput(description || '', 1000);
  const answersContext = buildAnswersContext(answers);
  const kbContext = buildKnowledgeBaseContext(null);
  const questionCount = answers.length;

  const instruction = `
You are an EXPERT_FALLBACK assistant for car diagnostics.

Mode: EXPERT_FALLBACK

User input:
"${sanitizedDescription}"

Recent Q/A history (${questionCount} questions asked so far):
${answersContext}

${hasImages ? 'Note: User provided an image. Describe what you see if relevant.\n' : ''}

Instructions:
${questionCount >= 5 ? `
- You have gathered enough information (${questionCount} questions). NOW provide a diagnosis_report.
- Return type: "diagnosis_report" with results array.
` : `
- Ask clarifying questions to understand the problem better.
- IMPORTANT: Provide 3-4 VARIED options, NOT just "כן/לא". Include specific symptoms, actions, or descriptions.
- Example good options: ["כן, יש טפטוף קבוע", "לא, אבל יש כתם על הרצפה", "לא בדקתי", "לא בטוח"]
- If the user indicates they want to go to a mechanic or end the conversation, provide a diagnosis_report.
`}
- If you can map the description to a warning_light ID from available_lights, include warning_light in the JSON.
- Be safety-conscious: if something sounds dangerous, immediately advise stopping and return diagnosis_report.

Available lights (JSON):
${kbContext}

Return ONLY a valid JSON object. No markdown, no extra text.

Schema for questions:
{
  "type": "question",
  "text": "<question string>",
  "options": ["<varied option 1>", "<varied option 2>", "<varied option 3>", "<varied option 4>"]
}

Schema for diagnosis (use when ${questionCount >= 5 ? 'NOW - enough questions asked' : 'user wants to end or dangerous situation'}):
{
  "type": "diagnosis_report",
  "title": "אבחון: <problem summary>",
  "results": [
    { "issue": "<diagnosis 1>", "probability": 0.7, "explanation": "<why>" },
    { "issue": "<diagnosis 2>", "probability": 0.2, "explanation": "<why>" }
  ],
  "confidence": 0.75,
  "status": { "color": "yellow", "text": "<severity text>", "instruction": "<action to take>" },
  "nextSteps": "<recommended next steps>",
  "recommendations": ["<specific check 1>", "<specific check 2>"],
  "endConversation": true
}
`.trim();

  return instruction;
}

// =============================================================================
// SHORT DESCRIPTION PROMPT (for from-draft route)
// =============================================================================

/**
 * Builds a prompt to generate a short description from a diagnosis.
 * Used by /api/requests/from-draft to create a summary for the request.
 */
export function buildShortDescriptionPrompt(diagnosis: string): string {
  const safeDiagnosis = sanitizeInput(diagnosis, 2000);

  return `
אתה עוזר טכני לרכב. קיבלת אבחנה של בעיה ברכב.
צור תיאור קצר של הבעיה בעברית (מקסימום 100 תווים).

האבחנה:
${safeDiagnosis}

החזר JSON בלבד בפורמט:
{
  "description": "תיאור קצר של הבעיה"
}

דוגמאות:
- "בעיה במערכת הבלמים"
- "התחממות יתר של המנוע"
- "נורת שמן דולקת"
- "רעש ממערכת ההיגוי"

החזר JSON בלבד, ללא טקסט נוסף.
`.trim();
>>>>>>> rescue/ui-stable
}
