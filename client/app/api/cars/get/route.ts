import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const carId = searchParams.get("car_id");

  console.log("[API /api/cars/get] Received car_id:", carId);

  if (!carId) {
    console.error("[API /api/cars/get] Missing car_id parameter");
    return NextResponse.json({ error: "Missing car_id" }, { status: 400 });
  }

  const supabase = await createServerSupabase();

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
    .eq("id", carId)
    .single();

  console.log("[API /api/cars/get] Supabase query result:", { data, error });

  if (error) {
    console.error("[API /api/cars/get] Supabase error:", error);
    return NextResponse.json(
      { error: "Failed to fetch car", details: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    console.error("[API /api/cars/get] No data returned for car_id:", carId);
    return NextResponse.json({ error: "Car not found" }, { status: 404 });
  }

  // Transform the data to match the expected format
  const catalog = (data as any).vehicle_catalog;
  const car = {
    id: data.id,
    manufacturer: catalog?.manufacturer || "",
    model: catalog?.model || "",
    year: catalog?.year || null,
    license_plate: data.license_plate || "",
  };

  console.log("[API /api/cars/get] Returning car data:", car);
  return NextResponse.json(car);
}
