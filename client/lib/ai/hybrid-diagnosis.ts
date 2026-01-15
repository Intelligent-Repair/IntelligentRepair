// lib/ai/hybrid-diagnosis.ts
// AI-powered diagnosis generation for complex warning lights

import { NextResponse } from 'next/server';
import { createOpenAIClient } from '@/lib/ai/client';
import { extractJSON } from '@/lib/ai/json-utils';
import type { UserAnswer } from '@/lib/ai/types';
import warningLightsKB from '@/lib/knowledge/warning-lights.json';

// Lights that use KB for questions but AI for diagnosis
export const HYBRID_LIGHTS = ['check_engine_light'] as const;

export interface AIDiagnosisResult {
    type: 'diagnosis_report';
    title: string;
    confidence: number;
    confidenceLevel: 'low' | 'medium' | 'high';
    results: Array<{
        issue: string;
        probability: number;
        explanation: string;
    }>;
    status: {
        color: 'red' | 'yellow' | 'blue' | 'green';
        text: string;
        instruction: string;
    };
    selfFix: Array<{
        step: string;
        actionType: string;
    }>;
    nextSteps: string;
    recommendations: string[];
    disclaimer: string;
    conversationSummaries?: {
        user?: { shortDescription: string; topIssue: string; nextAction: string };
        mechanic?: { formattedText: string };
    };
}

/**
 * Generate diagnosis using AI for hybrid lights.
 * Uses KB structure + AI interpretation instead of scoring.
 */
export async function generateAIDiagnosis(
    lightType: string,
    scenarioId: string | undefined,
    answers: UserAnswer[],
    vehicleInfo?: { manufacturer?: string; model?: string; year?: number },
    context?: any
): Promise<NextResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error('[AIDiagnosis] No API key');
        return fallbackDiagnosis(lightType, answers);
    }

    const lightData = (warningLightsKB as any)[lightType];
    const lightName = lightData?.names?.he?.[0] || lightType;
    const scenarioData = scenarioId ? lightData?.scenarios?.[scenarioId] : null;

    // Build conversation summary for AI
    const conversationSummary = answers.map(a =>
        `שאלה: ${a.question}\nתשובה: ${a.answer}`
    ).join('\n\n');

    const vehicleDesc = vehicleInfo
        ? `${vehicleInfo.manufacturer || ''} ${vehicleInfo.model || ''} ${vehicleInfo.year || ''}`.trim()
        : 'לא צוין';

    const prompt = `אתה מומחה רכב מנוסה. נתון לך מידע על נורת אזהרה ותשובות של משתמש. עליך לייצר אבחנה מדויקת.

## נורת אזהרה
סוג: ${lightName}
${scenarioData?.description ? `תיאור: ${scenarioData.description}` : ''}
${scenarioData?.severity ? `חומרה: ${scenarioData.severity}` : ''}

## רכב
${vehicleDesc}

## שיחה עם המשתמש
${conversationSummary || 'לא היו שאלות נוספות'}

## כללים חשובים
1. התבסס רק על התשובות שניתנו - אל תמציא מידע
2. אם המשתמש אמר שלא תידלק לאחרונה - אל תציע בעיית מכסה דלק
3. התאם את האבחנה לסימפטומים שתוארו
4. אם אין מספיק מידע - אמור זאת בכנות
5. החזר JSON בלבד

## פורמט החזרה (JSON)
{
  "topDiagnosis": {
    "issue": "שם הבעיה הסבירה ביותר",
    "probability": 0.65,
    "explanation": "הסבר קצר למה זו הסיבה הסבירה"
  },
  "additionalCauses": [
    { "issue": "סיבה אפשרית נוספת", "probability": 0.25 }
  ],
  "severity": "low|medium|high|critical",
  "canDrive": true,
  "needsTow": false,
  "recommendation": "המלצה לנהג",
  "selfFixActions": [
    { "step": "פעולה שהנהג יכול לעשות בעצמו", "actionType": "inspect|fill|safety" }
  ],
  "mechanicSummary": "סיכום קצר למוסך"
}`;

    try {
        const client = createOpenAIClient(apiKey, 'gpt-4o', { responseFormat: { type: 'json_object' } });
        const raw = await (client as any).generateContent(prompt, { responseFormat: { type: 'json_object' } });
        const parsed = extractJSON(raw);

        if (!parsed) {
            console.error('[AIDiagnosis] Failed to parse AI response');
            return fallbackDiagnosis(lightType, answers);
        }

        console.log('[AIDiagnosis] AI diagnosis generated:', JSON.stringify(parsed).slice(0, 200));

        // Convert AI response to diagnosis report format
        const diagnosis = buildDiagnosisReport(lightType, lightName, parsed, scenarioData);

        // Add required fields for proper saving
        return NextResponse.json({
            ...diagnosis,
            detectedLightType: lightType,
            endConversation: true,
            kbSource: true
        });

    } catch (err) {
        console.error('[AIDiagnosis] Error:', err);
        return fallbackDiagnosis(lightType, answers);
    }
}

