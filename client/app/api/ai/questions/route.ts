import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchImageAsInlineData } from "../../../../lib/ai/image-utils";

interface VehicleInfo {
  manufacturer: string;
  model: string;
  year?: number | null;
}

interface UserAnswer {
  question: string;
  answer: string;
}

interface ResearchData {
  top_causes?: string[];
  differentiating_factors?: string[];
  reasoning?: string;
}

interface RequestBody {
  research: ResearchData;
  description: string;
  vehicle: VehicleInfo;
  answers: UserAnswer[];
  image_urls?: string[];
}

const MAX_QUESTIONS = 5;
const DIAGNOSIS_DISCLAIMER =
  "האבחון מבוסס על מידע ראשוני בלבד ואינו מהווה תחליף לבדיקה מקצועית. מומלץ לפנות למוסך מוסמך לצורך בדיקה ואבחון מלא.";

async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Status ${res.status}`);
    }
    const contentType = res.headers.get("content-type") || undefined;
    const mimeType =
      contentType && contentType.startsWith("image/")
        ? contentType.split(";")[0]
        : undefined;

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    console.log("[GEMINI MULTIMODAL] image base64 length:", base64.length);
    if (base64.length <= 10000) {
      throw new Error("Base64 image too small to be valid");
    }

    return {
      base64,
      mimeType: mimeType || "image/jpeg",
    };
  } catch (err) {
    console.error("[Questions API] Failed to fetch image", url, err);
    throw err;
  }
}

function extractJSON(text: string): any | null {
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

function buildDiagnosisResponse(rawDiagnosis: any) {
  const summary =
    typeof rawDiagnosis?.summary === "string" && rawDiagnosis.summary.trim()
      ? rawDiagnosis.summary.trim()
      : "אבחון ראשוני על בסיס המידע שניתן.";
  const lowMatchFallbackText =
    "לא נמצאה התאמה ברורה. מומלץ להגיע למוסך או להתחיל ייעוץ חדש.";

  const rawResults = Array.isArray(rawDiagnosis?.results) ? rawDiagnosis.results : [];

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
      confidence: r.probability,
      explanation:
        typeof r.explanation === "string" && r.explanation.trim()
          ? r.explanation.trim()
          : summary,
    }));

  const uniqueResults = parsedResults.reduce(
    (
      acc: { issue: string; confidence: number; explanation: string }[],
      curr: { issue: string; confidence: number; explanation: string }
    ) => {
      const exists = acc.some(
        (r) => r.issue.toLowerCase() === curr.issue.toLowerCase()
      );
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
      results: [] as {
        title: string;
        explanation: string;
        probability: number;
      }[],
      recommendations: [
        "מומלץ לפנות למוסך לבדיקה מקצועית.",
        "אפשר לחזור לייעוץ חדש ולנסות לתאר את התקלה בצורה מפורטת יותר (רעשים, ריחות, מתי זה קורה).",
      ],
      disclaimer: DIAGNOSIS_DISCLAIMER,
      confidence: 0,
    };
  }

  uniqueResults.sort((a: { confidence: number }, b: { confidence: number }) => b.confidence - a.confidence);

  const topResult = uniqueResults[0];
  const topConfidence = topResult?.confidence ?? 0;

  const allLowConfidence = uniqueResults.every((r) => r.confidence < 0.05);

  if (allLowConfidence) {
    return {
      type: "diagnosis",
      summary: lowMatchFallbackText,
      results: [
        {
          issue: lowMatchFallbackText,
          title: lowMatchFallbackText,
          explanation: lowMatchFallbackText,
          probability: 100,
        },
      ],
      recommendations: [
        "מומלץ להגיע למוסך לבדיקה מקצועית.",
        "אפשר להתחיל ייעוץ חדש ולנסות לתאר את התקלה בצורה מפורטת יותר (רעשים, ריחות, מתי זה קורה).",
      ],
      disclaimer: DIAGNOSIS_DISCLAIMER,
      confidence: 0.1,
    };
  }

  const isHighConfidence = topConfidence >= 0.8;
  const count = Math.min(uniqueResults.length, 3);
  let displayProbabilities: number[];

  if (isHighConfidence) {
    if (count >= 3) {
      displayProbabilities = [85, 10, 5];
    } else if (count === 2) {
      displayProbabilities = [85, 15];
    } else {
      displayProbabilities = [90];
    }
  } else {
    if (count >= 3) {
      displayProbabilities = [70, 20, 10];
    } else if (count === 2) {
      displayProbabilities = [70, 20];
    } else {
      displayProbabilities = [75];
    }
  }

  const mappedResults = uniqueResults.slice(0, 3).map(
    (r: { issue: string; explanation: string }, index: number) => ({
      issue: r.issue,
      title: r.issue,
      explanation: r.explanation,
      probability: displayProbabilities[index] ?? (isHighConfidence ? 80 : 60),
    })
  );

  const recommendations =
    mappedResults.length > 0
      ? [
          "בדיקת מפלס שמן או נוזל קירור כשהרכב כבוי ועל משטח ישר.",
          "כיבוי הרכב והנעה מחדש לאחר מספר דקות כדי לראות אם התסמין חוזר.",
          "בדיקה האם יש רעשים חריגים, ריחות לא רגילים או ירידה בכוח המנוע.",
          "מעקב אם נורת אזהרה נכבית או נדלקת שוב לאחר נסיעה קצרה.",
        ]
      : [
          "מומלץ לפנות למוסך לבדיקה מקצועית.",
          "אפשר לחזור לייעוץ חדש ולנסות לתאר את התקלה בצורה מפורטת יותר (רעשים, ריחות, מתי זה קורה).",
        ];

  const internalConfidence =
    typeof rawDiagnosis?.confidence === "number" &&
    rawDiagnosis.confidence >= 0 &&
    rawDiagnosis.confidence <= 1
      ? isHighConfidence
        ? Math.max(0.85, rawDiagnosis.confidence)
        : rawDiagnosis.confidence
      : isHighConfidence
        ? Math.max(0.85, topConfidence || 0.8)
        : Math.min(0.95, Math.max(0.5, topConfidence || 0.6));

  return {
    type: "diagnosis",
    summary,
    results: mappedResults,
    recommendations,
    disclaimer: DIAGNOSIS_DISCLAIMER,
    confidence: internalConfidence,
  };
}

function buildPrompt(
  vehicle: VehicleInfo,
  description: string,
  research: ResearchData,
  answers: UserAnswer[],
  hasImages: boolean
): string {
  const yearStr = vehicle.year ? ` (${vehicle.year})` : "";
  const vehicleContext = `${vehicle.manufacturer} ${vehicle.model}${yearStr}`;

  const answersContext =
    answers.length > 0
      ? answers
          .map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`)
          .join("\n\n")
      : "No previous answers.";

  const researchContext = research.top_causes?.length
    ? `Top potential causes: ${research.top_causes.join(", ")}`
    : "No specific causes identified yet.";

  const differentiatingFactors = research.differentiating_factors?.length
    ? `Differentiating factors: ${research.differentiating_factors.join(", ")}`
    : "";

  return `אתה מכונאי רכב רגוע ומנוסה שמדבר עם נהגים שאינם טכניים.
שפה: עברית בלבד. משפטים קצרים וברורים. בלי קודי OBD, בלי ראשי תיבות ובלי ז'רגון מקצועי.

רכב: ${vehicleContext}
תיאור תקלה:
"${description}"

תובנות מחקר:
${researchContext}
${differentiatingFactors ? `\n${differentiatingFactors}` : ""}

שאלות ותשובות קודמות (${answers.length}):
${answersContext}

הנחיות חובה לשאלות:
- התייחס לנהג/ת שלא מבין/ה ברכב. קודם כל הסבר במשפט אחד או שניים מה אנחנו בודקים עכשיו, ואז שאל שאלה אחת ברורה.
- לעולם אל תשאל שאלות כן/לא.
- בכל פעם שאל רק שאלה אחת עם 3–5 אפשרויות בחירה ברורות ולא חופפות.
- ניסוח כל אופציה חייב להיות קצר, יומיומי וברור. בלי מילים מקצועיות, בלי קודי OBD ובלי ראשי תיבות.
- נתח את ${hasImages ? "התמונות וה" : ""}תיאור לפני השאלה הבאה.
- אל תשאל על דברים שנראים בתמונות, ואל תשאל על צבע נורות אם זה מופיע בתמונה.
- אל תחזור על שאלות שכבר נשאלו ואל תבקש מידע שלא יעזור לאבחון.
- שמור ציון ביטחון פנימי בין 0 ל-1.
- אם confidence < 0.8: שאל את שאלת ההבהרה הטובה ביותר הבאה.
- אם confidence >= 0.8: עצור שאלות והחזר אבחון.

פורמט JSON בלבד:
שאלה:
{
  "type": "question",
  "question": "משפט או שניים שמסבירים לנהג/ת מה אנחנו בודקים עכשיו, ואז שאלה אחת ברורה לבחירה",
  "options": ["תשובה אפשרית 1 לנהג/ת פשוט/ה", "תשובה אפשרית 2", "תשובה אפשרית 3"],
  "confidence": 0.xx
}

אבחון:
{
  "type": "diagnosis",
  "summary": "תקציר קצר",
  "results": [
    { "issue": "בעיה 1", "probability": 0.xx },
    { "issue": "בעיה 2", "probability": 0.xx },
    { "issue": "בעיה 3", "probability": 0.xx }
  ],
  "confidence": 0.xx
}

חובה: הסתברויות באבחון מסכמות ל-1 וממויינות מהגבוה לנמוך. אין טקסט מחוץ ל-JSON.`;
}

