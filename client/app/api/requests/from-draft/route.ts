import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createOpenAIClient } from "@/lib/ai/client";
import { buildShortDescriptionPrompt } from "@/lib/ai/prompt-builder";
import { extractJSON } from "../../ai/aiUtils";

type RequestBody = {
  draft_id?: string;
  user_id?: string;
  car_id?: string;
  description?: string | null;
  image_urls?: string[] | null;
  ai_questions?: any; // json | null
  ai_answers?: any; // json | null
  ai_diagnosis?: string;
  ai_recommendations?: string[] | null;
  ai_confidence?: number | null;
<<<<<<< HEAD
=======
  status?: 'open' | 'closed';  // NEW: request status
  ai_mechanic_summary?: Record<string, any> | null;  // NEW: full mechanic summary
>>>>>>> rescue/ui-stable
};

function normalizeImageUrls(urls: RequestBody["image_urls"]): string[] | null {
  if (!Array.isArray(urls)) return null;
  const valid = urls
    .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    .slice(0, 3); // Limit to 3 images
  return valid.length > 0 ? valid : null;
}

function normalizeRecommendations(
  recs: RequestBody["ai_recommendations"],
): string[] | null {
  if (!Array.isArray(recs)) return null;
  const valid = recs.filter(
    (r): r is string => typeof r === "string" && r.trim().length > 0,
  );
  return valid.length > 0 ? valid : null;
}

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json();

    console.log("[from-draft] incoming payload", {
      hasDraftId: !!body.draft_id,
      hasUserId: !!body.user_id,
      hasCarId: !!body.car_id,
      hasDiagnosis: !!body.ai_diagnosis,
    });

    const {
      draft_id,
      user_id,
      car_id,
      description,
      image_urls,
      ai_questions,
      ai_answers,
      ai_diagnosis,
      ai_recommendations,
      ai_confidence,
<<<<<<< HEAD
=======
      status,
      ai_mechanic_summary,
>>>>>>> rescue/ui-stable
    } = body;

    // Step 1 – Validate required fields
    if (!draft_id || typeof draft_id !== "string" || !draft_id.trim()) {
      return NextResponse.json(
        { error: "Missing required field: draft_id" },
        { status: 400 },
      );
    }

    if (!user_id || typeof user_id !== "string" || !user_id.trim()) {
      return NextResponse.json(
        { error: "Missing required field: user_id" },
        { status: 400 },
      );
    }

    if (!car_id || typeof car_id !== "string" || !car_id.trim()) {
      return NextResponse.json(
        { error: "Missing required field: car_id" },
        { status: 400 },
      );
    }

    if (!ai_diagnosis || typeof ai_diagnosis !== "string" || !ai_diagnosis.trim()) {
      return NextResponse.json(
        { error: "Missing required field: ai_diagnosis" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Step 2 – Idempotency check: does a request already exist for this draft_id?
    let draftIdColumnExists = true;
    try {
      const { data: existingRequest, error: checkError } = await supabase
        .from("requests")
        .select("id")
        .eq("draft_id", draft_id.trim())
        .maybeSingle();

      if (checkError) {
        // If the error indicates the draft_id column doesn't exist, mark and continue
        const msg = checkError.message || "";
        if (msg.includes("column") && msg.includes("draft_id")) {
          draftIdColumnExists = false;
          console.warn(
            "[from-draft] draft_id column does not exist on requests table; idempotency by draft_id disabled",
          );
        } else {
          console.warn(
            "[from-draft] error while checking existing request by draft_id",
            checkError,
          );
        }
      }

      if (existingRequest) {
        console.log("[from-draft] existing request found", {
          draft_id: draft_id.trim(),
          request_id: existingRequest.id,
        });
        return NextResponse.json(
          {
            request_id: existingRequest.id,
            status: "existing",
          },
          { status: 200 },
        );
      }
    } catch (checkErr) {
      // Any unexpected error during the check should not block creation
      console.warn(
        "[from-draft] unexpected error while checking existing request",
        checkErr,
      );
    }

    // Step 3 – Prepare insert payload
    const normalizedImages = normalizeImageUrls(image_urls);
    const normalizedRecommendations = normalizeRecommendations(ai_recommendations);

    const validatedConfidence =
      typeof ai_confidence === "number" &&
<<<<<<< HEAD
      Number.isFinite(ai_confidence) &&
      ai_confidence >= 0 &&
      ai_confidence <= 1
=======
        Number.isFinite(ai_confidence) &&
        ai_confidence >= 0 &&
        ai_confidence <= 1
>>>>>>> rescue/ui-stable
        ? ai_confidence
        : null;

    // Generate description if missing
    let finalDescription: string | null = null;
    if (typeof description === "string" && description.trim().length > 0) {
      finalDescription = description.trim();
    } else {
      // Generate short description using ChatGPT based on diagnosis
      try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
          const client = createOpenAIClient(apiKey, "gpt-4o", {
            responseFormat: { type: "json_object" },
          });
          const prompt = buildShortDescriptionPrompt(ai_diagnosis.trim());
          const response = await client.generateContent(prompt, {
            timeout: 30000,
            retries: {
              maxRetries: 2,
              backoffMs: [1000, 2000],
            },
          });
          const extracted = extractJSON(response);
          if (extracted && typeof extracted.description === "string" && extracted.description.trim()) {
            finalDescription = extracted.description.trim();
            console.log("[from-draft] Generated description:", finalDescription);
          }
        }
      } catch (err) {
        console.error("[from-draft] Failed to generate description:", err);
        // Continue without description if generation fails
      }
    }

    const insertPayload: Record<string, any> = {
      user_id: user_id.trim(),
      car_id: car_id.trim(),
      description: finalDescription,
<<<<<<< HEAD
      status: "open",
=======
      status: status === 'closed' ? 'closed' : 'open',  // Use provided status or default to 'open'
>>>>>>> rescue/ui-stable
      image_urls: normalizedImages,
      ai_diagnosis: ai_diagnosis.trim(),
      ai_confidence: validatedConfidence,
      ai_questions: ai_questions ?? null,
      ai_answers: ai_answers ?? null,
      ai_recommendations: normalizedRecommendations,
<<<<<<< HEAD
=======
      ai_mechanic_summary: ai_mechanic_summary ?? null,  // NEW: mechanic summary
>>>>>>> rescue/ui-stable
    };

    if (draftIdColumnExists) {
      insertPayload.draft_id = draft_id.trim();
    }

    // Attempt insert (with draft_id if column assumed to exist)
    let requestId: string | null = null;

    const attemptInsert = async (payload: Record<string, any>) => {
      const { data, error } = await supabase
        .from("requests")
        .insert(payload)
        .select("id")
        .single();
      return { data, error };
    };

    let { data: requestData, error: insertError } = await attemptInsert(insertPayload);

    // Handle draft_id column missing at insert time – retry without draft_id
    if (insertError && draftIdColumnExists) {
      const msg = insertError.message || "";
      if (msg.includes("column") && msg.includes("draft_id")) {
        console.warn(
          "[from-draft] draft_id column missing during insert, retrying without draft_id",
          insertError,
        );
        draftIdColumnExists = false;
        delete insertPayload.draft_id;
        ({ data: requestData, error: insertError } = await attemptInsert(insertPayload));
      }
    }

    if (insertError) {
      console.error("[from-draft] insert error", insertError);

      // Handle unique constraint on draft_id (if it exists)
      const msg = insertError.message || "";
      if (
        msg.includes("duplicate") ||
        msg.includes("unique") ||
        insertError.code === "23505"
      ) {
        try {
          const { data: existing } = await supabase
            .from("requests")
            .select("id")
            .eq("draft_id", draft_id.trim())
            .maybeSingle();
          if (existing) {
            console.log("[from-draft] existing request found after unique violation", {
              draft_id: draft_id.trim(),
              request_id: existing.id,
            });
            return NextResponse.json(
              {
                request_id: existing.id,
                status: "existing",
              },
              { status: 200 },
            );
          }
        } catch (fetchErr) {
          console.warn(
            "[from-draft] failed to fetch existing request after unique violation",
            fetchErr,
          );
        }
      }

      return NextResponse.json(
        {
          error: "Failed to create request",
          details: insertError.message,
        },
        { status: 500 },
      );
    }

    if (!requestData || !requestData.id) {
      console.error(
        "[from-draft] insert completed but no ID was returned in response",
        requestData,
      );
      return NextResponse.json(
        {
          error: "Failed to create request: No ID returned",
        },
        { status: 500 },
      );
    }

    requestId = requestData.id;

    console.log("[from-draft] request created", {
      draft_id: draft_id.trim(),
      request_id: requestId,
    });

    return NextResponse.json(
      {
        request_id: requestId,
        status: "created",
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[from-draft] unhandled error", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

