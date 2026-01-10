import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// Helper function to get garage ID by national_id
async function getGarageId(supabase: any, nationalId: string | null, mode: string): Promise<number | null> {
  if (mode === "global" || !nationalId) return null;

  const { data: garage, error } = await supabase
    .from("garages")
    .select("id")
    .eq("owner_national_id", nationalId)
    .single();

  if (error || !garage) return null;
  return garage.id;
}

// Helper function to apply date range filter
function applyDateRangeFilter(query: any, dateRange: string | null) {
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
    const chartMode = searchParams.get("chartMode") || "totalIssues";
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

    // Get user's national_id for garage lookup
    const { data: userData } = await supabase
      .from("users")
      .select("national_id")
      .eq("id", user.id)
      .single();

    const garageId = await getGarageId(supabase, userData?.national_id || null, mode);

    // Build base query for requests
    let requestsQuery = supabase
      .from("requests")
      .select(`
        id,
        description,
        problem_description,
        created_at,
        car:people_cars (
          vehicle_catalog:vehicle_catalog_id (
            manufacturer,
            model
          )
        )
      `);

    requestsQuery = applyDateRangeFilter(requestsQuery, dateRange);

    // Filter by garage_id if in local mode
    let requestIds: number[] = [];
    if (garageId !== null) {
      const { data: repairsData } = await supabase
        .from("repairs")
        .select("request_id")
        .eq("garage_id", garageId);

      requestIds = repairsData?.map((r: any) => r.request_id) || [];
      if (requestIds.length > 0) {
        requestsQuery = requestsQuery.in("id", requestIds);
      } else {
        return NextResponse.json({ data: [] });
      }
    }

    const { data: requests, error: requestsError } = await requestsQuery;

    if (requestsError) {
      return NextResponse.json(
        { error: "Failed to fetch requests", details: requestsError.message },
        { status: 500 }
      );
    }

    // Get all repair IDs for resolved issues check
    let repairRequestIds = new Set<number>();
    if (chartMode === "resolvedIssues" || chartMode === "unresolvedIssues") {
      let repairsQuery = supabase.from("repairs").select("request_id");
      if (garageId !== null) {
        repairsQuery = repairsQuery.eq("garage_id", garageId);
      }
      const { data: repairs } = await repairsQuery;
      repairRequestIds = new Set(repairs?.map((r: any) => r.request_id) || []);
    }

    // Process data based on chart mode
    const data: Array<{ label: string; value: number }> = [];

    if (chartMode === "totalIssues") {
      // Count all issues
      const filtered = requests?.filter((req: any) => {
        const catalog = req.car?.vehicle_catalog;
        if (manufacturers.length > 0 && catalog && !manufacturers.includes(catalog.manufacturer)) return false;
        if (models.length > 0 && catalog && !models.includes(catalog.model)) return false;
        const desc = req.problem_description || req.description || "";
        return matchesIssueType(desc, issueType);
      }) || [];

      data.push({ label: "סה״כ פניות", value: filtered.length });
    } else if (chartMode === "resolvedIssues") {
      const filtered = requests?.filter((req: any) => {
        if (!repairRequestIds.has(req.id)) return false;
        const catalog = req.car?.vehicle_catalog;
        if (manufacturers.length > 0 && catalog && !manufacturers.includes(catalog.manufacturer)) return false;
        if (models.length > 0 && catalog && !models.includes(catalog.model)) return false;
        const desc = req.problem_description || req.description || "";
        return matchesIssueType(desc, issueType);
      }) || [];

      data.push({ label: "פניות שנפתרו", value: filtered.length });
    } else if (chartMode === "unresolvedIssues") {
      const filtered = requests?.filter((req: any) => {
        if (repairRequestIds.has(req.id)) return false;
        const catalog = req.car?.vehicle_catalog;
        if (manufacturers.length > 0 && catalog && !manufacturers.includes(catalog.manufacturer)) return false;
        if (models.length > 0 && catalog && !models.includes(catalog.model)) return false;
        const desc = req.problem_description || req.description || "";
        return matchesIssueType(desc, issueType);
      }) || [];

      data.push({ label: "פניות שלא נפתרו", value: filtered.length });
    } else if (chartMode === "issuesByManufacturer") {
      const manufacturerCounts = new Map<string, number>();

      requests?.forEach((req: any) => {
        const catalog = req.car?.vehicle_catalog;
        if (!catalog || !catalog.manufacturer) return;

        if (manufacturers.length > 0 && !manufacturers.includes(catalog.manufacturer)) return;
        if (models.length > 0 && catalog.model && !models.includes(catalog.model)) return;

        const desc = req.problem_description || req.description || "";
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

      requests?.forEach((req: any) => {
        const catalog = req.car?.vehicle_catalog;
        if (!catalog || !catalog.model) return;

        if (manufacturers.length > 0 && !manufacturers.includes(catalog.manufacturer)) return;
        if (models.length > 0 && !models.includes(catalog.model)) return;

        const desc = req.problem_description || req.description || "";
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

