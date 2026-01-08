// app/api/garage/requests/by-request/[requestId]/route.ts
// Fetch the accepted garage_request for a given request_id

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
    params: Promise<{ requestId: string }>;
}

// GET /api/garage/requests/by-request/[requestId]
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { requestId } = await params;

        if (!requestId) {
            return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(requestId)) {
            return NextResponse.json({ error: 'Invalid request ID format' }, { status: 400 });
        }

        // Fetch the garage_request by its own ID
        // NOTE: The URL param 'requestId' is actually the garage_request.id, not request_id FK
        const { data, error } = await supabase
            .from('garage_requests')
            .select('*')
            .eq('id', requestId)  // Query by garage_requests.id, not request_id
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'No accepted garage request found for this request' },
                    { status: 404 }
                );
            }
            console.error('[API garage/requests/by-request] DB error:', error);
            return NextResponse.json(
                { error: 'Database error', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ garageRequest: data });
    } catch (err) {
        console.error('[API garage/requests/by-request] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
