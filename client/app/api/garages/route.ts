import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const city = searchParams.get("city");

        const supabase = createAdminClient();

        // Fetch all garages
        let query = supabase
            .from("garages")
            .select("id, garage_name, phone, City, Street, Number, owner_user_id")
            .order("garage_name", { ascending: true });

        // Filter by city if provided
        if (city && city.trim()) {
            query = query.eq("City", city.trim());
        }

        const { data: garages, error } = await query;

        if (error) {
            console.error("[garages] Error fetching garages:", error);
            return NextResponse.json(
                { error: "Failed to fetch garages", details: error.message },
                { status: 500 }
            );
        }

        // Also fetch unique cities for the filter dropdown
        const { data: citiesData, error: citiesError } = await supabase
            .from("garages")
            .select("City")
            .not("City", "is", null);

        const uniqueCities = citiesError
            ? []
            : [...new Set(citiesData?.map((g: { City: string | null }) => g.City).filter(Boolean))].sort();

        // hasOwner = TRUE only if owner_user_id is NOT NULL
        // (We already updated fictitious garages to have NULL)
        const processedGarages = (garages || [])
            .map(g => ({
                ...g,
                hasOwner: g.owner_user_id !== null
            }))
            .sort((a, b) => {
                // Garages with real owners come first
                if (a.hasOwner && !b.hasOwner) return -1;
                if (!a.hasOwner && b.hasOwner) return 1;
                return a.garage_name.localeCompare(b.garage_name);
            });

        // DEBUG: Log each garage's hasOwner status
        console.log(`[garages] Found ${processedGarages.length} garages:`);
        processedGarages.forEach(g => {
            console.log(`  - ${g.garage_name}: owner_user_id=${g.owner_user_id}, hasOwner=${g.hasOwner}`);
        });

        return NextResponse.json({
            garages: processedGarages,
            cities: uniqueCities,
        });
    } catch (err) {
        console.error("[garages] Unhandled error:", err);
        return NextResponse.json(
            { error: "Server error", details: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}

