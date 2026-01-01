/**
 * Prompt builder for AI consultation flow
 *
 * Anti-Gravity Design (Hybrid Modes):
 * - KB_COORDINATION: When detectedLightType exists → inject only that light's KB slice.
 * - OPTION_MAPPER: Map free-text answers to predefined option labels.
 * - BRIDGE_TO_KB: Ask up to 3 questions to identify warning_light or scenario.
 * - EXPERT_FALLBACK: General expertise when KB bridging fails.
 *
 * All modes return JSON only (no Markdown).
 */

import type { UserAnswer } from './types';
import { sanitizeInput } from './sanitize';
import warningLightsKB from '@/lib/knowledge/warning-lights.json';

// =============================================================================
// TYPES
// =============================================================================

export interface PromptContext {
  mode?: 'option_map' | 'bridge' | 'expert' | null;
  currentQuestionOptions?: string[];
  bridgeQuestionCount?: number;
  [key: string]: unknown;
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

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

/**
 * Surgical KB injection:
 * - If targetLightId exists, inject ONLY that light JSON.
 * - Else inject a minimal list for identification.
 */
function buildKnowledgeBaseContext(targetLightId?: string | null): string {
  const lights = warningLightsKB as Record<string, any>;

  if (targetLightId && lights[targetLightId]) {
    const lightData = lights[targetLightId];
    return JSON.stringify({ lightId: targetLightId, lightData }, null, 2);
  }

  const list = Object.entries(lights).map(([lightId, lightData]) => ({
    lightId,
    names_he: lightData?.names?.he ?? [],
    names_en: lightData?.names?.en ?? []
  }));

  return JSON.stringify({ available_lights: list }, null, 2);
}

/**
 * JSON-only response contract shared by all modes.
 */
function jsonOnlyContract(mode: string): string {
  if (mode === 'OPTION_MAPPER') {
    return `
Return ONLY a valid JSON object. No markdown, no extra text.

Schema for OPTION_MAPPER mode:
{
  "type": "option_map",
  "selectedOptionLabel": "<exact label from options | null>",
  "needClarification": "<clarifying question string | null>"
}

Rules:
- selectedOptionLabel MUST be exactly one of the provided option labels, or null if no match.
- If null, provide a short clarification question in needClarification.
`.trim();
  }

  return `
Return ONLY a valid JSON object. No markdown, no extra text.

Schema:
{
  "type": "question" | "ai_response",
  "warning_light"?: "<lightId>",
  "text": "<string>",
  "options"?: ["<string>", ...]
}

Rules:
- Do NOT invent technical diagnosis.
- If you choose a warning_light, it must be one of the provided KB IDs.
- If detectedLightType exists, ONLY use the KB slice injected for that light.
- Always include options as an array of strings when type is "question".
`.trim();
}

/**
 * Try to pick a followup question based on the user's last answer and KB structure.
 * Supports:
 * - new: first_question.followups[optionId]
 * - old: first_question.followup_for_steady / followup_for_flashing
 */
function suggestFollowupQuestion(lightData: any, lastAnswerRaw: string): any | null {
  const last = (lastAnswerRaw || '').toLowerCase();

  const firstQ = lightData?.first_question;
  if (!firstQ) return null;

  // New structure: followups map keyed by optionId
  const options = Array.isArray(firstQ.options) ? firstQ.options : [];
  const followups = firstQ.followups;

  if (followups && typeof followups === 'object' && options.length > 0) {
    const matched = options.find((o: any) => {
      const id = String(o?.id ?? '').toLowerCase();
      const label = String(o?.label ?? o ?? '').toLowerCase();
      return (id && last.includes(id)) || (label && last.includes(label));
    });

    if (matched) {
      const f = followups[String(matched.id)];
      if (f?.text) return f;
    }
  }

  // Old structure fallback
  if (last.includes('מהבהב') || last.includes('flashing')) {
    const f = firstQ.followup_for_flashing;
    if (f?.text) return f;
  }
  if (last.includes('קבוע') || last.includes('steady')) {
    const f = firstQ.followup_for_steady;
    if (f?.text) return f;
  }

  return null;
}

// =============================================================================
// MAIN EXPORTS
// =============================================================================

/**
 * Build prompt for chat-based AI coordination.
 *
 * Modes resolved internally:
 * - OPTION_MAPPER: ctx.mode === 'option_map' with ctx.currentQuestionOptions
 * - KB_COORDINATION: detectedLightType present
 * - IMAGE_IDENTIFICATION: hasImages && no detected light
 * - BRIDGE_TO_KB: no light, trying to identify
 */
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

  // -------------------------------------------------------------------------
  // MODE: OPTION_MAPPER
  // -------------------------------------------------------------------------
  if (ctx?.mode === 'option_map' && Array.isArray(ctx.currentQuestionOptions) && ctx.currentQuestionOptions.length > 0) {
    const optionsList = ctx.currentQuestionOptions.map((o, i) => `${i + 1}. "${o}"`).join('\n');

    return `
You are an Option Mapper assistant.

User's free-text answer:
"${sanitizedDescription}"

Available options (choose EXACTLY one label or null):
${optionsList}

${jsonOnlyContract('OPTION_MAPPER')}
`.trim();
  }

