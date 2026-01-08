import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

type VehiclePayload = {
  id?: string | number | null;
  manufacturer?: string | null;
  model?: string | null;
  year?: string | number | null;
};

type BodyPayload = {
  user_id?: string;
  vehicle?: VehiclePayload | null;
  description?: string | null;
  images?: string[] | { url: string }[];
  ai_diagnosis?: unknown;
  ai_confidence?: number;
};

function normalizeImages(images: BodyPayload["images"]) {
  if (!Array.isArray(images)) return [];
  return images
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "url" in item && typeof item.url === "string") {
        return item.url.trim();
      }
      return "";
    })
    .filter((url) => url.length > 0)
    .slice(0, 3);
}

export async function POST(req: Request) {
  try {
    const body: BodyPayload = await req.json();
    const { user_id, vehicle, description, ai_diagnosis, ai_confidence } = body;
    const images = normalizeImages(body.images);

    if (!user_id || typeof user_id !== "string" || !user_id.trim()) {
      return NextResponse.json(
        { error: "Missing required field: user_id" },
        { status: 400 }
      );
    }

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { error: "Missing required field: description" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: requestData, error: requestError } = await supabase
      .from("requests")
      .insert({
        user_id: user_id.trim(),
        car_id: vehicle?.id ?? null, // keep car link if provided
        description: description.trim(),
        status: "open",
        image_urls: images,
        ai_diagnosis: ai_diagnosis ?? null,
        ai_confidence:
          typeof ai_confidence === "number" && Number.isFinite(ai_confidence)
            ? ai_confidence
            : null,
      })
      .select("id")
      .single();

    if (requestError || !requestData) {
      console.error("[requests/start] insert error:", requestError);
      return NextResponse.json(
        { error: "Failed to create request", details: requestError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        request_id: requestData.id,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[requests/start] unhandled error:", err);
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}

