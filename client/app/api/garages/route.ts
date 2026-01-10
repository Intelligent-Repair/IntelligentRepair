import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const city = searchParams.get("city");

        const supabase = createAdminClient();

        // Fetch ALL garages - include owner_national_id to determine hasOwner
        let query = supabase
            .from("garages")
            .select("id, garage_name, phone, City, Street, Number, operating_hours, owner_national_id")
            .order("garage_name", { ascending: true });

        // Filter by city if provided
        if (city && city.trim()) {
            query = query.eq("City", city.trim());
        }

        // Show ALL garages - hasOwner flag will determine if send button appears

        const { data: garages, error } = await query;

        if (error) {
            console.error("[garages] Error fetching garages:", error);
            return NextResponse.json(
                { error: "Failed to fetch garages", details: error.message },
                { status: 500 }
            );
        }

        // Fetch unique cities from ALL garages for filter dropdown
        const { data: citiesData, error: citiesError } = await supabase
            .from("garages")
            .select("City")
            .not("City", "is", null);

        const uniqueCities = citiesError
            ? []
            : [...new Set(citiesData?.map((g: { City: string | null }) => g.City).filter(Boolean))].sort();

        // Set hasOwner based on actual owner_national_id value
        const processedGarages = (garages || [])
            .map(g => ({
                ...g,
                hasOwner: g.owner_national_id !== null,
            }))
            .sort((a, b) => {
                // Garages with owners first
                if (a.hasOwner && !b.hasOwner) return -1;
                if (!a.hasOwner && b.hasOwner) return 1;
                return a.garage_name.localeCompare(b.garage_name);
            });

        console.log(`[garages] Found ${processedGarages.length} registered garages`);

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
