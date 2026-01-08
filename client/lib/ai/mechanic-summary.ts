import { createOpenAIClient } from "./client";

export type ConversationEvent = {
    kind: "user" | "assistant";
    type?: string; // question/instruction/diagnosis_report/...
    text: string;
    selectedOption?: string;
    ts?: string;
};

export type DiagnosisItem = {
    issue: string;
    probability: number; // 0-1
};

export type MechanicSummary = {
    schemaVersion: 2;
    vehicleType: string;
    originalComplaint: string;
    conversationNarrative: string; // AI-generated coherent paragraph describing the entire interaction
    diagnoses: DiagnosisItem[];
    recommendations: string[];
    needsTow: boolean;
    urgency: "low" | "medium" | "high" | "critical";
    category?: string;
    formattedText?: string; // Pre-formatted text for display
};

function safeParseJson(text: string): any | null {
    try {
        return JSON.parse(text);
    } catch {
        // try to extract first {...}
        const first = text.indexOf("{");
        const last = text.lastIndexOf("}");
        if (first !== -1 && last !== -1 && last > first) {
            try {
                return JSON.parse(text.slice(first, last + 1));
            } catch { }
        }
        return null;
    }
}

function buildMechanicSummaryPrompt(input: {
    conversationEvents: ConversationEvent[];
    finalReport?: any;
    requestDescription?: string;
    vehicleInfo?: { manufacturer?: string; model?: string; year?: number };
}) {
    const vehicleStr = input.vehicleInfo
        ? `${input.vehicleInfo.manufacturer || ''} ${input.vehicleInfo.model || ''} ${input.vehicleInfo.year || ''}`.trim()
        : 'לא ידוע';

    return `
אתה מסכם שיחת אבחון רכב למכונאי בצורה מקצועית ומפורטת.

## כללים
- החזר JSON בלבד (בלי Markdown).
- אסור להמציא עובדות. השתמש רק במה שמופיע בנתונים.
- כתוב בעברית.
- conversationNarrative: כתוב פסקה אחת ארוכה (3-5 משפטים) שמתארת את כל מה שקרה בשיחה בצורה הגיונית ורציפה. כלול: מה הלקוח התלונן, אילו שאלות נשאל, מה ענה, אילו פעולות נדרש לעשות, ומה התוצאות.
- diagnoses: רשימה של אבחונים אפשריים עם אחוז הסתברות (probability בין 0 ל-1).

## סוג רכב
${vehicleStr}

## סכימת JSON (חובה)
{
  "schemaVersion": 2,
  "vehicleType": "${vehicleStr}",
  "originalComplaint": "הטקסט המקורי של התלונה כפי שהלקוח כתב",
  "conversationNarrative": "פסקה ארוכה שמתארת את כל השיחה בצורה רציפה והגיונית. הלקוח הגיע עם בעיה של... נשאל לגבי... וענה ש... הוא נדרש לבצע... והתוצאה היתה...",
  "diagnoses": [
    {"issue": "האבחון הסביר ביותר", "probability": 0.65},
    {"issue": "אבחון חלופי", "probability": 0.25}
  ],
  "recommendations": ["המלצה ספציפית 1", "המלצה ספציפית 2"],
  "needsTow": true/false,
  "urgency": "low" | "medium" | "high" | "critical"
}

## נתונים (JSON)
${JSON.stringify(input)}
`.trim();
}

