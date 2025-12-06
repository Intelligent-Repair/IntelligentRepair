import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");

    if (!user_id) {
      return NextResponse.json(
        { error: "Missing user_id parameter" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();

    // Fetch cars with JOIN to vehicle_catalog
    const { data, error } = await supabase
      .from("people_cars")
      .select(`
        id,
        license_plate,
        vehicle_catalog_id,
        vehicle_catalog:vehicle_catalog_id (
          manufacturer,
          model,
          year
        )
      `)
      .eq("user_id", user_id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch cars", details: error.message },
        { status: 500 }
      );
    }

    // Transform the data to match the expected format
    const cars = data.map((car: any) => ({
      id: car.id,
      manufacturer: car.vehicle_catalog?.manufacturer || "",
      model: car.vehicle_catalog?.model || "",
      year: car.vehicle_catalog?.year || null,
      license_plate: car.license_plate || "",
    }));

    return NextResponse.json(cars);
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}

