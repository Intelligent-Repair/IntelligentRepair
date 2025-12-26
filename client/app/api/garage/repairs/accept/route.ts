import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

/**
 * POST /api/garage/repairs/accept
 * 
 * Accepts a request and converts it to a repair.
 * This is used by garages to accept customer requests and start working on them.
 * 
 * Request body:
 * {
 *   request_id: number;
 *   ai_summary?: string; // Optional AI diagnosis summary
 * }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase();
    const body = await req.json();
    const { request_id, ai_summary } = body;

    // Validate request_id
    if (!request_id || typeof request_id !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid request_id" },
        { status: 400 }
      );
    }

    // Authenticate the user (garage mechanic/owner)
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

    // Get the garage for this user
    const { data: garage, error: garageError } = await supabase
      .from("garages")
      .select("id")
      .or(`owner_user_id.eq.${user.id},user_id.eq.${user.id}`)
      .single();

    if (garageError || !garage) {
      return NextResponse.json(
        { error: "Garage not found. Only garage owners can accept requests." },
        { status: 404 }
      );
    }

    // Verify the request exists and is available
    const { data: request, error: requestError } = await supabase
      .from("requests")
      .select("id, status, description, ai_diagnosis")
      .eq("id", request_id)
      .single();

    if (requestError || !request) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    // Check if this request is already converted to a repair
    const { data: existingRepair, error: checkError } = await supabase
      .from("repairs")
      .select("id")
      .eq("request_id", request_id)
      .maybeSingle();

    if (checkError) {
      return NextResponse.json(
        { error: "Error checking existing repairs", details: checkError.message },
        { status: 500 }
      );
    }

    if (existingRepair) {
      return NextResponse.json(
        { error: "This request has already been converted to a repair", repair_id: existingRepair.id },
        { status: 409 }
      );
    }

    // Create a repair record
    const { data: repair, error: repairError } = await supabase
      .from("repairs")
      .insert({
        request_id: request_id,
        garage_id: garage.id,
        ai_summary: ai_summary || request.ai_diagnosis || null,
        status: "in_progress",
        mechanic_notes: null,
        final_issue_type: null,
      })
      .select()
      .single();

    if (repairError) {
      return NextResponse.json(
        { error: "Failed to create repair", details: repairError.message },
        { status: 500 }
      );
    }

    // Update the request status to 'accepted'
    const { error: updateError } = await supabase
      .from("requests")
      .update({ status: "accepted" })
      .eq("id", request_id);

    if (updateError) {
      console.error("Failed to update request status:", updateError);
      // Don't fail the whole operation if this fails
    }

    return NextResponse.json({
      success: true,
      message: "Request accepted and converted to repair",
      repair: repair,
    });
  } catch (err) {
    console.error("Error in accept repair:", err);
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}
