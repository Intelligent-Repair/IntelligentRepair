import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    const status = searchParams.get("status"); // Filter by repair status
    const issueType = searchParams.get("issue_type"); // Filter by final issue type
    const manufacturer = searchParams.get("manufacturer"); // Filter by manufacturer
    const model = searchParams.get("model"); // Filter by model

    // Authenticate the user (required for both modes)
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

    let query = supabase
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
          problem_description,
          description,
          created_at,
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
              phone
            )
          )
        ),
        garage:garages (
          id,
          garage_name
        )
      `);

    // If mode is not "global", filter by garage_id
    if (mode !== "global") {
      // Find the garage record via user_id (check both owner_user_id and user_id)
      const { data: garage, error: garageError } = await supabase
        .from("garages")
        .select("id")
        .or(`owner_user_id.eq.${user.id},user_id.eq.${user.id}`)
        .single();

      if (garageError || !garage) {
        return NextResponse.json(
          { error: "Garage not found" },
          { status: 404 }
        );
      }

      // Filter by garage_id for local mode
      query = query.eq("garage_id", garage.id);
    }

    // Apply status filter if provided
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Apply final issue type filter if provided
    if (issueType && issueType !== "all") {
      query = query.eq("final_issue_type", issueType);
    }

    // Order by created_at descending
    const { data: repairs, error: repairsError } = await query.order("created_at", { ascending: false });

    if (repairsError) {
      return NextResponse.json(
        { error: "Failed to fetch repairs", details: repairsError.message },
        { status: 500 }
      );
    }

    // Apply additional filters in memory (for nested fields)
    let filteredRepairs = repairs || [];
    
    if (manufacturer || model) {
      filteredRepairs = filteredRepairs.filter((repair: any) => {
        const car = repair.request?.car;
        const carManufacturer = car?.vehicle_catalog?.manufacturer;
        const carModel = car?.vehicle_catalog?.model;

        if (manufacturer && carManufacturer !== manufacturer) {
          return false;
        }

        if (model && carModel !== model) {
          return false;
        }

        return true;
      });
    }

    // Transform the data to match the expected structure
    const transformedRepairs = filteredRepairs.map((repair: any) => {
      const request = repair.request;
      const car = request?.car;
      const user = car?.user;
      const garage = repair.garage;
      const carManufacturer = car?.vehicle_catalog?.manufacturer;
      const carModel = car?.vehicle_catalog?.model;
      const carYear = car?.vehicle_catalog?.year;

      return {
        id: repair.id,
        ai_summary: repair.ai_summary,
        mechanic_notes: repair.mechanic_notes,
        status: repair.status,
        final_issue_type: repair.final_issue_type,
        created_at: repair.created_at,
        updated_at: repair.updated_at,
        request: request
          ? {
              id: request.id,
              problem_description: request.problem_description || request.description || null,
              created_at: request.created_at,
            }
          : null,
        car: car
          ? {
              id: car.id,
              license_plate: car.license_plate,
              manufacturer: carManufacturer,
              model: carModel,
              year: carYear,
            }
          : null,
        user: user
          ? {
              id: user.id,
              full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
              first_name: user.first_name,
              last_name: user.last_name,
              phone: user.phone,
            }
          : null,
        garage: mode === "global" && garage
          ? {
              id: garage.id,
              name: garage.garage_name || null,
            }
          : null,
      };
    });

    return NextResponse.json({
      repairs: transformedRepairs,
      total: transformedRepairs.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}

