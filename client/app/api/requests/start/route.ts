import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { car_id, description, media_urls, user_id } = body;

    if (!car_id || !description || !user_id) {
      return NextResponse.json(
        { error: "Missing required fields: car_id, description, and user_id" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();

    // Create the request
    const { data: requestData, error: requestError } = await supabase
      .from("requests")
      .insert({
        user_id,
        vehicle_id: car_id, // vehicle_id refers to people_cars.id
        description,
        media_urls: media_urls || [],
        status: "pending",
      })
      .select()
      .single();

    if (requestError) {
      return NextResponse.json(
        { error: "Failed to create request", details: requestError.message },
        { status: 500 }
      );
    }

    // For now, return mock questions. In a real implementation,
    // this would call an AI service to generate questions
    const questions = [
      "מהו סוג התקלה שאתה חווה?",
      "מתי התחילה התקלה?",
      "האם הרכב עדיין נוהג?",
    ];

    return NextResponse.json({
      request_id: requestData.id,
      questions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}