function buildDiagnosisPrompt(
  vehicle: VehicleInfo,
  description: string,
  research: ResearchData,
  answers: UserAnswer[],
  hasImages: boolean
): string {
  const yearStr = vehicle.year ? ` (${vehicle.year})` : "";
  const vehicleContext = `${vehicle.manufacturer} ${vehicle.model}${yearStr}`;

  const answersContext =
    answers.length > 0
      ? answers
          .map((a, i) => `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer}`)
          .join("\n\n")
      : "No previous answers.";

  const researchContext = research.top_causes?.length
    ? `Top potential causes: ${research.top_causes.join(", ")}`
    : "No specific causes identified yet.";

  const differentiatingFactors = research.differentiating_factors?.length
    ? `Differentiating factors: ${research.differentiating_factors.join(", ")}`
    : "";

  return `אתה מכונאי רכב רגוע ומנוסה שמדבר עם נהגים לא טכניים. עכשיו חובה להחזיר אבחון סופי בלבד, ללא שאלות המשך.
שפה: עברית בלבד. משפטים קצרים וברורים. בלי קודי OBD, בלי ראשי תיבות ובלי ז'רגון מקצועי.

רכב: ${vehicleContext}
תיאור תקלה:
"${description}"

תובנות מחקר:
${researchContext}
${differentiatingFactors ? `\n${differentiatingFactors}` : ""}

שאלות ותשובות קודמות (${answers.length}):
${answersContext}

הנחיות חובה:
- נתח את ${hasImages ? "התמונות וה" : ""}תיאור לפני האבחון.
- הסבר את האבחון בשפה פשוטה, כאילו אתה מסביר לחבר ללא ידע טכני.
- אל תשתמש בקודי OBD, ראשי תיבות או שמות חלקים מורכבים בלי הסבר קצר ומילים יומיומיות.
- אל תשאל שאלות כן/לא או שאלות נוספות – רק תן אבחון וסיכום ברור.
- אל תשאל על צבע נורות אם יש תמונות.
- החזר רק אבחון סופי, מסודר וברור.

פורמט JSON בלבד:
{
  "type": "diagnosis",
  "summary": "תקציר קצר וברור שמתאים לנהג/ת לא טכני/ת",
  "results": [
    { "issue": "בעיה 1 מוסברת במילים פשוטות", "probability": 0.xx },
    { "issue": "בעיה 2 מוסברת במילים פשוטות", "probability": 0.xx },
    { "issue": "בעיה 3 מוסברת במילים פשוטות", "probability": 0.xx }
  ],
  "confidence": 0.xx
}

חובה: הסתברויות באבחון מסכמות ל-1 וממויינות מהגבוה לנמוך. אין טקסט מחוץ ל-JSON.`;
}

