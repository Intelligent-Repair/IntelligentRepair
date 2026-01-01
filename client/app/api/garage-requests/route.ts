import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

interface GarageRequestBody {
    garage_id: string;
    request_id: string;
}

export async function POST(req: Request) {
    try {
        const body: GarageRequestBody = await req.json();
        const { garage_id, request_id } = body;

        // Validate required fields
        if (!garage_id || !request_id) {
            return NextResponse.json(
                { error: "Missing required fields: garage_id and request_id" },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();

        // 1. Fetch the request data
        const { data: requestData, error: requestError } = await supabase
            .from("requests")
            .select("id, user_id, car_id, ai_diagnosis, ai_mechanic_summary, description")
            .eq("id", request_id)
            .single();

        if (requestError || !requestData) {
            console.error("[garage-requests] Request not found:", requestError);
            return NextResponse.json(
                { error: "Request not found" },
                { status: 404 }
            );
        }

        // 2. Fetch user info
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("first_name, last_name, phone")
            .eq("id", requestData.user_id)
            .single();

        if (userError) {
            console.warn("[garage-requests] User data not found:", userError);
        }

        // 3. Fetch car info with vehicle catalog details
        const { data: carData, error: carError } = await supabase
            .from("people_cars")
            .select(`
                license_plate,
                vehicle_catalog:vehicle_catalog_id (
                    manufacturer,
                    model,
                    year
                )
            `)
            .eq("id", requestData.car_id)
            .single();

        if (carError) {
            console.warn("[garage-requests] Car data not found:", carError);
        }

        // Extract vehicle info from nested structure
        const vehicleCatalog = carData?.vehicle_catalog as { manufacturer?: string; model?: string; year?: number } | null;

        // Combine first_name and last_name for customer_name
        const customerName = userData
            ? [userData.first_name, userData.last_name].filter(Boolean).join(" ") || null
            : null;

        // 4. Create garage_request record
        const garageRequestPayload = {
            garage_id,
            request_id,
            customer_name: customerName,
            customer_phone: userData?.phone || null,
            vehicle_info: carData ? {
                manufacturer: vehicleCatalog?.manufacturer || null,
                model: vehicleCatalog?.model || null,
                year: vehicleCatalog?.year || null,
                license_plate: carData.license_plate || null,
            } : null,
            mechanic_summary: requestData.ai_mechanic_summary || null,
            status: "pending",
        };

        const { data: garageRequest, error: insertError } = await supabase
            .from("garage_requests")
            .insert(garageRequestPayload)
            .select("id")
            .single();

        if (insertError) {
            console.error("[garage-requests] Insert error:", insertError);
            return NextResponse.json(
                { error: "Failed to create garage request", details: insertError.message },
                { status: 500 }
            );
        }

        // 5. Update the original request status
        await supabase
            .from("requests")
            .update({ status: "in_progress" })
            .eq("id", request_id);

        console.log("[garage-requests] Created:", {
            garage_request_id: garageRequest.id,
            garage_id,
            request_id,
        });

        return NextResponse.json({
            success: true,
            garage_request_id: garageRequest.id,
        });

    } catch (err) {
        console.error("[garage-requests] Unhandled error:", err);
        return NextResponse.json(
            { error: "Server error", details: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
