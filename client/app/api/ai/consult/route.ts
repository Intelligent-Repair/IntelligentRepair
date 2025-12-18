import { NextResponse } from "next/server";
import { createOpenAIClient } from "@/lib/ai/client";
import { createServerSupabase } from "@/lib/supabaseServer";
import { extractJSON } from "../aiUtils";

type RequestId = string | number;

interface VehiclePayload {
  manufacturer: string;
  model: string;
  year?: string | number | null;
}

interface AnswerPayload {
  question_id: string;
  answer: string;
}

interface ImagePayload {
  url: string;
}

interface OpenAIQuestion {
  id: string;
  text: string;
  options: string[];
}

interface OpenAIDiagnosis {
  title: string;
  summary: string;
  recommendations: string[];
}

interface ConsultationResponse {
  type: "question" | "diagnosis";
  confidence: number;
  question?: OpenAIQuestion;
  diagnosis?: OpenAIDiagnosis;
  request_image?: boolean;
}

const OPENAI_MODEL = "gpt-4o";

function clampConfidence(value: any): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function buildPrompt(
  vehicle: VehiclePayload,
  description: string,
  answers: AnswerPayload[],
  images: ImagePayload[]
): string {
  const yearText = vehicle.year ? `, שנה ${vehicle.year}` : "";
  const answersText =
    answers.length > 0
      ? answers
          .map(
            (item, index) =>
              `שאלה ${index + 1} (${item.question_id || "לא ידוע"}): ${item.answer}`
          )
          .join("\n")
      : "אין תשובות קודמות.";
  const imagesText =
    images.length > 0
      ? images
          .map((img, index) => `תמונה ${index + 1}: ${img.url}`)
          .join("\n")
      : "לא סופקו תמונות.";

  return `אתה מכונאי רכב מנוסה ורגוע. דבר בעברית בלבד במשפטים קצרים.
אל תשאל שאלות פתוחות. שאל רק שאלות כן/לא או רב ברירה (3-5 אפשרויות).
בקש תמונה נוספת לכל היותר פעם אחת (סמן request_image=true אם צריך).
אם רמת הביטחון שלך היא 0.8 ומעלה - החזר אבחנה מיד בלי שאלה נוספת.

נתוני רכב: ${vehicle.manufacturer} ${vehicle.model}${yearText}
תיאור התקלה: "${description}"
תשובות קודמות:
${answersText}
תמונות שסופקו (השתמש כקונטקסט בלבד, אל תדרוש המרה): 
${imagesText}

החזר אך ורק JSON תקף בפורמט הזה:
{
  "type": "question" או "diagnosis",
  "confidence": מספר בין 0 ל-1,
  "question": {
    "id": "מזהה ייחודי",
    "text": "שאלה סגורה בלבד",
    "options": ["אפשרות 1", "אפשרות 2" ... עד 5]
  },
  "diagnosis": {
    "title": "כותרת קצרה",
    "summary": "סיכום קצר",
    "recommendations": ["המלצה 1", "המלצה 2", "המלצה 3"]
  },
  "request_image": true או false
}

חייב להחזיר אחד משני סוגים:
- type=question: שאלת כן/לא (2 אפשרויות) או רב ברירה (3-5 אפשרויות).
- type=diagnosis: אם confidence >= 0.8 או יש מספיק מידע.`;
}

function fallbackResponse(): ConsultationResponse {
  return {
    type: "question",
    confidence: 0.3,
    question: {
      id: "fallback-question",
      text: "האם התסמין קורה רק בזמן נסיעה?",
      options: ["כן", "לא"],
    },
    request_image: false,
  };
}

