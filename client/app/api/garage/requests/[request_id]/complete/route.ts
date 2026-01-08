import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { createOpenAIClient } from "@/lib/ai/client";

// POST - Complete repair and create repair record
export async function POST(
    req: Request,
    { params }: { params: Promise<{ request_id: string }> }
) {
    try {
        const { request_id: requestId } = await params;
        const body = await req.json();
        const { problem_category, description, labor_hours } = body;

        if (!requestId) {
            return NextResponse.json(
                { error: "Request ID is required" },
                { status: 400 }
            );
        }

        if (!problem_category || !description || !labor_hours) {
            return NextResponse.json(
                { error: "Missing required fields: problem_category, description, labor_hours" },
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

        if (garageError || !garage) {
            return NextResponse.json(
                { error: "No garage found for this user" },
                { status: 404 }
            );
        }

        // Fetch garage_request and verify it belongs to this garage
        const { data: garageRequest, error: requestError } = await supabase
            .from("garage_requests")
            .select("id, status, vehicle_info, request_id")
            .eq("id", requestId)
            .eq("garage_id", garage.id)
            .single();

        if (requestError || !garageRequest) {
            return NextResponse.json(
                { error: "Request not found or access denied" },
                { status: 404 }
            );
        }

        // Verify status is pending or viewed
        if (garageRequest.status !== 'pending' && garageRequest.status !== 'viewed') {
            return NextResponse.json(
                { error: `Cannot complete request with status: ${garageRequest.status}` },
                { status: 400 }
            );
        }

        // Verify problem_category exists
        const { data: category, error: categoryError } = await supabase
            .from("problem_categories")
            .select("code, name_he")
            .eq("code", problem_category)
            .eq("is_active", true)
            .single();

        if (categoryError || !category) {
            return NextResponse.json(
                { error: "Invalid problem category" },
                { status: 400 }
            );
        }

        // Process description with OpenAI
        let improvedDescription = description;
        try {
            const apiKey = process.env.OPENAI_API_KEY;
            if (apiKey) {
                const client = createOpenAIClient(apiKey, "gpt-4o", {
                    responseFormat: { type: "text" },
                });

                const prompt = `אתה מומחה רכב מקצועי. שפר את הטקסט הטכני הבא כך שיהיה:
- מדויק וטכני יותר
- מובנה וקריא יותר
- משתמש במינוח מקצועי תקין
- שומר על כל המידע החשוב

קטגוריית התקלה: ${category.name_he}
הטקסט המקורי: ${description}

החזר רק את הטקסט המשופר, ללא הסברים נוספים.`;

                improvedDescription = await client.generateContent(prompt, {
                    timeout: 30000,
                    retries: {
                        maxRetries: 2,
                        backoffMs: [1000, 2000],
                    },
                });

                console.log("[garage/requests/complete] OpenAI processing successful");
            }
        } catch (openAIError) {
            console.error("[garage/requests/complete] OpenAI processing failed:", openAIError);
            // Continue with original description if OpenAI fails
            // Could also return error, but we'll proceed with original text
        }

        // Start transaction: Update garage_request and create repair
        // First, update garage_request status to closed_yes
        const { error: updateError } = await supabase
            .from("garage_requests")
            .update({ status: "closed_yes" })
            .eq("id", requestId)
            .eq("garage_id", garage.id);

        if (updateError) {
            console.error("[garage/requests/complete] Error updating garage_request:", updateError);
            return NextResponse.json(
                { error: "Failed to update request status", details: updateError.message },
                { status: 500 }
            );
        }

        // Create repair record
        const repairData = {
            request_id: garageRequest.request_id,
            garage_id: garage.id,
            vehicle_info: garageRequest.vehicle_info || {},
            problem_category: problem_category,
            mechanic_description_ai: improvedDescription,
            labor_hours: parseFloat(labor_hours),
            completed_at: new Date().toISOString(),
            status: "completed",
            garage_request_id: requestId,
        };

        const { data: newRepair, error: repairError } = await supabase
            .from("repairs")
            .insert(repairData)
            .select("id")
            .single();

        if (repairError) {
            console.error("[garage/requests/complete] Error creating repair:", repairError);
            // Rollback: Try to revert status update (optional, could leave as closed_yes)
            return NextResponse.json(
                { error: "Failed to create repair record", details: repairError.message },
                { status: 500 }
            );
        }

        console.log(`[garage/requests/complete] Successfully completed repair for request ${requestId}`);

        return NextResponse.json({
            success: true,
            message: "Repair completed successfully",
            repair_id: newRepair.id,
        });
    } catch (err) {
        console.error("[garage/requests/complete] Unhandled error:", err);
        return NextResponse.json(
            { error: "Server error", details: String(err) },
            { status: 500 }
        );
    }
}

