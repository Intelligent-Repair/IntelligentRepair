import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

/**
 * Check if a vehicle has past repairs matching a specific issue category.
 * Used to detect repeat issues during chat diagnosis.
 * 
 * GET /api/repairs/check-history?car_id=xxx&issue_type=brakes
 */
export async function GET(req: Request) {
    try {
        const supabase = await createServerSupabase();
        const { searchParams } = new URL(req.url);
        const car_id = searchParams.get("car_id");
        const issue_type = searchParams.get("issue_type");

        if (!car_id) {
            return NextResponse.json(
                { success: false, message: "Missing car_id parameter" },
                { status: 400 }
            );
        }

        // Get requests for this car
        const { data: carRequests, error: requestsError } = await supabase
            .from("requests")
            .select("id")
            .eq("car_id", car_id);

        if (requestsError) {
            return NextResponse.json(
                { success: false, message: "Failed to fetch car requests", error: requestsError.message },
                { status: 500 }
            );
        }

        if (!carRequests || carRequests.length === 0) {
            return NextResponse.json({
                success: true,
                hasHistory: false,
                repairs: [],
                message: "No repair history for this vehicle"
            });
        }

        const requestIds = carRequests.map((r) => r.id);

        // Build query for repairs
        let query = supabase
            .from("repairs")
            .select(`
        id,
        ai_summary,
        final_issue_type,
        created_at,
        garage:garages (name)
      `)
            .in("request_id", requestIds)
            .order("created_at", { ascending: false });

        // Filter by issue type if provided
        if (issue_type) {
            query = query.eq("final_issue_type", issue_type);
        }

        // Limit to last 5 repairs
        query = query.limit(5);

        const { data: repairs, error } = await query;

        if (error) {
            return NextResponse.json(
                { success: false, message: "Failed to fetch repairs", error: error.message },
                { status: 500 }
            );
        }

        // Calculate stats
        const hasHistory = repairs && repairs.length > 0;
        const isRepeatIssue = issue_type && hasHistory;
        const lastRepair = repairs?.[0];
        const daysSinceLastRepair = lastRepair
            ? Math.floor((Date.now() - new Date(lastRepair.created_at).getTime()) / (1000 * 60 * 60 * 24))
            : null;

        return NextResponse.json({
            success: true,
            hasHistory,
            isRepeatIssue,
            repairCount: repairs?.length || 0,
            daysSinceLastRepair,
            lastRepairDate: lastRepair?.created_at || null,
            lastGarage: Array.isArray(lastRepair?.garage) ? lastRepair?.garage[0]?.name : (lastRepair?.garage as any)?.name || null,
            repairs: repairs || [],
            // Friendly message for chatbot
            chatMessage: isRepeatIssue
                ? `שמתי לב שהיתה בעיה דומה (${issue_type}) לפני ${daysSinceLastRepair} ימים. האם הבעיה חזרה?`
                : null
        });
    } catch (err) {
        return NextResponse.json(
            { success: false, message: "Server error", error: (err as Error).message },
            { status: 500 }
        );
    }
}
