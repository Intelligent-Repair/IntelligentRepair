// lib/ai/unified-diagnosis-v2.ts
// Single AI service that generates BOTH user diagnosis AND mechanic summary in one call

import { createOpenAIClient } from "./client";
import { extractJSON } from "./json-utils";
import type { UserAnswer } from "./types";

// ============ TYPES ============

export interface UserDiagnosis {
    title: string;
    confidence: number;
    confidenceLevel: 'low' | 'medium' | 'high';
    topIssue: string;
    userSummary?: string;  // NEW: Summary of what user reported (answers + free text)
    explanation: string;
    recommendations: string[];
    nextAction: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    canDrive: boolean;
    needsMechanic: boolean;
    needsTow: boolean;
}

export interface MechanicDiagnosis {
    issue: string;
    probability: number;
}

export interface MechanicSummary {
    schemaVersion: 2;
    vehicleType: string;
    originalComplaint: string;
    conversationNarrative?: string; // Legacy - kept for backward compat
    driverFindings?: string[];      // NEW: bullet points from driver interview
    diagnoses: MechanicDiagnosis[];
    recommendations?: string[];     // Legacy
    recommendedActions?: string[];  // NEW: technical actions for mechanic
    needsTow: boolean;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    category?: string;
    formattedText?: string;
}

export interface UnifiedDiagnosisResult {
    userDiagnosis: UserDiagnosis;
    mechanicSummary: MechanicSummary;
}

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    type?: string;
    options?: string[];
    selectedOption?: string;
}

export interface VehicleInfo {
    manufacturer?: string;
    model?: string;
    year?: number;
    licensePlate?: string;
    mileage?: number;
}

// ============ PROMPT BUILDING ============

function buildUnifiedPrompt(input: {
    lightType?: string;
    scenarioId?: string;
    conversationHistory: ConversationMessage[];
    vehicleInfo?: VehicleInfo;
    requestDescription?: string;
    answers?: UserAnswer[];
}): string {
    const vehicleStr = input.vehicleInfo
        ? `${input.vehicleInfo.manufacturer || ''} ${input.vehicleInfo.model || ''} ${input.vehicleInfo.year || ''}`.trim() || 'לא ידוע'
        : 'לא ידוע';

    const lightName = input.lightType ? getLightHebrewName(input.lightType) : '';

    // Build conversation text
    let conversationText = '';
    if (input.conversationHistory && input.conversationHistory.length > 0) {
        conversationText = input.conversationHistory
            .map((msg, i) => {
                const role = msg.role === 'user' ? 'לקוח' : 'מערכת';
                return `${role}: ${msg.content}`;
            })
            .join('\n');
    }

    // Add answers if available
    if (input.answers && input.answers.length > 0) {
        const answersText = input.answers
            .map(a => `שאלה: ${a.question || 'שאלה'} - תשובה: ${a.answer}`)
            .join('\n');
        conversationText += '\n\n---\nשאלות ותשובות:\n' + answersText;
    }

    return `
אתה מומחה לאבחון רכב. בהתבסס על השיחה הבאה, צור שתי תשובות מותאמות:

## כללים חשובים
- החזר JSON בלבד (בלי Markdown, בלי \`\`\`)
- אסור להמציא עובדות - השתמש רק במידע מהשיחה
- כתוב בעברית
- הקפד על עקביות בין האבחון ללקוח לבין הסיכום למכונאי

## פרטי הרכב
סוג רכב: ${vehicleStr}
${input.lightType ? `נורת אזהרה: ${lightName}` : ''}
${input.scenarioId ? `מצב: ${input.scenarioId}` : ''}

## תיאור הבעיה המקורי
${input.requestDescription || 'לא צוין'}

## היסטוריית השיחה
${conversationText || 'לא זמינה'}

## סכימת JSON (חובה להחזיר בדיוק בפורמט הזה)
{
  "userDiagnosis": {
    "title": "כותרת קצרה של האבחון (3-5 מילים)",
    "confidence": 0.75,
    "confidenceLevel": "medium",
    "topIssue": "הבעיה העיקרית שזוהתה",
    "userSummary": "סיכום קצר של מה הלקוח דיווח - כולל התשובות שבחר וכל טקסט חופשי שכתב. לדוגמה: 'דיווחת על נורה דולקת קבוע, ציינת שאין רעשים חריגים, וכתבת שזה קרה לאחר תדלוק'",
    "explanation": "הסבר קצר ללקוח מה כנראה קורה - בשפה ידידותית ופשוטה",
    "recommendations": ["המלצה 1 ללקוח", "המלצה 2 ללקוח"],
    "nextAction": "הפעולה הבאה שהלקוח צריך לעשות",
    "severity": "low|medium|high|critical",
    "canDrive": true,
    "needsMechanic": true,
    "needsTow": false
  },
  "mechanicSummary": {
    "schemaVersion": 2,
    "vehicleType": "${vehicleStr}",
    "originalComplaint": "תלונת הלקוח המקורית - מה הנהג תיאר כבעיה הראשונית",
    "conversationNarrative": "סיכום נרטיבי של ממצאי תשאול הנהג - פסקה אחת שמתארת מה הלקוח דיווח, מה נמצא במהלך השאלות, ומה המצב הנוכחי. לדוגמה: הלקוח דיווח על נורת לחץ שמן דולקת קבוע. לאחר שנשאל, הוא השיב ששמע רעשים מוזרים מהמנוע ויש ירידה בכוח המנוע...",
    "diagnoses": [
      {"issue": "אבחון ראשי עם הסבר טכני קצר", "probability": 0.75},
      {"issue": "אבחון משני אפשרי", "probability": 0.25}
    ],
    "recommendedActions": [
      "פעולה טכנית 1 לצוות המוסך",
      "פעולה טכנית 2",
      "פעולה טכנית 3"
    ],
    "needsTow": false,
    "urgency": "low|medium|high|critical"
  }
}

## הנחיות לסיכום למכונאי (mechanicSummary):
חשוב מאוד: זהו דוח מבצעי טכני למוסך!

- originalComplaint: תלונת הנהג המקורית בציטוט או פרפרזה קצרה
- conversationNarrative: פסקה אחת (3-5 משפטים) שמסכמת את ממצאי תשאול הנהג. התחל ב"הלקוח דיווח על..." וכלול את כל המידע שנאסף: מה קרה, מתי, אילו תסמינים נוספים יש, מה הנהג עשה
- diagnoses: אבחונים טכניים עם אחוזי הסתברות. הסכום צריך להיות עד 100%
- recommendedActions: פעולות טכניות ספציפיות שהמכונאי צריך לבצע (3-5 פעולות)
- urgency: רמת דחיפות ("low", "medium", "high", "critical")

אל תשתמש בסימני Markdown כמו ##, **, - או * בתוך הטקסטים עצמם.
`.trim();
}

