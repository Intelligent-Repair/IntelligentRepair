// Prompt builder for AI consultation flow
// Modes: KB_COORDINATION (light detected), BRIDGE_TO_KB (identifying), EXPERT_FALLBACK
// All modes return JSON only

import type { UserAnswer } from './types';
import { sanitizeInput } from './sanitize';
import warningLightsKB from '@/lib/knowledge/warning-lights.json';

export interface PromptContext {
  mode?: 'bridge' | 'expert' | null;
  bridgeQuestionCount?: number;
  [key: string]: unknown;
}

const MAX_ANSWERS_CHARS = 2000;

function clampText(s: string, max: number): string {
  const t = (s || '').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

function buildAnswersContext(answers: UserAnswer[]): string {
  if (!answers || answers.length === 0) return 'אין תשובות קודמות.';
  const recent = answers.slice(-6);
  const lines = recent.map((a, idx) => {
    const q = clampText((a as any)?.question ?? '', 120);
    const ans = clampText((a as any)?.answer ?? '', 120);
    return `${idx + 1}) Q: "${q}" | A: "${ans}"`;
  });
  return clampText(lines.join('\n'), MAX_ANSWERS_CHARS);
}

// Inject KB context: full slice for detected light, or minimal list for identification
function buildKnowledgeBaseContext(targetLightId?: string | null): string {
  const lights = warningLightsKB as Record<string, any>;

  if (targetLightId && lights[targetLightId]) {
    const lightData = lights[targetLightId];
    return JSON.stringify({ lightId: targetLightId, lightData }, null, 2);
  }

  const list = Object.entries(lights).map(([lightId, lightData]) => ({
    lightId,
    names_he: lightData?.names?.he ?? [],
    names_en: lightData?.names?.en ?? [],
    symbol: lightData?.symbol ?? '',
    colors: lightData?.colors ?? []
  }));

  return JSON.stringify({ available_lights: list }, null, 2);
}

// JSON contract for AI responses
function jsonOnlyContract(): string {
  return `
Return ONLY a valid JSON object. No markdown, no extra text.

Schema:
{
  "type": "question" | "diagnosis_report",
  "text": "<string>",
  "options"?: ["<string>", ...],
  
  // If a warning light is detected, include at ROOT level (not in candidate):
  "warning_light"?: "<lightId>",
  "confidence"?: 0.0-1.0,
  "evidence"?: ["<short reason>", ...]
}

Rules:
- Return ONLY valid JSON. No markdown, no extra text.
- Type MUST be "question" or "diagnosis_report" only. NEVER use "ai_response".
- If you detect a warning light, put warning_light at the ROOT of the JSON (not inside candidate).
- warning_light MUST be one of the provided KB IDs.
- If type is "question", you MUST include "options" (array of strings).
- Use diagnosis_report ONLY when you have enough information to diagnose (after 3+ questions).
- Keep text concise and in Hebrew.
`.trim();
}

// Pick followup question based on option.id only (no text heuristics)
function suggestFollowupQuestion(lightData: any, lastAnswerRaw: string): any | null {
  const last = (lastAnswerRaw || '').toLowerCase().trim();
  const idxNum = Number(last);
  const isIndexChoice = Number.isFinite(idxNum) && idxNum >= 1 && idxNum <= 20;

  const firstQ = lightData?.first_question;
  if (!firstQ) return null;

  const options = Array.isArray(firstQ.options) ? firstQ.options : [];
  const followups = firstQ.followups;

  if (followups && typeof followups === 'object' && options.length > 0) {
    const matched = isIndexChoice
      ? options[Math.max(0, idxNum - 1)]
      : options.find((o: any) => {
        const id = String(o?.id ?? '').toLowerCase();
        const label = String(o?.label ?? o ?? '').toLowerCase();
        return (id && last.includes(id)) || (label && last === label);
      });

    if (matched) {
      const f = followups[String(matched.id)];
      if (f?.text) return f;
    }
  }

  return null;
}

// Build prompt for chat AI coordination
export function buildChatPrompt(
  description: string,
  answers: UserAnswer[],
  hasImages: boolean,
  questionNumber: number = 0,
  detectedLightType?: string | null,
  ctx?: PromptContext | null
): string {
  const sanitizedDescription = sanitizeInput(description || '', 1000);
  const answersContext = buildAnswersContext(answers);

  const lights = warningLightsKB as Record<string, any>;
  const lightData = detectedLightType ? lights[detectedLightType] : null;
  const lightHebrewName = lightData?.names?.he?.[0] || detectedLightType || '';

  const kbContext = buildKnowledgeBaseContext(detectedLightType);

  const needsImageIdentification = hasImages && !detectedLightType;

  const lastAnswer = (answers?.[answers.length - 1] as any)?.answer ?? '';
  const followup = lightData ? suggestFollowupQuestion(lightData, lastAnswer) : null;

  let mode: string;
  if (needsImageIdentification) {
    mode = 'IMAGE_IDENTIFICATION';
  } else if (detectedLightType) {
    mode = 'KB_COORDINATION';
  } else {
    mode = 'BRIDGE_TO_KB';
  }

  const bridgeCount = ctx?.bridgeQuestionCount ?? 0;
  const remainingBridgeQuestions = Math.max(0, 3 - bridgeCount);

  const instruction = `
You are a Data Coordinator for a car diagnostics assistant.

Mode: ${mode}

User input:
"${sanitizedDescription}"

⛔ BANNED - DO NOT ASK THESE QUESTIONS AGAIN (already asked):
${answers.length > 0 ? answers.map((a, i) => `${i + 1}. "${(a as any)?.question || 'unknown'}"`).join('\n') : 'No questions asked yet.'}

Recent Q/A history:
${answersContext}

Detected warning light (if any): ${detectedLightType ? `"${detectedLightType}" (${lightHebrewName})` : 'none'}

${mode === 'IMAGE_IDENTIFICATION' ? `
Instructions for IMAGE_IDENTIFICATION:
- Analyze the image to identify which warning_light from available_lights list.
- Return type="question" ONLY. NEVER return diagnosis_report or ai_response.
- If you identify a light, include warning_light at ROOT level (not in candidate):
  { "type": "question", "warning_light": "<lightId>", "confidence": 0.8, "evidence": ["reason"], "text": "<first KB question>", "options": [...] }
- If unclear, ask the user to describe the light in words.
- NEVER end conversation on first image.
` : ''}

${mode === 'KB_COORDINATION' ? `
Instructions for KB_COORDINATION:
- Return type="question" ONLY. NEVER return diagnosis_report here.
- Do NOT invent new questions.
- Use the injected KB slice ONLY.
- If a followup question is relevant, ask it.
- Otherwise, ask the KB first_question or a clarifying KB question derived ONLY from injected KB.
- Always return options as an array of strings.
- If you detect a secondary light, include warning_light at ROOT level.

Followup hint (if present): ${followup?.text ? `"${followup.text}"` : 'none'}
` : ''}

${mode === 'BRIDGE_TO_KB' ? `
Instructions for BRIDGE_TO_KB:

⚠️ FORBIDDEN:
- You MUST NOT output type="diagnosis_report" or type="mechanic_report"
- You MUST NOT give technical advice or diagnose the problem
- You MUST NOT invent warning lights not in available_lights

✅ ALLOWED outputs:
A) If you are HIGHLY CONFIDENT which warning light matches:
   Return { type: "question", candidate: { warning_light: "<lightId>", confidence: 0.8, evidence: ["reason"] }, text: "<first KB question>", options: [...] }

B) If you need more information to identify the light:
   Return { type: "question", text: "<clarifying question in Hebrew>", options: ["<max 4 short Hebrew phrases>"] }

