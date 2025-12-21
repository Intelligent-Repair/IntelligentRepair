/**
 * Main chat API route for AI consultation
 * 
 * Flow:
 * 1. User submits description + optional images
 * 2. AI returns question (or diagnosis if confidence >= 90%)
 * 3. User answers (up to 5 questions total)
 * 4. After 5 questions or 90% confidence → final diagnosis
 * 
 * Key changes:
 * - Vehicle info NOT sent to API (only for DB storage)
 * - Simplified prompts focused on general car problems
 * - Confidence-based early diagnosis (80% trigger)
 * - Natural, friendly Hebrew responses
 */

import { NextResponse } from "next/server";
import { createOpenAIClient, type OpenAIClient } from "@/lib/ai/client";
import { fetchImageAsInlineData } from "@/lib/ai/image-utils";
import { extractJSON } from "../aiUtils";
import { buildChatPrompt, buildDiagnosisPrompt, DANGER_KEYWORDS, CAUTION_KEYWORDS } from "@/lib/ai/prompt-builder";
import type { UserAnswer } from "@/lib/ai/types";

interface RequestBody {
  description: string;
  answers: UserAnswer[];
  image_urls?: string[];
  vehicle?: {
    manufacturer?: string;
    model?: string;
    year?: string | number;
  };
}

const MAX_QUESTIONS = 5;
const MIN_ANSWERS_FOR_EARLY_DIAGNOSIS = 3; // Minimum answers for early diagnosis (normal cases)
const MIN_ANSWERS_FOR_CLEAR_CASE = 2; // Minimum answers for clear cases (e.g., oil light + low oil + noise)
const CONFIDENCE_THRESHOLD = 0.9; // 90% confidence triggers early diagnosis (after MIN_ANSWERS_FOR_EARLY_DIAGNOSIS)
const MIN_CONFIDENCE_FOR_FINAL_DIAGNOSIS = 0.5; // Minimum confidence to return diagnosis after all questions
const DIAGNOSIS_DISCLAIMER =
  "האבחון מבוסס על מידע ראשוני בלבד ואינו מהווה תחליף לבדיקה מקצועית. מומלץ לפנות למוסך מוסמך לצורך בדיקה ואבחון מלא.";

/**
 * Fetch and process images
 */
async function fetchImages(imageUrls: string[]): Promise<Array<{ inlineData: { data: string; mimeType: string } }>> {
  const fetchedImages = await Promise.all(
    imageUrls.map(async (url) => {
      try {
        return await fetchImageAsInlineData(url);
      } catch (err) {
        console.warn("[Questions API] Failed to process image, continuing without it:", url, err);
        return null;
      }
    })
  );
  const validImages = fetchedImages.filter(Boolean) as Array<{ inlineData: { data: string; mimeType: string } }>;
  
  if (validImages.length < imageUrls.length) {
    console.warn(`[Questions API] Only ${validImages.length}/${imageUrls.length} images loaded successfully.`);
  }
  
  return validImages;
}

/**
 * Build diagnosis response from AI output
 */
function buildDiagnosisResponse(rawDiagnosis: any) {
  const summary =
    typeof rawDiagnosis?.summary === "string" && rawDiagnosis.summary.trim()
      ? rawDiagnosis.summary.trim()
      : "אבחון ראשוני על בסיס המידע שניתן.";

  const rawResults = Array.isArray(rawDiagnosis?.results) ? rawDiagnosis.results : [];

  // Parse and validate results
  const parsedResults = rawResults
    .filter(
      (r: any) =>
        r &&
        typeof r.issue === "string" &&
        r.issue.trim() &&
        typeof r.probability === "number" &&
        r.probability >= 0 &&
        r.probability <= 1
    )
    .map((r: any) => ({
      issue: r.issue.trim(),
      probability: r.probability,
      explanation:
        typeof r.explanation === "string" && r.explanation.trim()
          ? r.explanation.trim()
          : summary,
      self_checks: Array.isArray(r.self_checks) ? r.self_checks.filter((s: any) => typeof s === "string" && s.trim()) : [],
      do_not: Array.isArray(r.do_not) ? r.do_not.filter((d: any) => typeof d === "string" && d.trim()) : [],
    }));

  // Remove duplicates and sort by probability
  const uniqueResults = parsedResults.reduce(
    (
      acc: {
        issue: string;
        probability: number;
        explanation: string;
        self_checks: string[];
        do_not: string[];
      }[],
      curr: {
        issue: string;
        probability: number;
        explanation: string;
        self_checks: string[];
        do_not: string[];
      }
    ) => {
      const exists = acc.some(
        (r: {
          issue: string;
          probability: number;
          explanation: string;
          self_checks: string[];
          do_not: string[];
        }) => r.issue.toLowerCase() === curr.issue.toLowerCase()
      );
      if (!exists) {
        acc.push(curr);
      }
      return acc;
    },
    [] as {
      issue: string;
      probability: number;
      explanation: string;
      self_checks: string[];
      do_not: string[];
    }[]
  );

  if (!uniqueResults.length) {
    return {
      type: "diagnosis",
      summary: "לא נמצאה התאמה ברורה לתקלה על סמך המידע שסופק.",
      results: [],
      recommendations: [
        "מומלץ לפנות למוסך לבדיקה מקצועית.",
        "אפשר לחזור לייעוץ חדש ולנסות לתאר את התקלה בצורה מפורטת יותר.",
      ],
      disclaimer: DIAGNOSIS_DISCLAIMER,
      confidence: 0,
    };
  }

  uniqueResults.sort(
    (
      a: { probability: number },
      b: { probability: number }
    ) => b.probability - a.probability
  );

  // Take top 3 results
  const topResults = uniqueResults.slice(0, 3).map((r: {
    issue: string;
    probability: number;
    explanation: string;
    self_checks: string[];
    do_not: string[];
  }) => ({
    issue: r.issue,
    probability: Math.round(r.probability * 100), // Convert to percentage for display
    explanation: r.explanation,
    self_checks: r.self_checks.slice(0, 5), // Limit to 5 self checks
    do_not: r.do_not.slice(0, 4), // Limit to 4 warnings
  }));

  // Build recommendations (DIY actions user can perform)
  const recommendations = topResults[0]?.self_checks?.length
    ? [
        ...topResults[0].self_checks,
        "אם הבעיה נמשכת או מחמירה, מומלץ לפנות למוסך לבדיקה מקצועית.",
      ]
    : [
        "בדיקת מפלס שמן או נוזל קירור כשהרכב כבוי ועל משטח ישר.",
        "כיבוי הרכב והנעה מחדש לאחר מספר דקות כדי לראות אם התסמין חוזר.",
        "בדיקה האם יש רעשים חריגים, ריחות לא רגילים או ירידה בכוח המנוע.",
        "אם הבעיה נמשכת, מומלץ לפנות למוסך לבדיקה מקצועית.",
      ];

  const confidence =
    typeof rawDiagnosis?.confidence === "number" &&
    rawDiagnosis.confidence >= 0 &&
    rawDiagnosis.confidence <= 1
      ? rawDiagnosis.confidence
      : topResults[0]?.probability ? topResults[0].probability / 100 : 0.7;

  return {
    type: "diagnosis",
    summary,
    results: topResults,
    recommendations,
    disclaimer: DIAGNOSIS_DISCLAIMER,
    confidence,
  };
}

/**
 * Check if a "no" answer to a specific question type should trigger instructions
 * For example: "האם ניסית להניע באמצעות כבלים?" + "לא" = needs instructions
 */
function shouldTriggerInstructionsForNo(question: string, answer: string): boolean {
  if (!question || !answer) return false;
  
  const lowerQuestion = question.toLowerCase();
  const lowerAnswer = answer.trim().toLowerCase();
  
  // Check if answer contains "לא" or "no" (can be part of a longer answer)
  // Examples: "לא", "לא, לא יודע", "no", "no, i don't know"
  const hasNo = lowerAnswer === "לא" || 
                lowerAnswer === "no" || 
                lowerAnswer.startsWith("לא ") || 
                lowerAnswer.startsWith("no ") ||
                lowerAnswer.includes(" לא ") ||
                lowerAnswer.includes(" no ");
  
  if (!hasNo) {
    return false;
  }
  
  // Check if question asks about trying/attempting/checking/observing something
  const instructionTriggerPhrases = [
    "האם ניסית",
    "האם ניסה",
    "האם ניסיתי",
    "האם בדקת",
    "האם בדק",
    "האם בדקתי",
    "האם זיהית",
    "האם זיהיתי",
    "האם טענת",
    "האם טען",
    "האם חיברת",
    "האם חיבר",
    "האם השתמשת",
    "האם השתמש",
    "האם אתה מבחין",
    "האם אתה רואה",
    "האם אתה מבחינה",
    "האם את רואה",
    "האם אתה מזהה",
    "האם את מזהה",
    "האם אתה מבחין ב",
    "האם אתה רואה ב",
    "האם יש לך",
    "האם יש",
    "did you try",
    "did you check",
    "did you identify",
    "did you see",
    "do you see",
    "do you notice",
    "have you tried",
    "have you checked",
    "have you seen"
  ];
  
  // Check if question contains any trigger phrase
  return instructionTriggerPhrases.some(phrase => lowerQuestion.includes(phrase));
}

/**
 * Check if answer indicates uncertainty ("לא בטוח", "לא יודע", etc.)
 */
/**
 * Check if the answer indicates that the problem has been solved/success
 * Returns true if the answer suggests the issue is resolved
 * IMPORTANT: Must check for failure phrases first to avoid false positives
 */
