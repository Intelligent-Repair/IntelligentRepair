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
      const { data: garage, error: garageError } = await supabase
        .from("garages")
        .select("id")
        .or(`owner_user_id.eq.${user.id},user_id.eq.${user.id}`)
        .single();

      if (garageError || !garage) {
        return NextResponse.json({ error: "Garage not found" }, { status: 404 });
      }
      garageId = garage.id;
    }

    // Query repairs table for issue types
    let query = supabase
      .from("repairs")
      .select("final_issue_type")
      .not("final_issue_type", "is", null);

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
      console.error('[top-issues] DB error:', repairsError);
      return NextResponse.json(
        { error: "Failed to fetch repairs", details: repairsError.message },
        { status: 500 }
      );
    }

    // Count occurrences by issue type
    const issueCounts = new Map<string, number>();

    repairs?.forEach((repair: any) => {
      const issueType = repair.final_issue_type;
      if (issueType) {
        issueCounts.set(issueType, (issueCounts.get(issueType) || 0) + 1);
      }
    });

    // Convert to array with Hebrew labels, sort descending, take top 5
    const top5 = Array.from(issueCounts.entries())
      .map(([issue_type, occurrences]) => ({
        issue_description: ISSUE_TYPE_LABELS[issue_type] || issue_type,
        occurrences
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 5);

    return NextResponse.json({ top5 });
  } catch (err) {
    console.error('[top-issues] Server error:', err);
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}
