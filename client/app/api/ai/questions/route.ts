/**
 * Main chat API route for AI consultation
 * 
 * Flow:
 * 1. User submits description + optional images
 * 2. AI returns question (or diagnosis if confidence >= 80%)
 * 3. User answers (up to 5 questions total)
 * 4. After 5 questions or 80% confidence → final diagnosis
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
import { buildChatPrompt, buildDiagnosisPrompt } from "@/lib/ai/prompt-builder";
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
const CONFIDENCE_THRESHOLD = 0.8; // 80% confidence triggers early diagnosis
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
    (acc: typeof parsedResults, curr) => {
      const exists = acc.some((r) => r.issue.toLowerCase() === curr.issue.toLowerCase());
      if (!exists) {
        acc.push(curr);
      }
      return acc;
    },
    []
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

  uniqueResults.sort((a, b) => b.probability - a.probability);

  // Take top 3 results
  const topResults = uniqueResults.slice(0, 3).map((r) => ({
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

    // Check if AI returned diagnosis (confidence >= 80% trigger)
    if (extracted.type === "diagnosis") {
      const diagnosisResponse = buildDiagnosisResponse(extracted);
      return NextResponse.json(diagnosisResponse);
    }

    // Check confidence level - if >= 80%, trigger early diagnosis
    const confidence = typeof extracted?.confidence === "number" && extracted.confidence >= 0 && extracted.confidence <= 1
      ? extracted.confidence
      : 0.5;

    if (confidence >= CONFIDENCE_THRESHOLD && answersCount > 0) {
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

    // Add safety warning if present
    if (typeof extracted?.safety_warning === "string" && extracted.safety_warning.trim()) {
      responsePayload.safety_warning = extracted.safety_warning.trim();
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