function isSuccessAnswer(answer: string, question: string): boolean {
  if (!answer || typeof answer !== "string") {
    return false;
  }
  
  // Normalize the answer - remove extra spaces and convert to lowercase
  const normalizedAnswer = answer.trim().toLowerCase();
  const lowerQuestion = (question || "").toLowerCase();
  
  // Failure phrases that indicate the problem is NOT solved (must check these first!)
  const failurePhrases = [
    "לא נדלק",
    "עדיין לא נדלק",
    "לא, עדיין לא נדלק",
    "לא עדיין לא נדלק",
    "לא הצלחתי",
    "לא הצלחתי להניע",
    "לא הצלחתי להניע",
    "לא עובד",
    "עדיין לא עובד",
    "לא, עדיין לא עובד",
    "לא פתר",
    "לא פתר את הבעיה",
    "לא נפתרה",
    "עדיין לא נפתרה",
    "לא נעלמה",
    "עדיין לא נעלמה",
    "לא הצליח",
    "לא הצליחה",
    "didn't start",
    "still didn't start",
    "didn't work",
    "still doesn't work",
    "didn't succeed",
    "failed",
    "still not working",
  ];
  
  // Check if answer contains failure phrases - if yes, it's NOT a success!
  const hasFailurePhrase = failurePhrases.some((phrase) => 
    normalizedAnswer.includes(phrase)
  );
  
  if (hasFailurePhrase) {
    return false; // Definitely not a success
  }
  
  // Success phrases that indicate the problem is solved
  const successPhrases = [
    "כן, הרכב נדלק",
    "כן הרכב נדלק",
    "הרכב נדלק",
    "נדלק",
    "כן, הנורה נעלמה",
    "כן הנורה נעלמה",
    "הנורה נעלמה",
    "נעלמה",
    "כן, זה עובד",
    "כן זה עובד",
    "זה עובד",
    "עובד",
    "כן, הבעיה נפתרה",
    "כן הבעיה נפתרה",
    "הבעיה נפתרה",
    "נפתרה",
    "הכל תקין עכשיו",
    "הכל תקין",
    "תקין",
    "כן, הצלחתי",
    "כן הצלחתי",
    "הצלחתי",
    "כן, זה פתר את הבעיה",
    "כן זה פתר את הבעיה",
    "זה פתר את הבעיה",
    "פתר את הבעיה",
    "כן, זה פתר",
    "כן זה פתר",
    "זה פתר",
    "yes, it started",
    "yes it started",
    "it started",
    "started",
    "yes, it works",
    "yes it works",
    "it works",
    "works",
    "yes, the light went off",
    "yes the light went off",
    "the light went off",
    "light went off",
    "problem solved",
    "solved",
    "fixed",
    "it's fixed",
    "all good",
    "all fine",
  ];
  
  // Check if answer contains success phrases
  const hasSuccessPhrase = successPhrases.some((phrase) => 
    normalizedAnswer.includes(phrase)
  );
  
  // Also check for "yes" answers to success-related questions
  const isSuccessQuestion = 
    lowerQuestion.includes("הצלחת") ||
    lowerQuestion.includes("נדלק") ||
    lowerQuestion.includes("עובד") ||
    lowerQuestion.includes("נעלמה") ||
    lowerQuestion.includes("נפתרה") ||
    lowerQuestion.includes("succeeded") ||
    lowerQuestion.includes("started") ||
    lowerQuestion.includes("works") ||
    lowerQuestion.includes("went off");
  
  // If it's a success question and answer is "yes" (but NOT "no" with failure phrases - already checked above)
  // AND answer contains success phrase or starts with "yes"
  if (isSuccessQuestion && (normalizedAnswer.startsWith("כן") || normalizedAnswer.startsWith("yes")) && hasSuccessPhrase) {
    return true;
  }
  
  // If answer contains success phrase regardless of question (and no failure phrases)
  if (hasSuccessPhrase) {
    return true;
  }
  
  return false;
}

function isUncertainAnswer(answer: string): boolean {
  if (!answer || typeof answer !== "string") {
    return false;
  }
  
  // Normalize the answer - remove extra spaces and convert to lowercase
  const normalizedAnswer = answer.trim().toLowerCase();
  
  // Check for exact matches or partial matches (no duplicates)
  const uncertainPhrases = [
    "לא בטוח",
    "לא בטוחה",
    "לא יודע",
    "לא יודעת",
    "לא יודע לבדוק",
    "לא יודע איך לבדוק",
    "לא יודע לבדוק את",
    "לא יודע איך לבדוק את",
    "לא יודעת לבדוק",
    "לא יודעת איך לבדוק",
    "לא זוכר",
    "לא זוכרת",
    "צריך לבדוק",
    "צריך לבדוק שוב",
    "לא בטוח צריך לבדוק",
    "אין לי מושג",
    "לא ברור לי",
    "לא ברור",
    "לא בדקתי",
    "לא בדקתי עדיין",
    "עדיין לא בדקתי",
    "לא בדק",
    "לא בדקתי את",
    "עדיין לא בדק",
    "לא הצלחתי לבדוק", // Also accept this variant
    "not sure",
    "don't know",
    "dont know",
    "don't know how to check",
    "unsure",
    "i don't know",
    "idk",
    "haven't checked",
    "didn't check",
    "not checked",
    "not checked yet",
  ];
  
  // Check if any phrase is contained in the answer
  // IMPORTANT: We need exact or near-exact matches to avoid false positives
  // For example, "לא" alone should NOT match "לא בטוח" or "לא יודע"
  const matches = uncertainPhrases.some((phrase) => {
    const lowerPhrase = phrase.toLowerCase();
    
    // For exact match (most reliable)
    if (normalizedAnswer === lowerPhrase) {
      return true;
    }
    
    // For partial match, ensure it's not just "לא" matching "לא בטוח"
    // We need at least 2 words or a complete phrase
    if (normalizedAnswer.includes(lowerPhrase)) {
      // If the phrase contains "לא" and the answer is just "לא", don't match
      // unless it's an exact match (already checked above)
      if (lowerPhrase.includes("לא") && normalizedAnswer === "לא") {
        return false;
      }
      return true;
    }
    
    return false;
  });
  
  return matches;
}

/**
 * Instruction scenario definitions
 */
interface InstructionScenario {
  keywords: string[];
  title: string;
  steps: string[];
  question: string;
  options: string[];
  priority: number; // 1 = most critical, 10 = least urgent
  requiresEngineRunning?: boolean; // Whether this check requires starting the engine
}

