// app/api/repairs/[requestId]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for server-side operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
    params: Promise<{ requestId: string }>;
}

// GET /api/repairs/[requestId] - Fetch repair data by request_id
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { requestId } = await params;

        if (!requestId) {
            return NextResponse.json(
                { error: 'Request ID is required' },
                { status: 400 }
            );
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(requestId)) {
            return NextResponse.json(
                { error: 'Invalid request ID format' },
                { status: 400 }
            );
        }

        // Query the repairs table
        const { data, error } = await supabase
            .from('repairs')
            .select('*')
            .eq('request_id', requestId)
            .single();

        if (error) {
            // Handle "no rows returned" as 404
            if (error.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'Repair not found for this request' },
                    { status: 404 }
                );
            }

            console.error('[API repairs/[requestId]] Database error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch repair data', details: error.message },
                { status: 500 }
            );
        }

        if (!data) {
            return NextResponse.json(
                { error: 'Repair not found for this request' },
                { status: 404 }
            );
        }

        // Return the repair object
        return NextResponse.json({
            repair: data
        });

    } catch (err) {
        console.error('[API repairs/[requestId]] Unexpected error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
