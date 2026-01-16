import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// Issue type labels in Hebrew
const ISSUE_TYPE_OPTIONS = [
  { value: 'engine', label: 'מנוע' },
  { value: 'brakes', label: 'בלמים' },
  { value: 'electrical', label: 'חשמל' },
  { value: 'ac', label: 'מיזוג אוויר' },
  { value: 'starting', label: 'מערכת התנעה' },
  { value: 'gearbox', label: 'תיבת הילוכים' },
  { value: 'noise', label: 'רעש/רטט' },
  { value: 'suspension', label: 'מתלים' },
  { value: 'transmission', label: 'הנעה' },
  { value: 'fuel_system', label: 'מערכת דלק' },
  { value: 'cooling_system', label: 'מערכת קירור' },
  { value: 'exhaust', label: 'פליטה' },
  { value: 'tires', label: 'צמיגים' },
  { value: 'steering', label: 'היגוי' },
  { value: 'other', label: 'אחר' },
];

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "local";

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get garage ID for local mode
    let garageId: string | null = null;
    if (mode === "local") {
      const { data: userData } = await supabase
        .from("users")
        .select("national_id")
        .eq("id", user.id)
        .single();

      if (userData?.national_id) {
        const { data: garage } = await supabase
          .from("garages")
          .select("id")
          .eq("owner_national_id", userData.national_id)
          .single();
        garageId = garage?.id || null;
      }
    }

    // Build query for repairs to extract filter options
    let repairsQuery = supabase
      .from("repairs")
      .select("vehicle_info, final_issue_type");

    if (garageId) {
      repairsQuery = repairsQuery.eq("garage_id", garageId);
    }

    const { data: repairsData } = await repairsQuery;

    // Extract unique manufacturers, models, and years from vehicle_info
    const manufacturers = new Set<string>();
    const modelsByManufacturer = new Map<string, Set<string>>();
    const years = new Set<number>();
    const issueTypesUsed = new Set<string>();

    (repairsData || []).forEach((repair: any) => {
      const vi = repair.vehicle_info;
      if (vi?.manufacturer) {
        manufacturers.add(vi.manufacturer);
        if (vi.model) {
          if (!modelsByManufacturer.has(vi.manufacturer)) {
            modelsByManufacturer.set(vi.manufacturer, new Set());
          }
          modelsByManufacturer.get(vi.manufacturer)!.add(vi.model);
        }
        if (vi.year) {
          years.add(vi.year);
        }
      }
      if (repair.final_issue_type) {
        issueTypesUsed.add(repair.final_issue_type);
      }
    });

    // Convert to arrays and sort
    const manufacturersArray = Array.from(manufacturers).sort();
    const modelsByManufacturerObj: Record<string, string[]> = {};
    modelsByManufacturer.forEach((models, manufacturer) => {
      modelsByManufacturerObj[manufacturer] = Array.from(models).sort();
    });
    const yearsArray = Array.from(years).sort((a, b) => b - a); // Descending

    // Filter issue types to only those used in repairs
    const issueTypesArray = ISSUE_TYPE_OPTIONS.filter(opt => issueTypesUsed.has(opt.value));

    return NextResponse.json({
      manufacturers: manufacturersArray,
      modelsByManufacturer: modelsByManufacturerObj,
      years: yearsArray,
      issueTypes: issueTypesArray,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", details: String(err) },
      { status: 500 }
    );
  }
}