const INSTRUCTION_SCENARIOS: Record<string, InstructionScenario> = {
  oil: {
    keywords: ['שמן', 'מדיד', 'oil', 'מפלס'],
    title: 'בדיקת מפלס שמן',
    steps: [
      'ודא שהרכב נמצא במישור והמנוע כבוי לפחות 5 דקות.',
      'שלוף את המדיד (טבעת צהובה/כתומה), נגב אותו, הכנס עד הסוף והוצא שוב.',
      'בדוק היכן נמצא השמן ביחס לקווי המינימום והמקסימום.'
    ],
    question: 'מה גובה השמן במדיד?',
    options: ['חסר שמן', 'תקין', 'יש יותר מדי', 'לא יודע לבדוק'],
    priority: 1, // Most critical - oil light is dangerous
    requiresEngineRunning: false
  },
  overheat: {
    keywords: ['חום', 'התחממות', 'קיטור', 'עשן', 'temp', 'קירור', 'coolant', 'נוזל קירור'],
    title: 'בדיקת נוזל קירור (בזהירות!)',
    steps: [
      'אזהרה: אל תפתח את הפקק כשהמנוע חם!',
      'הסתכל על מיכל העיבוי (מיכל פלסטיק שקוף בדרך כלל עם נוזל ורוד/ירוק).',
      'האם המפלס נמצא בין ה-MIN ל-MAX?'
    ],
    question: 'מה מצב נוזל הקירור?',
    options: ['חסר נוזל', 'תקין', 'לא רואה את המיכל'],
    priority: 2, // Critical - engine overheating
    requiresEngineRunning: false
  },
  brakes: {
    keywords: ['בלם', 'ברקס', 'רעש', 'חריקה', 'brakes', 'בלימה'],
    title: 'בדיקת נוזל בלמים',
    steps: [
      'אתר את מיכל נוזל הבלמים (בדרך כלל ליד קיר האש, מיכל קטן עם פקק צהוב/שחור).',
      'הסתכל מבחוץ על גובה הנוזל.',
      '**אזהרה: אם הנוזל נמוך - פנה למוסך מיד! מילוי נוזל בלמים זה דבר מסוכן מאוד ורק מוסך מוסמך יכול לעשות זאת.**'
    ],
    question: 'האם חסר נוזל בלמים?',
    options: ['כן, חסר', 'לא, תקין', 'לא מצאתי', 'לא יודע לבדוק'],
    priority: 3, // Critical - brake failure is dangerous
    requiresEngineRunning: false
  },
  battery: {
    keywords: ['מצבר', 'חשמל', 'אורות', 'האורות', 'אור', 'האור', 'הנעה', 'קליק', 'קליקים', 'start', 'battery', 'בטרייה', 'בטריה', 'נדלקים', 'חלשים', 'קורוזיה', 'קטבים', 'כבלים', 'חיבורים'],
    title: 'בדיקת מצבר וקטבים',
    steps: [
      'פתח את מכסה המנוע בזהירות.',
      'אתר את המצבר (קופסה מלבנית עם כבלים שחור ואדום).',
      'הסתכל על החיבורים (הקטבים) - האם אתה רואה אבקה לבנה/כחולה או קורוזיה?',
      'נסה להזיז ביד (בזהירות!) את הכבלים - האם הם רופפים?'
    ],
    question: 'האם זיהית קורוזיה, לכלוך או חיבור רופף?',
    options: ['כן, יש קורוזיה/רופף', 'לא, הכל נראה נקי וחזק', 'לא יודע לבדוק'],
    priority: 4, // Important - car won't start
    requiresEngineRunning: false
  },
  jumpStart: {
    keywords: ['כבלים', 'jumper', 'jump start', 'הנעה', 'להניע', 'start', 'מצבר', 'battery', 'קליק', 'קליקים', 'רכב אחר', 'מתח', 'voltmeter', 'מד מתח'],
    title: 'הנעת רכב באמצעות כבלים',
    steps: [
      'ודא שיש לך רכב נוסף עם מצבר תקין וכבלי הנעה (אדום ושחור).',
      'החנה את שני הרכבים זה מול זה (לא נוגעים) והנע את הרכב התקין.',
      'כבה את המנוע של הרכב התקין.',
      'חבר את הכבל האדום לקטב החיובי (+) של המצבר המת, ואז לקטב החיובי של המצבר התקין.',
      'חבר את הכבל השחור לקטב השלילי (-) של המצבר התקין, ואז למתכת חשופה ברכב המת (לא למצבר!).',
      'הנע את הרכב התקין והמתן 2-3 דקות.',
      'נסה להניע את הרכב המת. אם זה עובד, אל תכבה את המנוע - נסה לנסוע לפחות 20 דקות כדי לטעון את המצבר.'
    ],
    question: 'האם הצלחת להניע את הרכב עם הכבלים?',
    options: ['כן, הרכב נדלק', 'לא, עדיין לא נדלק', 'לא ניסיתי עדיין', 'לא יודע איך'],
    priority: 4, // Important - car won't start
    requiresEngineRunning: false
  },
  leak: {
    keywords: ['נזילה', 'נזילות', 'leak'],
    title: 'בדיקת נזילת שמן',
    steps: [
      'החנה את הרכב על משטח נקי ויבש (אספלט או בטון)',
      'המתן 10-15 דקות לאחר כיבוי המנוע',
      'בדוק מתחת לרכב - האם יש כתמים כהים/שחורים?',
      'גע בכתם (אם יש) - שמן יהיה שמנוני וצמיגי',
      'בדוק את צבע הכתם: שחור/חום כהה = שמן מנוע, אדום/ורוד = תיבת הילוכים, ירוק/צהוב = קירור'
    ],
    question: 'מה אתה רואה מתחת לרכב?',
    options: ['כתם שחור/חום כהה', 'כתם אדום/ורוד', 'כתם ירוק/צהוב', 'אין כתמים', 'לא בטוח'],
    priority: 5, // Important - oil leak can cause engine damage
    requiresEngineRunning: false
  },
  tires: {
    keywords: ['גלגל', 'צמיג', 'פנצ\'ר', 'אוויר', 'tire', 'wheel', 'לחץ', 'pressure'],
    title: 'בדיקת צמיגים ויזואלית',
    steps: [
      'צא מהרכב והסתכל על ארבעת הגלגלים.',
      'האם אחד מהם נראה "נמוך" או מעוך יותר מהאחרים?',
      'האם אתה שומע רעש של בריחת אוויר (פסיסה)?'
    ],
    question: 'מה מצב הגלגלים?',
    options: ['יש גלגל מפונצ\'ר', 'נראים תקינים', 'לא בטוח'],
    priority: 6, // Medium - tire pressure issue
    requiresEngineRunning: false
  },
  fillTirePressure: {
    keywords: ['מילוי אוויר', 'למלא אוויר', 'תחנת דלק', 'לחץ אוויר', 'fill air', 'tire pressure', 'inflate', 'האם ניסית למלא אוויר', 'האם ניסית למלא', 'ניסית למלא אוויר'],
    title: 'מילוי אוויר בצמיגים',
    steps: [
      'סע לתחנת הדלק הקרובה אליך.',
      'מצא את מכונת מילוי האוויר הדיגיטלית.',
      'בצד הנהג אמורה להיות מדבקה של הכמות שצריך למלא.',
      'מלא כל גלגל בנפרד לפי הוראות היצרן.',
      'הנורה אמורה להיעלם מעצמה לאחר נסיעה קצרה.'
    ],
    question: 'האם הנורה נעלמה לאחר מילוי האוויר?',
    options: ['כן, הנורה נעלמה', 'לא, עדיין דולקת', 'לא ניסיתי עדיין', 'לא יודע איך'],
    priority: 6, // Medium - tire pressure issue
    requiresEngineRunning: false
  },
  fillOil: {
    keywords: ['מילוי שמן', 'למלא שמן', 'הוספת שמן', 'fill oil', 'add oil', 'שמן נמוך', 'מפלס שמן נמוך', 'חסר שמן', 'האם ניסית למלא שמן', 'האם ניסית למלא', 'ניסית למלא שמן'],
    title: 'מילוי שמן מנוע',
    steps: [
      'ודא שהרכב נמצא במישור והמנוע כבוי לפחות 5 דקות.',
      'פתח את מכסה המנוע.',
      'אתר את פתח מילוי השמן (פקק עם אייקון שמן, בדרך כלל בחלק העליון של המנוע).',
      'הסר את הפקק בעדינות.',
      'הוסף שמן מנוע בהדרגה (חצי ליטר בכל פעם) ובדוק את המדיד.',
      'המשך להוסיף עד שהשמן מגיע לקו המקסימום במדיד.',
      'סגור את הפקק היטב והחזר את המדיד למקומו.',
      'הנורה אמורה להיעלם לאחר נסיעה קצרה.'
    ],
    question: 'האם הנורה נעלמה לאחר מילוי השמן?',
    options: ['כן, הנורה נעלמה', 'לא, עדיין דולקת', 'לא ניסיתי עדיין', 'לא יודע איך'],
    priority: 1, // Most critical - oil light is dangerous
    requiresEngineRunning: false
  },
  fillCoolant: {
    keywords: ['מילוי נוזל קירור', 'למלא נוזל קירור', 'נוזל קירור נמוך', 'fill coolant', 'coolant low', 'חסר נוזל קירור', 'נוזל קירור חסר', 'האם ניסית למלא נוזל קירור', 'האם ניסית למלא', 'ניסית למלא נוזל קירור'],
    title: 'מילוי נוזל קירור (בזהירות!)',
    steps: [
      '**אזהרה: אל תפתח את הפקק כשהמנוע חם! המתן לפחות 30 דקות לאחר כיבוי.**',
      'ודא שהמנוע קר לחלוטין.',
      'פתח את מכסה המנוע.',
      'אתר את מיכל העיבוי (מיכל פלסטיק שקוף בדרך כלל עם נוזל ורוד/ירוק).',
      'אם יש פקק על המיכל - פתח אותו בעדינות (רק אם המנוע קר!).',
      'הוסף נוזל קירור עד שהמפלס מגיע לקו MAX.',
      'סגור את הפקק היטב.',
      '**אזהרה: אם הנוזל יורד שוב במהירות - יש נזילה! פנה למוסך מיד!**'
    ],
    question: 'האם הנורה נעלמה לאחר מילוי הנוזל?',
    options: ['כן, הנורה נעלמה', 'לא, עדיין דולקת', 'לא ניסיתי עדיין', 'לא יודע איך'],
    priority: 2, // Critical - engine overheating
    requiresEngineRunning: false
  },
  noise: {
    keywords: ['רעש', 'רעשים', 'noise'],
    title: 'בדיקת רעשים מהמנוע',
    steps: [
      '**אזהרה: אם יש נורת שמן דולקת - אל תניע את המנוע!**',
      '**אם יש נורת שמן - בדוק קודם את מפלס השמן (המנוע חייב להיות כבוי).**',
      'רק אם אין נורת שמן או שהשמן תקין - הנע את המנוע (על משטח ישר ובטוח)',
      'הקשיב לרעשים: נקישה/טפיפה? חריקה? רעם/דפיקה? שריקה?',
      'בדוק מתי הרעש מתרחש: בהתנעה? בנסיעה? בעלייה?'
    ],
    question: 'איזה סוג רעש אתה שומע ומתי?',
    options: ['נקישה/טפיפה', 'חריקה', 'רעם/דפיקה', 'שריקה', 'לא בטוח'],
    priority: 7, // Low - requires engine running
    requiresEngineRunning: true
  },
  vibration: {
    keywords: ['רעידות', 'רעידה', 'vibration'],
    title: 'בדיקת רעידות ברכב',
    steps: [
      'נסה לנסוע במהירות נמוכה (30-40 קמ"ש) על כביש ישר וחלק',
      'שים לב מתי הרעידות מתרחשות: בהאצה? בבלימה? בנסיעה רגילה?',
      'בדוק את הצמיגים: בליטות, נפיחויות, סימני שחיקה לא אחידה, חפצים תקועים',
      'בדוק את הגלגלים: משקולות איזון, נזקים או עיוותים'
    ],
    question: 'מתי אתה מרגיש את הרעידות?',
    options: ['בעת האצה', 'בעת בלימה', 'בזמן נסיעה רגילה', 'בכל המהירויות', 'לא בטוח'],
    priority: 8, // Low - requires driving
    requiresEngineRunning: true
  },
  sparkPlugs: {
    keywords: ['מצת', 'מצתים', 'spark plug', 'spark plugs'],
    title: 'בדיקת מצתים',
    steps: [
      'ודא שהמנוע כבוי וקר לחלוטין (המתן לפחות 30 דקות לאחר כיבוי)',
      'פתח את מכסה המנוע',
      'מצא את סלילי ההצתה (coils) - בדרך כלל 4-6 סלילים מעל המנוע',
      'הסר סליל אחד בעדינות (יש לנתק את החיבור החשמלי תחילה)',
      'הסר את המצת מתחת לסליל (ייתכן שתצטרך מפתח מצתים)',
      'בדוק את המצת: פיח שחור → בעיית בעירה, שמן רטוב → דליפת שמן, סדקים → מצת פגום'
    ],
    question: 'מה אתה רואה על המצת?',
    options: ['פיח שחור', 'שמן רטוב', 'סדקים/נזק', 'נראה תקין', 'לא יודע לבדוק'],
    priority: 9, // Low - complex check
    requiresEngineRunning: false
  }
};

