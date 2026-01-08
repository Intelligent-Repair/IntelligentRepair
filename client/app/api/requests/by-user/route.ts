import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const supabase = await createServerSupabase();
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
      description,
      status,
      created_at,
      car:people_cars (
        license_plate,
        vehicle_catalog:vehicle_catalog_id (
          manufacturer,
          model
        )
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
