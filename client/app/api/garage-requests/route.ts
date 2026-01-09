import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { generateMechanicSummaryFromUnified, type MechanicSummary } from "@/lib/ai/unified-diagnosis-v2";

type GarageRequestBody = {
    garage_id: string;
    request_id: string;
};

// Internal type for conversation events (compatible with unified-diagnosis-v2)
type LocalConversationEvent = {
    kind: "user" | "assistant";
    type?: string;
    text: string;
    selectedOption?: string;
    ts?: string;
};

// Build conversation events from stored request data
function buildConversationEventsFromRequest(req: any): LocalConversationEvent[] {
    const events: LocalConversationEvent[] = [];

    // description as opening user message
    if (req?.description) {
        events.push({ kind: "user", type: "description", text: String(req.description) });
    }

    const q = req?.ai_questions;
    const a = req?.ai_answers;

    // v2: {schemaVersion:2, items:[{id,text}]}
    if (q?.schemaVersion === 2 && Array.isArray(q.items)) {
        for (const qi of q.items) {
            events.push({ kind: "assistant", type: "question", text: String(qi.text ?? "") });
        }
    } else if (Array.isArray(q)) {
        for (const qt of q) {
            events.push({ kind: "assistant", type: "question", text: String(qt ?? "") });
        }
    }

    // answers
    if (a?.schemaVersion === 2 && Array.isArray(a.items)) {
        for (const ai of a.items) {
            events.push({ kind: "user", type: "answer", text: String(ai.text ?? "") });
        }
    } else if (Array.isArray(a)) {
        for (const at of a) {
            events.push({ kind: "user", type: "answer", text: String(at ?? "") });
        }
    }

    // final diagnosis text if exists
    if (req?.ai_diagnosis) {
        events.push({ kind: "assistant", type: "diagnosis_report", text: String(req.ai_diagnosis) });
    }
    if (req?.ai_recommendations && Array.isArray(req.ai_recommendations)) {
        events.push({ kind: "assistant", type: "recommendations", text: req.ai_recommendations.join(", ") });
    }

    // trim empties and limit
    return events.filter(e => e.text && e.text.trim().length > 0).slice(0, 200);
}

export async function POST(req: Request) {
    try {
        const body: GarageRequestBody = await req.json();
        const { garage_id, request_id } = body;

        // Validate required fields
        if (!garage_id || !request_id) {
            return NextResponse.json(
                { error: "Missing garage_id or request_id" },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();

        // Check for existing garage_request (prevent duplicates)
        const { data: existing } = await supabase
            .from("garage_requests")
            .select("id")
            .eq("garage_id", garage_id)
            .eq("request_id", request_id)
            .maybeSingle();

        if (existing?.id) {
            return NextResponse.json({
                success: true,
                garage_request_id: existing.id,
                status: "existing",
            });
        }

        // Fetch the request data
        const { data: reqRow, error: reqError } = await supabase
            .from("requests")
            .select(
                "id, user_id, car_id, description, image_urls, ai_mechanic_summary, ai_questions, ai_answers, ai_diagnosis, ai_recommendations, ai_confidence, created_at"
            )
            .eq("id", request_id)
            .single();

        if (reqError || !reqRow) {
            return NextResponse.json({ error: "Request not found" }, { status: 404 });
        }

        // Fetch user info for customer details
        let customer_name: string | null = null;
        let customer_phone: string | null = null;

        if (reqRow.user_id) {
            const { data: userData } = await supabase
                .from("users")
                .select("first_name, last_name, phone")
                .eq("id", reqRow.user_id)
                .single();

            if (userData) {
                // Concatenate first_name and last_name
                const firstName = userData.first_name || "";
                const lastName = userData.last_name || "";
                customer_name = `${firstName} ${lastName}`.trim() || null;
                customer_phone = userData.phone || null;
            }
        }

        // Fetch car details from people_cars with vehicle_catalog join
        let vehicle_info: Record<string, any> | null = null;

        if (reqRow.car_id) {
            const { data: carData } = await supabase
                .from("people_cars")
                .select(`
                    id,
                    license_plate,
                    vehicle_catalog:vehicle_catalog_id (
                        manufacturer,
                        model,
                        year
                    )
                `)
                .eq("id", reqRow.car_id)
                .single();

            if (carData) {
                const catalog = (carData as any).vehicle_catalog;
                vehicle_info = {
                    car_id: carData.id,
                    manufacturer: catalog?.manufacturer || null,
                    model: catalog?.model || null,
                    year: catalog?.year || null,
                    license_plate: carData.license_plate || null
                };
            } else {
                vehicle_info = { car_id: reqRow.car_id };
            }
        }

        // Build or use existing mechanic_summary
        let mechanicSummary: MechanicSummary | Record<string, any> | null = reqRow.ai_mechanic_summary ?? null;

        console.log('[garage-requests] ai_mechanic_summary from DB:', mechanicSummary ? 'EXISTS' : 'NULL');

        if (!mechanicSummary) {
            console.log('[garage-requests] Generating fallback mechanic summary via AI');
            // Generate new summary using unified AI diagnosis
            const conversationEvents = buildConversationEventsFromRequest(reqRow);
            console.log('[garage-requests] conversationEvents count:', conversationEvents.length);
            console.log('[garage-requests] conversationEvents sample:', JSON.stringify(conversationEvents.slice(0, 3)));


            mechanicSummary = await generateMechanicSummaryFromUnified({
                conversationEvents,
                finalReport: {
                    ai_diagnosis: reqRow.ai_diagnosis,
                    ai_recommendations: reqRow.ai_recommendations,
                    ai_confidence: reqRow.ai_confidence,
                },
                requestDescription: reqRow.description ?? "",
                vehicleInfo: vehicle_info ? {
                    manufacturer: vehicle_info.manufacturer,
                    model: vehicle_info.model,
                    year: vehicle_info.year
                } : undefined,
            });

            // Update requests.ai_mechanic_summary as source of truth
            await supabase
                .from("requests")
                .update({ ai_mechanic_summary: mechanicSummary })
                .eq("id", reqRow.id);
        }

        // Ensure category is set in mechanic_summary for display
        if (mechanicSummary && !(mechanicSummary as any).category) {
            // Try to extract category from description or diagnosis
            const categorySource = reqRow.description || reqRow.ai_diagnosis || "";
            const shortCategory = categorySource.substring(0, 50).trim();
            mechanicSummary = {
                ...mechanicSummary,
                category: shortCategory || "בעיה ברכב"
            };
        }

        // Create garage_request with all customer and vehicle info
        const { data: insertData, error: insertError } = await supabase
            .from("garage_requests")
            .insert({
                garage_id,
                request_id,
                customer_name,
                customer_phone,
                vehicle_info,
                mechanic_summary: mechanicSummary,
                status: "pending",
            })
            .select("id")
            .single();

        if (insertError) {
            console.error("[garage-requests] Insert error:", insertError.message);
            return NextResponse.json(
                { error: "Failed to create garage request", details: insertError.message },
                { status: 500 }
            );
        }

        // Update original request status
        await supabase.from("requests").update({ status: "in_progress" }).eq("id", request_id);

        return NextResponse.json({
            success: true,
            garage_request_id: insertData.id,
        });
    } catch (err) {
        console.error("[garage-requests] Error:", err instanceof Error ? err.message : String(err));
        return NextResponse.json(
            { error: "Server error", details: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