function getLightHebrewName(lightType: string): string {
    const names: Record<string, string> = {
        'tpms_light': 'נורת לחץ אוויר בצמיגים',
        'check_engine_light': 'נורת צ\'ק אנג\'ין',
        'oil_pressure_light': 'נורת לחץ שמן',
        'battery_light': 'נורת מצבר',
        'coolant_temperature_light': 'נורת טמפרטורת מנוע',
        'brake_light': 'נורת בלמים',
        'abs_light': 'נורת ABS',
        'airbag_light': 'נורת כרית אוויר',
        'power_steering_light': 'נורת הגה כוח',
        'esp_light': 'נורת יציבות'
    };
    return names[lightType] || lightType;
}

// ============ MAIN FUNCTION ============

export async function generateUnifiedDiagnosis(input: {
    lightType?: string;
    scenarioId?: string;
    conversationHistory: ConversationMessage[];
    vehicleInfo?: VehicleInfo;
    requestDescription?: string;
    answers?: UserAnswer[];
}): Promise<UnifiedDiagnosisResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const vehicleStr = input.vehicleInfo
        ? `${input.vehicleInfo.manufacturer || ''} ${input.vehicleInfo.model || ''} ${input.vehicleInfo.year || ''}`.trim() || 'לא ידוע'
        : 'לא ידוע';

    if (!apiKey) {
        console.error('[UnifiedDiagnosis] No API key');
        return createFallbackResult(vehicleStr, input.requestDescription);
    }

    try {
        const client = createOpenAIClient(apiKey, model, {
            responseFormat: { type: 'json_object' },
            temperature: 0.3
        });
        const prompt = buildUnifiedPrompt(input);

        console.log('[UnifiedDiagnosis] Calling AI for unified diagnosis...');

        const content = await client.generateContent(prompt, {
            responseFormat: { type: 'json_object' },
            temperature: 0.3
        });

        console.log('[UnifiedDiagnosis] AI response received, parsing...');

        // Extract JSON from response
        const parsed = extractJSON(content);

        if (!parsed || !parsed.userDiagnosis || !parsed.mechanicSummary) {
            console.error('[UnifiedDiagnosis] Invalid JSON structure:', content.slice(0, 500));
            return createFallbackResult(vehicleStr, input.requestDescription);
        }

        // Validate and normalize the result
        const result: UnifiedDiagnosisResult = {
            userDiagnosis: normalizeUserDiagnosis(parsed.userDiagnosis),
            mechanicSummary: normalizeMechanicSummary(parsed.mechanicSummary, vehicleStr)
        };

        // Generate formatted text for mechanic
        result.mechanicSummary.formattedText = generateFormattedText(result.mechanicSummary);

        console.log('[UnifiedDiagnosis] Successfully generated unified diagnosis');
        return result;

    } catch (error) {
        console.error('[UnifiedDiagnosis] Error:', error);
        return createFallbackResult(vehicleStr, input.requestDescription);
    }
}

// ============ HELPERS ============

