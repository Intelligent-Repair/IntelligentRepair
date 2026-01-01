import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function GET(req: Request) {
    try {
        const supabase = await createServerSupabase();

        // Authenticate user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error("[garage/requests] Auth error:", authError);
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // DEBUG: Log user info
        console.log("[garage/requests] User authenticated:", {
            id: user.id,
            email: user.email
        });

        // Find the garage owned by this user
        const { data: garage, error: garageError } = await supabase
            .from("garages")
            .select("id")
            .eq("owner_user_id", user.id)
            .single();

        // DEBUG: Log garage lookup result
        console.log("[garage/requests] Garage lookup:", {
            found: !!garage,
            garageId: garage?.id,
            error: garageError?.message
        });

        if (garageError || !garage) {
            console.error("[garage/requests] Garage not found for user:", user.id);
            return NextResponse.json(
                { error: "No garage found for this user" },
                { status: 404 }
            );
        }

        // Fetch all requests for this garage
        const { data: requests, error: requestsError } = await supabase
            .from("garage_requests")
            .select("*")
            .eq("garage_id", garage.id)
            .order("created_at", { ascending: false });

        if (requestsError) {
            console.error("[garage/requests] Error fetching requests:", requestsError);
            return NextResponse.json(
                { error: "Failed to fetch requests", details: requestsError.message },
                { status: 500 }
            );
        }

        // Transform to UI format
        const formattedRequests = (requests || []).map(r => ({
            id: r.id,
            client: r.customer_name || "לקוח ללא שם",
            phone: r.customer_phone || "",
            car: r.vehicle_info
                ? `${r.vehicle_info.manufacturer || ""} ${r.vehicle_info.model || ""} (${r.vehicle_info.year || ""})`.trim()
                : "רכב לא ידוע",
            fault: r.mechanic_summary?.topDiagnosis?.[0]?.name
                || r.mechanic_summary?.shortDescription
                || "לא צוין",
            status: r.status || "pending",
            date: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : "",
            // Keep raw data for detail view
            vehicle_info: r.vehicle_info,
            mechanic_summary: r.mechanic_summary,
            request_id: r.request_id,
        }));

        console.log(`[garage/requests] Found ${formattedRequests.length} requests for garage ${garage.id}`);

        return NextResponse.json({
            requests: formattedRequests,
        });

    } catch (err) {
        console.error("[garage/requests] Unhandled error:", err);
        return NextResponse.json(
            { error: "Server error", details: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}

