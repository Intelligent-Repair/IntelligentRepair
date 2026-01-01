import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: requestId } = await params;

        if (!requestId) {
            return NextResponse.json(
                { error: "Request ID is required" },
                { status: 400 }
            );
        }

        const supabase = await createServerSupabase();

        // Authenticate user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error("[garage/requests/id] Auth error:", authError);
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Find the garage owned by this user
        const { data: garage, error: garageError } = await supabase
            .from("garages")
            .select("id")
            .eq("owner_user_id", user.id)
            .single();

        if (garageError || !garage) {
            return NextResponse.json(
                { error: "No garage found for this user" },
                { status: 404 }
            );
        }

        // Fetch the specific request (ensure it belongs to this garage)
        const { data: garageRequest, error: requestError } = await supabase
            .from("garage_requests")
            .select("*")
            .eq("id", requestId)
            .eq("garage_id", garage.id)
            .single();

        if (requestError || !garageRequest) {
            console.error("[garage/requests/id] Request not found:", requestError);
            return NextResponse.json(
                { error: "Request not found" },
                { status: 404 }
            );
        }

        // Format vehicle info for display
        const vehicleInfo = garageRequest.vehicle_info || {};
        const carDisplay = [
            vehicleInfo.manufacturer,
            vehicleInfo.model,
            vehicleInfo.year ? `(${vehicleInfo.year})` : null
        ].filter(Boolean).join(" ") || "רכב לא ידוע";

        // Format mechanic summary
        const mechanicSummary = garageRequest.mechanic_summary || {};
        const aiSummary = mechanicSummary.formattedText
            || mechanicSummary.shortDescription
            || (mechanicSummary.topDiagnosis?.[0]?.name
                ? `אבחון: ${mechanicSummary.topDiagnosis[0].name}. ${mechanicSummary.topDiagnosis[0].recommendation || ""}`
                : "לא קיים סיכום AI");

        // Transform to UI format
        const formattedRequest = {
            id: garageRequest.id,
            client: garageRequest.customer_name || "לקוח ללא שם",
            phone: garageRequest.customer_phone || "",
            car: carDisplay,
            license_plate: vehicleInfo.license_plate || "",
            date: garageRequest.created_at
                ? new Date(garageRequest.created_at).toLocaleDateString('he-IL')
                : "",
            description: mechanicSummary.conversationLog
                || "תיאור הבעיה לא זמין",
            ai_summary: aiSummary,
            status: garageRequest.status || "pending",
            // Raw data for additional usage
            vehicle_info: vehicleInfo,
            mechanic_summary: mechanicSummary,
            request_id: garageRequest.request_id,
        };

        console.log(`[garage/requests/id] Fetched request ${requestId}`);

        return NextResponse.json({
            request: formattedRequest,
        });

    } catch (err) {
        console.error("[garage/requests/id] Unhandled error:", err);
        return NextResponse.json(
            { error: "Server error", details: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}

// Update request status (e.g., mark as viewed, answered)
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: requestId } = await params;
        const body = await req.json();
        const { status } = body;

        console.log("[garage/requests/id PATCH] Updating:", { requestId, status });

        if (!requestId || !status) {
            return NextResponse.json(
                { error: "Request ID and status are required" },
                { status: 400 }
            );
        }

        const supabase = await createServerSupabase();

        // Authenticate user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Find the garage owned by this user
        const { data: garage } = await supabase
            .from("garages")
            .select("id")
            .eq("owner_user_id", user.id)
            .single();

        if (!garage) {
            return NextResponse.json({ error: "No garage found" }, { status: 404 });
        }

        // Update the request status
        const { error: updateError } = await supabase
            .from("garage_requests")
            .update({ status })
            .eq("id", requestId)
            .eq("garage_id", garage.id);

        if (updateError) {
            console.error("[garage/requests/id PATCH] Update error:", updateError);
            return NextResponse.json(
                { error: "Failed to update status", details: updateError.message },
                { status: 500 }
            );
        }

        console.log("[garage/requests/id PATCH] Success");
        return NextResponse.json({ success: true });

    } catch (err) {
        console.error("[garage/requests/id PATCH] Unhandled error:", err);
        return NextResponse.json(
            { error: "Server error", details: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}