function buildDiagnosisReport(lightType: string, lightName: string, aiResult: any, scenarioData: any): AIDiagnosisResult {
    const topDiag = aiResult.topDiagnosis || {};
    const severity = aiResult.severity || 'medium';
    const isCritical = severity === 'critical';
    const isHigh = severity === 'high';

    const statusColor = isCritical ? 'red' : isHigh ? 'yellow' : 'blue';
    const statusText = isCritical
        ? 'נדרשת תשומת לב מיידית!'
        : isHigh
            ? 'מומלץ לבדוק בהקדם.'
            : 'ניתן להמשיך בזהירות ולבדוק בהמשך.';

    const results = [
        {
            issue: topDiag.issue || 'לא זוהתה סיבה ספציפית',
            probability: Math.min(0.92, Math.max(0.3, topDiag.probability || 0.5)),
            explanation: topDiag.explanation || 'נדרש מידע נוסף'
        },
        ...(aiResult.additionalCauses || []).map((c: any) => ({
            issue: c.issue,
            probability: Math.min(0.85, Math.max(0.2, c.probability || 0.3)),
            explanation: ''
        }))
    ];

    const selfFix = (aiResult.selfFixActions || []).map((a: any) => ({
        step: a.step,
        actionType: a.actionType || 'inspect'
    }));

    const recommendations: string[] = [];
    if (aiResult.recommendation) recommendations.push(aiResult.recommendation);
    if (aiResult.needsTow) recommendations.push('מומלץ להזמין גרר');
    if (!aiResult.canDrive) recommendations.push('אין לנסוע עם הרכב');

    // Confidence based on AI's probability and scenario info
    const confidence = Math.min(0.92, (topDiag.probability || 0.5) * 0.9 + 0.1);
    const confidenceLevel: 'low' | 'medium' | 'high' = confidence >= 0.7 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';

    return {
        type: 'diagnosis_report',
        title: `אבחון: ${lightName}`,
        confidence,
        confidenceLevel,
        results,
        status: {
            color: statusColor,
            text: statusText,
            instruction: aiResult.recommendation || scenarioData?.recommendation || 'מומלץ לפנות למוסך לאבחון מקצועי.'
        },
        selfFix,
        nextSteps: aiResult.recommendation || 'פנה למוסך לאבחון מקצועי.',
        recommendations,
        disclaimer: confidence >= 0.6
            ? 'האבחון מבוסס על תיאור בלבד ואינו מחליף בדיקה מקצועית במוסך.'
            : 'האבחון מבוסס על מידע חלקי. מומלץ מאוד בדיקה מקצועית.',
        conversationSummaries: {
            user: {
                shortDescription: topDiag.issue || 'לא זוהתה בעיה ספציפית',
                topIssue: topDiag.issue || 'לא ידוע',
                nextAction: aiResult.recommendation || 'בדוק במוסך'
            },
            mechanic: aiResult.mechanicSummary ? {
                formattedText: aiResult.mechanicSummary
            } : undefined
        }
    };
}

function fallbackDiagnosis(lightType: string, answers: UserAnswer[]): NextResponse {
    const lightData = (warningLightsKB as any)[lightType];
    const lightName = lightData?.names?.he?.[0] || lightType;

    // Try to extract specific diagnoses from KB scenarios
    const results: Array<{ issue: string; probability: number; explanation: string }> = [];

    if (lightData?.scenarios) {
        // Get all possible causes from scenarios
        const allCauses: Array<{ name: string; description?: string }> = [];
        for (const [scenarioKey, scenario] of Object.entries(lightData.scenarios)) {
            if (typeof scenario === 'object' && scenario && 'possible_causes' in scenario) {
                const causes = (scenario as any).possible_causes || [];
                causes.forEach((c: any) => {
                    if (c?.name && !allCauses.find(ac => ac.name === c.name)) {
                        allCauses.push({ name: c.name, description: c.description });
                    }
                });
            }
        }

        // Take top 3 causes and assign probabilities
        const topCauses = allCauses.slice(0, 3);
        topCauses.forEach((cause, idx) => {
            results.push({
                issue: cause.name,
                probability: idx === 0 ? 0.55 : idx === 1 ? 0.30 : 0.15,
                explanation: cause.description || 'סיבה אפשרית לפי מאגר הידע'
            });
        });
    }

    // If no results from KB, provide a light-specific diagnosis
    if (results.length === 0) {
        results.push({
            issue: `בעיה אפשרית הקשורה ל${lightName}`,
            probability: 0.6,
            explanation: 'האור מצביע על בעיה במערכת. מומלץ לבדוק במוסך.'
        });
    }

    const topIssue = results[0]?.issue || lightName;

    return NextResponse.json({
        type: 'diagnosis_report',
        title: `אבחון: ${topIssue}`,
        confidence: 0.5,
        confidenceLevel: 'medium',
        results,
        status: {
            color: 'yellow',
            text: 'מומלץ לבדוק בהקדם.',
            instruction: 'פנה למוסך לאבחון מקצועי עם קורא קודים OBD.'
        },
        selfFix: [],
        nextSteps: 'פנה למוסך לאבחון מקצועי.',
        recommendations: ['מומלץ לפנות למוסך לקריאת קודי שגיאה', 'בדוק אם יש נוזלים דולפים'],
        disclaimer: 'האבחון מבוסס על מידע חלקי. נדרשת בדיקה מקצועית.',
        detectedLightType: lightType,
        endConversation: true,
        kbSource: true
    });
}
