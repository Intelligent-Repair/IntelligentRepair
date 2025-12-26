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
    const requestId = parseInt(params.id, 10);

    if (isNaN(requestId)) {
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
        problem_description,
        status,
        image_urls,
        ai_diagnosis,
        ai_confidence,
        created_at,
        user_id,
        car:people_cars (
          id,
          license_plate,
          plate_number,
          manufacturer,
          model,
          year,
          vehicle_catalog:vehicle_catalog_id (
            manufacturer,
            model,
            year
          ),
          user:users (
            id,
            full_name,
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
    const manufacturer = car?.manufacturer || car?.vehicle_catalog?.manufacturer;
    const model = car?.model || car?.vehicle_catalog?.model;
    const year = car?.year || car?.vehicle_catalog?.year;

    const transformedRequest = {
      id: requestData.id,
      description: requestData.description || requestData.problem_description,
      problem_description: requestData.problem_description,
      status: requestData.status,
      image_urls: requestData.image_urls,
      ai_diagnosis: requestData.ai_diagnosis,
      ai_confidence: requestData.ai_confidence,
      created_at: requestData.created_at,
      client: carUser ? {
        id: carUser.id,
        name: carUser.full_name,
        phone: carUser.phone,
        email: carUser.email,
      } : null,
      car: car ? {
        id: car.id,
        license_plate: car.license_plate || car.plate_number,
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