Clarifying questions should focus on:
- Symbol shape (e.g., "האם הסמל נראה כמו סוללה? מנוע? טיפת שמן?")
- Color (e.g., "באיזה צבע הנורה דולקת - אדום, כתום, או צהוב?")
- Behavior (e.g., "האם הנורה דולקת קבוע או מהבהבת?")
- When it appeared (e.g., "האם הנורה נדלקה תוך כדי נסיעה או בהתנעה?")

Remaining bridge questions allowed: ${remainingBridgeQuestions}
If remainingBridgeQuestions is 0 and you still cannot identify: return type="question" WITHOUT warning_light, and include options asking the user to choose a light from available_lights.
` : ''}

KB Context (JSON):
${kbContext}

${jsonOnlyContract()}
`.trim();

  return instruction;
}

// Build prompt for expert fallback mode
export function buildGeneralExpertPrompt(
  description: string,
  answers: UserAnswer[],
  hasImages: boolean = false,
  ctx?: PromptContext | null
): string {
  const sanitizedDescription = sanitizeInput(description || '', 1000);
  const answersContext = buildAnswersContext(answers);
  const kbContext = buildKnowledgeBaseContext(null);
  const questionCount = answers.length;

  // Build detailed conversation history like mechanic-summary does
  const conversationHistory = answers.length > 0
    ? answers.map(a => `שאלה: ${a.question}\nתשובה: ${a.answer}`).join('\n\n')
    : 'אין שאלות קודמות';

  const instruction = `
אתה מומחה לאבחון רכב. תפקידך לאבחן בעיות ברכב על סמך תיאור המשתמש.

## הבעיה שהמשתמש מתאר
"${sanitizedDescription}"

## היסטוריית שיחה (${questionCount} שאלות נשאלו)
${conversationHistory}

## שאלות שכבר נשאלו - אל תחזור עליהן!
${answers.length > 0 ? answers.map(a => `- ${a.question}`).join('\n') : 'אין שאלות קודמות'}

${hasImages ? '## תמונה: המשתמש צירף תמונה. נתח אותה לזיהוי נזק, נזילות, או נורות אזהרה.\n' : ''}

## כללים חשובים
1. **זהה את הקטגוריה**: האם הבעיה קשורה לגיר/תמסורת, מנוע, בלמים, חשמל, היגוי, או קירור?
2. **שאל שאלות ממוקדות**: שאל רק שאלות רלוונטיות לקטגוריה שזיהית.
3. **מקסימום 5 שאלות**: אחרי 5 שאלות חייבים לתת אבחון!
4. **אל תחזור על שאלות**: בדוק את הרשימה למעלה לפני ששואל.

## ⚠️ שגיאות נפוצות - חובה להימנע!

### ❌ שגיאה: "רכב נכבה באמצע נסיעה" → לשאול על מצבר
**למה שגוי:** מצבר לא יכול לגרום לרכב להיכבות תוך כדי נסיעה! האלטרנטור מזין את הרכב בזמן נסיעה.
**✅ שאלות נכונות:** האם היה מספיק דלק? האם היו נורות אזהרה לפני? האם המנוע התחמם?

### ❌ שגיאה: לשאול "האם בדקת את המצבר?" כשהרכב נסע
**למה שגוי:** אם הרכב נסע, המצבר לא הבעיה.
**✅ לשאול:** על נורות אזהרה, רמת דלק, טמפרטורת מנוע, רעשות לפני הכיבוי.

### ❌ שגיאה: לתת אבחון "נדרש אבחון מקצועי" בלי פירוט
**✅ נכון:** תמיד לתת אבחון ספציפי כמו "בעיה במשאבת דלק" או "תקלה באלטרנטור"

## דוגמאות לזיהוי קטגוריה ושאלות רלוונטיות

### רכב נכבה תוך נסיעה → קטגוריה: דלק/חשמל/מנוע
שאלות לשאול:
- "האם היו נורות אזהרה דולקות לפני הכיבוי?" → [כן, נורת מנוע", "כן, נורת טמפרטורה", "לא היו נורות", "לא שמתי לב"]
- "האם יש מספיק דלק במיכל?" → ["מלא/חצי מיכל", "כמעט ריק", "לא בטוח"]
- "האם המנוע התחמם לפני הכיבוי?" → ["כן, מד החום היה גבוה", "לא, טמפרטורה רגילה", "לא שמתי לב"]

### בעיות הילוכים/גיר → קטגוריה: תמסורת
שאלות לשאול:
- "האם הגיר אוטומטי או ידני?" → ["גיר אוטומטי", "גיר ידני"]
- "האם יש נורת אזהרה של גיר?" → ["כן", "לא", "לא בטוח"]
- "האם יש ריח או נזילה?" → ["יש ריח שריפה", "יש נזילה אדומה", "הכל תקין"]

### רכב לא נדלק (לא נוסע בכלל) → קטגוריה: חשמל/התנעה
רק כאן רלוונטי לשאול על מצבר!
- "מה קורה כשמנסה להתניע?" → ["שקט מוחלט", "קליקים", "המנוע מסתובב אבל לא נדלק"]

## מה לעשות עכשיו
${questionCount >= 5 ? `
⚠️ הגעת ל-5 שאלות - חייב לתת אבחון עכשיו!
החזר type: "diagnosis_report" עם אבחון ספציפי.
` : questionCount >= 3 ? `
יש לך מידע. שאל עוד 1-2 שאלות ממוקדות או תן אבחון.
` : `
זו תחילת השיחה. זהה את הקטגוריה ושאל שאלה ראשונה רלוונטית.
`}

## פורמט תגובה (JSON בלבד!)

לשאלה:
{
  "type": "question",
  "text": "שאלה בעברית - לא לחזור על שאלות שנשאלו!",
  "options": ["אפשרות ספציפית 1", "אפשרות ספציפית 2", "אפשרות ספציפית 3", "לא בטוח"]
}

לאבחון (אחרי ${questionCount >= 5 ? 'עכשיו!' : '3-5 שאלות'}):
{
  "type": "diagnosis_report",
  "title": "אבחון: <תיאור ספציפי של הבעיה>",
  "results": [
    {"issue": "בעיה ספציפית", "probability": 0.65, "explanation": "הסבר מבוסס על התשובות"},
    {"issue": "אפשרות נוספת", "probability": 0.25, "explanation": "סיבה אפשרית"}
  ],
  "confidence": 0.7,
  "status": {"color": "yellow", "text": "מומלץ בדיקה במוסך", "instruction": "פנה למוסך"},
  "nextSteps": "המלצה ספציפית",
  "recommendations": ["המלצה 1", "המלצה 2"],
  "endConversation": true
}

## נורות אזהרה זמינות (לרפרנס)
${kbContext}
`.trim();

  return instruction;
}

// Build prompt to generate short description from diagnosis
export function buildShortDescriptionPrompt(diagnosis: string): string {
  const safeDiagnosis = sanitizeInput(diagnosis, 2000);

  return `
אתה עוזר טכני לרכב. קיבלת אבחנה של בעיה ברכב.
צור תיאור קצר של הבעיה בעברית (מקסימום 100 תווים).

האבחנה:
${safeDiagnosis}

החזר JSON בלבד בפורמט:
{
  "description": "תיאור קצר של הבעיה"
}

דוגמאות:
- "בעיה במערכת הבלמים"
- "התחממות יתר של המנוע"
- "נורת שמן דולקת"
- "רעש ממערכת ההיגוי"

החזר JSON בלבד, ללא טקסט נוסף.
`.trim();
}