/**
 * Generate instruction message based on question type
 * Returns structured instruction object with title, steps, question, and options
 * If vehicle info is provided and question is about oil/pressure/coolant, fetch specific info from AI
 */
async function generateInstructionMessage(
  question: string, 
  lastAnswer: string,
  vehicle?: { manufacturer?: string; model?: string; year?: string | number },
  client?: OpenAIClient,
  description?: string,
  answers?: UserAnswer[]
): Promise<{ title: string; steps: string[]; question: string; options: string[] } | null> {
  const lowerQuestion = question.toLowerCase();
  const lowerAnswer = lastAnswer.toLowerCase();
  const combinedText = `${lowerQuestion} ${lowerAnswer}`.toLowerCase();

  // Check for critical warning lights
  const criticalLight = description && answers ? 
    checkForCriticalLights(description, answers) : 
    null;

  // Find matching scenario based on keywords
  const candidateScenarios: Array<{ key: string; matches: number; scenario: InstructionScenario }> = [];

  for (const [key, scenario] of Object.entries(INSTRUCTION_SCENARIOS)) {
    const matchCount = scenario.keywords.filter(kw => 
      combinedText.includes(kw.toLowerCase())
    ).length;
    if (matchCount > 0) {
      candidateScenarios.push({ key, matches: matchCount, scenario });
    }
  }

  // If no candidates, return null
  if (candidateScenarios.length === 0) {
    return null;
  }

  // Calculate priority score: priority weight + match count
  // Higher priority (lower number) = higher weight
  // Formula: (11 - priority) * 10 + matchCount * 2
  const calculatePriorityScore = (scenario: InstructionScenario, matchCount: number) => {
    const priorityWeight = (11 - scenario.priority) * 10;
    const matchScore = matchCount * 2;
    return priorityWeight + matchScore;
  };

  // Sort by priority score (highest first)
  candidateScenarios.sort((a, b) => {
    const scoreA = calculatePriorityScore(a.scenario, a.matches);
    const scoreB = calculatePriorityScore(b.scenario, b.matches);
    return scoreB - scoreA;
  });

  let matchedScenario: string | null = null;
  let maxMatches = 0;

  // If we have a critical light, force the matching scenario
  if (criticalLight) {
    const criticalScenario = candidateScenarios.find(s => s.key === criticalLight);
    if (criticalScenario) {
      matchedScenario = criticalLight;
      maxMatches = criticalScenario.matches;
      console.log(`[Questions API] Critical light detected (${criticalLight}) - forcing ${criticalLight} scenario`);
    } else {
      // Critical light detected but no matching scenario - use highest priority
      matchedScenario = candidateScenarios[0].key;
      maxMatches = candidateScenarios[0].matches;
      console.warn(`[Questions API] Critical light (${criticalLight}) detected but no matching scenario, using highest priority: ${matchedScenario}`);
    }
  } else {
    // No critical light - check if any scenario requires engine running
    // If there's a critical light context (from description), avoid engine-running scenarios
    const hasCriticalContext = description && answers ? 
      checkOilContext(description, answers).hasOilLight : false;
    
    if (hasCriticalContext) {
      // Filter out scenarios that require engine running
      const safeScenarios = candidateScenarios.filter(s => !s.scenario.requiresEngineRunning);
      if (safeScenarios.length > 0) {
        matchedScenario = safeScenarios[0].key;
        maxMatches = safeScenarios[0].matches;
        console.log(`[Questions API] Critical context detected - avoiding engine-running scenarios, using: ${matchedScenario}`);
      } else {
        // All scenarios require engine - use highest priority anyway but log warning
        matchedScenario = candidateScenarios[0].key;
        maxMatches = candidateScenarios[0].matches;
        console.warn(`[Questions API] All scenarios require engine running, but critical context detected. Using: ${matchedScenario}`);
      }
    } else {
      // No critical context - use highest priority scenario
      matchedScenario = candidateScenarios[0].key;
      maxMatches = candidateScenarios[0].matches;
    }
  }

  // Log matching attempt for debugging
  console.log("[Questions API] Instruction matching:", {
    question: lowerQuestion.substring(0, 50),
    answer: lowerAnswer.substring(0, 30),
    matchedScenario,
    maxMatches,
    combinedText: combinedText.substring(0, 100),
  });

  // If no match found, return null (will use generic fallback)
  if (!matchedScenario || maxMatches === 0) {
    console.warn("[Questions API] No instruction scenario matched, returning null");
    return null;
  }

  const scenario = INSTRUCTION_SCENARIOS[matchedScenario];
  let steps = [...scenario.steps];
  let followUpQuestion = scenario.question;
  let options = [...scenario.options];

  // If we have a critical light and a scenario that requires engine running was selected, add critical warning
  if (criticalLight && matchedScenario === 'noise' && INSTRUCTION_SCENARIOS[matchedScenario].requiresEngineRunning) {
    // Prepend critical warning to steps
    const lightName = criticalLight === 'oil' ? 'שמן' : criticalLight === 'brakes' ? 'בלם' : criticalLight === 'overheat' ? 'חום מנוע' : 'מצבר';
    steps = [
      `**אזהרה קריטית: יש נורת ${lightName} דולקת - אל תניע את המנוע!**`,
      '**המנוע חייב להיות כבוי עד שהרכב יתוקן.**',
      `**בדוק קודם את ${lightName === 'שמן' ? 'מפלס השמן' : lightName === 'בלם' ? 'נוזל הבלמים' : lightName === 'חום מנוע' ? 'נוזל הקירור' : 'המצבר'} (המנוע כבוי) - זה בטוח יותר.**`,
      ...steps
    ];
    console.warn(`[Questions API] Critical light (${criticalLight}) detected with noise scenario - added critical safety warning`);
  }

  // Handle vehicle-specific enhancements for oil, tire pressure, and coolant
  if (matchedScenario === 'oil' && vehicle && client && vehicle.manufacturer && vehicle.model) {
    try {
      const vehicleInfo = `${vehicle.manufacturer} ${vehicle.model} ${vehicle.year || ""}`.trim();
      const oilPrompt = `מהו סוג השמן המומלץ לרכב ${vehicleInfo}? החזר JSON בלבד: {"oil_type": "סוג השמן (למשל: 5W-30, 10W-40) או 'לא ידוע' אם אין לך מידע"}`;
      
      const response = await client.generateContent(oilPrompt, {
        responseFormat: { type: "json_object" },
        timeout: 30000,
      });
      const extracted = extractJSON(response);
      const oilType = extracted?.oil_type || "";
      
      if (oilType && oilType !== "לא ידוע" && typeof oilType === "string") {
        steps.push(`\nנתוני היצרן של רכבך: ${vehicleInfo}`);
        steps.push(`סוג השמן המומלץ: ${oilType}`);
        steps.push(`מומלץ לבדוק בספר הרכב בתא הכפפות.`);
      } else if (vehicle.manufacturer && vehicle.model) {
        steps.push(`\nנתוני היצרן של רכבך: ${vehicleInfo}`);
        steps.push(`מומלץ לבדוק בספר הרכב בתא הכפפות.`);
      }
    } catch (err) {
      console.warn("[Questions API] Failed to get oil type from AI:", err);
      if (vehicle.manufacturer && vehicle.model) {
        const vehicleInfo = `${vehicle.manufacturer} ${vehicle.model} ${vehicle.year || ""}`.trim();
        steps.push(`\nנתוני היצרן של רכבך: ${vehicleInfo}`);
        steps.push(`מומלץ לבדוק בספר הרכב בתא הכפפות.`);
      }
    }
  }

  if (matchedScenario === 'tires' && vehicle && client && vehicle.manufacturer && vehicle.model) {
    try {
      const vehicleInfo = `${vehicle.manufacturer} ${vehicle.model} ${vehicle.year || ""}`.trim();
      const pressurePrompt = `מהו לחץ האוויר המומלץ בצמיגים לרכב ${vehicleInfo}? החזר JSON בלבד: {"front_psi": "לחץ קדמיים ב-PSI (למשל: 32-35) או 'לא ידוע'", "rear_psi": "לחץ אחוריים ב-PSI (למשל: 32-35) או 'לא ידוע'"}`;
      
      const response = await client.generateContent(pressurePrompt, {
        responseFormat: { type: "json_object" },
        timeout: 30000,
      });
      const extracted = extractJSON(response);
      const frontPsi = extracted?.front_psi || "";
      const rearPsi = extracted?.rear_psi || "";
      
      steps.push(`\nנתוני לחץ אוויר מומלצים ל-${vehicleInfo} (מומלץ לוודא מול המדבקה ברכב):`);
      if (frontPsi && frontPsi !== "לא ידוע" && typeof frontPsi === "string") {
        steps.push(`גלגלים קדמיים: ${frontPsi} PSI`);
      } else {
        steps.push(`גלגלים קדמיים: 32-35 PSI (יש לבדוק במדבקה לדיוק)`);
      }
      if (rearPsi && rearPsi !== "לא ידוע" && typeof rearPsi === "string") {
        steps.push(`גלגלים אחוריים: ${rearPsi} PSI`);
      } else {
        steps.push(`גלגלים אחוריים: 32-35 PSI (יש לבדוק במדבקה לדיוק)`);
      }
    } catch (err) {
      console.warn("[Questions API] Failed to get tire pressure from AI:", err);
      steps.push(`\nנתוני לחץ אוויר מומלצים: 32-35 PSI (יש לבדוק במדבקה ברכב לדיוק)`);
    }
  }

  if (matchedScenario === 'overheat' && vehicle && client && vehicle.manufacturer && vehicle.model) {
    try {
      const vehicleInfo = `${vehicle.manufacturer} ${vehicle.model} ${vehicle.year || ""}`.trim();
      const coolantPrompt = `מהו סוג נוזל הקירור המומלץ לרכב ${vehicleInfo}? החזר JSON בלבד: {"coolant_type": "סוג הנוזל (למשל: נוזל קירור אוניברסלי, נוזל קירור ספציפי) או 'לא ידוע' אם אין לך מידע"}`;
      
      const response = await client.generateContent(coolantPrompt, {
        responseFormat: { type: "json_object" },
        timeout: 30000,
      });
      const extracted = extractJSON(response);
      const coolantType = extracted?.coolant_type || "";
      
      if (coolantType && coolantType !== "לא ידוע" && typeof coolantType === "string") {
        steps.push(`\nנתוני היצרן של רכבך: ${vehicleInfo}`);
        steps.push(`סוג נוזל הקירור המומלץ: ${coolantType}`);
        steps.push(`מומלץ לבדוק בספר הרכב בתא הכפפות.`);
      } else if (vehicle.manufacturer && vehicle.model) {
        steps.push(`\nנתוני היצרן של רכבך: ${vehicleInfo}`);
        steps.push(`מומלץ לבדוק בספר הרכב בתא הכפפות.`);
      }
    } catch (err) {
      console.warn("[Questions API] Failed to get coolant type from AI:", err);
      if (vehicle.manufacturer && vehicle.model) {
        const vehicleInfo = `${vehicle.manufacturer} ${vehicle.model} ${vehicle.year || ""}`.trim();
        steps.push(`\nנתוני היצרן של רכבך: ${vehicleInfo}`);
        steps.push(`מומלץ לבדוק בספר הרכב בתא הכפפות.`);
      }
    }
  }

  return {
    title: scenario.title,
    steps,
    question: followUpQuestion,
    options
  };
}

