import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");

  if (!user_id) {
    return NextResponse.json(
      {
        success: false,
        message: "Missing user_id parameter",
      },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("requests")
    .select(`
      id,
      title,
      description,
      status,
      created_at,
      vehicle:vehicles (
        manufacturer,
        model,
        license_plate
      )
    `)
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch user requests",
        error: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    requests: data,
  });
}
