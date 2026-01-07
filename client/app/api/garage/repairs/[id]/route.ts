import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

/**
 * GET /api/garage/repairs/[id]
 * 
 * Gets a single repair by ID with all related information.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabase();
    const repairId = params.id;

    // repairs.id is a UUID in Supabase
    const isUuid =
      typeof repairId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(repairId);
    if (!isUuid) {
      return NextResponse.json(
        { error: "Invalid repair ID" },
        { status: 400 }
      );
    }

    // Authenticate the user
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

    // Get the repair with all related data
    const { data: repair, error: repairError } = await supabase
      .from("repairs")
      .select(`
        id,
        ai_summary,
        mechanic_notes,
        status,
        final_issue_type,
        created_at,
        updated_at,
        garage_id,
        request:requests (
          id,
          description,
          ai_mechanic_summary,
          status,
          image_urls,
          ai_diagnosis,
          ai_confidence,
          created_at,
          user_id,
          car:people_cars (
            id,
            license_plate,
            vehicle_catalog:vehicle_catalog_id (
              manufacturer,
              model,
              year
            ),
            user:users (
              id,
              first_name,
              last_name,
              phone,
              email
            )
          )
        ),
        garage:garages (
          id,
          garage_name
        )
      `)
      .eq("id", repairId)
      .single();

    if (repairError || !repair) {
      return NextResponse.json(
        { error: "Repair not found" },
        { status: 404 }
      );
    }

    // Get the garage for this user to verify access
    const { data: garage } = await supabase
      .from("garages")
      .select("id")
      .or(`owner_user_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();

    // Check if user has access to this repair
    // User can access if they're the garage owner OR if they're the customer
    const isGarageOwner = garage && repair.garage_id === garage.id;
    const isCustomer = repair.request?.user_id === user.id;

    if (!isGarageOwner && !isCustomer) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Transform the data
    const transformedRepair = {
      id: repair.id,
      ai_summary: repair.ai_summary,
      mechanic_notes: repair.mechanic_notes,
      status: repair.status,
      final_issue_type: repair.final_issue_type,
      created_at: repair.created_at,
      updated_at: repair.updated_at,
      request: repair.request ? {
        id: repair.request.id,
        description: repair.request.description,
        // Backward-compatible field name used by the UI.
        problem_description: repair.request.ai_mechanic_summary || repair.request.description || null,
        status: repair.request.status,
        image_urls: repair.request.image_urls,
        ai_diagnosis: repair.request.ai_diagnosis,
        ai_confidence: repair.request.ai_confidence,
        created_at: repair.request.created_at,
        car: repair.request.car ? {
          id: repair.request.car.id,
          license_plate: repair.request.car.license_plate,
          manufacturer: repair.request.car.vehicle_catalog?.manufacturer,
          model: repair.request.car.vehicle_catalog?.model,
          year: repair.request.car.vehicle_catalog?.year,
          user: repair.request.car.user ? {
            id: repair.request.car.user.id,
            full_name: `${repair.request.car.user.first_name || ''} ${repair.request.car.user.last_name || ''}`.trim(),
            first_name: repair.request.car.user.first_name,
            last_name: repair.request.car.user.last_name,
            phone: repair.request.car.user.phone,
            email: repair.request.car.user.email,
          } : null,
        } : null,
      } : null,
      garage: repair.garage ? {
        id: repair.garage.id,
        name: repair.garage.garage_name,
      } : null,
    };

    return NextResponse.json({
      success: true,
      repair: transformedRepair,
    });
  } catch (err) {
    console.error("Error fetching repair:", err);
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/garage/repairs/[id]
 * 
 * Updates a repair with mechanic notes, status, and final issue type.
 * This is used by mechanics after they fix the vehicle.
 * 
 * Request body:
 * {
 *   mechanic_notes?: string; // Optional notes from the mechanic
 *   status?: string; // Status of the repair (in_progress, completed, on_hold, cancelled)
 *   final_issue_type?: string; // Final categorized issue type
 * }
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabase();
    const repairId = params.id;
    const body = await req.json();

    const isUuid =
      typeof repairId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(repairId);
    if (!isUuid) {
      return NextResponse.json(
        { error: "Invalid repair ID" },
        { status: 400 }
      );
    }

    const { mechanic_notes, status, final_issue_type } = body;

    // Validate at least one field is provided
    if (
      mechanic_notes === undefined &&
      status === undefined &&
      final_issue_type === undefined
    ) {
      return NextResponse.json(
        { error: "At least one field must be provided for update" },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ["in_progress", "completed", "on_hold", "cancelled"];
    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate final_issue_type if provided
    const validIssueTypes = [
      "engine",
      "brakes",
      "electrical",
      "ac",
      "starting",
      "gearbox",
      "noise",
      "suspension",
      "transmission",
      "fuel_system",
      "cooling_system",
      "exhaust",
      "tires",
      "steering",
      "other",
    ];
    if (final_issue_type !== undefined && final_issue_type !== null && !validIssueTypes.includes(final_issue_type)) {
      return NextResponse.json(
        { error: `Invalid issue type. Must be one of: ${validIssueTypes.join(", ")}` },
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
        { error: "Garage not found. Only garage owners can update repairs." },
        { status: 404 }
      );
    }

    // Verify the repair exists and belongs to this garage
    const { data: existingRepair, error: checkError } = await supabase
      .from("repairs")
      .select("id, garage_id")
      .eq("id", repairId)
      .single();

    if (checkError || !existingRepair) {
      return NextResponse.json(
        { error: "Repair not found" },
        { status: 404 }
      );
    }

    if (existingRepair.garage_id !== garage.id) {
      return NextResponse.json(
        { error: "Access denied. This repair belongs to another garage." },
        { status: 403 }
      );
    }

    // Build the update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (mechanic_notes !== undefined) {
      updateData.mechanic_notes = mechanic_notes;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    if (final_issue_type !== undefined) {
      updateData.final_issue_type = final_issue_type;
    }

    // Update the repair
    const { data: repair, error: updateError } = await supabase
      .from("repairs")
      .update(updateData)
      .eq("id", repairId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update repair", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Repair updated successfully",
      repair: repair,
    });
  } catch (err) {
    console.error("Error updating repair:", err);
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}
