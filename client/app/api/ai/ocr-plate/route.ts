import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const { image } = await request.json();

        if (!image) {
            return NextResponse.json(
                { error: 'No image provided' },
                { status: 400 }
            );
        }

        // Call OpenAI Vision API to extract license plate number
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Look at this image of an Israeli license plate and extract ONLY the license plate number.
                            
Israeli license plates have either 7 or 8 digits.
- Old format (7 digits): XX-XXX-XX
- New format (8 digits): XXX-XX-XXX

Return ONLY the digits, nothing else. No dashes, no spaces, just the pure number.
If you cannot clearly see a license plate number, respond with "NOT_FOUND".

Example valid responses:
- 12345678
- 1234567
- NOT_FOUND`
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${image}`,
                                detail: 'high'
                            }
                        }
                    ]
                }
            ],
            max_tokens: 50,
            temperature: 0
        });

        const result = response.choices[0]?.message?.content?.trim();

        if (!result || result === 'NOT_FOUND') {
            return NextResponse.json({ licensePlate: null });
        }

        // Clean the result - only keep digits
        const cleanedPlate = result.replace(/\D/g, '');

        // Validate it's a proper Israeli plate (7-8 digits)
        if (cleanedPlate.length >= 7 && cleanedPlate.length <= 8) {
            return NextResponse.json({ licensePlate: cleanedPlate });
        }

        return NextResponse.json({ licensePlate: null });

    } catch (error) {
        console.error('OCR API error:', error);
        return NextResponse.json(
            { error: 'Failed to process image' },
            { status: 500 }
        );
    }
}
