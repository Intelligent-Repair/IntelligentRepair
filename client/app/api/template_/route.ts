import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseClient";

// This is a template route. Copy it when creating a new API route.
export async function POST(req: Request) {
  try {
    // Parse body JSON if needed
    const body = await req.json();

    // Example basic response
    return NextResponse.json({
      success: true,
      message: "Template API is working",
      received: body,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "API error",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
