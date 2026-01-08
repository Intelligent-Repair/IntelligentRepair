/**
 * Unified AI-Powered Diagnosis Generator
 * 
 * Generates consistent, high-quality diagnoses for both users and mechanics.
 * Uses AI (OpenAI) to process conversation history and produce structured diagnoses.
 */

import { createOpenAIClient } from "./client";
import { extractJSON } from "./json-utils";

// Types
export interface ConversationMessage {
    role: "user" | "assistant";
    content: string;
    type?: string;
}

export interface VehicleInfo {
    manufacturer?: string;
    model?: string;
    year?: number;
}

export interface DiagnosisResult {
    issue: string;
    probability: number;
    explanation: string;
}

export interface UnifiedDiagnosis {
    // Core diagnosis
    diagnoses: DiagnosisResult[];
    // Recommendations for user
    recommendations: string[];
    // Urgency level
    urgency: "low" | "medium" | "high" | "critical";
    // Whether tow is needed
    needsTow: boolean;
    // Status for UI
    status: {
        color: "green" | "yellow" | "red" | "blue";
        text: string;
        instruction: string;
    };
    // Pre-formatted summary for display
    formattedSummary: string;
    // Category of issue
    category?: string;
    // Confidence level
    confidence: number;
    confidenceLevel: "low" | "medium" | "high";
}

/**
 * Generate a unified diagnosis using AI based on conversation and vehicle info
 */
