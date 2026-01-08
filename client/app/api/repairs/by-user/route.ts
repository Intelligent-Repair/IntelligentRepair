import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
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

    // First, get all request IDs for this user
    const { data: userRequests, error: requestsError } = await supabase
      .from("requests")
      .select("id")
      .eq("user_id", user_id);

    if (requestsError) {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch user requests",
          error: requestsError.message,
        },
        { status: 500 }
      );
    }

    if (!userRequests || userRequests.length === 0) {
      return NextResponse.json({
        success: true,
        repairs: [],
      });
    }

    const requestIds = userRequests.map((r) => r.id);

    // Get repairs for these requests
    const { data, error } = await supabase
      .from("repairs")
      .select(`
        id,
        ai_summary,
        mechanic_notes,
        created_at,
        request:requests (
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
        ),
        garage:garages (
          id,
          name
        )
      `)
      .in("request_id", requestIds)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch user repairs",
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      repairs: data,
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