  // -------------------------------------------------------------------------
  // MODE: KB_COORDINATION / IMAGE_IDENTIFICATION / BRIDGE_TO_KB
  // -------------------------------------------------------------------------
  const lights = warningLightsKB as Record<string, any>;
  const lightData = detectedLightType ? lights[detectedLightType] : null;
  const lightHebrewName = lightData?.names?.he?.[0] || detectedLightType || '';

  const kbContext = buildKnowledgeBaseContext(detectedLightType);

  const needsImageIdentification =
    hasImages && (!detectedLightType || detectedLightType === 'unidentified_light');

  const lastAnswer = (answers?.[answers.length - 1] as any)?.answer ?? '';
  const followup = lightData ? suggestFollowupQuestion(lightData, lastAnswer) : null;

  let mode: string;
  if (needsImageIdentification) {
    mode = 'IMAGE_IDENTIFICATION';
  } else if (detectedLightType && detectedLightType !== 'unidentified_light') {
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

Recent Q/A history:
${answersContext}

Detected warning light (if any): ${detectedLightType ? `"${detectedLightType}" (${lightHebrewName})` : 'none'}

${mode === 'IMAGE_IDENTIFICATION' ? `
Instructions for IMAGE_IDENTIFICATION:
- Identify the warning_light ID from the provided available_lights list.
- Return a JSON object with type="question", include warning_light, and ask the first KB question if possible.
- Do NOT guess if unclear; ask the user to describe the light.
` : ''}

${mode === 'KB_COORDINATION' ? `
Instructions for KB_COORDINATION:
- Do NOT invent new questions.
- Use the injected KB slice ONLY.
- If a followup question is relevant, ask it.
- Otherwise, ask the KB first_question or a clarifying KB question derived ONLY from injected KB.
- Always return options as an array of strings.

Followup hint (if present): ${followup?.text ? `"${followup.text}"` : 'none'}
` : ''}

${mode === 'BRIDGE_TO_KB' ? `
Instructions for BRIDGE_TO_KB:
- Your goal: identify which warning_light (from available_lights) matches the user's problem.
- You may ask UP TO ${remainingBridgeQuestions} more bridging question(s).
- Do NOT diagnose or give technical advice.
- If you identify a warning_light, include it in your response.
- Keep questions short and focused.
` : ''}

KB Context (JSON):
${kbContext}

${jsonOnlyContract(mode)}
`.trim();

  return instruction;
}

/**
 * Build prompt for expert fallback mode.
 *
 * Used when:
 * - context-analyzer returns CONSULT_AI
 * - No recognized light or scenario in KB
 * - Bridge attempts exhausted
 */
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

  const instruction = `
You are an EXPERT_FALLBACK assistant for car diagnostics.

Mode: EXPERT_FALLBACK

User input:
"${sanitizedDescription}"

Recent Q/A history (${questionCount} questions asked so far):
${answersContext}

${hasImages ? 'Note: User provided an image. Describe what you see if relevant.\n' : ''}

Instructions:
${questionCount >= 5 ? `
- You have gathered enough information (${questionCount} questions). NOW provide a diagnosis_report.
- Return type: "diagnosis_report" with results array.
` : `
- Ask clarifying questions to understand the problem better.
- IMPORTANT: Provide 3-4 VARIED options, NOT just "כן/לא". Include specific symptoms, actions, or descriptions.
- Example good options: ["כן, יש טפטוף קבוע", "לא, אבל יש כתם על הרצפה", "לא בדקתי", "לא בטוח"]
- If the user indicates they want to go to a mechanic or end the conversation, provide a diagnosis_report.
`}
- If you can map the description to a warning_light ID from available_lights, include warning_light in the JSON.
- Be safety-conscious: if something sounds dangerous, immediately advise stopping and return diagnosis_report.

Available lights (JSON):
${kbContext}

Return ONLY a valid JSON object. No markdown, no extra text.

Schema for questions:
{
  "type": "question",
  "text": "<question string>",
  "options": ["<varied option 1>", "<varied option 2>", "<varied option 3>", "<varied option 4>"]
}

Schema for diagnosis (use when ${questionCount >= 5 ? 'NOW - enough questions asked' : 'user wants to end or dangerous situation'}):
{
  "type": "diagnosis_report",
  "title": "אבחון: <problem summary>",
  "results": [
    { "issue": "<diagnosis 1>", "probability": 0.7, "explanation": "<why>" },
    { "issue": "<diagnosis 2>", "probability": 0.2, "explanation": "<why>" }
  ],
  "confidence": 0.75,
  "status": { "color": "yellow", "text": "<severity text>", "instruction": "<action to take>" },
  "nextSteps": "<recommended next steps>",
  "recommendations": ["<specific check 1>", "<specific check 2>"],
  "endConversation": true
}
`.trim();

  return instruction;
}

// =============================================================================
// SHORT DESCRIPTION PROMPT (for from-draft route)
// =============================================================================

/**
 * Builds a prompt to generate a short description from a diagnosis.
 * Used by /api/requests/from-draft to create a summary for the request.
 */
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
