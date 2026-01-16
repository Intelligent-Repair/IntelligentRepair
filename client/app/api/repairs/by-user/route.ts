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

    // Step 1: Get all requests for this user
    const { data: userRequests, error: requestsError } = await supabase
      .from("requests")
      .select("id")
      .eq("user_id", user_id);

    if (requestsError) {
      console.error("[repairs/by-user] Error fetching user requests:", requestsError);
      return NextResponse.json(
        { success: false, message: "שגיאה בטעינת הנתונים", error: requestsError.message },
        { status: 500 }
      );
    }

    const requestIds = (userRequests || []).map(r => r.id);

    if (requestIds.length === 0) {
      return NextResponse.json({ success: true, repairs: [] });
    }

    // Step 2: Fetch repairs that belong to those requests
    const { data: repairs, error: repairsError } = await supabase
      .from("repairs")
      .select(`
        id,
        request_id,
        mechanic_notes,
        ai_summary,
        final_issue_type,
        created_at,
        completed_at,
        vehicle_info,
        garage:garages!garage_id (
          id,
          name
        )
      `)
      .in("request_id", requestIds)
      .order("completed_at", { ascending: false, nullsFirst: false });

    if (repairsError) {
      console.error("[repairs/by-user] Error fetching repairs:", repairsError);
      return NextResponse.json(
        { success: false, message: "שגיאה בטעינת היסטוריית הטיפולים", error: repairsError.message },
        { status: 500 }
      );
    }

    // Step 3: Get car details for the repairs
    const { data: requestsWithCars } = await supabase
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
      .in("id", requestIds);

    const requestMap = new Map((requestsWithCars || []).map(r => [r.id, r]));

    // Transform data for frontend
    const transformedRepairs = (repairs || []).map((repair: any) => {
      const request = requestMap.get(repair.request_id);
      const vehicleInfo = repair.vehicle_info || {};

      return {
        id: repair.id,
        ai_summary: repair.ai_summary || null,
        mechanic_notes: repair.mechanic_notes || null,
        final_issue_type: repair.final_issue_type || null,
        created_at: repair.completed_at || repair.created_at,
        request: request ? {
          id: request.id,
          description: repair.mechanic_notes || request.description,
          status: request.status,
          created_at: request.created_at,
          car_id: request.car_id,
          car: request.car || {
            id: null,
            license_plate: vehicleInfo.license_plate || null,
            vehicle_catalog: {
              manufacturer: vehicleInfo.manufacturer || null,
              model: vehicleInfo.model || null,
            }
          },
        } : null,
        garage: repair.garage || null,
      };
    });

    return NextResponse.json({
      success: true,
      repairs: transformedRepairs,
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

