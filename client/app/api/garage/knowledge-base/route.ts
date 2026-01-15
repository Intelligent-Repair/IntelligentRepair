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

// Helper: Get start date for date range filter
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

        // Parse query params
        const mode = searchParams.get("mode") || "local"; // local = my garage, global = all garages
        const manufacturer = searchParams.get("manufacturer");
        const model = searchParams.get("model");
        const year = searchParams.get("year");
        const issueType = searchParams.get("issueType");
        const dateRange = searchParams.get("dateRange") || "all";
        const offset = parseInt(searchParams.get("offset") || "0", 10);
        const limit = 12;

        // Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get garage ID for local mode
        let garageId: string | null = null;
        if (mode === "local") {
            const { data: userData } = await supabase
                .from("users")
                .select("national_id")
                .eq("id", user.id)
                .single();

            if (userData?.national_id) {
                const { data: garage } = await supabase
                    .from("garages")
                    .select("id")
                    .eq("owner_national_id", userData.national_id)
                    .single();

                garageId = garage?.id || null;
            }
        }

        // Build query - NO pagination here, we'll paginate after JS filtering
        // Join with garage_requests to get the AI consultation summary (mechanic_summary)
        let query = supabase
            .from("repairs")
            .select(`
        id,
        vehicle_info,
        final_issue_type,
        ai_summary,
        mechanic_notes,
        mechanic_description_ai,
        completed_at,
        created_at,
        garage_request:garage_requests!garage_request_id (
          mechanic_summary
        )
      `)
            .eq("status", "completed") // Only show completed repairs
            .order("completed_at", { ascending: false, nullsFirst: false });

        // Filter by garage (local mode)
        if (garageId) {
            query = query.eq("garage_id", garageId);
        }

        // Filter by issue type
        if (issueType && issueType !== "all") {
            query = query.eq("final_issue_type", issueType);
        }

        // Filter by date range
        const startDate = getStartDate(dateRange);
        if (startDate) {
            query = query.gte("completed_at", startDate.toISOString());
        }

        // Execute query - get ALL results first
        const { data: repairs, error: repairsError } = await query;

        if (repairsError) {
            console.error('[knowledge-base] DB error:', repairsError);
            return NextResponse.json(
                { error: "Failed to fetch repairs", details: repairsError.message },
                { status: 500 }
            );
        }

        // Filter by vehicle info (manufacturer/model/year) - done in JS since vehicle_info is JSONB
        let filteredRepairs = repairs || [];

        if (manufacturer) {
            filteredRepairs = filteredRepairs.filter((r: any) =>
                r.vehicle_info?.manufacturer === manufacturer
            );
        }

        if (model) {
            filteredRepairs = filteredRepairs.filter((r: any) =>
                r.vehicle_info?.model === model
            );
        }

        if (year) {
            const yearNum = parseInt(year, 10);
            filteredRepairs = filteredRepairs.filter((r: any) =>
                r.vehicle_info?.year === yearNum
            );
        }

        // Get total count AFTER filtering
        const totalFilteredCount = filteredRepairs.length;

        // Apply pagination AFTER filtering
        const paginatedRepairs = filteredRepairs.slice(offset, offset + limit);

        // Transform data for frontend
        const transformedRepairs = paginatedRepairs.map((repair: any) => ({
            id: repair.id,
            vehicle: repair.vehicle_info ? {
                manufacturer: repair.vehicle_info.manufacturer || 'לא ידוע',
                model: repair.vehicle_info.model || '',
                year: repair.vehicle_info.year || null,
                licensePlate: repair.vehicle_info.license_plate || '',
            } : null,
            issueType: repair.final_issue_type,
            issueTypeLabel: ISSUE_TYPE_LABELS[repair.final_issue_type] || repair.final_issue_type || 'לא צוין',
            // AI consultation summary from garage_requests
            consultationSummary: repair.garage_request?.mechanic_summary || null,
            // Mechanic's repair solution
            mechanicSolution: repair.mechanic_description_ai || repair.mechanic_notes,
            completedAt: repair.completed_at,
        }));

        // Get unique manufacturers and models for filter options
        const { data: allRepairs } = await supabase
            .from("repairs")
            .select("vehicle_info")
            .eq("status", "completed");

        const manufacturers = new Set<string>();
        const modelsByManufacturer: Record<string, Set<string>> = {};
        const years = new Set<number>();

        allRepairs?.forEach((r: any) => {
            if (r.vehicle_info?.manufacturer) {
                manufacturers.add(r.vehicle_info.manufacturer);
                if (!modelsByManufacturer[r.vehicle_info.manufacturer]) {
                    modelsByManufacturer[r.vehicle_info.manufacturer] = new Set();
                }
                if (r.vehicle_info?.model) {
                    modelsByManufacturer[r.vehicle_info.manufacturer].add(r.vehicle_info.model);
                }
                if (r.vehicle_info?.year) {
                    years.add(r.vehicle_info.year);
                }
            }
        });

        return NextResponse.json({
            repairs: transformedRepairs,
            totalCount: totalFilteredCount,
            filters: {
                manufacturers: Array.from(manufacturers).sort(),
                modelsByManufacturer: Object.fromEntries(
                    Object.entries(modelsByManufacturer).map(([k, v]) => [k, Array.from(v).sort()])
                ),
                issueTypes: Object.entries(ISSUE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
                years: Array.from(years).sort((a, b) => b - a), // Newest first
            },
        });
    } catch (err) {
        console.error('[knowledge-base] Server error:', err);
        return NextResponse.json(
            { error: "Server error", details: String(err) },
            { status: 500 }
        );
    }
}
