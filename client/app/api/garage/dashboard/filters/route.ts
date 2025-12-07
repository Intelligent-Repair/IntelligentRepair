import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function GET(request: Request) {
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
      new Set(manufacturersData?.map((item: any) => item.manufacturer).filter(Boolean))
    ).sort();

    // Extract unique models grouped by manufacturer
    const modelsByManufacturer = new Map<string, string[]>();
    modelsData?.forEach((item: any) => {
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
    modelsByManufacturer.forEach((models, manufacturer) => {
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

