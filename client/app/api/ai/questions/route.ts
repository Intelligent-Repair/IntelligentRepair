<<<<<<< HEAD
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
  // Vehicle info is kept for backward compatibility but NOT sent to API
  vehicle?: any;
  research?: any; // Optional research data (not used in new flow)
}

const MAX_QUESTIONS = 5;
const MIN_ANSWERS_FOR_EARLY_DIAGNOSIS = 3;
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
=======
// app/api/ai/questions/route.ts
import { NextResponse } from 'next/server';
import { analyzeUserContext, analyzeSafetyOnly } from '@/lib/ai/context-analyzer';
import {
  handleKBFlow,
  handleScenarioStep,
  callExpertAI,
  handleWarningLightDetection,
  handleScenarioStart,
  handleSafetyStop,
  type RequestContext
} from '@/lib/ai/flow-handlers';

type IncomingBody = {
  message?: string;
  description?: string;
  answers?: any[];
  image_urls?: string[];
  context?: any;
};

const mergeContext = (base: any, patch: any) => ({ ...(base ?? {}), ...(patch ?? {}) });
>>>>>>> rescue/ui-stable

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
<<<<<<< HEAD
    const body = await req.json();
    const {
      description,
      answers = [],
      image_urls = [],
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

    // Check if AI returned diagnosis directly
    if (extracted.type === "diagnosis") {
      // Respect minimum number of answers before accepting diagnosis,
      // unless we've already hit the max questions limit (handled above)
      if (answersCount >= MIN_ANSWERS_FOR_EARLY_DIAGNOSIS) {
        const diagnosisResponse = buildDiagnosisResponse(extracted);
        return NextResponse.json(diagnosisResponse);
      } else {
        // Too early for final diagnosis – keep asking questions
        console.warn(
          "[Questions API] Model returned diagnosis too early (answersCount=" +
            answersCount +
            "), continuing with questions."
        );
        // Fall through to question handling below
        extracted = {}; // Force using fallback question below
      }
    }

    // Check confidence level - if >= 90%, trigger early diagnosis (after minimum answers)
    const confidence = typeof extracted?.confidence === "number" && extracted.confidence >= 0 && extracted.confidence <= 1
      ? extracted.confidence
      : 0.5;

    if (confidence >= CONFIDENCE_THRESHOLD && answersCount >= MIN_ANSWERS_FOR_EARLY_DIAGNOSIS) {
      // AI is confident enough, generate diagnosis
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

    // Ensure 3-5 options
    const normalizedOptions =
      options.length >= 3 && options.length <= 5
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
=======
    const body = (await req.json()) as IncomingBody;

    const answers = body.answers ?? [];
    const context = body.context ?? {};
    const image_urls = body.image_urls ?? [];

    // Normalize user text (message/description/last answer)
    let userText = body.message || body.description || '';
    if (!userText && answers.length > 0) {
      const last = answers[answers.length - 1];
      userText = last?.answer || last?.text || '';
    }

    const hasImage = image_urls.length > 0;
    const hasKnownLight = !!context?.detectedLightType && context.detectedLightType !== 'unidentified_light';
    const hasScenario = !!context?.currentScenarioId;

    console.log(
      `[Router] 📥 "${(userText || '').slice(0, 60)}" | light=${context?.detectedLightType ?? 'none'} | scenario=${context?.currentScenarioId ?? 'none'} | image=${hasImage}`
    );

    // Build request context
    const reqContext: RequestContext = { body, userText, answers, context, hasImage };

    // =========================================================================
    // Step 1: Safety check ALWAYS (Anti-Gravity: no re-detection mid-flow)
    // =========================================================================
    const safetyRule = analyzeSafetyOnly(userText);
    if (safetyRule) return handleSafetyStop(safetyRule);

    // =========================================================================
    // Step 2: Continue existing flows
    // =========================================================================
    if (hasKnownLight) {
      const result = await handleKBFlow(reqContext);
      if (result.handled) return result.response;
      // If KB couldn't handle (rare), fall back to AI but KEEP context
      return await callExpertAI({ ...body, context: mergeContext(context, { isLightContext: true }) });
    }

    if (hasScenario) {
      const result = await handleScenarioStep(reqContext);
      if (result.handled) return result.response;
      return await callExpertAI({ ...body, context: mergeContext(context, { isSymptomFlow: true }) });
    }

    // =========================================================================
    // Step 3: Image path (no flow yet)
    // =========================================================================
    if (hasImage) {
      return await callExpertAI({ ...body, context: mergeContext(context, { isLightContext: true }) });
    }

    // =========================================================================
    // Step 4: Fresh analysis (KB routing)
    // =========================================================================
    const analysis = analyzeUserContext(userText);

    if (analysis.type === 'SAFETY_STOP') {
      return handleSafetyStop(analysis.rule);
    }

    if (analysis.type === 'WARNING_LIGHT') {
      const kbStart = handleWarningLightDetection(analysis.lightId, analysis.severity);
      if (kbStart) return kbStart;

      // If KB can't start (missing light), fall back to AI but persist detectedLightType
      return await callExpertAI({
        ...body,
        context: mergeContext(context, { detectedLightType: analysis.lightId, isLightContext: true })
      });
    }

    if (analysis.type === 'START_SCENARIO') {
      const start = handleScenarioStart(analysis.scenarioId);
      if (start) return start;

      return await callExpertAI({ ...body, context: mergeContext(context, { isSymptomFlow: true }) });
    }

    // =========================================================================
    // Step 5: AI fallback (KEEP context)
    // =========================================================================
    return await callExpertAI({ ...body, context: mergeContext(context, { isSymptomFlow: true }) });
  } catch (error) {
    console.error('[Router] Error:', error);
    return NextResponse.json({
      type: 'question',
      text: 'נתקלתי בשגיאה. תוכל לתאר שוב את הבעיה?',
      options: ['אנסה שוב', 'אעדיף לגשת למוסך']
    });
>>>>>>> rescue/ui-stable
  }
}
