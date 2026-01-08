import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ request_id: string }> }
) {
    try {
        const { request_id: requestId } = await params;

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
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Find the garage owned by this user
        // Note: garages table only has owner_user_id (no user_id field)
        const { data: garage, error: garageError } = await supabase
            .from("garages")
            .select("id")
            .eq("owner_user_id", user.id)
            .maybeSingle();

        if (garageError) {
            console.error("[garage/requests/request_id] Garage lookup error:", garageError);
            console.error("[garage/requests/request_id] User ID:", user.id);
            return NextResponse.json(
                { error: "Failed to find garage", details: garageError.message },
                { status: 500 }
            );
        }

        if (!garage) {
            console.error("[garage/requests/request_id] No garage found for user:", user.id);
            console.error("[garage/requests/request_id] User email:", user.email);
            return NextResponse.json(
                { error: "No garage found for this user" },
                { status: 404 }
            );
        }

        console.log("[garage/requests/request_id] Found garage:", garage.id, "for user:", user.id);

        // Fetch garage_request and verify it belongs to this garage
        const { data: garageRequest, error: requestError } = await supabase
            .from("garage_requests")
            .select("*")
            .eq("id", requestId)
            .eq("garage_id", garage.id)
            .single();

        if (requestError || !garageRequest) {
            return NextResponse.json(
                { error: "Request not found" },
                { status: 404 }
            );
        }

        // Format vehicle info for display
        // Handle JSONB - it might be a string or already parsed object
        let vehicleInfo: any = {};
        if (garageRequest.vehicle_info) {
            if (typeof garageRequest.vehicle_info === 'string') {
                try {
                    vehicleInfo = JSON.parse(garageRequest.vehicle_info);
                } catch (e) {
                    console.error("[garage/requests/request_id] Failed to parse vehicle_info:", e);
                    vehicleInfo = {};
                }
            } else {
                vehicleInfo = garageRequest.vehicle_info;
            }
        }

        console.log("[garage/requests/request_id] Vehicle info:", JSON.stringify(vehicleInfo));

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

        console.log(`[garage/requests/request_id] Fetched request ${requestId}`, {
            vehicleInfo,
            hasVehicleInfo: !!garageRequest.vehicle_info,
        });

        return NextResponse.json({
            request: formattedRequest,
        });

    } catch (err) {
        console.error("[garage/requests/request_id] Error:", err);
        return NextResponse.json(
            { error: "Server error", details: String(err) },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ request_id: string }> }
) {
    try {
        const { request_id: requestId } = await params;
        const body = await req.json();
        const { status } = body;

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
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Find the garage owned by this user
        // Note: garages table only has owner_user_id (no user_id field)
        const { data: garage, error: garageError } = await supabase
            .from("garages")
            .select("id")
            .eq("owner_user_id", user.id)
            .maybeSingle();

        if (garageError) {
            console.error("[garage/requests/request_id] Garage lookup error:", garageError);
            console.error("[garage/requests/request_id] User ID:", user.id);
            return NextResponse.json(
                { error: "Failed to find garage", details: garageError.message },
                { status: 500 }
            );
        }

        if (!garage) {
            console.error("[garage/requests/request_id] No garage found for user:", user.id);
            console.error("[garage/requests/request_id] User email:", user.email);
            return NextResponse.json(
                { error: "No garage found for this user" },
                { status: 404 }
            );
        }

        console.log("[garage/requests/request_id] Found garage:", garage.id, "for user:", user.id);

        // Update garage_request status
        const updateData: any = {};
        if (status) {
            updateData.status = status;
        }

        const { error: updateError } = await supabase
            .from("garage_requests")
            .update(updateData)
            .eq("id", requestId)
            .eq("garage_id", garage.id);

        if (updateError) {
            console.error("[garage/requests/request_id] Update error:", updateError);
            return NextResponse.json(
                { error: "Failed to update request", details: updateError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Request updated successfully",
        });
    } catch (err) {
        console.error("[garage/requests/request_id] Error:", err);
        return NextResponse.json(
            { error: "Server error", details: String(err) },
            { status: 500 }
        );
    }
}

