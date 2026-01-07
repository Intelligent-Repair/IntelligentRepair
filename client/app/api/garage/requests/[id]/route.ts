import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

/**
 * GET /api/garage/requests/[id]
 * 
 * Gets a single request by ID with all related information.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabase();
    const requestId = params.id;

    // requests.id is a UUID in Supabase
    const isUuid =
      typeof requestId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId);
    if (!isUuid) {
      return NextResponse.json(
        { error: "Invalid request ID" },
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

    // Get the request with all related data
    const { data: requestData, error: requestError } = await supabase
      .from("requests")
      .select(`
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
      `)
      .eq("id", requestId)
      .single();

    if (requestError || !requestData) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    // Check if there's an associated repair
    const { data: repair, error: repairError } = await supabase
      .from("repairs")
      .select(`
        id,
        status,
        mechanic_notes,
        final_issue_type,
        ai_summary,
        created_at,
        updated_at
      `)
      .eq("request_id", requestId)
      .maybeSingle();

    // Transform the data
    const car = requestData.car;
    const carUser = car?.user;
    const manufacturer = car?.vehicle_catalog?.manufacturer;
    const model = car?.vehicle_catalog?.model;
    const year = car?.vehicle_catalog?.year;

    const transformedRequest = {
      id: requestData.id,
      description: requestData.description || requestData.ai_mechanic_summary,
      // Backward-compatible field name used by the UI.
      problem_description: requestData.ai_mechanic_summary || requestData.description || null,
      status: requestData.status,
      image_urls: requestData.image_urls,
      ai_diagnosis: requestData.ai_diagnosis,
      ai_confidence: requestData.ai_confidence,
      created_at: requestData.created_at,
      client: carUser ? {
        id: carUser.id,
        name: `${carUser.first_name || ''} ${carUser.last_name || ''}`.trim(),
        first_name: carUser.first_name,
        last_name: carUser.last_name,
        phone: carUser.phone,
        email: carUser.email,
      } : null,
      car: car ? {
        id: car.id,
        license_plate: car.license_plate,
        manufacturer: manufacturer,
        model: model,
        year: year,
        full_name: `${manufacturer || ''} ${model || ''} ${year ? `(${year})` : ''}`.trim(),
      } : null,
      repair: repair ? {
        id: repair.id,
        status: repair.status,
        mechanic_notes: repair.mechanic_notes,
        final_issue_type: repair.final_issue_type,
        ai_summary: repair.ai_summary,
        created_at: repair.created_at,
        updated_at: repair.updated_at,
      } : null,
    };

    return NextResponse.json({
      success: true,
      request: transformedRequest,
    });
  } catch (err) {
    console.error("Error fetching request:", err);
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}
