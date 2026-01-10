import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createOpenAIClient } from "@/lib/ai/client";
import { buildShortDescriptionPrompt } from "@/lib/ai/prompt-builder";
import { extractJSON } from "../../ai/aiUtils";

// Schema v2 Types
type StoredQuestionsV2 = {
  schemaVersion: 2;
  items: Array<{ id: string; text: string; ts?: string }>;
};

type StoredAnswersV2 = {
  schemaVersion: 2;
  items: Array<{ questionId: string; text: string; ts?: string }>;
};

type RequestBody = {
  draft_id?: string;
  user_id?: string;
  car_id?: string;
  description?: string | null;
  image_urls?: string[] | null;
  ai_questions?: any;
  ai_answers?: any;
  ai_diagnosis?: string;
  ai_recommendations?: string[] | null;
  ai_confidence?: number | null;
  status?: "open" | "closed";
  ai_mechanic_summary?: Record<string, any> | null;
};

function normalizeImageUrls(urls: RequestBody["image_urls"]): string[] | null {
  if (!Array.isArray(urls)) return null;
  const valid = urls
    .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    .slice(0, 3);
  return valid.length > 0 ? valid : null;
}

function normalizeRecommendations(recs: RequestBody["ai_recommendations"]): string[] | null {
  if (!Array.isArray(recs)) return null;
  const valid = recs.filter((r): r is string => typeof r === "string" && r.trim().length > 0);
  return valid.length > 0 ? valid : null;
}

function normalizeQuestions(raw: any): StoredQuestionsV2 | null {
  if (!raw) return null;

  // Already v2 format
  if (raw.schemaVersion === 2 && Array.isArray(raw.items)) {
    return {
      schemaVersion: 2,
      items: raw.items
        .map((q: any, i: number) => ({
          id: String(q.id ?? `q${i + 1}`),
          text: String(q.text ?? "").trim(),
          ts: q.ts ? String(q.ts) : undefined,
        }))
        .filter((q: { text: string }) => q.text),
    };
  }

  // Array of message objects: extract only type="question"
  if (Array.isArray(raw)) {
    // Check if it's an array of plain strings (from frontend state.messages.map(m => m.text))
    if (raw.length > 0 && typeof raw[0] === 'string') {
      const items = raw
        .map((text: string, i: number) => ({
          id: `q${i + 1}`,
          text: String(text ?? "").trim(),
        }))
        .filter((q: { text: string }) => q.text);
      return items.length > 0 ? { schemaVersion: 2, items } : null;
    }

    // Objects with type/sender fields
    const items = raw
      .filter((m: any) => m?.type === "question" || (m?.sender === "ai" && m?.type === "question"))
      .map((m: any, i: number) => ({
        id: String(m.id ?? `q${i + 1}`),
        text: String(m.text ?? m.question ?? "").trim(),
        ts: m.ts ? String(m.ts) : undefined,
      }))
      .filter((q: { text: string }) => q.text);
    return items.length > 0 ? { schemaVersion: 2, items } : null;
  }

  // Legacy: { questions: string[] }
  if (typeof raw === "object" && Array.isArray(raw.questions)) {
    const items = raw.questions
      .map((t: any, i: number) => ({
        id: `q${i + 1}`,
        text: String(t ?? "").trim(),
      }))
      .filter((q: { text: string }) => q.text);
    return items.length > 0 ? { schemaVersion: 2, items } : null;
  }

  return null;
}

