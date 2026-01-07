import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// Helper function to get garage ID
type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabase>>;
type HasGte<T> = { gte: (column: string, value: string) => T };
type VehicleCatalog = { manufacturer: string | null; model: string | null };
type RequestRow = {
  id: string;
  description: string | null;
  ai_mechanic_summary: string | null;
  created_at: string;
  car?: { vehicle_catalog?: VehicleCatalog | null } | null;
};

async function getGarageId(
  supabase: SupabaseServerClient,
  userId: string,
  mode: string
): Promise<string | null> {
  if (mode === "global") return null;
  
  const { data: garage, error } = await supabase
    .from("garages")
    .select("id")
    .or(`owner_user_id.eq.${userId},user_id.eq.${userId}`)
    .single();

  if (error || !garage) return null;
  const id = (garage as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

// Helper function to apply date range filter
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
    const manufacturers = searchParams.get("manufacturers")?.split(",").filter(Boolean) || [];
    const models = searchParams.get("models")?.split(",").filter(Boolean) || [];
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

    const garageId = await getGarageId(supabase, user.id, mode);

    // Build query
    let query = supabase
      .from("requests")
      .select(`
        id,
        description,
        ai_mechanic_summary,
        created_at,
        car:people_cars (
          vehicle_catalog:vehicle_catalog_id (
            manufacturer,
            model
          )
        )
      `);

    // Apply date range filter
    query = applyDateRangeFilter(query, dateRange);

    // Filter by garage_id if in local mode
    if (garageId !== null) {
      const { data: repairsData } = await supabase
        .from("repairs")
        .select("request_id")
        .eq("garage_id", garageId);

      const requestIds = (repairsData ?? [])
        .map((r) => (r as { request_id?: unknown }).request_id)
        .filter((id): id is string => typeof id === "string");
      if (requestIds.length > 0) {
        query = query.in("id", requestIds);
      } else {
        return NextResponse.json({ top5: [] });
      }
    }

    const { data: requestsRaw, error: requestsError } = await query;

    if (requestsError) {
      return NextResponse.json(
        { error: "Failed to fetch requests", details: requestsError.message },
        { status: 500 }
      );
    }
    const requests = (requestsRaw ?? []) as RequestRow[];

    // Count issue descriptions
    const issueCounts = new Map<string, number>();

    requests.forEach((req) => {
      const catalog = req.car?.vehicle_catalog;

      // Apply manufacturer filter
      if (manufacturers.length > 0 && catalog && !manufacturers.includes(catalog.manufacturer)) return;

      // Apply model filter
      if (models.length > 0 && catalog && !models.includes(catalog.model)) return;

      const description = req.ai_mechanic_summary || req.description || "";
      
      // Apply issue type filter
      if (!matchesIssueType(description, issueType)) return;

      // Normalize description (take first 100 chars as key)
      const normalized = description.substring(0, 100).trim();
      if (normalized) {
        issueCounts.set(normalized, (issueCounts.get(normalized) || 0) + 1);
      }
    });

    // Convert to array, sort by count descending, take top 5
    const top5 = Array.from(issueCounts.entries())
      .map(([issue_description, occurrences]) => ({ issue_description, occurrences }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 5);

    return NextResponse.json({ top5 });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}

