import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
}

interface QuestionResponse {
  should_finish: false;
  question: string;
  type: "yesno" | "multi";
  options: string[];
  shouldStop: boolean;
}

interface DiagnosisResponse {
  should_finish: true;
  final_diagnosis: {
    diagnosis: string[];
    self_checks: string[];
    warnings: string[];
    disclaimer: string;
  };
  recommendations?: string[];
  safety_notice?: string;
}

type AIResponse = QuestionResponse | DiagnosisResponse;

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

function buildPrompt(
  vehicle: VehicleInfo,
  description: string,
  research: ResearchData,
  answers: UserAnswer[]
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

  const shouldFinish = answers.length >= 5;

  return `You are a vehicle diagnostic expert.

Vehicle: ${vehicleContext}

Problem description:
"${description}"

Research insights:
${researchContext}
${differentiatingFactors ? `\n${differentiatingFactors}` : ""}

Previous Q&A (${answers.length} questions answered):
${answersContext}

${shouldFinish ? "IMPORTANT: You have reached 5 questions. You MUST provide a final diagnosis now." : ""}

Your task:
${shouldFinish
    ? `Provide a final diagnosis with:
- diagnosis: array of possible diagnoses (most likely first)
- self_checks: array of things the user can check themselves
- warnings: array of safety warnings if any
- disclaimer: standard disclaimer text

Return JSON:
{
  "final_diagnosis": {
    "diagnosis": ["..."],
    "self_checks": ["..."],
    "warnings": ["..."],
    "disclaimer": "..."
  }
}`
    : `Ask ONE more diagnostic question to narrow down the issue.

You may generate either:
- a yes/no question (2 options: ["כן", "לא"]), OR
- a multi-choice question (3-5 options)

Choose whichever format produces the most diagnostically meaningful next step.
If the distinction requires nuance, use 3-5 multiple-choice options.
If the distinction is binary, use yes/no.

Question must be SHORT and CLEAR.
Question should help differentiate between potential causes.

Return JSON:
{
  "question": "Question text",
  "type": "yesno" or "multi",
  "options": ["כן", "לא"] for yesno OR ["option1", "option2", "option3", ...] for multi (3-5 options),
  "shouldStop": false or true
}`}`;
}

function createFallbackQuestion(): QuestionResponse {
  return {
    should_finish: false,
    question: "האם הבעיה מתרחשת רק בזמן נסיעה?",
    type: "yesno",
    options: ["כן", "לא"],
    shouldStop: false,
  };
}

function createFallbackDiagnosis(): DiagnosisResponse {
  return {
    should_finish: true,
    final_diagnosis: {
      diagnosis: ["לא ניתן לקבוע אבחון מדויק. מומלץ לבצע בדיקה מקצועית במוסך."],
      self_checks: ["בדוק אם הבעיה מתרחשת רק בתנאים ספציפיים"],
      warnings: ["אם יש רעש חריג, עצור נסיעה מיידית"],
      disclaimer: "מידע זה הוא הערכה ראשונית בלבד ואינו מהווה תחליף לבדיקה מקצועית במוסך.",
    },
    recommendations: ["קבע תור לבדיקה במוסך מוסמך"],
    safety_notice: null,
  };
}