/**
 * Create fallback question
 */
function createFallbackQuestion() {
  return {
    type: "question",
    question: "מתי התסמין בולט ביותר?",
    options: ["התנעה קרה", "נסיעה בעיר", "נסיעה מהירה", "אחרי עצירה"],
    confidence: 0.3,
  };
}

/**
 * Create fallback diagnosis
 */
function createFallbackDiagnosis() {
  return {
    type: "diagnosis",
    summary: "אבחון ראשוני על בסיס מידע חלקי.",
    results: [
      {
        issue: "בעיה לא מזוהה בבירור",
        probability: 60,
        explanation: "לא ניתן היה לזהות תקלה ספציפית על בסיס המידע הקיים.",
        self_checks: [
          "בדיקת מפלס שמן או נוזל קירור כשהרכב כבוי ועל משטח ישר.",
          "בדיקה אם יש סימני נזילה מתחת לרכב לאחר עמידה.",
        ],
        do_not: ["אם יש רעש חריג או ריח לא רגיל, עצור נסיעה מיידית."],
      },
    ],
    recommendations: [
      "בדיקת מפלס שמן או נוזל קירור כשהרכב כבוי ועל משטח ישר.",
      "בדיקה אם יש סימני נזילה מתחת לרכב לאחר עמידה.",
      "מומלץ לפנות למוסך לבדיקה מקצועית בהקדם.",
    ],
    disclaimer: DIAGNOSIS_DISCLAIMER,
    confidence: 0.6,
  };
}

/**
 * Detect potentially dangerous context (for missing safety_warning)
 */
function isDangerousContext(description: string, answers: UserAnswer[], hasImages: boolean): boolean {
  const lowerDesc = (description || "").toLowerCase();
  const answersText = answers.map((a) => `${a.question} ${a.answer}` || "").join(" ").toLowerCase();
  const combined = `${lowerDesc} ${answersText}`;

  const hasDangerKeyword = DANGER_KEYWORDS.some((kw) => combined.includes(kw));

  // אם יש מילות מפתח מסוכנות – מצב רגיש. לא נסיק מסקנה רק מעצם קיום תמונה.
  return hasDangerKeyword;
}

/**
 * Detect caution context (for missing caution_notice)
 */
function isCautionContext(description: string, answers: UserAnswer[], hasImages: boolean): boolean {
  const lowerDesc = (description || "").toLowerCase();
  const answersText = answers.map((a) => `${a.question} ${a.answer}` || "").join(" ").toLowerCase();
  const combined = `${lowerDesc} ${answersText}`;

  const hasCautionKeyword = CAUTION_KEYWORDS.some((kw) => combined.includes(kw));
  const isDanger = isDangerousContext(description, answers, hasImages);

  // רק אם יש מילת מפתח זהירות אבל לא מסוכן
  return hasCautionKeyword && !isDanger;
}

/**
 * Check for critical warning lights in the context
 * Returns the type of critical light detected, or null if none
 */
function checkForCriticalLights(description: string, answers: UserAnswer[]): 'oil' | 'brakes' | 'overheat' | 'battery' | null {
  const lowerDesc = (description || "").toLowerCase();
  const answersText = answers.map((a) => `${a.question} ${a.answer}` || "").join(" ").toLowerCase();
  const combined = `${lowerDesc} ${answersText}`;

  // Check for oil light (highest priority)
  if (combined.includes("נורת שמן") || combined.includes("נורה אדומה של שמן") || 
      (combined.includes("שמן") && combined.includes("נורה"))) {
    return 'oil';
  }

  // Check for brake light
  if (combined.includes("נורת בלם") || combined.includes("נורת בלימה") || 
      combined.includes("נורת בלמים") || (combined.includes("בלם") && combined.includes("נורה"))) {
    return 'brakes';
  }

  // Check for overheating
  if (combined.includes("נורת טמפרטורה") || combined.includes("חום מנוע") || 
      combined.includes("התחממות") || (combined.includes("חום") && combined.includes("נורה"))) {
    return 'overheat';
  }

  // Check for battery light
  if (combined.includes("נורת מצבר") || combined.includes("נורת בטרייה") || 
      (combined.includes("מצבר") && combined.includes("נורה"))) {
    return 'battery';
  }

  return null;
}

/**
 * Helper function to check oil-related context (reused to avoid duplication)
 */
function checkOilContext(description: string, answers: UserAnswer[]) {
  const lowerDesc = (description || "").toLowerCase();
  const answersText = answers.map((a) => `${a.question} ${a.answer}` || "").join(" ").toLowerCase();
  const combined = `${lowerDesc} ${answersText}`;

  const hasOilLight = combined.includes("נורת שמן") || combined.includes("שמן") || combined.includes("oil");
  const hasAskedAboutOilLevel = answers.some((a) => {
    const q = (a.question || "").toLowerCase();
    return q.includes("מפלס") || q.includes("שמן") || q.includes("oil level");
  });
  const hasLowOil = combined.includes("שמן נמוך") || combined.includes("מפלס נמוך") || combined.includes("low oil") || 
                    combined.includes("שמן נראה נמוך") || combined.includes("השמן נראה נמוך") ||
                    combined.includes("שמן נמוך מאוד") || combined.includes("מפלס נמוך מאוד");
  const hasEngineNoise = combined.includes("רעש") || combined.includes("רעשים") || combined.includes("noise") ||
                         combined.includes("ברזלים") || combined.includes("מטאלי");

  return { hasOilLight, hasAskedAboutOilLevel, hasLowOil, hasEngineNoise, combined };
}

/**
 * Helper function to check if user hasn't checked something (reused to avoid duplication)
 */
function hasNotCheckedAnswer(answer: string): boolean {
  if (!answer || typeof answer !== "string") {
    return false;
  }
  const lowerAnswer = answer.toLowerCase();
  return lowerAnswer.includes("לא בדקתי") || 
         lowerAnswer.includes("לא בדק") || 
         lowerAnswer.includes("עדיין לא") ||
         lowerAnswer.includes("not checked") ||
         lowerAnswer.includes("haven't checked") ||
         lowerAnswer.includes("didn't check");
}

/**
 * Detect clear cases where we have enough information for diagnosis
 * Returns true if we should trigger diagnosis even without high confidence
 * 
 * IMPORTANT: For oil-related cases, we need to verify the current oil level
 * before diagnosing, not just rely on "last checked a month ago"
 */
function isClearCaseForDiagnosis(description: string, answers: UserAnswer[]): boolean {
  if (answers.length < 2) return false;

  const { hasOilLight, hasAskedAboutOilLevel, hasLowOil, hasEngineNoise } = checkOilContext(description, answers);

  // For oil light cases: Only consider it a clear case if:
  // 1. We have oil light + explicitly stated low oil + engine noise, OR
  // 2. We have oil light + we asked about oil level + got low oil answer + engine noise
  // BUT NOT if we only know "last checked a month ago" - that's not enough, need current level
  
  if (hasOilLight) {
    // If we have explicit low oil statement, it's a clear case
    if (hasLowOil && hasEngineNoise) {
      return true;
    }
    
    // If we asked about oil level and got a low oil answer, it's a clear case
    if (hasAskedAboutOilLevel && hasLowOil && hasEngineNoise) {
      return true;
    }
    
    // Don't treat "last checked a month ago" as a clear case - need to ask about current level first
    return false;
  }

  return false;
}