function normalizeAnswers(raw: any, questions: StoredQuestionsV2 | null): StoredAnswersV2 | null {
  if (!raw) return null;

  // Already v2 format
  if (raw.schemaVersion === 2 && Array.isArray(raw.items)) {
    return {
      schemaVersion: 2,
      items: raw.items
        .map((a: any, i: number) => ({
          questionId: String(a.questionId ?? questions?.items?.[i]?.id ?? `q${i + 1}`),
          text: String(a.text ?? "").trim(),
          ts: a.ts ? String(a.ts) : undefined,
        }))
        .filter((a: { text: string }) => a.text),
    };
  }

  // Array of message objects: extract user messages
  if (Array.isArray(raw)) {
    // Check if it's an array of plain strings (from frontend state.messages.map(m => m.text))
    if (raw.length > 0 && typeof raw[0] === 'string') {
      const items = raw
        .map((text: string, i: number) => ({
          questionId: questions?.items?.[i]?.id ?? `q${i + 1}`,
          text: String(text ?? "").trim(),
        }))
        .filter((a: { text: string }) => a.text);
      return items.length > 0 ? { schemaVersion: 2, items } : null;
    }

    // Objects with sender/kind fields
    const userAnswers = raw.filter((m: any) => m?.sender === "user" || m?.kind === "user");
    const items = userAnswers
      .map((m: any, i: number) => ({
        questionId: questions?.items?.[i]?.id ?? `q${i + 1}`,
        text: String(m.text ?? m.answer ?? "").trim(),
        ts: m.ts ? String(m.ts) : undefined,
      }))
      .filter((a: { text: string }) => a.text);
    return items.length > 0 ? { schemaVersion: 2, items } : null;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json();

    const { draft_id, user_id, car_id, description, status } = body;

    // Validate required fields
    if (!user_id || typeof user_id !== "string" || !user_id.trim()) {
      return NextResponse.json({ error: "Missing required field: user_id" }, { status: 400 });
    }

    if (!car_id || typeof car_id !== "string" || !car_id.trim()) {
      return NextResponse.json({ error: "Missing required field: car_id" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Normalize data
    const normalizedImages = normalizeImageUrls(body.image_urls);
    const normalizedRecommendations = normalizeRecommendations(body.ai_recommendations);
    const qv2 = normalizeQuestions(body.ai_questions);
    const av2 = normalizeAnswers(body.ai_answers, qv2);

    // DEBUG: Log what we received
    console.log('[from-draft] Received body.ai_questions:', JSON.stringify(body.ai_questions)?.substring(0, 200));
    console.log('[from-draft] Received body.ai_answers:', JSON.stringify(body.ai_answers)?.substring(0, 200));
    console.log('[from-draft] Received body.ai_mechanic_summary:', body.ai_mechanic_summary ? 'EXISTS' : 'NULL');
    console.log('[from-draft] Normalized qv2:', qv2 ? `${qv2.items.length} items` : 'NULL');
    console.log('[from-draft] Normalized av2:', av2 ? `${av2.items.length} items` : 'NULL');

    // Confidence: use actual value or null (never hardcode)
    const ai_confidence =
      typeof body.ai_confidence === "number" &&
        Number.isFinite(body.ai_confidence) &&
        body.ai_confidence >= 0 &&
        body.ai_confidence <= 1
        ? body.ai_confidence
        : null;

    // Mechanic summary: store as-is (no generation here)
    const ai_mechanic_summary = body.ai_mechanic_summary ?? null;

    // Generate description if missing
    let finalDescription: string | null = null;
    if (typeof description === "string" && description.trim().length > 0) {
      finalDescription = description.trim();
    } else if (body.ai_diagnosis && typeof body.ai_diagnosis === "string") {
      try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
          const client = createOpenAIClient(apiKey, "gpt-4o", {
            responseFormat: { type: "json_object" },
          });
          const prompt = buildShortDescriptionPrompt(body.ai_diagnosis.trim());
          const response = await client.generateContent(prompt, {
            timeout: 30000,
            retries: { maxRetries: 2, backoffMs: [1000, 2000] },
          });
          const extracted = extractJSON(response);
          if (extracted && typeof extracted.description === "string" && extracted.description.trim()) {
            finalDescription = extracted.description.trim();
          }
        }
      } catch {
        // Continue without description
      }
    }

    // Build payload
    const payload: Record<string, any> = {
      user_id: user_id.trim(),
      car_id: car_id.trim(),
      description: finalDescription,
      status: status === "closed" ? "closed" : "open",
      image_urls: normalizedImages,
      ai_questions: qv2,
      ai_answers: av2,
      ai_diagnosis: body.ai_diagnosis?.trim() ?? null,
      ai_recommendations: normalizedRecommendations,
      ai_confidence,
      ai_mechanic_summary,
    };

    let requestId: string | null = null;

    // If draft_id provided and valid UUID, try update first
    if (draft_id && typeof draft_id === "string" && draft_id.trim()) {
      const { data: existing, error: checkError } = await supabase
        .from("requests")
        .select("id")
        .eq("id", draft_id.trim())
        .maybeSingle();

      if (!checkError && existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from("requests")
          .update(payload)
          .eq("id", draft_id.trim());

        if (!updateError) {
          requestId = draft_id.trim();
        }
      }
    }

    // If no update happened, insert new
    if (!requestId) {
      const { data: insertData, error: insertError } = await supabase
        .from("requests")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) {
        console.error("[from-draft] Insert error:", insertError.message);
        return NextResponse.json(
          { error: "Failed to create request", details: insertError.message },
          { status: 500 }
        );
      }

      if (!insertData?.id) {
        return NextResponse.json({ error: "Failed to create request: No ID returned" }, { status: 500 });
      }

      requestId = insertData.id;
    }

    return NextResponse.json({
      ok: true,
      request_id: requestId,
    });
  } catch (err) {
    console.error("[from-draft] Error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
