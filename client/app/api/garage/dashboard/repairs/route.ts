import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// Issue type labels in Hebrew
const ISSUE_TYPE_LABELS: Record<string, string> = {
  engine: 'מנוע',
  brakes: 'בלמים',
  electrical: 'חשמל',
  ac: 'מיזוג אוויר',
  starting: 'מערכת התנעה',
  gearbox: 'תיבת הילוכים',
  noise: 'רעש/רטט',
  suspension: 'מתלים',
  transmission: 'הנעה',
  fuel_system: 'מערכת דלק',
  cooling_system: 'מערכת קירור',
  exhaust: 'פליטה',
  tires: 'צמיגים',
  steering: 'היגוי',
  other: 'אחר',
};

// Helper function to apply date range filter
function applyDateRangeFilter(query: any, dateRange: string | null, column: string = "created_at") {
  if (!dateRange || dateRange === "all") return query;

  const now = new Date();
  let startDate: Date;

  switch (dateRange) {
    case "today":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "weekly":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "monthly":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "yearly":
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      return query;
  }

  return query.gte(column, startDate.toISOString());
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "local";
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const limit = 6; // Reduced for less dense display
    const dateRange = searchParams.get("dateRange");
    const issueType = searchParams.get("issueType");
    const manufacturer = searchParams.get("manufacturer");
    const model = searchParams.get("model");
    const year = searchParams.get("year");
    const licensePlate = searchParams.get("licensePlate");

    // Authenticate the user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let garageId: string | null = null;

    // If mode is not "global", get the garage_id for this user
    if (mode !== "global") {
      // Get user's national_id from users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("national_id")
        .eq("id", user.id)
        .single();

      if (userError || !userData?.national_id) {
        console.log('[Dashboard repairs] User national_id not found');
        return NextResponse.json({
          repairs: [],
          totalCount: 0,
        });
      }

      // Find garage by owner_national_id
      const { data: garage, error: garageError } = await supabase
        .from("garages")
        .select("id")
        .eq("owner_national_id", userData.national_id)
        .single();

      if (garageError || !garage) {
        console.log('[Dashboard repairs] Garage not found for national_id:', userData.national_id);
        return NextResponse.json({
          repairs: [],
          totalCount: 0,
        });
      }

      garageId = garage.id;
    }

    // Build query for repairs with new schema
    let query = supabase
      .from("repairs")
      .select(`
        id,
        garage_request_id,
        final_issue_type,
        mechanic_notes,
        mechanic_description_ai,
        ai_summary,
        labor_hours,
        status,
        vehicle_info,
        created_at,
        completed_at,
        garage_request:garage_requests!garage_request_id (
          mechanic_summary
        )
      `, { count: 'exact' })
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    // Apply date range filter
    query = applyDateRangeFilter(query, dateRange, "completed_at");

    // Filter by garage_id if in local mode
    if (garageId !== null) {
      query = query.eq("garage_id", garageId);
    }

    // Filter by issue type
    if (issueType && issueType !== "all") {
      query = query.eq("final_issue_type", issueType);
    }

    // Filter by vehicle_info JSONB fields
    if (manufacturer) {
      query = query.eq("vehicle_info->>manufacturer", manufacturer);
    }
    if (model) {
      query = query.eq("vehicle_info->>model", model);
    }
    if (year) {
      query = query.eq("vehicle_info->>year", year);
    }
    if (licensePlate) {
      query = query.ilike("vehicle_info->>license_plate", `%${licensePlate}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: repairs, error: repairsError, count } = await query;

    if (repairsError) {
      console.error('[Dashboard repairs] Error:', repairsError);
      return NextResponse.json(
        { error: "Failed to fetch repairs", details: repairsError.message },
        { status: 500 }
      );
    }

    // Transform the data for frontend
    const transformedRepairs = (repairs || []).map((repair: any) => {
      const vehicleInfo = repair.vehicle_info || {};
      // Handle garage_request as array or object from Supabase join
      const garageReq = Array.isArray(repair.garage_request)
        ? repair.garage_request[0]
        : repair.garage_request;
      const mechanicSummary = garageReq?.mechanic_summary || null;

      return {
        id: repair.id,
        garage_request_id: repair.garage_request_id,
        final_issue_type: repair.final_issue_type,
        final_issue_type_label: ISSUE_TYPE_LABELS[repair.final_issue_type] || repair.final_issue_type || 'לא צוין',
        mechanic_notes: repair.mechanic_notes,
        mechanic_description_ai: repair.mechanic_description_ai,
        ai_summary: repair.ai_summary,
        labor_hours: repair.labor_hours,
        status: repair.status,
        created_at: repair.created_at,
        completed_at: repair.completed_at,
        vehicle_info: {
          manufacturer: vehicleInfo.manufacturer || null,
          model: vehicleInfo.model || null,
          year: vehicleInfo.year || null,
          license_plate: vehicleInfo.license_plate || null,
          current_mileage: vehicleInfo.current_mileage || null,
        },
        // הנתון החדש - סיכום הפנייה המלא (ממצאי תשאול, ניתוח הסתברותי, פעולות מומלצות)
        mechanic_summary: mechanicSummary,
      };
    });

    return NextResponse.json({
      repairs: transformedRepairs,
      totalCount: count || 0,
    });
  } catch (err) {
    console.error('[Dashboard repairs] Server error:', err);
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}