/**
 * Build diagnosis from context when AI content filter is triggered
 * This is a fallback that tries to identify the issue from available information
 */
function buildDiagnosisFromContext(description: string, answers: UserAnswer[]): any | null {
  const { hasOilLight, hasLowOil, hasEngineNoise, combined } = checkOilContext(description, answers);
  
  // If we have oil light + low oil + engine noise, it's likely an oil-related issue
  if (hasOilLight && hasLowOil && hasEngineNoise) {
    return {
      type: "diagnosis",
      summary: "נראה שמדובר בבעיית שמן מנוע - נורת שמן דולקת, מפלס שמן נמוך, ורעשים מהמנוע.",
      results: [
        {
          issue: "מחסור בשמן מנוע או נזילת שמן",
          probability: 85,
          explanation: "נורת שמן דולקת יחד עם מפלס שמן נמוך ורעשים מהמנוע מצביעים על מחסור בשמן מנוע או נזילת שמן. זה יכול לגרום לנזק חמור למנוע אם לא מטופל.",
          self_checks: [
            "בדיקת מפלס שמן כשהרכב כבוי ועל משטח ישר",
            "בדיקה אם יש נזילת שמן מתחת לרכב",
            "בדיקה ויזואלית של מפלס השמן במדיד",
          ],
          do_not: [
            "אל תמשיך לנסוע אם מפלס השמן נמוך מאוד - זה יכול לגרום לנזק חמור למנוע",
            "אם יש רעש חזק מהמנוע, עצור נסיעה מיידית",
          ],
        },
      ],
      recommendations: [
        "בדיקת מפלס שמן כשהרכב כבוי ועל משטח ישר",
        "אם מפלס השמן נמוך, הוסף שמן בהתאם לסוג המומלץ לרכב",
        "אם יש נזילה, פנה למוסך לבדיקה ותיקון",
        "מומלץ לפנות למוסך לבדיקה מקצועית בהקדם",
      ],
      disclaimer: DIAGNOSIS_DISCLAIMER,
      confidence: 0.85,
    };
  }
  
  // If we have oil light but not enough info, return null to use fallback
  return null;
}

/**
 * Generate final diagnosis
 */
async function generateFinalDiagnosis(
  description: string,
  answers: UserAnswer[],
  imageParts: Array<{ inlineData: { data: string; mimeType: string } }>,
  client: OpenAIClient
): Promise<any> {
  const diagnosisPrompt = buildDiagnosisPrompt(description, answers, imageParts.length > 0);

  try {
    const raw = await client.generateContent(diagnosisPrompt, {
      images: imageParts,
      responseFormat: { type: "json_object" },
      timeout: 60000,
      retries: {
        maxRetries: 1,
        backoffMs: [2000],
      },
    });
    const extracted = extractJSON(raw);

    if (extracted && extracted.type === "diagnosis" && Array.isArray(extracted.results) && extracted.results.length > 0) {
      return buildDiagnosisResponse(extracted);
    }
  } catch (err: any) {
    console.error("[Questions API] Failed to generate final diagnosis:", err);
    
    // If it's a content filter refusal, try to build a diagnosis from available context
    if (err?.message?.includes("content filter refusal")) {
      console.warn("[Questions API] Content filter triggered, attempting to build diagnosis from context");
      // Try to build a basic diagnosis from the available information
      const contextDiagnosis = buildDiagnosisFromContext(description, answers);
      if (contextDiagnosis) {
        return contextDiagnosis;
      }
    }
  }

  return createFallbackDiagnosis();
}

