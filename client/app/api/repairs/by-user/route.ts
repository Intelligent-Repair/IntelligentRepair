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

    // Fetch closed requests (completed consultations) for this user
    // This is the actual repair history - requests that were completed
    const { data, error } = await supabase
      .from("requests")
      .select(`
        id,
        description,
        status,
        created_at,
        car_id,
        car:people_cars (
          id,
          license_plate,
          vehicle_catalog:vehicle_catalog_id (
            manufacturer,
            model
          )
        )
      `)
      .eq("user_id", user_id)
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[repairs/by-user] Error fetching closed requests:", error);
      console.error("[repairs/by-user] Error details:", JSON.stringify(error, null, 2));
      return NextResponse.json(
        {
          success: false,
          message: "שגיאה בטעינת היסטוריית הטיפולים",
          error: error.message,
        },
        { status: 500 }
      );
    }

    // Transform data to match expected format for the repairs page
    const repairs = (data || []).map((request) => ({
      id: request.id,
      ai_summary: request.description || null,
      mechanic_notes: null,
      final_issue_type: null,
      created_at: request.created_at,
      request: {
        id: request.id,
        description: request.description,
        status: request.status,
        created_at: request.created_at,
        car_id: request.car_id,
        car: request.car,
      },
      garage: null,
    }));

    return NextResponse.json({
      success: true,
      repairs: repairs,
    });
  } catch (err) {
    console.error("[repairs/by-user] Server error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "שגיאת שרת",
        error: (err as Error).message,
      },
      { status: 500 }
    );
  }
}