function createFallbackQuestion() {
  return {
    type: "question",
    question: "מתי התסמין בולט ביותר?",
    options: ["התנעה קרה", "נסיעה בעיר", "נסיעה מהירה", "אחרי עצירה"],
    confidence: 0.3,
  };
}

function createFallbackDiagnosis() {
  return {
    type: "diagnosis",
    summary: "אבחון ראשוני על בסיס מידע חלקי.",
    results: [
      {
        issue: "בעיה לא מזוהה",
        title: "בעיה לא מזוהה",
        explanation: "לא ניתן היה לזהות תקלה ספציפית על בסיס המידע הקיים.",
        probability: 60,
      },
      {
        issue: "בדיקה חשמלית נדרשת",
        title: "בדיקה חשמלית נדרשת",
        explanation: "ייתכן שמדובר בתקלה במערכת החשמל או בחיישנים הדורשת בדיקה.",
        probability: 25,
      },
      {
        issue: "נזילת נוזלים אפשרית",
        title: "נזילת נוזלים אפשרית",
        explanation: "ייתכן שקיימת נזילת שמן או נוזל קירור המשפיעה על תפקוד הרכב.",
        probability: 15,
      },
    ],
    recommendations: [
      "בדיקת מפלס שמן או נוזל קירור כשהרכב כבוי ועל משטח ישר.",
      "בדיקה אם יש סימני נזילה מתחת לרכב לאחר עמידה.",
      "מעקב אם נורת אזהרה נכבית או נדלקת שוב לאחר נסיעה קצרה.",
      "מומלץ לפנות למוסך לבדיקה מקצועית בהקדם.",
    ],
    disclaimer: DIAGNOSIS_DISCLAIMER,
    confidence: 0.6,
  };
}

