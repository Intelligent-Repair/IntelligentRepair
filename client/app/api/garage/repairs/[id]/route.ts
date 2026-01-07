import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

type VehicleCatalog = { manufacturer: string | null; model: string | null; year: number | null };
type VehicleCatalogJoin = VehicleCatalog | VehicleCatalog[] | null | undefined;
type UserJoin = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email?: string | null;
};
type UserJoinValue = UserJoin | UserJoin[] | null | undefined;
type CarJoin = { id: string; license_plate: string | null; vehicle_catalog?: VehicleCatalogJoin; user?: UserJoinValue };
type CarJoinValue = CarJoin | CarJoin[] | null | undefined;
type RequestJoin = {
  id: string;
  description: string | null;
  ai_mechanic_summary: string | null;
  status: string | null;
  image_urls: string[] | null;
  ai_diagnosis: unknown;
  ai_confidence: number | null;
  created_at: string;
  user_id: string | null;
  car?: CarJoinValue;
};
type RequestJoinValue = RequestJoin | RequestJoin[] | null | undefined;

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * GET /api/garage/repairs/[id]
 * 
 * Gets a single repair by ID with all related information.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { id } = await params;
    const repairId = id;

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
    const requestJoin = firstOrNull(
      (repair as unknown as { request?: RequestJoinValue }).request
    );
    const isCustomer = requestJoin?.user_id === user.id;

    if (!isGarageOwner && !isCustomer) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Transform the data
    const carJoin = firstOrNull(requestJoin?.car as CarJoinValue);
    const catalogJoin = firstOrNull(carJoin?.vehicle_catalog as VehicleCatalogJoin);
    const carUserJoin = firstOrNull(carJoin?.user as UserJoinValue);
    const garageJoin = firstOrNull(
      (repair as unknown as { garage?: { id: string; garage_name: string | null } | { id: string; garage_name: string | null }[] | null })
        .garage
    );

    const transformedRepair = {
      id: repair.id,
      ai_summary: repair.ai_summary,
      mechanic_notes: repair.mechanic_notes,
      status: repair.status,
      final_issue_type: repair.final_issue_type,
      created_at: repair.created_at,
      updated_at: repair.updated_at,
      request: requestJoin ? {
        id: requestJoin.id,
        description: requestJoin.description,
        // Backward-compatible field name used by the UI.
        problem_description: requestJoin.ai_mechanic_summary || requestJoin.description || null,
        status: requestJoin.status,
        image_urls: requestJoin.image_urls,
        ai_diagnosis: requestJoin.ai_diagnosis,
        ai_confidence: requestJoin.ai_confidence,
        created_at: requestJoin.created_at,
        car: carJoin ? {
          id: carJoin.id,
          license_plate: carJoin.license_plate,
          manufacturer: catalogJoin?.manufacturer ?? null,
          model: catalogJoin?.model ?? null,
          year: catalogJoin?.year ?? null,
          user: carUserJoin ? {
            id: carUserJoin.id,
            full_name: `${carUserJoin.first_name || ''} ${carUserJoin.last_name || ''}`.trim(),
            first_name: carUserJoin.first_name,
            last_name: carUserJoin.last_name,
            phone: carUserJoin.phone,
            email: carUserJoin.email ?? null,
          } : null,
        } : null,
      } : null,
      garage: garageJoin ? {
        id: garageJoin.id,
        name: garageJoin.garage_name,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { id } = await params;
    const repairId = id;
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
