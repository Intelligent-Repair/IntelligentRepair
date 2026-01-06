import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// Helper function to convert day number (0-6) to Hebrew day name
const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// Helper function to parse operating hours from database format
function parseOperatingHours(hoursJson: any): Array<{ day: string; open: string; close: string; isClosed: boolean }> {
    if (!hoursJson) {
        // Default hours if not set
        return [
            { day: 'ראשון', open: '08:00', close: '17:00', isClosed: false },
            { day: 'שני', open: '08:00', close: '17:00', isClosed: false },
            { day: 'שלישי', open: '08:00', close: '17:00', isClosed: false },
            { day: 'רביעי', open: '08:00', close: '17:00', isClosed: false },
            { day: 'חמישי', open: '08:00', close: '17:00', isClosed: false },
            { day: 'שישי', open: '08:00', close: '13:00', isClosed: false },
            { day: 'שבת', open: '00:00', close: '00:00', isClosed: true },
        ];
    }

    // If it's already an array, return it
    if (Array.isArray(hoursJson)) {
        return hoursJson;
    }

    // If it's an object with day numbers as keys
    if (typeof hoursJson === 'object') {
        return dayNames.map((dayName, index) => {
            const dayData = hoursJson[index] || hoursJson[dayName] || hoursJson[`day_${index}`];
            if (!dayData) {
                return { day: dayName, open: '08:00', close: '17:00', isClosed: false };
            }
            return {
                day: dayName,
                open: dayData.open || '08:00',
                close: dayData.close || '17:00',
                isClosed: dayData.isClosed !== undefined ? dayData.isClosed : false,
            };
        });
    }

    // Fallback to default
    return [
        { day: 'ראשון', open: '08:00', close: '17:00', isClosed: false },
        { day: 'שני', open: '08:00', close: '17:00', isClosed: false },
        { day: 'שלישי', open: '08:00', close: '17:00', isClosed: false },
        { day: 'רביעי', open: '08:00', close: '17:00', isClosed: false },
        { day: 'חמישי', open: '08:00', close: '17:00', isClosed: false },
        { day: 'שישי', open: '08:00', close: '13:00', isClosed: false },
        { day: 'שבת', open: '00:00', close: '00:00', isClosed: true },
    ];
}

// GET - Get garage profile
export async function GET(req: Request) {
    console.log("[garage/profile] GET request received");
    try {
        const supabase = await createServerSupabase();

        // Authenticate user
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

        // Find the garage owned by this user
        // Note: Only owner_user_id exists in the garages table (no user_id field)
        const { data: garage, error: garageError } = await supabase
            .from("garages")
            .select("id, garage_name, phone, email, City, Street, Number, operating_hours")
            .eq("owner_user_id", user.id)
            .single();

        if (garageError || !garage) {
            console.error("[garage/profile] Garage lookup error:", garageError);
            return NextResponse.json(
                { error: "No garage found for this user" },
                { status: 404 }
            );
        }

        // Format address from components
        const addressParts = [garage.City, garage.Street, garage.Number].filter(Boolean);
        const address = addressParts.length > 0 ? addressParts.join(", ") : "";

        // Parse operating hours
        const operatingHours = parseOperatingHours(garage.operating_hours);

        return NextResponse.json({
            success: true,
            profile: {
                id: garage.id,
                name: garage.garage_name,
                email: garage.email || user.email || "",
                phone: garage.phone || "",
                address: address,
                city: garage.City || "",
                street: garage.Street || "",
                number: garage.Number || "",
            },
            operatingHours: operatingHours,
        });
    } catch (err) {
        console.error("[garage/profile] Error:", err);
        return NextResponse.json(
            { error: "Server error", details: String(err) },
            { status: 500 }
        );
    }
}

// PUT - Update garage profile
export async function PUT(req: Request) {
    console.log("[garage/profile] PUT request received");
    try {
        const supabase = await createServerSupabase();

        // Authenticate user
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

        const body = await req.json();
        const { profile, operatingHours } = body;

        // Find the garage owned by this user
        // Note: Only owner_user_id exists in the garages table (no user_id field)
        const { data: garage, error: garageError } = await supabase
            .from("garages")
            .select("id")
            .eq("owner_user_id", user.id)
            .single();

        if (garageError || !garage) {
            console.error("[garage/profile] Garage lookup error:", garageError);
            return NextResponse.json(
                { error: "No garage found for this user" },
                { status: 404 }
            );
        }

        // Prepare update data
        const updateData: any = {};

        if (profile) {
            if (profile.name) updateData.garage_name = profile.name;
            if (profile.phone !== undefined) updateData.phone = profile.phone;
            if (profile.city) updateData.City = profile.city;
            if (profile.street) updateData.Street = profile.street;
            if (profile.number) updateData.Number = profile.number;
        }

        // Update operating hours if provided
        if (operatingHours && Array.isArray(operatingHours)) {
            updateData.operating_hours = operatingHours;
        }

        // Update the garage
        const { error: updateError } = await supabase
            .from("garages")
            .update(updateData)
            .eq("id", garage.id);

        if (updateError) {
            console.error("[garage/profile] Update error:", updateError);
            return NextResponse.json(
                { error: "Failed to update profile", details: updateError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Profile updated successfully",
        });
    } catch (err) {
        console.error("[garage/profile] Error:", err);
        return NextResponse.json(
            { error: "Server error", details: String(err) },
            { status: 500 }
        );
    }
}

