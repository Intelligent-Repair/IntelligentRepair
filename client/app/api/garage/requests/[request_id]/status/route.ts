// app/api/garage/requests/[request_id]/status/route.ts
// Update garage_request status and optionally the parent request status

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
    params: Promise<{ request_id: string }>;
}

// PATCH /api/garage/requests/[request_id]/status
export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const { request_id } = await params;
        const body = await request.json();
        const { status } = body;

        if (!request_id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        // Validate status
        const validStatuses = ['pending', 'viewed', 'quoted', 'accepted', 'rejected', 'in_repair', 'completed'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            }, { status: 400 });
        }

        // Update garage_request status (request_id param is actually the garage_request.id)
        const { data: garageRequest, error: grError } = await supabase
            .from('garage_requests')
            .update({ status })
            .eq('id', request_id)
            .select('request_id')
            .single();

        if (grError) {
            console.error('[API status] garage_requests update error:', grError);
            return NextResponse.json({ error: 'Failed to update garage_request' }, { status: 500 });
        }

        // If completed, also update the parent request status
        if (status === 'completed' && garageRequest?.request_id) {
            const { error: reqError } = await supabase
                .from('requests')
                .update({ status: 'completed' })
                .eq('id', garageRequest.request_id);

            if (reqError) {
                console.warn('[API status] Failed to update parent request:', reqError);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Status updated to ${status}`
        });

    } catch (err) {
        console.error('[API status] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