export async function generateMechanicSummary(input: {
    conversationEvents: ConversationEvent[];
    finalReport?: any;
    requestDescription?: string;
    vehicleInfo?: { manufacturer?: string; model?: string; year?: number };
}): Promise<MechanicSummary> {
    const apiKey = process.env.OPENAI_API_KEY;
    const vehicleStr = input.vehicleInfo
        ? `${input.vehicleInfo.manufacturer || ''} ${input.vehicleInfo.model || ''} ${input.vehicleInfo.year || ''}`.trim()
        : 'לא ידוע';

    if (!apiKey) {
        return createFallbackSummary(vehicleStr, input.requestDescription, "OPENAI_API_KEY חסר בשרת");
    }

    const client = createOpenAIClient(apiKey, process.env.OPENAI_MODEL || undefined, {
        responseFormat: { type: "json_object" },
        temperature: 0.3,
    });

    const prompt = buildMechanicSummaryPrompt(input);

    try {
        const text = await client.generateContent(prompt, { responseFormat: { type: "json_object" }, temperature: 0.3 });
        const parsed = safeParseJson(text);

        if (!parsed) {
            return createFallbackSummary(vehicleStr, input.requestDescription, "פלט לא היה JSON תקין");
        }

        // Build v2 summary from parsed response
        const out: MechanicSummary = {
            schemaVersion: 2,
            vehicleType: String(parsed.vehicleType || vehicleStr),
            originalComplaint: String(parsed.originalComplaint || input.requestDescription || "לא ידוע"),
            conversationNarrative: String(parsed.conversationNarrative || "לא זמין תיאור שיחה"),
            diagnoses: Array.isArray(parsed.diagnoses)
                ? parsed.diagnoses.map((d: any) => ({
                    issue: String(d?.issue || "לא ידוע"),
                    probability: typeof d?.probability === 'number' ? d.probability : 0.5
                }))
                : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
            needsTow: Boolean(parsed.needsTow),
            urgency: ['low', 'medium', 'high', 'critical'].includes(parsed.urgency) ? parsed.urgency : 'medium',
        };

        // Generate formatted text for display
        out.formattedText = generateFormattedText(out);

        return out;
    } catch (err) {
        console.error('[generateMechanicSummary] Error:', err);
        return createFallbackSummary(vehicleStr, input.requestDescription, "שגיאה בייצור סיכום");
    }
}

function createFallbackSummary(vehicleType: string, description?: string, errorReason?: string): MechanicSummary {
    const summary: MechanicSummary = {
        schemaVersion: 2,
        vehicleType,
        originalComplaint: description || "לא ידוע",
        conversationNarrative: errorReason || "לא ניתן היה לייצר סיכום שיחה.",
        diagnoses: [],
        recommendations: ["פנה למוסך לאבחון מקצועי"],
        needsTow: false,
        urgency: "medium",
    };
    summary.formattedText = generateFormattedText(summary);
    return summary;
}

/**
 * Generate clean readable text from mechanic summary v2
 */
function generateFormattedText(summary: MechanicSummary): string {
    const lines: string[] = [];

    // Vehicle type
    lines.push(`🚗 סוג רכב: ${summary.vehicleType}`);
    lines.push("");

    // Original complaint
    if (summary.originalComplaint && summary.originalComplaint !== "לא ידוע") {
        lines.push(`📝 תלונת הלקוח המקורית:`);
        lines.push(summary.originalComplaint);
        lines.push("");
    }

    // Conversation narrative (the main summary)
    if (summary.conversationNarrative && summary.conversationNarrative !== "לא זמין תיאור שיחה") {
        lines.push(`📋 תיאור מהלך השיחה:`);
        lines.push(summary.conversationNarrative);
        lines.push("");
    }

    // Diagnoses with percentages
    if (summary.diagnoses.length > 0) {
        lines.push(`🔍 אבחונים אפשריים:`);
        summary.diagnoses.forEach((d, i) => {
            const pct = Math.round(d.probability * 100);
            lines.push(`   ${i + 1}. ${d.issue} (${pct}%)`);
        });
        lines.push("");
    }

    // Recommendations
    if (summary.recommendations.length > 0) {
        lines.push(`💡 המלצות:`);
        summary.recommendations.forEach(rec => {
            lines.push(`   • ${rec}`);
        });
        lines.push("");
    }

    // Urgency level
    const urgencyMap: Record<string, string> = {
        critical: "קריטי 🔴",
        high: "גבוה 🟠",
        medium: "בינוני 🟡",
        low: "נמוך 🟢"
    };
    lines.push(`⚡ דחיפות: ${urgencyMap[summary.urgency] || summary.urgency}`);

    // Tow needed
    if (summary.needsTow) {
        lines.push(`🚨 נדרש גרר!`);
    }

    return lines.join("\n");
}
