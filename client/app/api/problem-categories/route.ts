import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// GET - Fetch all active problem categories
export async function GET(req: Request) {
    try {
        const supabase = await createServerSupabase();

        const { data: categories, error } = await supabase
            .from("problem_categories")
            .select("code, name_he, name_en, description, display_order")
            .eq("is_active", true)
            .order("display_order", { ascending: true });

        if (error) {
            console.error("[problem-categories] Error fetching categories:", error);
            return NextResponse.json(
                { error: "Failed to fetch categories", details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            categories: categories || [],
        });
    } catch (err) {
        console.error("[problem-categories] Unhandled error:", err);
        return NextResponse.json(
            { error: "Server error", details: String(err) },
            { status: 500 }
        );
    }
}

