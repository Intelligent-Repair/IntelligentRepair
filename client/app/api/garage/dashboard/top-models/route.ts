import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// Helper function to get start date for date range
function getStartDate(dateRange: string | null): Date | null {
  if (!dateRange || dateRange === "all") return null;

  const now = new Date();

  switch (dateRange) {
    case "today":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "monthly":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "yearly":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "local";
    const dateRange = searchParams.get("dateRange");
    const issueType = searchParams.get("issueType");

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let garageId: string | null = null;

    // Get garage ID for local mode
    if (mode !== "global") {
      // First, find the user in public.users table by email
      const { data: publicUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", user.email)
        .single();

      const userIdToMatch = publicUser?.id || user.id;

      const { data: garage, error: garageError } = await supabase
        .from("garages")
        .select("id")
        .eq("owner_user_id", userIdToMatch)
        .single();

      if (garageError || !garage) {
        // Return empty data instead of 404
        return NextResponse.json({ topVehicles: [] });
      }
      garageId = garage.id;
    }

    // Query repairs table for vehicle info
    let query = supabase
      .from("repairs")
      .select("vehicle_info, final_issue_type")
      .not("vehicle_info", "is", null);

    // Apply garage filter
    if (garageId) {
      query = query.eq("garage_id", garageId);
    }

    // Apply date filter
    const startDate = getStartDate(dateRange);
    if (startDate) {
      query = query.gte("completed_at", startDate.toISOString());
    }

    // Apply issue type filter
    if (issueType && issueType !== "all") {
      query = query.eq("final_issue_type", issueType);
    }

    const { data: repairs, error: repairsError } = await query;

    if (repairsError) {
      console.error('[top-models] DB error:', repairsError);
      return NextResponse.json(
        { error: "Failed to fetch repairs", details: repairsError.message },
        { status: 500 }
      );
    }

    // Count occurrences by manufacturer+model
    const vehicleCounts = new Map<string, { manufacturer: string; model: string; count: number }>();

    repairs?.forEach((repair: any) => {
      const vehicleInfo = repair.vehicle_info;
      if (!vehicleInfo) return;

      const manufacturer = vehicleInfo.manufacturer;
      const model = vehicleInfo.model;

      if (!manufacturer) return;

      const key = `${manufacturer}|${model || 'לא ידוע'}`;
      const existing = vehicleCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        vehicleCounts.set(key, {
          manufacturer,
          model: model || 'לא ידוע',
          count: 1,
        });
      }
    });

    // Convert to array, sort by count descending, take top 5
    const top5 = Array.from(vehicleCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({ top5 });
  } catch (err) {
    console.error('[top-models] Server error:', err);
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}
