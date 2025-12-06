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
  next_question: string;
  options?: string[];
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
    : `Ask ONE more diagnostic question to narrow down the issue:
- Question must be SHORT and CLEAR
- Question can be yes/no (options: ["כן", "לא"]) OR multi-choice with 3-5 options
- For multi-choice, provide specific options that help differentiate between causes
- Question should help differentiate between potential causes

Return JSON:
{
  "next_question": "Question text",
  "options": ["כן", "לא"] OR ["option1", "option2", "option3", ...]
}`}`;
}

function createFallbackQuestion(): QuestionResponse {
  return {
    should_finish: false,
    next_question: "האם הבעיה מתרחשת רק בזמן נסיעה?",
    options: ["כן", "לא"],
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
    
    let raw: string;
    try {
      const result = await model.generateContent(prompt);
      raw = result.response.text();
      
      console.log("[Questions API] Raw response length:", raw?.length || 0);
      console.log("[Questions API] Raw response preview:", raw?.substring(0, 200) || "No response");
    } catch (geminiError: any) {
      console.error("[Questions API] Gemini API call failed:", geminiError);
      console.error("[Questions API] Gemini error message:", geminiError?.message);
      // Use fallback on Gemini API failure
      const fallback = shouldFinish ? createFallbackDiagnosis() : createFallbackQuestion();
      return NextResponse.json(fallback, { status: 200 });
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

    const question: QuestionResponse = {
      should_finish: false,
      next_question:
        typeof extracted?.next_question === "string" && extracted.next_question.trim()
          ? extracted.next_question
          : "האם יש תסמינים נוספים?",
      options: Array.isArray(extracted?.options) && extracted.options.length > 0
        ? extracted.options.filter((o: any) => typeof o === "string").slice(0, 5)
        : ["כן", "לא"],
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

