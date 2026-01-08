// app/api/ai/mechanic-summary/route.ts
import { NextResponse } from 'next/server';
import { generateMechanicSummary, type ConversationEvent } from '@/lib/ai/mechanic-summary';

type RequestBody = {
    conversationEvents?: ConversationEvent[];
    finalReport?: any;
    requestDescription?: string;
};

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as RequestBody;

        if (!body.conversationEvents || body.conversationEvents.length === 0) {
            return NextResponse.json(
                { error: 'conversationEvents is required and cannot be empty' },
                { status: 400 }
            );
        }

        const mechanicSummary = await generateMechanicSummary({
            conversationEvents: body.conversationEvents,
            finalReport: body.finalReport,
            requestDescription: body.requestDescription,
        });

        return NextResponse.json({ mechanicSummary });

    } catch (error) {
        console.error('[mechanic-summary] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate mechanic summary' },
            { status: 500 }
        );
    }
}
