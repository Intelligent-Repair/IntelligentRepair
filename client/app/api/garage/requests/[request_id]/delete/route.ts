// app/api/garage/requests/[request_id]/delete/route.ts
// Delete a garage_request

import { NextResponse } from 'next/server';
import { createServerSupabase } from "@/lib/supabaseServer";

interface RouteParams {
    params: Promise<{ request_id: string }>;
}

// DELETE /api/garage/requests/[request_id]/delete
export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const { request_id } = await params;

        if (!request_id) {
            return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
        }

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

        // Get user's national_id from users table
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("national_id")
            .eq("id", user.id)
            .single();

        if (userError || !userData?.national_id) {
            return NextResponse.json(
                { error: "User profile incomplete - missing national_id" },
                { status: 400 }
            );
        }

        // Find the garage by owner_national_id
        const { data: garage, error: garageError } = await supabase
            .from("garages")
            .select("id")
            .eq("owner_national_id", userData.national_id)
            .maybeSingle();

        if (garageError || !garage) {
            return NextResponse.json(
                { error: "No garage found for this user" },
                { status: 404 }
            );
        }

        // Delete the garage_request (only if it belongs to this garage)
        const { error: deleteError } = await supabase
            .from("garage_requests")
            .delete()
            .eq("id", request_id)
            .eq("garage_id", garage.id);

        if (deleteError) {
            console.error('[API delete] Delete error:', deleteError);
            return NextResponse.json(
                { error: 'Failed to delete request', details: deleteError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Request deleted successfully'
        });

    } catch (err) {
        console.error('[API delete] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
