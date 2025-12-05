import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase();
    const body = await req.json();
    const { user_id, vehicle_id, title, description } = body;

    if (!user_id || !vehicle_id || !title) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("requests")
      .insert({
        user_id,
        vehicle_id,
        title,
        description,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to create request",
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Request created successfully",
      request: data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: "Server error",
        error: (err as Error).message,
      },
      { status: 500 }
    );
  }
}