/**
 * Main POST handler
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      description,
      answers = [],
      image_urls = [],
      vehicle,
    } = body as RequestBody;

    // Validate required fields
    if (!description?.trim()) {
      return NextResponse.json(createFallbackQuestion(), { status: 200 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[Questions API] Missing OPENAI_API_KEY");
      return NextResponse.json(createFallbackQuestion(), { status: 200 });
    }

    const client = createOpenAIClient(apiKey, "gpt-4o", {
      responseFormat: { type: "json_object" },
    });

    // Process images
    const imageUrls = Array.isArray(image_urls)
      ? image_urls.filter((u) => typeof u === "string" && u.trim()).slice(0, 3)
      : [];
    const imageParts = await fetchImages(imageUrls);
    // hasImages should be true if we have image URLs, even if they failed to load
    // This ensures the prompt includes image instructions
    const hasImages = imageUrls.length > 0;
    
    // Log image status for debugging
    if (imageUrls.length > 0 && imageParts.length === 0) {
      console.warn(`[Questions API] ${imageUrls.length} image URL(s) provided but none loaded successfully. Will still include image instructions in prompt.`);
    }

    const answersCount = Array.isArray(answers) ? answers.length : 0;

    // If max questions reached, force diagnosis
    if (answersCount >= MAX_QUESTIONS) {
      const diagnosis = await generateFinalDiagnosis(description, answers, imageParts, client);
      return NextResponse.json(diagnosis);
    }

    // Check if last answer indicates success (problem solved) - this should stop the conversation
    if (answersCount > 0) {
      const lastAnswer = answers[answers.length - 1];
      const isSuccess = isSuccessAnswer(lastAnswer.answer, lastAnswer.question);
      
      if (isSuccess) {
        console.log("[Questions API] Detected success answer - problem solved, returning final diagnosis:", {
          answer: lastAnswer.answer,
          question: lastAnswer.question,
        });
        
        // Return a success diagnosis in the format expected by the frontend
        // The frontend parseDiagnosis function expects data.type === "diagnosis" && data.diagnosis
        const successDiagnosis = {
          type: "diagnosis",
          diagnosis: {
            diagnosis: ["הבעיה נפתרה בהצלחה!"],
            self_checks: [],
            warnings: [],
            disclaimer: "הבעיה נפתרה בהצלחה. אם הבעיה תחזור, מומלץ לפנות למוסך לבדיקה מקצועית.",
            safety_notice: null,
            recommendations: ["אם הבעיה תחזור, מומלץ לפנות למוסך לבדיקה מקצועית."],
          },
        };
        
        return NextResponse.json(successDiagnosis);
      }
    }
    
    // Check if last answer indicates uncertainty OR if "no" answer should trigger instructions
    // IMPORTANT: Don't count "uncertain" answers - remove them from answers array before processing
    if (answersCount > 0) {
      const lastAnswer = answers[answers.length - 1];
      const isUncertain = isUncertainAnswer(lastAnswer.answer);
      const shouldTriggerForNo = shouldTriggerInstructionsForNo(lastAnswer.question, lastAnswer.answer);
      
      // Log for debugging
      console.log("[Questions API] Checking for uncertain answer or instruction trigger:", {
        answer: lastAnswer.answer,
        question: lastAnswer.question,
        isUncertain,
        shouldTriggerForNo,
        answersCount,
      });
      
      if (isUncertain || shouldTriggerForNo) {
        // Check if question requires vehicle-specific info (oil, pressure, coolant)
        const lowerQuestion = (lastAnswer.question || "").toLowerCase();
        const needsVehicleInfo = 
          lowerQuestion.includes("מפלס") || 
          lowerQuestion.includes("שמן") || 
          lowerQuestion.includes("oil level") ||
          lowerQuestion.includes("לחץ") || 
          lowerQuestion.includes("אוויר") || 
          lowerQuestion.includes("צמיג") ||
          lowerQuestion.includes("pressure") ||
          lowerQuestion.includes("קירור") ||
          lowerQuestion.includes("coolant") ||
          lowerQuestion.includes("נוזל קירור");
        
        // Only use vehicle info if question is relevant and vehicle is provided
        const vehicleForInstruction = needsVehicleInfo && body.vehicle ? body.vehicle : undefined;
        
        const instructionMessage = await generateInstructionMessage(
          lastAnswer.question, 
          lastAnswer.answer,
          vehicleForInstruction,
          vehicleForInstruction ? client : undefined,
          description,
          answers
        );
        
        console.log("[Questions API] Generated instruction message:", {
          hasInstruction: !!instructionMessage,
          question: lastAnswer.question,
          needsVehicleInfo,
          hasVehicle: !!vehicleForInstruction,
        });
        
        if (instructionMessage) {
          console.log("[Questions API] Returning instruction response", {
            title: instructionMessage.title,
            stepsCount: instructionMessage.steps.length,
            question: instructionMessage.question,
            optionsCount: instructionMessage.options.length,
          });
          
          // Build instruction text from title and steps for frontend compatibility
          const instructionText = `${instructionMessage.title}\n\n${instructionMessage.steps.join('\n')}`;
          
          // Return structured instruction message
          // Note: The frontend will remove this answer from state, so it won't be counted
          return NextResponse.json({
            type: "instruction",
            instruction: instructionText, // For frontend compatibility (InstructionBubble expects string)
            title: instructionMessage.title,
            steps: instructionMessage.steps,
            question: instructionMessage.question,
            options: instructionMessage.options,
            confidence: 0.5,
          });
        }
      }
    }

    // Build prompt for next question
    const prompt = buildChatPrompt(description, answers, hasImages, answersCount);

    let raw = "";
    try {
      raw = await client.generateContent(prompt, {
        images: imageParts,
        responseFormat: { type: "json_object" },
        timeout: 60000,
        retries: {
          maxRetries: 2,
          backoffMs: [2000, 3000],
        },
      });
    } catch (openaiError: any) {
      console.error("[Questions API] OpenAI error:", openaiError?.message);
      return NextResponse.json(createFallbackQuestion(), { status: 200 });
    }

    let extracted = extractJSON(raw);

    if (!extracted || typeof extracted !== "object") {
      console.error("[Questions API] JSON extraction failed, using fallback");
      return NextResponse.json(createFallbackQuestion(), { status: 200 });
    }

    // Handle text_input type - convert to question with empty options for frontend compatibility
    const isTextInputType = extracted.type === "text_input";
    
    // If we have images and AI returned text_input asking "what do you see", reject it
    if (isTextInputType && hasImages) {
      const questionText = (extracted.question || "").toLowerCase();
      const forbiddenPhrases = ["מה אתה רואה", "מה אתה רואה כשאתה", "תאר", "describe", "what do you see"];
      const isForbiddenQuestion = forbiddenPhrases.some(phrase => questionText.includes(phrase));
      
      if (isForbiddenQuestion) {
        console.warn("[Questions API] AI returned forbidden 'what do you see' question with images. Requesting new question.");
        // Request a new question that identifies the light directly
        try {
          const retryPrompt = buildChatPrompt(description, answers, hasImages, answersCount) + "\n\n**תזכורת חשובה: יש לך תמונה של נורה - זהה אותה ישירות! אל תשאל 'מה אתה רואה' - זה אסור!**";
          const retryRaw = await client.generateContent(retryPrompt, {
            images: imageParts,
            responseFormat: { type: "json_object" },
            timeout: 60000,
            retries: {
              maxRetries: 1,
              backoffMs: [2000],
            },
          });
          const retryExtracted = extractJSON(retryRaw);
          if (retryExtracted && (retryExtracted.type === "question" || retryExtracted.type === "text_input")) {
            extracted = retryExtracted;
            console.log("[Questions API] Retry successful - got new question");
          }
        } catch (retryError) {
          console.error("[Questions API] Retry failed:", retryError);
          // Continue with original response but convert to question
        }
      }
    }
    
    if (isTextInputType) {
      extracted.type = "question";
      extracted.options = [];
    }
    
    // Track if this is a text input (for later option normalization)
    let isTextInput = isTextInputType;

    // Check if this question was already asked (prevent duplicates)
    if (extracted.type === "question" && extracted.question) {
      const newQuestion = extracted.question.trim().toLowerCase();
      const alreadyAsked = answers.some((a) => {
        const prevQuestion = (a.question || "").trim().toLowerCase();
        // Check for exact match or very similar questions
        if (prevQuestion === newQuestion) {
          return true;
        }
        // Check for similar questions about the same topic (e.g., "האם ניסית להניע עם כבלים" vs "האם ניסית להניע את הרכב באמצעות כבלים")
        const keyPhrases = [
          "האם ניסית להניע",
          "האם ניסית להניע את הרכב",
          "האם ניסית להניע באמצעות כבלים",
          "האם ניסית להניע את הרכב באמצעות כבלים",
          "האם ניסית להניע עם כבלים",
          "האם ניסית להניע את הרכב עם כבלים",
        ];
        const newQuestionHasKeyPhrase = keyPhrases.some(phrase => newQuestion.includes(phrase));
        const prevQuestionHasKeyPhrase = keyPhrases.some(phrase => prevQuestion.includes(phrase));
        if (newQuestionHasKeyPhrase && prevQuestionHasKeyPhrase) {
          return true; // Both questions are about jump-starting
        }
        return false;
      });
      
      if (alreadyAsked) {
        console.warn("[Questions API] Detected duplicate question, requesting new question:", {
          duplicateQuestion: extracted.question,
          previousQuestions: answers.map(a => a.question),
        });
        
        // Request a new question with explicit reminder
        try {
          const retryPrompt = buildChatPrompt(description, answers, hasImages, answersCount) + 
            "\n\n**תזכורת קריטית: השאלה הזו כבר נשאלה! אל תחזור על אותה שאלה! המשך לשאלה אחרת או לאבחון.**";
          const retryRaw = await client.generateContent(retryPrompt, {
            images: imageParts,
            responseFormat: { type: "json_object" },
            timeout: 60000,
            retries: {
              maxRetries: 1,
              backoffMs: [2000],
            },
          });
          const retryExtracted = extractJSON(retryRaw);
          if (retryExtracted && (retryExtracted.type === "question" || retryExtracted.type === "text_input")) {
            // Check again if the new question is also a duplicate
            const retryQuestion = (retryExtracted.question || "").trim().toLowerCase();
            const isStillDuplicate = answers.some((a) => {
              const prevQuestion = (a.question || "").trim().toLowerCase();
              if (prevQuestion === retryQuestion) return true;
              // Check for similar jump-start questions
              const keyPhrases = [
                "האם ניסית להניע",
                "האם ניסית להניע את הרכב",
                "האם ניסית להניע באמצעות כבלים",
                "האם ניסית להניע את הרכב באמצעות כבלים",
                "האם ניסית להניע עם כבלים",
                "האם ניסית להניע את הרכב עם כבלים",
              ];
              const retryHasKeyPhrase = keyPhrases.some(phrase => retryQuestion.includes(phrase));
              const prevHasKeyPhrase = keyPhrases.some(phrase => prevQuestion.includes(phrase));
              return retryHasKeyPhrase && prevHasKeyPhrase;
            });
            
            if (!isStillDuplicate) {
              extracted = retryExtracted;
              console.log("[Questions API] Retry successful - got new non-duplicate question");
            } else {
              console.warn("[Questions API] Retry question is also duplicate, using fallback");
              return NextResponse.json(createFallbackQuestion(), { status: 200 });
            }
          } else {
            console.warn("[Questions API] Retry failed to get valid question, using fallback");
            return NextResponse.json(createFallbackQuestion(), { status: 200 });
          }
        } catch (retryError) {
          console.error("[Questions API] Retry failed:", retryError);
          return NextResponse.json(createFallbackQuestion(), { status: 200 });
        }
      }
    }

    // Log what we extracted for debugging
    console.log("[Questions API] Extracted response:", {
      type: extracted.type,
      hasQuestion: !!extracted.question,
      hasOptions: Array.isArray(extracted.options),
      hasResults: Array.isArray(extracted.results),
      resultsLength: Array.isArray(extracted.results) ? extracted.results.length : 0,
      confidence: extracted.confidence,
      answersCount,
    });

    // Check if AI returned diagnosis directly
    if (extracted.type === "diagnosis") {
      // Check if last answer indicates user hasn't checked something - if so, don't accept diagnosis
      const lastAnswer = answers.length > 0 ? answers[answers.length - 1] : null;
      const lastAnswerText = lastAnswer?.answer || "";
      const hasNotChecked = hasNotCheckedAnswer(lastAnswerText);
      
      // Check for clear cases - allow earlier diagnosis
      const isClearCase = isClearCaseForDiagnosis(description, answers);
      const aiConfidence = typeof extracted?.confidence === "number" && extracted.confidence >= 0 && extracted.confidence <= 1
        ? extracted.confidence
        : 0.5;
      
      // If AI has high confidence (>= 0.9), respect its decision even with fewer answers
      // OR if it's a clear case, allow with minimum answers
      const minAnswersRequired = isClearCase ? MIN_ANSWERS_FOR_CLEAR_CASE : MIN_ANSWERS_FOR_EARLY_DIAGNOSIS;
      const hasHighConfidence = aiConfidence >= CONFIDENCE_THRESHOLD;
      
      // For oil light cases: Check if we asked about current oil level
      const { hasOilLight, hasAskedAboutOilLevel } = checkOilContext(description, answers);
      const shouldWaitForOilLevel = hasOilLight && !hasAskedAboutOilLevel && answersCount < 3;
      
      // Don't accept diagnosis if user said they haven't checked something
      // This indicates lack of information, so we should continue asking questions or provide instructions
      if (hasNotChecked) {
        console.warn("[Questions API] User said they haven't checked something, rejecting early diagnosis and requesting new question");
        // Force a new question instead of accepting diagnosis
        extracted = {}; // Force using fallback question below
      } else {
        // Allow diagnosis if:
        // 1. We have minimum required answers (normal flow)
        // 2. AI has high confidence (>= 0.9) and at least 2 answers (AI is confident) - BUT not if we need to ask about oil level
        // 3. It's a clear case with at least 2 answers
        const shouldAcceptDiagnosis = 
          (answersCount >= minAnswersRequired && !shouldWaitForOilLevel) || 
          (hasHighConfidence && answersCount >= 2 && !shouldWaitForOilLevel) ||
          (isClearCase && answersCount >= 2);
        
        if (shouldAcceptDiagnosis) {
        // Check if the diagnosis response has results - if not, it might be incomplete
        // In that case, call generateFinalDiagnosis to get a complete diagnosis
        const hasResults = Array.isArray(extracted.results) && extracted.results.length > 0;
        
        if (hasResults) {
          // AI returned complete diagnosis with results
          const diagnosisResponse = buildDiagnosisResponse(extracted);
          // Double-check that we got valid results (not fallback)
          if (diagnosisResponse.results && diagnosisResponse.results.length > 0) {
            return NextResponse.json(diagnosisResponse);
          } else {
            // Diagnosis was incomplete or invalid, generate a proper one
            console.warn("[Questions API] AI returned incomplete diagnosis, generating proper diagnosis");
            const diagnosis = await generateFinalDiagnosis(description, answers, imageParts, client);
            return NextResponse.json(diagnosis);
          }
        } else {
          // AI returned diagnosis type but without results - generate proper diagnosis
          console.warn("[Questions API] AI returned diagnosis type but without results (confidence=" + aiConfidence + "), generating proper diagnosis");
          const diagnosis = await generateFinalDiagnosis(description, answers, imageParts, client);
          return NextResponse.json(diagnosis);
        }
      } else {
        // Too early for final diagnosis – keep asking questions
        console.warn(
          "[Questions API] Model returned diagnosis too early (answersCount=" +
            answersCount +
            ", minRequired=" + minAnswersRequired +
            ", confidence=" + aiConfidence +
            ", isClearCase=" + isClearCase +
            "), requesting new question from AI."
        );
        // The AI returned diagnosis but we need more info - request a new question
        // We'll rebuild the prompt and ask for a question instead
        try {
          const questionPrompt = buildChatPrompt(description, answers, hasImages, answersCount);
          const questionRaw = await client.generateContent(questionPrompt, {
            images: imageParts,
            responseFormat: { type: "json_object" },
            timeout: 60000,
            retries: {
              maxRetries: 2,
              backoffMs: [2000, 3000],
            },
          });
          const questionExtracted = extractJSON(questionRaw);
          
          if (questionExtracted && typeof questionExtracted === "object" && (questionExtracted.type === "question" || questionExtracted.type === "text_input")) {
            // Use the new question response
            // Handle text_input type conversion
            const wasTextInput = questionExtracted.type === "text_input";
            if (wasTextInput) {
              questionExtracted.type = "question";
              questionExtracted.options = [];
              isTextInput = true; // Update flag for retry case
            }
            extracted = questionExtracted;
          } else {
            // If AI still returns diagnosis or invalid response, use fallback
            console.warn("[Questions API] AI still returned diagnosis after retry, using fallback question");
            extracted = {}; // Force using fallback question below
          }
        } catch (retryError) {
          console.error("[Questions API] Error requesting new question after early diagnosis:", retryError);
          extracted = {}; // Force using fallback question below
        }
      }
      }
    }

    // Check confidence level - if >= 90%, trigger early diagnosis (after minimum answers)
    // Extract confidence for use later (both in diagnosis check and response payload)
    const confidence = typeof extracted?.confidence === "number" && extracted.confidence >= 0 && extracted.confidence <= 1
      ? extracted.confidence
      : 0.5;
    
    // Only check confidence-based diagnosis if we didn't already handle diagnosis above (when extracted.type === "diagnosis")
    if (extracted.type !== "diagnosis") {

      // Check for clear cases where we have enough info for diagnosis (even with lower confidence)
      const isClearCaseForConfidence = isClearCaseForDiagnosis(description, answers);
      // For clear cases, allow diagnosis with fewer answers (2 instead of 3)
      const minAnswersRequiredForConfidence = isClearCaseForConfidence ? MIN_ANSWERS_FOR_CLEAR_CASE : MIN_ANSWERS_FOR_EARLY_DIAGNOSIS;
      
      // For oil light cases: Check if we asked about current oil level
      const { hasOilLight: hasOilLightForConfidence, hasAskedAboutOilLevel: hasAskedAboutOilLevelForConfidence } = checkOilContext(description, answers);
      const shouldWaitForOilLevelForConfidence = hasOilLightForConfidence && !hasAskedAboutOilLevelForConfidence && answersCount < 3;
      
      // Check if last answer indicates user hasn't checked something - if so, don't return diagnosis
      const lastAnswerForConfidence = answers.length > 0 ? answers[answers.length - 1] : null;
      const lastAnswerTextForConfidence = lastAnswerForConfidence?.answer || "";
      const hasNotCheckedForConfidence = hasNotCheckedAnswer(lastAnswerTextForConfidence);
      
      // Don't return diagnosis if:
      // 1. User said they haven't checked something (indicates lack of information)
      // 2. We don't have enough concrete answers
      // 3. We should wait for oil level check
      const shouldNotDiagnoseForConfidence = hasNotCheckedForConfidence || shouldWaitForOilLevelForConfidence;
      
      if ((confidence >= CONFIDENCE_THRESHOLD || isClearCaseForConfidence) && 
          answersCount >= minAnswersRequiredForConfidence && 
          !shouldNotDiagnoseForConfidence) {
        // AI is confident enough OR we have a clear case, generate diagnosis
        const diagnosis = await generateFinalDiagnosis(description, answers, imageParts, client);
        return NextResponse.json(diagnosis);
      }
    }

    // Return question
    const questionText =
      typeof extracted?.question === "string" && extracted.question.trim()
        ? extracted.question.trim()
        : "מה התסמין הבולט ביותר?";

    // Type-safe option extraction - only process options if not a text input
    const options = isTextInput
      ? []
      : Array.isArray(extracted?.options)
        ? extracted.options.filter((o: any) => typeof o === "string" && o.trim())
        : [];

    // Filter options to be relevant to the question (prevent answer leakage)
    const lowerQuestion = questionText.toLowerCase();
    const filteredOptions = isTextInput ? [] : options.filter((opt: string) => {
      const lowerOpt = opt.toLowerCase();
      // For oil level questions, filter out unrelated options like "רעשים"
      if (lowerQuestion.includes("מפלס") || lowerQuestion.includes("שמן") || lowerQuestion.includes("oil level")) {
        // Only allow options related to oil level
        return lowerOpt.includes("תקין") || lowerOpt.includes("נמוך") || lowerOpt.includes("גבוה") || 
               lowerOpt.includes("לא") || lowerOpt.includes("בדק") || lowerOpt.includes("שמן") || 
               lowerOpt.includes("מפלס") || lowerOpt.includes("oil");
      }
      // For noise questions, filter out unrelated options
      if (lowerQuestion.includes("רעש") || lowerQuestion.includes("רעשים") || lowerQuestion.includes("noise")) {
        return lowerOpt.includes("רעש") || lowerOpt.includes("יש") || lowerOpt.includes("אין") || 
               lowerOpt.includes("לא") || lowerOpt.includes("noise");
      }
      // For leak questions, filter out unrelated options
      if (lowerQuestion.includes("נזילה") || lowerQuestion.includes("נזילות") || lowerQuestion.includes("leak")) {
        return lowerOpt.includes("נזילה") || lowerOpt.includes("יש") || lowerOpt.includes("אין") || 
               lowerOpt.includes("לא") || lowerOpt.includes("leak");
      }
      // For pressure questions, filter out unrelated options
      if (lowerQuestion.includes("לחץ") || lowerQuestion.includes("אוויר") || lowerQuestion.includes("צמיג") || lowerQuestion.includes("pressure") || lowerQuestion.includes("נורה נעלמה")) {
        return lowerOpt.includes("נורה") || lowerOpt.includes("נעלמה") || lowerOpt.includes("דולקת") || 
               lowerOpt.includes("לחץ") || lowerOpt.includes("אוויר") || lowerOpt.includes("תקין") || 
               lowerOpt.includes("נמוך") || lowerOpt.includes("לא") || lowerOpt.includes("pressure");
      }
      // For other questions, allow all options (no filtering)
      return true;
    });

    // Ensure 3-5 options (use filtered options if available, otherwise fallback)
    // For text_input type, keep options empty
    const normalizedOptions = isTextInput
      ? []
      : filteredOptions.length >= 3 && filteredOptions.length <= 5
        ? filteredOptions.slice(0, 5)
        : filteredOptions.length > 5
          ? filteredOptions.slice(0, 5)
          : filteredOptions.length > 0
            ? filteredOptions // Use filtered even if less than 3
            : options.length >= 3 && options.length <= 5
              ? options.slice(0, 5)
              : options.length > 5
                ? options.slice(0, 5)
                : ["התנעה קרה", "נסיעה בעיר", "נסיעה מהירה"];

    const responsePayload: any = {
      type: "question",
      question: questionText,
      options: normalizedOptions,
      confidence,
    };

    // Add safety warning אם המודל החזיר אחת (בדרך כלל בשאלה הראשונה בלבד)
    if (typeof extracted?.safety_warning === "string" && extracted.safety_warning.trim()) {
      responsePayload.safety_warning = extracted.safety_warning.trim();
    } else if (answers.length === 0 && isDangerousContext(description, answers, hasImages)) {
      // Safety net: בשאלה הראשונה בלבד, אם מתיאור המשתמש ברור שמדובר בנורה אדומה קריטית
      // (שמן, מנוע, בלם, חום מנוע, מצבר, כריות אוויר), נוסיף אזהרה ברירת מחדל.
      responsePayload.safety_warning =
        "אם אתה נוסע כרגע, עדיף לעצור את הרכב בצד בבטחה ולא להמשיך בנסיעה עד שנבין מה הבעיה.";
    }

    // Add caution notice אם המודל החזיר אחת (בדרך כלל בשאלה הראשונה בלבד)
    if (typeof extracted?.caution_notice === "string" && extracted.caution_notice.trim()) {
      responsePayload.caution_notice = extracted.caution_notice.trim();
    } else if (answers.length === 0 && isCautionContext(description, answers, hasImages)) {
      // Safety net: בשאלה הראשונה בלבד, אם מתיאור המשתמש ברור שמדובר בנורה כתומה
      // (Check Engine, ABS, בקרת יציבות, לחץ אוויר), נוסיף הודעת זהירות ברירת מחדל.
      responsePayload.caution_notice =
        "מומלץ להמשיך בנסיעה בזהירות, להימנע מנהיגה מהירה או אגרסיבית, ולפנות למוסך לבדיקה בהקדם.";
    }

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("[Questions API] Error:", error);
    // Always return 200 with valid JSON - never break the frontend flow
    const body = await req.json().catch(() => ({}));
    const answersCount = Array.isArray(body.answers) ? body.answers.length : 0;
    
    if (answersCount >= MAX_QUESTIONS) {
      return NextResponse.json(createFallbackDiagnosis(), { status: 200 });
    }
    return NextResponse.json(createFallbackQuestion(), { status: 200 });
  }
}
