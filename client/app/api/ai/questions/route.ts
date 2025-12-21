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
 * Check if answer indicates uncertainty ("לא בטוח", "לא יודע", etc.)
 */
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
    "לא זוכר",
    "לא זוכרת",
    "צריך לבדוק",
    "צריך לבדוק שוב",
    "לא בטוח צריך לבדוק",
    "אין לי מושג",
    "לא ברור לי",
    "לא ברור",
    "not sure",
    "don't know",
    "dont know",
    "unsure",
    "i don't know",
    "idk",
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
 * Generate instruction message based on question type
 * If vehicle info is provided and question is about oil/pressure/coolant, fetch specific info from AI
 */
async function generateInstructionMessage(
  question: string, 
  lastAnswer: string,
  vehicle?: { manufacturer?: string; model?: string; year?: string | number },
  client?: OpenAIClient
): Promise<string | null> {
  const lowerQuestion = question.toLowerCase();
  const lowerAnswer = lastAnswer.toLowerCase();

  // Oil level check instructions
  if (lowerQuestion.includes("מפלס") || lowerQuestion.includes("שמן") || lowerQuestion.includes("oil level")) {
    let baseInstructions = `אין בעיה! בואו נבדוק את מפלס השמן יחד:

1. כבה את המנוע והמתן 2-3 דקות כדי שהשמן ירד למקומו
2. פתח את מכסה המנוע (מצוי בדרך כלל בחזית הרכב)
3. מצא את מקל הבדיקה (stick) - זה מוט צהוב/כתום עם טבעת או ידית
4. שלוף את המקל - משוך אותו החוצה בעדינות
5. נקה את המקל עם מטלית או נייר
6. הכנס שוב את המקל עד הסוף
7. שלוף שוב והסתכל על הסימן - השמן צריך להיות בין שתי נקודות/קווים (MIN ו-MAX)

מה אתה רואה?
• השמן בין MIN ל-MAX? → המפלס תקין
• השמן מתחת ל-MIN? → המפלס נמוך
• השמן מעל ל-MAX? → המפלס גבוה מדי`;

    // If vehicle info is available, get specific oil type
    if (vehicle && client && vehicle.manufacturer && vehicle.model) {
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
          baseInstructions += `\n\nנתוני היצרן של רכבך הם: ${vehicleInfo}
סוג השמן המומלץ: ${oilType}
אך מומלץ לבדוק בספר הרכב אשר נמצא בתא הכפפות שלך.`;
        } else {
          baseInstructions += `\n\nנתוני היצרן של רכבך הם: ${vehicleInfo}
אך מומלץ לבדוק בספר הרכב אשר נמצא בתא הכפפות שלך.`;
        }
      } catch (err) {
        console.warn("[Questions API] Failed to get oil type from AI, using base instructions:", err);
        if (vehicle.manufacturer && vehicle.model) {
          const vehicleInfo = `${vehicle.manufacturer} ${vehicle.model} ${vehicle.year || ""}`.trim();
          baseInstructions += `\n\nנתוני היצרן של רכבך הם: ${vehicleInfo}
אך מומלץ לבדוק בספר הרכב אשר נמצא בתא הכפפות שלך.`;
        }
      }
    }
    
    return baseInstructions;
  }

  // Tire pressure check instructions
  if (lowerQuestion.includes("לחץ") || lowerQuestion.includes("אוויר") || lowerQuestion.includes("צמיג") || lowerQuestion.includes("pressure")) {
    const vehicleInfo = vehicle && vehicle.manufacturer && vehicle.model
      ? `${vehicle.manufacturer} ${vehicle.model} ${vehicle.year || ""}`.trim()
      : null;
    
    let baseInstructions = `בדיקת ומילוי אוויר בצמיגים – מדריך מקוצר${vehicleInfo ? `\nרכב: ${vehicleInfo}` : ""}

שלבי הפעולה:

הגעה לעמדה: גש לתחנת הדלק הקרובה ומצא את עמדת מילוי האוויר הדיגיטלית.

בדיקת נתונים: את הלחץ המדויק המומלץ לרכבך ניתן למצוא על גבי מדבקה הממוקמת בסף דלת הנהג (המשקוף הפנימי) או בספר הרכב בתא הכפפות.

כיוון המכונה: כוון את המכונה ללחץ הנדרש (PSI) בהתאם לנתוני היצרן המופיעים מטה או על המדבקה.

מילוי: חבר את הצינור לכל גלגל בנפרד והמתן לצפצוף המאשר שהמילוי הסתיים.

סיום: נורת ההתראה בלוח השעונים אמורה לכבות מעצמה לאחר נסיעה קצרה.`;

    // If vehicle info is available, get specific tire pressure (front and rear separately)
    if (vehicle && client && vehicle.manufacturer && vehicle.model) {
      try {
        const pressurePrompt = `מהו לחץ האוויר המומלץ בצמיגים לרכב ${vehicleInfo}? החזר JSON בלבד: {"front_psi": "לחץ קדמיים ב-PSI (למשל: 32-35) או 'לא ידוע'", "rear_psi": "לחץ אחוריים ב-PSI (למשל: 32-35) או 'לא ידוע'"}`;
        
        const response = await client.generateContent(pressurePrompt, {
          responseFormat: { type: "json_object" },
          timeout: 30000,
        });
        const extracted = extractJSON(response);
        const frontPsi = extracted?.front_psi || "";
        const rearPsi = extracted?.rear_psi || "";
        
        baseInstructions += `\n\nנתוני לחץ אוויר (PSI) מומלצים: (מומלץ לוודא מול המדבקה ברכב)`;
        
        if (frontPsi && frontPsi !== "לא ידוע" && typeof frontPsi === "string") {
          baseInstructions += `\n\nגלגלים קדמיים: ${frontPsi} PSI (יש לבדוק במדבקה לדיוק)`;
        } else {
          baseInstructions += `\n\nגלגלים קדמיים: 32-35 PSI (יש לבדוק במדבקה לדיוק)`;
        }
        
        if (rearPsi && rearPsi !== "לא ידוע" && typeof rearPsi === "string") {
          baseInstructions += `\nגלגלים אחוריים: ${rearPsi} PSI (יש לבדוק במדבקה לדיוק)`;
        } else {
          baseInstructions += `\nגלגלים אחוריים: 32-35 PSI (יש לבדוק במדבקה לדיוק)`;
        }
      } catch (err) {
        console.warn("[Questions API] Failed to get tire pressure from AI, using default values:", err);
        baseInstructions += `\n\nנתוני לחץ אוויר (PSI) מומלצים: (מומלץ לוודא מול המדבקה ברכב)

גלגלים קדמיים: 32-35 PSI (יש לבדוק במדבקה לדיוק)

גלגלים אחוריים: 32-35 PSI (יש לבדוק במדבקה לדיוק)`;
      }
    } else {
      // If no vehicle info, show generic values
      baseInstructions += `\n\nנתוני לחץ אוויר (PSI) מומלצים: (מומלץ לוודא מול המדבקה ברכב)

גלגלים קדמיים: 32-35 PSI (יש לבדוק במדבקה לדיוק)

גלגלים אחוריים: 32-35 PSI (יש לבדוק במדבקה לדיוק)`;
    }
    
    return baseInstructions;
  }

  // Coolant check instructions (if question is about coolant/cooling system)
  if (lowerQuestion.includes("קירור") || lowerQuestion.includes("coolant") || lowerQuestion.includes("נוזל קירור")) {
    let baseInstructions = `בואו נבדוק את נוזל הקירור:

1. ודא שהרכב כבוי והמנוע קר
2. פתח את מכסה המנוע
3. מצא את מיכל נוזל הקירור (בדרך כלל שקוף עם נוזל צבעוני)
4. בדוק את מפלס הנוזל - צריך להיות בין MIN ל-MAX
5. אם המפלס נמוך, הוסף נוזל קירור מתאים`;

    // If vehicle info is available, get specific coolant type
    if (vehicle && client && vehicle.manufacturer && vehicle.model) {
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
          baseInstructions += `\n\nנתוני היצרן של רכבך הם: ${vehicleInfo}
סוג נוזל הקירור המומלץ: ${coolantType}
אך מומלץ לבדוק בספר הרכב אשר נמצא בתא הכפפות שלך.`;
        } else {
          baseInstructions += `\n\nנתוני היצרן של רכבך הם: ${vehicleInfo}
אך מומלץ לבדוק בספר הרכב אשר נמצא בתא הכפפות שלך.`;
        }
      } catch (err) {
        console.warn("[Questions API] Failed to get coolant type from AI, using base instructions:", err);
        if (vehicle.manufacturer && vehicle.model) {
          const vehicleInfo = `${vehicle.manufacturer} ${vehicle.model} ${vehicle.year || ""}`.trim();
          baseInstructions += `\n\nנתוני היצרן של רכבך הם: ${vehicleInfo}
אך מומלץ לבדוק בספר הרכב אשר נמצא בתא הכפפות שלך.`;
        }
      }
    }
    
    return baseInstructions;
  }

  // Vibration check instructions
  if (lowerQuestion.includes("רעידות") || lowerQuestion.includes("רעידה") || lowerQuestion.includes("vibration")) {
    return `בואו נבדוק את הרעידות ברכב:

1. נסה לנסוע במהירות נמוכה (30-40 קמ"ש) על כביש ישר וחלק
2. שים לב מתי הרעידות מתרחשות:
   • רק בהאצה? → יכול להיות בעיית צמיגים, גלגלים או בלמים
   • רק בבלימה? → יכול להיות בעיית דיסקי בלמים או צמיגים
   • בנסיעה רגילה? → יכול להיות בעיית איזון גלגלים, צמיגים או מתלים
   • בכל המהירויות? → יכול להיות בעיית צמיגים או מתלים

3. בדוק את הצמיגים:
   • האם יש בליטות או נפיחויות בצמיגים?
   • האם יש סימני שחיקה לא אחידה?
   • האם יש חפצים תקועים בצמיגים (מסמרים, אבנים)?

4. בדוק את הגלגלים:
   • האם יש משקולות איזון על הגלגלים?
   • האם יש נזקים או עיוותים בגלגלים?

מתי אתה מרגיש את הרעידות ומה אתה רואה בצמיגים?`;
  }

  // Engine noise check instructions
  if (lowerQuestion.includes("רעש") || lowerQuestion.includes("רעשים") || lowerQuestion.includes("noise")) {
    return `בואו נבדוק את הרעשים מהמנוע:

1. הנע את המנוע (על משטח ישר ובטוח)
2. הקשיב לרעשים - האם הם:
   • רעש נקישה/טפיפה (ticking)? → יכול להיות בעיית שמן
   • רעש חריקה (squeaking)? → יכול להיות בעיית רצועות
   • רעש רעם/דפיקה (knocking)? → יכול להיות בעיית דלק או מנוע
   • רעש שריקה (whistling)? → יכול להיות בעיית ואקום

3. בדוק מתי הרעש מתרחש:
   • רק בהתנעה? → יכול להיות בעיית מצבר או התנעה
   • בנסיעה? → יכול להיות בעיית מנוע או תיבת הילוכים
   • בעלייה? → יכול להיות בעיית כוח

איזה סוג רעש אתה שומע ומתי?`;
  }

  // Oil leak check instructions
  if (lowerQuestion.includes("נזילה") || lowerQuestion.includes("נזילות") || lowerQuestion.includes("leak")) {
    return `בואו נבדוק אם יש נזילת שמן:

1. החנה את הרכב על משטח נקי ויבש (אספלט או בטון)
2. המתן 10-15 דקות לאחר כיבוי המנוע
3. בדוק מתחת לרכב - האם יש כתמים כהים/שחורים?
4. גע בכתם (אם יש) - שמן יהיה שמנוני וצמיגי
5. בדוק את צבע הכתם:
   • שחור/חום כהה → שמן מנוע
   • אדום/ורוד → נוזל תיבת הילוכים
   • ירוק/צהוב → נוזל קירור
   • שקוף/צהבהב → מים או נוזל בלמים

מה אתה רואה מתחת לרכב?`;
  }

  // General check instructions
  return `אין בעיה! בואו נבדוק יחד:

1. ודא שהרכב כבוי ועל משטח ישר
2. פתח את מכסה המנוע בזהירות
3. בדוק ויזואלית - האם אתה רואה משהו חריג?
4. הקשיב - האם יש רעשים חריגים?
5. הרחיח - האם יש ריחות חריגים?

מה אתה רואה, שומע או מרגיש?`;
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
    });
    const extracted = extractJSON(raw);

    if (extracted && extracted.type === "diagnosis") {
      return buildDiagnosisResponse(extracted);
    }
  } catch (err) {
    console.error("[Questions API] Failed to generate final diagnosis:", err);
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
    const hasImages = imageParts.length > 0;

    const answersCount = Array.isArray(answers) ? answers.length : 0;

    // If max questions reached, force diagnosis
    if (answersCount >= MAX_QUESTIONS) {
      const diagnosis = await generateFinalDiagnosis(description, answers, imageParts, client);
      return NextResponse.json(diagnosis);
    }

    // Check if last answer indicates uncertainty - if so, provide instructions and re-ask the question
    // IMPORTANT: Don't count "uncertain" answers - remove them from answers array before processing
    if (answersCount > 0) {
      const lastAnswer = answers[answers.length - 1];
      const isUncertain = isUncertainAnswer(lastAnswer.answer);
      
      // Log for debugging
      console.log("[Questions API] Checking for uncertain answer:", {
        answer: lastAnswer.answer,
        question: lastAnswer.question,
        isUncertain,
        answersCount,
      });
      
      if (isUncertain) {
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
        const vehicle = needsVehicleInfo && body.vehicle ? body.vehicle : undefined;
        
        const instructionMessage = await generateInstructionMessage(
          lastAnswer.question, 
          lastAnswer.answer,
          vehicle,
          vehicle ? client : undefined
        );
        
        console.log("[Questions API] Generated instruction message:", {
          hasInstruction: !!instructionMessage,
          question: lastAnswer.question,
          needsVehicleInfo,
          hasVehicle: !!vehicle,
        });
        
        if (instructionMessage) {
          // Generate appropriate options and follow-up question based on question type
          const lowerQuestion = (lastAnswer.question || "").toLowerCase();
          let defaultOptions: string[] = [];
          let followUpQuestion = lastAnswer.question;
          
          // Determine options and follow-up question based on question type
          if (lowerQuestion.includes("מפלס") || lowerQuestion.includes("שמן") || lowerQuestion.includes("oil level")) {
            defaultOptions = ["תקין", "נמוך", "נמוך מאוד", "לא בטוח"];
            followUpQuestion = "לאחר שבדקנו, מהו מפלס השמן שאתה מבחין?";
          } else if (lowerQuestion.includes("לחץ") || lowerQuestion.includes("אוויר") || lowerQuestion.includes("צמיג") || lowerQuestion.includes("pressure")) {
            defaultOptions = ["כן, הנורה נעלמה", "לא, הנורה עדיין דולקת", "לא בטוח"];
            followUpQuestion = "לאחר שבדקנו, האם הנורה נעלמה?";
          } else if (lowerQuestion.includes("רעידות") || lowerQuestion.includes("רעידה") || lowerQuestion.includes("vibration")) {
            defaultOptions = ["בעת האצה", "בעת בלימה", "בזמן נסיעה רגילה", "לא בטוח"];
            followUpQuestion = "לאחר שבדקנו, מתי אתה מרגיש את הרעידות?";
          } else if (lowerQuestion.includes("רעש") || lowerQuestion.includes("רעשים") || lowerQuestion.includes("noise")) {
            defaultOptions = ["כן, יש רעשים", "לא, אין רעשים", "לא בטוח"];
            followUpQuestion = "לאחר שבדקנו, איזה סוג רעש אתה שומע?";
          } else if (lowerQuestion.includes("נזילה") || lowerQuestion.includes("נזילות") || lowerQuestion.includes("leak")) {
            defaultOptions = ["כן, יש נזילה", "לא, אין נזילה", "לא בטוח"];
            followUpQuestion = "לאחר שבדקנו, מה אתה רואה מתחת לרכב?";
          } else {
            // Generic fallback for other question types
            defaultOptions = ["כן", "לא", "לא בטוח"];
            followUpQuestion = "לאחר שבדקנו, מה אתה מבחין?";
          }
          
          console.log("[Questions API] Returning instruction response");
          
          // Return instruction message with the follow-up question
          // Note: The frontend will remove this answer from state, so it won't be counted
          return NextResponse.json({
            type: "instruction",
            instruction: instructionMessage,
            question: followUpQuestion, // Use follow-up question instead of original
            options: defaultOptions,
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
          
          if (questionExtracted && typeof questionExtracted === "object" && questionExtracted.type === "question") {
            // Use the new question response
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

    // Check confidence level - if >= 90%, trigger early diagnosis (after minimum answers)
    const confidence = typeof extracted?.confidence === "number" && extracted.confidence >= 0 && extracted.confidence <= 1
      ? extracted.confidence
      : 0.5;

    // Check for clear cases where we have enough info for diagnosis (even with lower confidence)
    const isClearCase = isClearCaseForDiagnosis(description, answers);
    // For clear cases, allow diagnosis with fewer answers (2 instead of 3)
    const minAnswersRequired = isClearCase ? MIN_ANSWERS_FOR_CLEAR_CASE : MIN_ANSWERS_FOR_EARLY_DIAGNOSIS;
    
    // For oil light cases: Check if we asked about current oil level
    const { hasOilLight, hasAskedAboutOilLevel } = checkOilContext(description, answers);
    const shouldWaitForOilLevel = hasOilLight && !hasAskedAboutOilLevel && answersCount < 3;
    
    if ((confidence >= CONFIDENCE_THRESHOLD || isClearCase) && answersCount >= minAnswersRequired && !shouldWaitForOilLevel) {
      // AI is confident enough OR we have a clear case, generate diagnosis
      const diagnosis = await generateFinalDiagnosis(description, answers, imageParts, client);
      return NextResponse.json(diagnosis);
    }

    // Return question
    const questionText =
      typeof extracted?.question === "string" && extracted.question.trim()
        ? extracted.question.trim()
        : "מה התסמין הבולט ביותר?";

    const options = Array.isArray(extracted?.options)
      ? extracted.options.filter((o: any) => typeof o === "string" && o.trim())
      : [];

    // Filter options to be relevant to the question (prevent answer leakage)
    const lowerQuestion = questionText.toLowerCase();
    const filteredOptions = options.filter((opt: string) => {
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
    const normalizedOptions =
      filteredOptions.length >= 3 && filteredOptions.length <= 5
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