function normalizeUserDiagnosis(raw: any): UserDiagnosis {
    return {
        title: raw.title || 'אבחון לא ידוע',
        confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
        confidenceLevel: ['low', 'medium', 'high'].includes(raw.confidenceLevel) ? raw.confidenceLevel : 'medium',
        topIssue: raw.topIssue || raw.title || '',
        userSummary: raw.userSummary || undefined,  // NEW: AI summary of what user reported
        explanation: raw.explanation || '',
        recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
        nextAction: raw.nextAction || 'פנה למוסך לבדיקה',
        severity: ['low', 'medium', 'high', 'critical'].includes(raw.severity) ? raw.severity : 'medium',
        canDrive: raw.canDrive !== false,
        needsMechanic: raw.needsMechanic !== false,
        needsTow: raw.needsTow === true
    };
}

function normalizeMechanicSummary(raw: any, vehicleType: string): MechanicSummary {
    return {
        schemaVersion: 2,
        vehicleType: raw.vehicleType || vehicleType,
        originalComplaint: raw.originalComplaint || 'לא צוין',
        conversationNarrative: raw.conversationNarrative || 'לא זמין',
        driverFindings: Array.isArray(raw.driverFindings) ? raw.driverFindings : undefined,
        diagnoses: Array.isArray(raw.diagnoses)
            ? raw.diagnoses.map((d: any) => ({
                issue: d.issue || 'לא ידוע',
                probability: typeof d.probability === 'number' ? d.probability : 0.5
            }))
            : [],
        // Support both recommendedActions (new) and recommendations (legacy)
        recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
        recommendedActions: Array.isArray(raw.recommendedActions)
            ? raw.recommendedActions
            : (Array.isArray(raw.recommendations) ? raw.recommendations : undefined),
        needsTow: raw.needsTow === true,
        urgency: ['low', 'medium', 'high', 'critical'].includes(raw.urgency) ? raw.urgency : 'medium',
        category: raw.category
    };
}

function createFallbackResult(vehicleType: string, description?: string): UnifiedDiagnosisResult {
    return {
        userDiagnosis: {
            title: 'נדרשת בדיקה מקצועית',
            confidence: 0.5,
            confidenceLevel: 'low',
            topIssue: 'לא ניתן לקבוע אבחון מדויק',
            explanation: 'על סמך המידע שהתקבל, מומלץ לפנות למוסך לבדיקה מקצועית.',
            recommendations: ['פנה למוסך לבדיקה'],
            nextAction: 'קבע תור למוסך',
            severity: 'medium',
            canDrive: true,
            needsMechanic: true,
            needsTow: false
        },
        mechanicSummary: {
            schemaVersion: 2,
            vehicleType,
            originalComplaint: description || 'לא צוין',
            conversationNarrative: 'לא היה ניתן ליצור סיכום אוטומטי. יש לבדוק את פרטי השיחה.',
            diagnoses: [{ issue: 'דרושה בדיקה מקצועית', probability: 1.0 }],
            recommendations: ['בדיקה כללית במוסך'],
            needsTow: false,
            urgency: 'medium'
        }
    };
}

function generateFormattedText(summary: MechanicSummary): string {
    const lines: string[] = [];

    lines.push(`## רכב: ${summary.vehicleType}`);
    lines.push('');

    if (summary.originalComplaint && summary.originalComplaint !== 'לא צוין') {
        lines.push(`### תלונה מקורית`);
        lines.push(summary.originalComplaint);
        lines.push('');
    }

    if (summary.conversationNarrative && summary.conversationNarrative !== 'לא זמין') {
        lines.push(`### סיכום השיחה`);
        lines.push(summary.conversationNarrative);
        lines.push('');
    }

    if (summary.diagnoses && summary.diagnoses.length > 0) {
        lines.push(`### אבחונים אפשריים`);
        for (const d of summary.diagnoses) {
            const pct = Math.round(d.probability * 100);
            lines.push(`- ${d.issue} (${pct}%)`);
        }
        lines.push('');
    }

    if (summary.recommendations && summary.recommendations.length > 0) {
        lines.push(`### המלצות לבדיקה`);
        for (const r of summary.recommendations) {
            lines.push(`- ${r}`);
        }
        lines.push('');
    }

    const urgencyMap: Record<string, string> = {
        low: 'נמוכה',
        medium: 'בינונית',
        high: 'גבוהה',
        critical: 'קריטית'
    };
    lines.push(`**דחיפות:** ${urgencyMap[summary.urgency] || summary.urgency}`);

    if (summary.needsTow) {
        lines.push('**⚠️ נדרש גרר**');
    }

    return lines.join('\n');
}

// ============ EXPORT FOR BACKWARD COMPATIBILITY ============

// Export function that matches old mechanicSummary interface
export async function generateMechanicSummaryFromUnified(input: {
    conversationEvents: any[];
    finalReport?: any;
    requestDescription?: string;
    vehicleInfo?: { manufacturer?: string; model?: string; year?: number };
}): Promise<MechanicSummary> {
    // Convert old format to new format
    const conversationHistory: ConversationMessage[] = (input.conversationEvents || []).map(e => ({
        role: e.kind === 'user' ? 'user' : 'assistant',
        content: e.text || e.selectedOption || '',
        type: e.type
    }));

    const result = await generateUnifiedDiagnosis({
        conversationHistory,
        vehicleInfo: input.vehicleInfo,
        requestDescription: input.requestDescription
    });

    return result.mechanicSummary;
}