export async function POST(req: Request) {
  let answers: UserAnswer[] = [];
  try {
    const body = await req.json();
    const { research, description, vehicle, answers: bodyAnswers = [] } = body;
    answers = Array.isArray(bodyAnswers) ? bodyAnswers : [];

    // Always return 200 with valid JSON - never break the frontend flow
    if (!description || typeof description !== "string" || !description.trim()) {
      console.warn("[Questions API] Invalid description, using fallback");
      const shouldFinish = answers.length >= 5;
      return NextResponse.json(
        shouldFinish ? createFallbackDiagnosis() : createFallbackQuestion(),
        { status: 200 }
      );
    }

    if (!vehicle || !vehicle.manufacturer || !vehicle.model) {
      console.warn("[Questions API] Invalid vehicle data, using fallback");
      const shouldFinish = answers.length >= 5;
      return NextResponse.json(
        shouldFinish ? createFallbackDiagnosis() : createFallbackQuestion(),
        { status: 200 }
      );
    }

    if (!research || typeof research !== "object") {
      console.warn("[Questions API] Invalid research data, using fallback");
      const shouldFinish = answers.length >= 5;
      return NextResponse.json(
        shouldFinish ? createFallbackDiagnosis() : createFallbackQuestion(),
        { status: 200 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[Questions API] Missing GEMINI_API_KEY, using fallback");
      const shouldFinish = answers.length >= 5;
      return NextResponse.json(
        shouldFinish ? createFallbackDiagnosis() : createFallbackQuestion(),
        { status: 200 }
      );
    }

    const shouldFinish = answers.length >= 5;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = buildPrompt(vehicle, description, research, answers);
    
    console.log("[Questions API] Calling Gemini with:", {
      vehicle: `${vehicle.manufacturer} ${vehicle.model}`,
      descriptionLength: description.length,
      answersCount: answers.length,
      researchHasData: !!(research.top_causes?.length || research.differentiating_factors?.length)
    });
    
    // Retry logic: 2 attempts
    let raw: string;
    let lastError: any = null;
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        raw = result.response.text();
        
        console.log("[Questions API] Raw response length:", raw?.length || 0);
        console.log("[Questions API] Raw response preview:", raw?.substring(0, 200) || "No response");
        break; // Success, exit retry loop
      } catch (geminiError: any) {
        lastError = geminiError;
        console.error(`[Questions API] Gemini API call failed (attempt ${attempt}/${maxRetries}):`, geminiError);
        console.error("[Questions API] Gemini error message:", geminiError?.message);
        
        if (attempt === maxRetries) {
          // Final attempt failed, use fallback
          console.error("[Questions API] All retry attempts failed, using fallback");
          const fallback = shouldFinish ? createFallbackDiagnosis() : createFallbackQuestion();
          return NextResponse.json(fallback, { status: 200 });
        }
        
        // Wait before retry (exponential backoff: 500ms, 1000ms)
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
    
    const extracted = extractJSON(raw);
    
    console.log("[Questions API] Extracted JSON:", extracted ? "Success" : "Failed");

    if (!extracted || typeof extracted !== "object") {
      console.warn("[Questions API] JSON extraction failed, using fallback");
      const fallback = shouldFinish ? createFallbackDiagnosis() : createFallbackQuestion();
      return NextResponse.json(fallback, { status: 200 });
    }

    if (shouldFinish) {
      const diagnosis: DiagnosisResponse = {
        should_finish: true,
        final_diagnosis: {
          diagnosis: Array.isArray(extracted?.final_diagnosis?.diagnosis)
            ? extracted.final_diagnosis.diagnosis.filter((d: any) => typeof d === "string").slice(0, 10)
            : ["לא ניתן לקבוע אבחון מדויק. מומלץ לבצע בדיקה מקצועית במוסך."],
          self_checks: Array.isArray(extracted?.final_diagnosis?.self_checks)
            ? extracted.final_diagnosis.self_checks.filter((s: any) => typeof s === "string").slice(0, 10)
            : [],
          warnings: Array.isArray(extracted?.final_diagnosis?.warnings)
            ? extracted.final_diagnosis.warnings.filter((w: any) => typeof w === "string").slice(0, 10)
            : [],
          disclaimer:
            typeof extracted?.final_diagnosis?.disclaimer === "string"
              ? extracted.final_diagnosis.disclaimer
              : "מידע זה הוא הערכה ראשונית בלבד ואינו מהווה תחליף לבדיקה מקצועית במוסך.",
        },
        recommendations: Array.isArray(extracted?.recommendations)
          ? extracted.recommendations.filter((r: any) => typeof r === "string").slice(0, 10)
          : ["קבע תור לבדיקה במוסך מוסמך"],
        safety_notice: typeof extracted?.safety_notice === "string" ? extracted.safety_notice : undefined,
      };
      return NextResponse.json(diagnosis);
    }

    // Extract question text (support both "question" and "next_question" for backward compatibility)
    const questionText = extracted?.question || extracted?.next_question;
    const extractedType = extracted?.type;
    const extractedOptions = extracted?.options;
    const extractedShouldStop = extracted?.shouldStop;

    // Determine question type and validate options
    let questionType: "yesno" | "multi" = "yesno";
    let options: string[] = ["כן", "לא"];

    if (extractedType === "multi" || (Array.isArray(extractedOptions) && extractedOptions.length >= 3 && extractedOptions.length <= 5)) {
      questionType = "multi";
      if (Array.isArray(extractedOptions) && extractedOptions.length >= 3 && extractedOptions.length <= 5) {
        options = extractedOptions.filter((o: any) => typeof o === "string").slice(0, 5);
      } else {
        // Invalid multi-choice options, fallback to yes/no
        questionType = "yesno";
        options = ["כן", "לא"];
      }
    } else if (extractedType === "yesno" || (Array.isArray(extractedOptions) && extractedOptions.length === 2)) {
      questionType = "yesno";
      if (Array.isArray(extractedOptions) && extractedOptions.length === 2) {
        // Use provided options but ensure they're valid strings
        const validOptions = extractedOptions.filter((o: any) => typeof o === "string");
        if (validOptions.length === 2) {
          options = validOptions;
        } else {
          options = ["כן", "לא"];
        }
      } else {
        options = ["כן", "לא"];
      }
    } else if (Array.isArray(extractedOptions)) {
      // Infer type from options length
      const validOptions = extractedOptions.filter((o: any) => typeof o === "string");
      if (validOptions.length === 2) {
        questionType = "yesno";
        options = validOptions;
      } else if (validOptions.length >= 3 && validOptions.length <= 5) {
        questionType = "multi";
        options = validOptions.slice(0, 5);
      } else {
        // Invalid length, default to yes/no
        questionType = "yesno";
        options = ["כן", "לא"];
      }
    }

    // Validate options length
    if (questionType === "yesno" && options.length !== 2) {
      console.warn("[Questions API] Invalid yes/no options length, using default");
      options = ["כן", "לא"];
    } else if (questionType === "multi" && (options.length < 3 || options.length > 5)) {
      console.warn("[Questions API] Invalid multi-choice options length, using fallback");
      questionType = "yesno";
      options = ["כן", "לא"];
    }

    const question: QuestionResponse = {
      should_finish: false,
      question: typeof questionText === "string" && questionText.trim()
        ? questionText
        : "האם יש תסמינים נוספים?",
      type: questionType,
      options: options,
      shouldStop: typeof extractedShouldStop === "boolean" ? extractedShouldStop : false,
    };

    return NextResponse.json(question);
  } catch (error: any) {
    console.error("[Questions API] Error:", error);
    console.error("[Questions API] Error message:", error?.message);
    console.error("[Questions API] Error stack:", error?.stack);
    // Always return 200 with valid JSON - never break the frontend flow
    const shouldFinish = answers.length >= 5;
    return NextResponse.json(
      shouldFinish ? createFallbackDiagnosis() : createFallbackQuestion(),
      { status: 200 }
    );
  }
}

