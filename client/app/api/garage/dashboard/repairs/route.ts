import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// Helper function to apply date range filter
type HasGte<T> = { gte: (column: string, value: string) => T };
type VehicleCatalog = { manufacturer: string | null; model: string | null };
type VehicleCatalogJoin = VehicleCatalog | VehicleCatalog[] | null | undefined;
type CarJoin =
  | {
      license_plate: string | null;
      vehicle_catalog?: VehicleCatalogJoin;
    }
  | null
  | undefined;
type RequestJoin =
  | {
      id: string;
      description: string | null;
      ai_mechanic_summary: string | null;
      created_at: string;
      car?: CarJoin | CarJoin[] | null;
    }
  | null
  | undefined;
type RepairRow = {
  id: string;
  mechanic_notes: string | null;
  created_at: string;
  request?: RequestJoin | RequestJoin[] | null;
};

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function applyDateRangeFilter<T extends HasGte<T>>(query: T, dateRange: string | null): T {
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
  
  return query.gte("created_at", startDate.toISOString());
}

// Helper function to check if description matches issue type
function matchesIssueType(description: string | null, issueType: string | null): boolean {
  if (!issueType || issueType === "all" || !description) return true;
  
  const desc = description.toLowerCase();
  const type = issueType.toLowerCase();
  
  if (type === "engine") return desc.includes("מנוע") || desc.includes("engine") || desc.includes("חום") || desc.includes("שמן");
  if (type === "brakes") return desc.includes("בלמים") || desc.includes("brake") || desc.includes("בלימה");
  if (type === "electrical") return desc.includes("חשמל") || desc.includes("electrical") || desc.includes("חשמלי");
  if (type === "ac") return desc.includes("מיזוג") || desc.includes("ac") || desc.includes("קירור");
  if (type === "starting") return desc.includes("התנעה") || desc.includes("start") || desc.includes("מצבר");
  if (type === "gearbox") return desc.includes("תיבת") || desc.includes("gearbox") || desc.includes("הילוכים");
  if (type === "noise") return desc.includes("רעש") || desc.includes("noise") || desc.includes("רטט");
  
  return true;
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "local";
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const limit = 5; // 5 records per page
    const manufacturers = searchParams.get("manufacturers")?.split(",").filter(Boolean) || [];
    const models = searchParams.get("models")?.split(",").filter(Boolean) || [];
    const dateRange = searchParams.get("dateRange");
    const issueType = searchParams.get("issueType");

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

    let garageId: string | null = null;

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

      const id = (garage as { id?: unknown }).id;
      garageId = typeof id === "string" ? id : null;
    }

    // Build query for repairs with all required fields
    let query = supabase
      .from("repairs")
      .select(`
        id,
        mechanic_notes,
        created_at,
        request:requests (
          id,
          description,
          ai_mechanic_summary,
          created_at,
          car:people_cars (
            license_plate,
            vehicle_catalog:vehicle_catalog_id (
              manufacturer,
              model
            )
          )
        )
      `)
      .order("created_at", { ascending: false });

    // Apply date range filter on repairs.created_at
    query = applyDateRangeFilter(query, dateRange);

    // Filter by garage_id if in local mode
    if (garageId !== null) {
      query = query.eq("garage_id", garageId);
    }

    // Get all repairs first (we'll filter in memory for complex filters)
    const { data: repairsRaw, error: repairsError } = await query;

    if (repairsError) {
      return NextResponse.json(
        { error: "Failed to fetch repairs", details: repairsError.message },
        { status: 500 }
      );
    }
    // Supabase nested selects can come back as arrays depending on FK metadata.
    // We normalize via `firstOrNull` below.
    const repairs = (repairsRaw ?? []) as unknown as RepairRow[];

    // Apply filters in memory
    const filteredRepairs = repairs.filter((repair) => {
      const request = firstOrNull(repair.request as RequestJoin | RequestJoin[] | null | undefined);
      const car = firstOrNull(request?.car as CarJoin | CarJoin[] | null | undefined);
      const catalog = firstOrNull(car?.vehicle_catalog as VehicleCatalogJoin);

      // Manufacturer filter
      if (manufacturers.length > 0 && (!catalog?.manufacturer || !manufacturers.includes(catalog.manufacturer))) {
        return false;
      }

      // Model filter
      if (models.length > 0 && (!catalog?.model || !models.includes(catalog.model))) {
        return false;
      }

      // Issue type filter
      const description = request?.ai_mechanic_summary || request?.description || "";
      if (!matchesIssueType(description, issueType)) {
        return false;
      }

      return true;
    });

    // Get total count before pagination
    const totalCount = filteredRepairs.length;

    // Apply pagination
    const paginatedRepairs = filteredRepairs.slice(offset, offset + limit);

    // Transform the data to match the expected structure
    const transformedRepairs = paginatedRepairs.map((repair) => {
      const request = firstOrNull(repair.request as RequestJoin | RequestJoin[] | null | undefined);
      const car = firstOrNull(request?.car as CarJoin | CarJoin[] | null | undefined);
      const catalog = firstOrNull(car?.vehicle_catalog as VehicleCatalogJoin);

      return {
        repair_id: repair.id,
        request_id: request?.id || null,
        license_plate: car?.license_plate || null,
        manufacturer: catalog?.manufacturer || null,
        model: catalog?.model || null,
        problem_description: request?.ai_mechanic_summary || request?.description || null,
        mechanic_notes: repair.mechanic_notes || null,
        created_at: repair.created_at,
      };
    });

    return NextResponse.json({
      repairs: transformedRepairs,
      totalCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}

