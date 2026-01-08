// app/api/repairs/create/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase with service role for server-side operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Input types - matches new schema (2026-01-08)
type RepairStatus = 'in_progress' | 'completed';
type FinalIssueType =
    | 'engine' | 'brakes' | 'electrical' | 'ac' | 'starting' | 'gearbox'
    | 'noise' | 'suspension' | 'transmission' | 'fuel_system' | 'cooling_system'
    | 'exhaust' | 'tires' | 'steering' | 'other';

interface RepairInput {
    request_id: string;           // FK to requests
    garage_id: string;            // FK to garages  
    garage_request_id?: string;   // FK to garage_requests (the accepted quote)
    mechanic_notes: string;
    problem_category: string;     // FK to problem_categories(code)
    final_issue_type: FinalIssueType;
    labor_hours: number;
    status: RepairStatus;
    vehicle_info?: Record<string, any>;  // JSONB
}

interface AIProcessingResult {
    mechanic_description_ai: string;
    ai_summary: string;
}

// AI Processing Function
async function processWithAI(mechanicNotes: string): Promise<AIProcessingResult> {
    const systemPrompt = `You are an expert automotive technical writer. Analyze the mechanic's raw notes and output a JSON object with exactly two fields:

1. "mechanic_description_ai": A professional, customer-facing technical explanation of the work done. Make it clear, polite, and easy for a non-technical person to understand. Summarize the diagnosis, work performed, and any relevant findings.

2. "ai_summary": A very short, 1-sentence summary of the repair (max 20 words).

IMPORTANT: 
- Output ONLY valid JSON, no markdown.
- If notes are in Hebrew, respond in Hebrew.
- Be professional and concise.`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Mechanic's raw notes:\n\n${mechanicNotes}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error('Empty response from AI');
    }

    const parsed = JSON.parse(content) as AIProcessingResult;

    // Validate required fields
    if (!parsed.mechanic_description_ai || !parsed.ai_summary) {
        throw new Error('AI response missing required fields');
    }

    return parsed;
}

// POST /api/repairs/create - Create new repair with AI processing
export async function POST(request: Request) {
    try {
        // Parse request body
        const body: RepairInput = await request.json();

        // Validate required fields
        const requiredFields = ['request_id', 'garage_id', 'mechanic_notes', 'problem_category', 'final_issue_type', 'labor_hours', 'status'];
        for (const field of requiredFields) {
            if (!(field in body) || body[field as keyof RepairInput] === undefined) {
                return NextResponse.json(
                    { error: `Missing required field: ${field}` },
                    { status: 400 }
                );
            }
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(body.request_id)) {
            return NextResponse.json({ error: 'Invalid request_id format' }, { status: 400 });
        }
        if (!uuidRegex.test(body.garage_id)) {
            return NextResponse.json({ error: 'Invalid garage_id format' }, { status: 400 });
        }
        if (body.garage_request_id && !uuidRegex.test(body.garage_request_id)) {
            return NextResponse.json({ error: 'Invalid garage_request_id format' }, { status: 400 });
        }

        // Validate status
        const validStatuses: RepairStatus[] = ['in_progress', 'completed'];
        if (!validStatuses.includes(body.status)) {
            return NextResponse.json({ error: 'Status must be "in_progress" or "completed"' }, { status: 400 });
        }

        // Validate final_issue_type - all 15 categories
        const validIssueTypes: FinalIssueType[] = [
            'engine', 'brakes', 'electrical', 'ac', 'starting', 'gearbox',
            'noise', 'suspension', 'transmission', 'fuel_system', 'cooling_system',
            'exhaust', 'tires', 'steering', 'other'
        ];
        if (!validIssueTypes.includes(body.final_issue_type)) {
            return NextResponse.json({ error: `final_issue_type must be one of: ${validIssueTypes.join(', ')}` }, { status: 400 });
        }

        console.log('[API repairs/create] Processing repair for request:', body.request_id);

        // Step A: AI Processing
        let aiResult: AIProcessingResult;
        try {
            aiResult = await processWithAI(body.mechanic_notes);
            console.log('[API repairs/create] AI processing successful');
        } catch (aiError) {
            console.error('[API repairs/create] AI processing failed:', aiError);
            // Use fallback if AI fails - don't block the repair creation
            aiResult = {
                mechanic_description_ai: body.mechanic_notes,
                ai_summary: 'תיקון הושלם - לא נוצר סיכום אוטומטי'
            };
        }

        // Step B: Database Insertion - matches new schema
        const repairData = {
            request_id: body.request_id,
            garage_id: body.garage_id,
            garage_request_id: body.garage_request_id || null,  // NEW: FK to garage_requests
            mechanic_notes: body.mechanic_notes,
            mechanic_description_ai: aiResult.mechanic_description_ai,
            ai_summary: aiResult.ai_summary,
            problem_category: null,  // Not used - removed from form
            final_issue_type: body.final_issue_type,
            labor_hours: body.labor_hours,
            status: body.status,
            vehicle_info: body.vehicle_info || null,
            completed_at: body.status === 'completed' ? new Date().toISOString() : null,
        };

        const { data, error } = await supabase
            .from('repairs')
            .insert(repairData)
            .select()
            .single();

        if (error) {
            console.error('[API repairs/create] Database error:', error);

            // Handle unique constraint violation
            if (error.code === '23505') {
                return NextResponse.json(
                    { error: 'A repair record already exists for this request' },
                    { status: 409 }
                );
            }

            return NextResponse.json(
                { error: 'Failed to create repair record', details: error.message },
                { status: 500 }
            );
        }

        console.log('[API repairs/create] Repair created successfully:', data.id);

        // Step C: Response
        return NextResponse.json(
            { repair: data, message: 'Repair created successfully' },
            { status: 201 }
        );

    } catch (err) {
        console.error('[API repairs/create] Unexpected error:', err);
        return NextResponse.json(
            { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