export async function generateUnifiedDiagnosis(input: {
    description: string;
    conversationHistory: ConversationMessage[];
    vehicleInfo?: VehicleInfo;
    detectedLightType?: string;
}): Promise<UnifiedDiagnosis> {
    const apiKey = process.env.OPENAI_API_KEY;

    // Build vehicle string
    const vehicleStr = input.vehicleInfo
        ? `${input.vehicleInfo.manufacturer || ''} ${input.vehicleInfo.model || ''} ${input.vehicleInfo.year || ''}`.trim()
        : 'לא ידוע';

    // Build conversation text
    const conversationText = input.conversationHistory.length > 0
        ? input.conversationHistory.map(m =>
            `${m.role === 'user' ? 'לקוח' : 'מערכת'}: ${m.content}`
        ).join('\n\n')
        : 'אין היסטוריית שיחה';

    // Fallback if no API key
    if (!apiKey) {
        return createFallbackDiagnosis(input.description, vehicleStr);
    }

    const prompt = `
אתה מומחה לאבחון רכב. על סמך השיחה הבאה, צור אבחון מקצועי ומפורט.

## סוג רכב
${vehicleStr}

## תיאור הבעיה המקורי
"${input.description}"

## היסטוריית השיחה
${conversationText}

${input.detectedLightType ? `## נורת אזהרה שזוהתה: ${input.detectedLightType}` : ''}

## הנחיות חשובות
1. תן אבחון ספציפי בהתבסס על המידע שנאסף (לא "נדרש אבחון מקצועי" גנרי!)
2. אם הבעיה קשורה לגיר/הילוכים - תן אבחון כמו "תקלה בתיבת ההילוכים האוטומטית"
3. אם הבעיה קשורה למנוע - תן אבחון כמו "בעיה במערכת ההצתה" או "תקלה בחיישן"
4. הסבר בקצרה למה הגעת למסקנה זו
5. קבע את רמת הדחיפות על סמך הסימפטומים

## פורמט תגובה (JSON בלבד!)
{
  "diagnoses": [
    {"issue": "<אבחון ראשי ספציפי>", "probability": 0.65, "explanation": "<הסבר קצר>"},
    {"issue": "<אבחון חלופי>", "probability": 0.25, "explanation": "<הסבר קצר>"}
  ],
  "recommendations": ["<המלצה ספציפית 1>", "<המלצה ספציפית 2>"],
  "urgency": "low|medium|high|critical",
  "needsTow": true/false,
  "category": "<גיר/מנוע/בלמים/חשמל/מתלים/קירור/אחר>",
  "statusColor": "green|yellow|red",
  "statusText": "<טקסט סטטוס קצר>",
  "statusInstruction": "<מה לעשות עכשיו>"
}`;

    try {
        const client = createOpenAIClient(apiKey, 'gpt-4o', {
            responseFormat: { type: 'json_object' }
        });

        const response = await client.generateContent(prompt, {
            responseFormat: { type: 'json_object' },
            temperature: 0.3
        });

        const parsed = extractJSON(response);

        if (!parsed || !parsed.diagnoses || parsed.diagnoses.length === 0) {
            return createFallbackDiagnosis(input.description, vehicleStr);
        }

        // Build formatted summary for display
        const formattedSummary = buildFormattedSummary(parsed, vehicleStr);

        // Calculate confidence from top diagnosis probability
        const topProb = parsed.diagnoses[0]?.probability || 0.5;
        const confidence = Math.min(0.95, topProb + 0.1);
        const confidenceLevel = confidence >= 0.7 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';

        return {
            diagnoses: parsed.diagnoses.map((d: any) => ({
                issue: String(d.issue || 'לא ידוע'),
                probability: typeof d.probability === 'number' ? d.probability : 0.5,
                explanation: String(d.explanation || '')
            })),
            recommendations: Array.isArray(parsed.recommendations)
                ? parsed.recommendations.map(String)
                : ['פנה למוסך לאבחון מקצועי'],
            urgency: ['low', 'medium', 'high', 'critical'].includes(parsed.urgency)
                ? parsed.urgency
                : 'medium',
            needsTow: Boolean(parsed.needsTow),
            status: {
                color: ['green', 'yellow', 'red', 'blue'].includes(parsed.statusColor)
                    ? parsed.statusColor
                    : 'yellow',
                text: String(parsed.statusText || 'מומלץ בדיקה במוסך'),
                instruction: String(parsed.statusInstruction || 'פנה למוסך לאבחון מקצועי')
            },
            formattedSummary,
            category: parsed.category,
            confidence,
            confidenceLevel
        };
    } catch (err) {
        console.error('[generateUnifiedDiagnosis] Error:', err);
        return createFallbackDiagnosis(input.description, vehicleStr);
    }
}

/**
 * Create fallback diagnosis when AI fails
 */
function createFallbackDiagnosis(description: string, vehicleStr: string): UnifiedDiagnosis {
    // Try to identify category from description
    const descLower = description.toLowerCase();
    let issue = 'בעיה ברכב';
    let category = 'אחר';

    if (descLower.includes('הילוך') || descLower.includes('גיר') || descLower.includes('תקוע')) {
        issue = 'חשד לתקלה בתיבת ההילוכים';
        category = 'גיר';
    } else if (descLower.includes('רעש') || descLower.includes('נקישות')) {
        issue = 'רעשים חריגים - נדרשת בדיקה';
        category = 'מנוע';
    } else if (descLower.includes('נדלק') || descLower.includes('התנעה') || descLower.includes('מצבר')) {
        issue = 'חשד לתקלה במערכת החשמל/התנעה';
        category = 'חשמל';
    } else if (descLower.includes('בלם') || descLower.includes('עצירה')) {
        issue = 'חשד לבעיה במערכת הבלמים';
        category = 'בלמים';
    }

    return {
        diagnoses: [{
            issue,
            probability: 0.6,
            explanation: 'בהתבסס על תיאור הבעיה'
        }],
        recommendations: [
            'פנה למוסך לאבחון מקצועי',
            'אם הבעיה מחמירה - הפסק לנסוע'
        ],
        urgency: 'medium',
        needsTow: false,
        status: {
            color: 'yellow',
            text: 'מומלץ בדיקה במוסך',
            instruction: 'פנה למוסך לאבחון מקצועי'
        },
        formattedSummary: buildFormattedSummary({
            diagnoses: [{ issue, probability: 0.6 }],
            recommendations: ['פנה למוסך לאבחון מקצועי'],
            urgency: 'medium'
        }, vehicleStr),
        category,
        confidence: 0.5,
        confidenceLevel: 'low'
    };
}

/**
 * Build formatted text summary for display
 */
function buildFormattedSummary(data: any, vehicleStr: string): string {
    const lines: string[] = [];

    // Vehicle
    if (vehicleStr && vehicleStr !== 'לא ידוע') {
        lines.push(`🚗 רכב: ${vehicleStr}`);
        lines.push('');
    }

    // Main diagnosis
    if (data.diagnoses && data.diagnoses.length > 0) {
        lines.push('🔍 אבחונים אפשריים:');
        data.diagnoses.forEach((d: any, idx: number) => {
            const pct = Math.round((d.probability || 0.5) * 100);
            lines.push(`   ${idx + 1}. ${d.issue} (${pct}%)`);
            if (d.explanation) {
                lines.push(`      ${d.explanation}`);
            }
        });
        lines.push('');
    }

    // Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
        lines.push('💡 המלצות:');
        data.recommendations.forEach((rec: string) => {
            lines.push(`   • ${rec}`);
        });
        lines.push('');
    }

    // Urgency
    const urgencyMap: Record<string, string> = {
        critical: 'קריטי 🔴',
        high: 'גבוהה 🟠',
        medium: 'בינונית 🟡',
        low: 'נמוכה 🟢'
    };
    if (data.urgency) {
        lines.push(`⚡ דחיפות: ${urgencyMap[data.urgency] || data.urgency}`);
    }

    return lines.join('\n');
}