function normalizeResponse(raw: any): ConsultationResponse | null {
  if (!raw || typeof raw !== "object") return null;

  const confidence = clampConfidence(raw.confidence);
  const type = raw.type === "diagnosis" ? "diagnosis" : raw.type === "question" ? "question" : null;
  if (!type) return null;

  if (type === "diagnosis") {
    const diagnosis = raw.diagnosis;
    if (!diagnosis || typeof diagnosis !== "object") return null;

    const title = typeof diagnosis.title === "string" && diagnosis.title.trim().length > 0
      ? diagnosis.title.trim()
      : "אבחנה ראשונית";
    const summary = typeof diagnosis.summary === "string" && diagnosis.summary.trim().length > 0
      ? diagnosis.summary.trim()
      : "נדרש איסוף מידע נוסף, אך זוהי ההשערה הראשונית.";
    const recommendations = Array.isArray(diagnosis.recommendations)
      ? diagnosis.recommendations.filter((item: any) => typeof item === "string").slice(0, 5)
      : [];

    return {
      type: "diagnosis",
      confidence,
      diagnosis: {
        title,
        summary,
        recommendations,
      },
      request_image: Boolean(raw.request_image),
    };
  }

  // type === "question"
  const question = raw.question;
  const text =
    typeof question?.text === "string" && question.text.trim().length > 0
      ? question.text.trim()
      : null;
  const options = Array.isArray(question?.options)
    ? question.options.filter((opt: any) => typeof opt === "string" && opt.trim().length > 0)
    : [];

  const normalizedOptions =
    options.length === 2
      ? options
      : options.length >= 3 && options.length <= 5
        ? options.slice(0, 5)
        : ["כן", "לא"];

  const normalizedText = text || "האם קיימים תסמינים נוספים?";
  const id =
    typeof question?.id === "string" && question.id.trim().length > 0
      ? question.id.trim()
      : "question-" + Date.now();

  return {
    type: "question",
    confidence,
    question: {
      id,
      text: normalizedText,
      options: normalizedOptions,
    },
    request_image: Boolean(raw.request_image),
  };
}

function sanitizeBody(body: any) {
  const request_id: RequestId = body?.request_id;
  const vehicle: VehiclePayload = body?.vehicle || {};
  const description: string = body?.description;
  const answers: AnswerPayload[] = Array.isArray(body?.answers)
    ? body.answers
        .filter(
          (item: any) =>
            item &&
            typeof item.question_id === "string" &&
            item.question_id.trim() &&
            typeof item.answer === "string"
        )
        .map((item: any) => ({
          question_id: item.question_id.trim(),
          answer: item.answer.trim(),
        }))
    : [];
  const images: ImagePayload[] = Array.isArray(body?.images)
    ? body.images
        .filter((img: any) => img && typeof img.url === "string" && img.url.trim())
        .slice(0, 3)
        .map((img: any) => ({ url: img.url.trim() }))
    : [];

  return { request_id, vehicle, description, answers, images };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { request_id, vehicle, description, answers, images } = sanitizeBody(body);

    if (!request_id) {
      return NextResponse.json({ error: "request_id is required" }, { status: 400 });
    }

    if (
      !vehicle ||
      typeof vehicle.manufacturer !== "string" ||
      typeof vehicle.model !== "string" ||
      !vehicle.manufacturer.trim() ||
      !vehicle.model.trim()
    ) {
      return NextResponse.json(
        { error: "vehicle.manufacturer and vehicle.model are required" },
        { status: 400 }
      );
    }

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[Consult API] Missing OPENAI_API_KEY");
      return NextResponse.json(fallbackResponse(), { status: 200 });
    }

    const client = createOpenAIClient(apiKey, OPENAI_MODEL, {
      temperature: 0,
      responseFormat: { type: "json_object" },
    });

    const prompt = buildPrompt(vehicle, description.trim(), answers, images);
    const rawText = await client.generateContent(prompt);

    const parsed = extractJSON(rawText);
    const normalized = normalizeResponse(parsed) || fallbackResponse();

    // Persist to requests table
    try {
      const supabase = await createServerSupabase();
      const imageUrls = images.map((img) => img.url);
      const updatePayload: Record<string, any> = {
        ai_questions: normalized.type === "question" ? normalized.question : null,
        ai_answers: answers,
        ai_diagnosis: normalized.type === "diagnosis" ? normalized.diagnosis : null,
        ai_confidence: normalized.confidence ?? null,
      };

      if (imageUrls.length > 0) {
        updatePayload.image_urls = imageUrls;
      }

      const { error: dbError } = await supabase
        .from("requests")
        .update(updatePayload)
        .eq("id", request_id);

      if (dbError) {
        console.error("[Consult API] Failed to persist AI result", dbError);
      }
    } catch (dbErr) {
      console.error("[Consult API] DB error while persisting AI result", dbErr);
    }

    return NextResponse.json(normalized, { status: 200 });
  } catch (err: any) {
    console.error("[Consult API] Error", err);
    const fallback = fallbackResponse();
    return NextResponse.json(fallback, { status: 200 });
  }
}
