import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

type ManufacturerRow = { manufacturer: string | null };
type ModelRow = { manufacturer: string | null; model: string | null };

function isManufacturerRow(value: unknown): value is ManufacturerRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "manufacturer" in value
  );
}

function isModelRow(value: unknown): value is ModelRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "manufacturer" in value &&
    "model" in value
  );
}

export async function GET() {
  try {
    const supabase = await createServerSupabase();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all unique manufacturers
    const { data: manufacturersData, error: manufacturersError } = await supabase
      .from("vehicle_catalog")
      .select("manufacturer")
      .not("manufacturer", "is", null);

    if (manufacturersError) {
      return NextResponse.json(
        { error: "Failed to fetch manufacturers", details: manufacturersError.message },
        { status: 500 }
      );
    }

    // Get all unique models with manufacturers
    const { data: modelsData, error: modelsError } = await supabase
      .from("vehicle_catalog")
      .select("manufacturer, model")
      .not("model", "is", null);

    if (modelsError) {
      return NextResponse.json(
        { error: "Failed to fetch models", details: modelsError.message },
        { status: 500 }
      );
    }

    // Extract unique manufacturers
    const manufacturers = Array.from(
      new Set(
        (manufacturersData ?? [])
          .filter(isManufacturerRow)
          .map((item) => item.manufacturer)
          .filter((m): m is string => typeof m === "string" && m.length > 0)
      )
    ).sort();

    // Extract unique models grouped by manufacturer
    const modelsByManufacturer = new Map<string, string[]>();
    (modelsData ?? []).filter(isModelRow).forEach((item) => {
      if (item.manufacturer && item.model) {
        if (!modelsByManufacturer.has(item.manufacturer)) {
          modelsByManufacturer.set(item.manufacturer, []);
        }
        const models = modelsByManufacturer.get(item.manufacturer)!;
        if (!models.includes(item.model)) {
          models.push(item.model);
        }
      }
    });

    // Sort models within each manufacturer
    modelsByManufacturer.forEach((models) => {
      models.sort();
    });

    return NextResponse.json({
      manufacturers,
      modelsByManufacturer: Object.fromEntries(modelsByManufacturer),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}