async function generateFinalDiagnosis(
  vehicle: VehicleInfo,
  description: string,
  research: ResearchData,
  answers: UserAnswer[],
  imageParts: { inlineData: { data: string; mimeType: string } }[],
  model: any
): Promise<any> {
  const diagnosisPrompt = buildDiagnosisPrompt(
    vehicle,
    description,
    research,
    answers,
    imageParts.length > 0
  );
  const diagnosisParts = [
    { text: diagnosisPrompt },
    ...imageParts.map((p) => ({ inlineData: p.inlineData })),
  ];

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: diagnosisParts,
        },
      ],
    });
    const raw = result.response.text();
    const extracted = extractJSON(raw);

    if (extracted && extracted.type === "diagnosis") {
      return buildDiagnosisResponse(extracted);
    }
  } catch (err) {
    console.error("[Questions API] Failed to generate final diagnosis:", err);
  }

  // Fallback if Gemini call fails or returns invalid response
  return createFallbackDiagnosis();
}

export async function POST(req: Request) {
  let answers: UserAnswer[] = [];
  let diagnosticAnswers: any[] = [];
  // Default modes; recalculated after parsing body to enforce server-side limits
  let questionMode = true;
  let diagnosisMode = false;
  try {
    const body = await req.json();
    const {
      research,
      description,
      vehicle,
      answers: bodyAnswers = [],
      image_urls = [],
    } = body as RequestBody;
    answers = Array.isArray(bodyAnswers) ? bodyAnswers : [];
    
    // 🔒 HARD LIMIT: Count ALL answers at the start
    const answersCount = answers.length;
    
    diagnosticAnswers = (answers as any[]).filter(
      (a: any) =>
        a &&
        a.kind === "answer" &&
        a.question_type === "diagnostic"
    );

    console.log("[Questions API] Answers counts:", {
      answersCount,
      diagnosticAnswersCount: diagnosticAnswers.length,
    });

    // 🔒 HARD STOP: If user already answered 5 questions, force final diagnosis
    // This MUST happen before any Gemini question calls
    if (answersCount >= MAX_QUESTIONS) {
      console.log(
        `[Questions API] 🔒 HARD LIMIT: Reached ${answersCount} answers (max: ${MAX_QUESTIONS}), forcing final diagnosis`
      );
      
      // Validate required fields before generating diagnosis
      if (!description || typeof description !== "string" || !description.trim()) {
        console.warn("[Questions API] Invalid description, using fallback diagnosis");
        return NextResponse.json(createFallbackDiagnosis(), { status: 200 });
      }

      if (!vehicle || !vehicle.manufacturer || !vehicle.model) {
        console.warn("[Questions API] Invalid vehicle data, using fallback diagnosis");
        return NextResponse.json(createFallbackDiagnosis(), { status: 200 });
      }

      if (!research || typeof research !== "object") {
        console.warn("[Questions API] Invalid research data, using fallback diagnosis");
        return NextResponse.json(createFallbackDiagnosis(), { status: 200 });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("[Questions API] Missing GEMINI_API_KEY, using fallback diagnosis");
        return NextResponse.json(createFallbackDiagnosis(), { status: 200 });
      }

      // Prepare images for diagnosis
      const imageUrls = Array.isArray(image_urls)
        ? image_urls.filter((u) => typeof u === "string" && u.trim()).slice(0, 3)
        : [];

      const fetchedImages = await Promise.all(
        imageUrls.map(async (url) => {
          try {
            return await fetchImageAsInlineData(url);
          } catch (err) {
            console.error("[Questions API] Failed to process image", url, err);
            return null;
          }
        })
      );

      const imageParts = fetchedImages.filter(Boolean) as { inlineData: { data: string; mimeType: string } }[];

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      // 🔒 Force final diagnosis - NO questions allowed
      const diagnosis = await generateFinalDiagnosis(
        vehicle,
        description,
        research,
        answers,
        imageParts,
        model
      );

      return NextResponse.json(diagnosis);
    }

    // Only if answersCount < MAX_QUESTIONS, allow question flow
    questionMode = diagnosticAnswers.length < MAX_QUESTIONS;
    diagnosisMode = !questionMode;

    // Always return 200 with valid JSON - never break the frontend flow
    if (!description || typeof description !== "string" || !description.trim()) {
      console.warn("[Questions API] Invalid description, using fallback");
      return NextResponse.json(questionMode ? createFallbackQuestion() : createFallbackDiagnosis(), { status: 200 });
    }

    if (!vehicle || !vehicle.manufacturer || !vehicle.model) {
      console.warn("[Questions API] Invalid vehicle data, using fallback");
      return NextResponse.json(questionMode ? createFallbackQuestion() : createFallbackDiagnosis(), { status: 200 });
    }

    if (!research || typeof research !== "object") {
      console.warn("[Questions API] Invalid research data, using fallback");
      return NextResponse.json(questionMode ? createFallbackQuestion() : createFallbackDiagnosis(), { status: 200 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[Questions API] Missing GEMINI_API_KEY, using fallback");
      return NextResponse.json(questionMode ? createFallbackQuestion() : createFallbackDiagnosis(), { status: 200 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const imageUrls = Array.isArray(image_urls)
      ? image_urls.filter((u) => typeof u === "string" && u.trim()).slice(0, 3)
      : [];

    // Log image URLs received from client
    console.log("[Questions API] Received image_urls:", {
      count: imageUrls.length,
      urls: imageUrls.map(url => url.substring(0, 50) + (url.length > 50 ? "..." : ""))
    });

    const fetchedImages = await Promise.all(
      imageUrls.map(async (url) => {
        try {
          return await fetchImageAsInlineData(url);
        } catch (err) {
          console.error("[Questions API] Failed to process image", url, err);
          throw err;
        }
      })
    );

    const imageParts = fetchedImages.filter(Boolean) as { inlineData: { data: string; mimeType: string } }[];
    
    // Log image parts that will be sent to Gemini
    console.log("[Questions API] Image parts prepared:", {
      count: imageParts.length,
      partsTypes: imageParts.map((p, i) => `IMAGE_${i + 1}: ${p.inlineData.mimeType} (${p.inlineData.data.length} chars)`)
    });

    const prompt = questionMode
      ? buildPrompt(vehicle, description, research, answers, imageParts.length > 0)
      : buildDiagnosisPrompt(vehicle, description, research, answers, imageParts.length > 0);
    
    // Build parts array: TEXT first, then IMAGE parts
    const parts = [
      { text: prompt },
      ...imageParts.map((p) => ({ inlineData: p.inlineData })),
    ];
    
    // Verify parts structure
    const partsTypes = parts.map((p: any) => p.inlineData ? "IMAGE" : "TEXT");
    console.log("[Questions API] Parts structure:", partsTypes);
    
    console.log("[Questions API] Calling Gemini with:", {
      vehicle: `${vehicle.manufacturer} ${vehicle.model}`,
      descriptionLength: description.length,
      answersCount: answers.length,
      diagnosticAnswersCount: diagnosticAnswers.length,
      researchHasData: !!(research.top_causes?.length || research.differentiating_factors?.length),
      imagesIncluded: imageParts.length,
    });
    
    // Retry logic: 2 attempts
    let raw = "";
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const partsDebug = parts.map((p: any) => p.inlineData ? "IMAGE" : "TEXT");
        console.log("[GEMINI MULTIMODAL] Sending parts to generateContent:", partsDebug);
        console.log("[GEMINI MULTIMODAL] Parts count:", {
          total: parts.length,
          text: parts.filter((p: any) => !p.inlineData).length,
          images: parts.filter((p: any) => p.inlineData).length
        });

        const result = await model.generateContent({
          contents: [
            {
              role: "user",
              parts,
            },
          ],
        });
        raw = result.response.text();
        
        console.log("[Questions API] Raw response length:", raw?.length || 0);
        console.log("[Questions API] Raw response preview:", raw?.substring(0, 200) || "No response");
        break; // Success, exit retry loop
      } catch (geminiError: any) {
        console.error(`[Questions API] Gemini API call failed (attempt ${attempt}/${maxRetries}):`, geminiError);
        console.error("[Questions API] Gemini error message:", geminiError?.message);
        
        if (attempt === maxRetries) {
          // Final attempt failed, use fallback
          console.error("[Questions API] All retry attempts failed, using fallback");
          const fallback = questionMode ? createFallbackQuestion() : createFallbackDiagnosis();
          return NextResponse.json(fallback, { status: 200 });
        }
        
        // Wait before retry (exponential backoff: 500ms, 1000ms)
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
    
    let extracted = extractJSON(raw);
    
    console.log("[Questions API] Extracted JSON:", extracted ? "Success" : "Failed");

    if (!extracted || typeof extracted !== "object") {
      console.warn("[Questions API] JSON extraction failed, using fallback");
      // 🔒 Safety check: If we have 5+ answers, must return diagnosis
      if (answersCount >= MAX_QUESTIONS) {
        return NextResponse.json(createFallbackDiagnosis(), { status: 200 });
      }
      return NextResponse.json(questionMode ? createFallbackQuestion() : createFallbackDiagnosis(), { status: 200 });
    }

    // 🔒 CRITICAL: If we have 5+ answers, force diagnosis regardless of what Gemini returned
    // This should never happen since we return early, but adding as safety check
    if (answersCount >= MAX_QUESTIONS) {
      if (extracted.type !== "diagnosis") {
        console.log(
          `[Questions API] 🔒 SAFETY: Forcing diagnosis after ${answersCount} answers (max: ${MAX_QUESTIONS}), even though Gemini returned ${extracted.type}`
        );
        // Use diagnosis prompt to get proper diagnosis
        const forcedDiagPrompt = buildDiagnosisPrompt(vehicle, description, research, answers, imageParts.length > 0);
        const forcedDiagParts = [
          { text: forcedDiagPrompt },
          ...imageParts.map((p) => ({ inlineData: p.inlineData })),
        ];
        
        try {
          const forcedResult = await model.generateContent({
            contents: [
              {
                role: "user",
                parts: forcedDiagParts,
              },
            ],
          });
          const forcedRaw = forcedResult.response.text();
          const forcedExtracted = extractJSON(forcedRaw);
          
          if (forcedExtracted && forcedExtracted.type === "diagnosis") {
            extracted = forcedExtracted;
          } else {
            // Fallback to diagnosis even if parsing failed
            console.warn("[Questions API] Forced diagnosis request failed, using fallback diagnosis");
            return NextResponse.json(createFallbackDiagnosis(), { status: 200 });
          }
        } catch (err) {
          console.error("[Questions API] Forced diagnosis call failed:", err);
          return NextResponse.json(createFallbackDiagnosis(), { status: 200 });
        }
      }
      // If extracted.type === "diagnosis", continue to diagnosis handling below
    }

    if (extracted.type === "diagnosis") {
      const diagnosisResponse = buildDiagnosisResponse(extracted);
      return NextResponse.json(diagnosisResponse);
    }

    if (diagnosisMode) {
      // Gemini responded with a question in diagnosis mode; force re-run with diagnosis-only prompt
      console.warn("[Questions API] Received question in diagnosis mode, reissuing with diagnosis prompt only");
      const diagPrompt = buildDiagnosisPrompt(vehicle, description, research, answers, imageParts.length > 0);
      const diagParts = [
        { text: diagPrompt },
        ...imageParts.map((p) => ({ inlineData: p.inlineData })),
      ];
      
      console.log("[Questions API] Diagnosis re-run parts:", {
        total: diagParts.length,
        text: diagParts.filter((p: any) => !p.inlineData).length,
        images: diagParts.filter((p: any) => p.inlineData).length
      });

      try {
        const diagResult = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: diagParts,
            },
          ],
        });
        const diagRaw = diagResult.response.text();
        const diagExtracted = extractJSON(diagRaw);

        if (diagExtracted && diagExtracted.type === "diagnosis") {
          const diagnosisResponse = buildDiagnosisResponse(diagExtracted);
          return NextResponse.json(diagnosisResponse);
        }
      } catch (err) {
        console.error("[Questions API] Diagnosis re-run failed:", err);
      }

      return NextResponse.json(createFallbackDiagnosis(), { status: 200 });
    }

    // 🔒 FINAL SAFETY CHECK: If we have 5+ answers, we should NEVER return a question
    // This should never happen since we return early, but adding as absolute safety
    if (answersCount >= MAX_QUESTIONS) {
      console.warn(
        `[Questions API] 🔒 SAFETY: Attempted to return question after ${answersCount} answers (max: ${MAX_QUESTIONS}), forcing diagnosis`
      );
      return NextResponse.json(createFallbackDiagnosis(), { status: 200 });
    }

    // Only return question if answersCount < MAX_QUESTIONS
    const questionText =
      typeof extracted?.question === "string" && extracted.question.trim()
        ? extracted.question
        : typeof extracted?.message === "string" && extracted.message.trim()
          ? extracted.message
          : "מה התסמין הבולט ביותר?";

    const options = Array.isArray(extracted?.options)
      ? extracted.options.filter((o: any) => typeof o === "string" && o.trim())
      : [];

    const normalizedOptions =
      options.length >= 3 && options.length <= 5
        ? options.slice(0, 5)
        : ["התנעה קרה", "נסיעה בעיר", "נסיעה מהירה"];

    const confidence =
      typeof extracted?.confidence === "number" && extracted.confidence >= 0 && extracted.confidence <= 1
        ? extracted.confidence
        : 0.5;

    const responsePayload = {
      type: "question",
      question: questionText,
      options: normalizedOptions,
      confidence,
    };

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("[Questions API] Error:", error);
    console.error("[Questions API] Error message:", error?.message);
    console.error("[Questions API] Error stack:", error?.stack);
    // Always return 200 with valid JSON - never break the frontend flow
    // 🔒 If we have 5+ answers, must return diagnosis even on error
    // Note: answersCount may not be accessible here if error occurred before parsing body
    // So we check if answers array was parsed
    const errorAnswersCount = Array.isArray(answers) ? answers.length : 0;
    if (errorAnswersCount >= MAX_QUESTIONS) {
      return NextResponse.json(createFallbackDiagnosis(), { status: 200 });
    }
    return NextResponse.json(questionMode ? createFallbackQuestion() : createFallbackDiagnosis(), { status: 200 });
  }
}

