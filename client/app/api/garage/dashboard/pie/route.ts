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

  // Try to get garage by owner_user_id first
  let { data: garage } = await supabase
    .from("garages")
    .select("id")
    .eq("owner_user_id", userId)
    .single();

  // If not found, try user_id
  if (!garage) {
    ({ data: garage } = await supabase
      .from("garages")
      .select("id")
      .eq("user_id", userId)
      .single());
  }

  if (!garage) return null;
  const id = (garage as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

// Helper function to apply date range filter
function applyDateRangeFilter<T extends HasGte<T>>(
  query: T,
  dateRange: string | null
): T {
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
function matchesIssueType(
  description: string | null,
  issueType: string | null
): boolean {
  if (!issueType || issueType === "all" || !description) return true;

  const desc = description.toLowerCase();
  const type = issueType.toLowerCase();

  if (type === "engine")
    return (
      desc.includes("מנוע") ||
      desc.includes("engine") ||
      desc.includes("חום") ||
      desc.includes("שמן")
    );
  if (type === "brakes")
    return (
      desc.includes("בלמים") || desc.includes("brake") || desc.includes("בלימה")
    );
  if (type === "electrical")
    return (
      desc.includes("חשמל") ||
      desc.includes("electrical") ||
      desc.includes("חשמלי")
    );
  if (type === "ac")
    return (
      desc.includes("מיזוג") || desc.includes("ac") || desc.includes("קירור")
    );
  if (type === "starting")
    return (
      desc.includes("התנעה") || desc.includes("start") || desc.includes("מצבר")
    );
  if (type === "gearbox")
    return (
      desc.includes("תיבת") ||
      desc.includes("gearbox") ||
      desc.includes("הילוכים")
    );
  if (type === "noise")
    return (
      desc.includes("רעש") || desc.includes("noise") || desc.includes("רטט")
    );

  return true;
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "local";
    const chartMode = searchParams.get("chartMode") || "totalIssues";
    const manufacturers =
      searchParams.get("manufacturers")?.split(",").filter(Boolean) || [];
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

    // Build base query for repairs with joined request data
    let repairsQuery = supabase.from("repairs").select(`
        id,
        created_at,
        request:requests (
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
        )
      `);

    repairsQuery = applyDateRangeFilter(repairsQuery, dateRange);

    // Filter by garage_id if in local mode
    if (garageId !== null) {
      repairsQuery = repairsQuery.eq("garage_id", garageId);
    }

    const { data: repairsRaw, error: repairsError } = await repairsQuery;

    if (repairsError) {
      console.error("pie repairs error:", repairsError);
      return NextResponse.json(
        { error: "Failed to fetch repairs", details: repairsError.message },
        { status: 500 }
      );
    }

    // Process repairs data
    const repairs = (repairsRaw ?? []) as any[];
    console.log("=== PIE DEBUG ===");
    console.log("mode:", mode, "garageId:", garageId);
    console.log("repairs count:", repairs.length);
    console.log("repairs raw:", JSON.stringify(repairs.slice(0, 2))); // First 2 repairs
    console.log("repairsRaw is null:", repairsRaw === null);
    console.log("repairsRaw is undefined:", repairsRaw === undefined);

    // Debug: log first repair if exists
    if (repairs.length > 0) {
      console.log(
        "first repair has request?:",
        repairs[0].request !== null && repairs[0].request !== undefined
      );
    }

    // Process data based on chart mode
    const data: Array<{ label: string; value: number }> = [];

    if (chartMode === "totalIssues") {
      // Count all repairs
      const filtered = requests.filter((req) => {
        const catalog = req.car?.vehicle_catalog;
        if (
          manufacturers.length > 0 &&
          (!catalog?.manufacturer ||
            !manufacturers.includes(catalog.manufacturer))
        )
          return false;
        if (
          models.length > 0 &&
          (!catalog?.model || !models.includes(catalog.model))
        )
          return false;
        const desc = req.ai_mechanic_summary || req.description || "";
        return matchesIssueType(desc, issueType);
      });

      data.push({ label: "סה״כ תיקונים", value: filtered.length });
    } else if (chartMode === "issuesByManufacturer") {
      const manufacturerCounts = new Map<string, number>();

      requests.forEach((req) => {
        const catalog = req.car?.vehicle_catalog;
        if (!catalog || !catalog.manufacturer) return;

        if (
          manufacturers.length > 0 &&
          !manufacturers.includes(catalog.manufacturer)
        )
          return;
        if (
          models.length > 0 &&
          catalog.model &&
          !models.includes(catalog.model)
        )
          return;

        const desc = req.ai_mechanic_summary || req.description || "";
        if (!matchesIssueType(desc, issueType)) return;

        manufacturerCounts.set(
          catalog.manufacturer,
          (manufacturerCounts.get(catalog.manufacturer) || 0) + 1
        );
      });

      Array.from(manufacturerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([label, value]) => {
          data.push({ label, value });
        });
    } else if (chartMode === "issuesByModel") {
      const modelCounts = new Map<string, number>();

      requests.forEach((req) => {
        const catalog = req.car?.vehicle_catalog;
        if (!catalog || !catalog.model) return;

        if (
          manufacturers.length > 0 &&
          (!catalog.manufacturer ||
            !manufacturers.includes(catalog.manufacturer))
        )
          return;
        if (models.length > 0 && !models.includes(catalog.model)) return;

        const desc = req.ai_mechanic_summary || req.description || "";
        if (!matchesIssueType(desc, issueType)) return;

        const key = `${catalog.manufacturer} ${catalog.model}`;
        modelCounts.set(key, (modelCounts.get(key) || 0) + 1);
      });

      Array.from(modelCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([label, value]) => {
          data.push({ label, value });
        });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}
