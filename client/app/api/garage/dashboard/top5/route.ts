import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "local";

    // Authenticate the user (required for both modes)
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

    let garageId: number | null = null;

    // If mode is not "global", get the garage_id for this user
    if (mode !== "global") {
      // Try owner_user_id first (from registration), then user_id as fallback
      const { data: garage, error: garageError } = await supabase
        .from("garages")
        .select("id")
        .or(`owner_user_id.eq.${user.id},user_id.eq.${user.id}`)
        .single();

      if (garageError || !garage) {
        return NextResponse.json(
          { error: "Garage not found" },
          { status: 404 }
        );
      }

      garageId = garage.id;
    }

    // Build query to count repairs by vehicle
    // We need: repairs -> requests -> people_cars -> vehicle_catalog
    let query = supabase
      .from("repairs")
      .select(`
        request:requests (
          car:people_cars (
            vehicle_catalog:vehicle_catalog_id (
              manufacturer,
              model
            )
          )
        )
      `);

    // Filter by garage_id if in local mode
    if (garageId !== null) {
      query = query.eq("garage_id", garageId);
    }

    const { data: repairs, error: repairsError } = await query;

    if (repairsError) {
      return NextResponse.json(
        { error: "Failed to fetch repairs", details: repairsError.message },
        { status: 500 }
      );
    }

    // Count vehicles by manufacturer + model combination
    const vehicleCounts = new Map<string, { manufacturer: string; model: string; count: number }>();

    repairs?.forEach((repair: any) => {
      const catalog = repair.request?.car?.vehicle_catalog;
      if (catalog && catalog.manufacturer && catalog.model) {
        const key = `${catalog.manufacturer}|${catalog.model}`;
        const existing = vehicleCounts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          vehicleCounts.set(key, {
            manufacturer: catalog.manufacturer,
            model: catalog.model,
            count: 1,
          });
        }
      }
    });

    // Convert to array, sort by count descending, take top 5
    const top5 = Array.from(vehicleCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      top5,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}

