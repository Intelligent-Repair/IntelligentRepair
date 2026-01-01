// lib/ai/diagnostic-utils.ts
/**
 * =============================================================================
 * DIAGNOSTIC UTILITIES
 * =============================================================================
 * Pure helpers used by KB and Scenario flows (flow-handlers.ts).
 *
 * Goals:
 * - Be schema-tolerant (supports both legacy and patched KB structures)
 * - Never throw on missing fields (Anti-Gravity robustness)
 * - Keep exported function signatures stable for existing code
 */

import warningLightsKB from '@/lib/knowledge/warning-lights.json';
import type { UserAnswer } from './types';
import type { DiagnosticState, Scenario, StepOption } from '@/lib/types/knowledge';

// =============================================================================
// CONSTANTS
// =============================================================================

export const CRITICAL_LIGHTS = ['oil_pressure_light', 'coolant_temperature_light', 'brake_light'] as const;
export type CriticalLightId = typeof CRITICAL_LIGHTS[number];

function isCriticalLight(x: string): x is CriticalLightId {
    return (CRITICAL_LIGHTS as readonly string[]).includes(x);
}

const DIAGNOSIS_THRESHOLD = 4; // score threshold for top cause
const MIN_QUESTIONS_BEFORE_DIAGNOSIS = 4; // minimum questions before allowing diagnosis (raised for better accuracy)
const MAX_QUESTIONS = { danger: 6, caution: 6 } as const;

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function norm(s: unknown): string {
    return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

type KBOption = string | { id: string; label: string };

function optionLabel(opt: KBOption): string {
    return typeof opt === 'string' ? opt : opt?.label ?? '';
}

function optionId(opt: KBOption): string | null {
    return typeof opt === 'string' ? null : opt?.id ?? null;
}

function optionsToLabels(options: unknown): string[] {
    const arr: KBOption[] = Array.isArray(options) ? options : [];
    const labels = arr.map(optionLabel).filter(Boolean);
    return labels.length > 0 ? labels : ['כן', 'לא', 'לא בטוח'];
}

/**
 * Try to match user's answer to an option in a question.
 * Works with either string[] options or {id,label}[] options.
 */
function matchOption(questionOptions: unknown, userAnswer: string): { id?: string; label: string } | null {
    const ans = norm(userAnswer);
    const opts: KBOption[] = Array.isArray(questionOptions) ? questionOptions : [];
    if (opts.length === 0) return null;

    // exact match by label
    for (const opt of opts) {
        const label = norm(optionLabel(opt));
        if (!label) continue;
        if (ans === label) return { id: optionId(opt) ?? undefined, label: optionLabel(opt) };
    }

    // partial match: user typed only part of label
    for (const opt of opts) {
        const label = norm(optionLabel(opt));
        if (!label) continue;
        if (label.length >= 6 && ans.includes(label.slice(0, 6))) return { id: optionId(opt) ?? undefined, label: optionLabel(opt) };
        if (ans.includes(label)) return { id: optionId(opt) ?? undefined, label: optionLabel(opt) };
    }

    return null;
}

function asScenarioSeverity(raw: unknown): 'critical' | 'high' | 'moderate' | 'low' {
    const s = norm(raw);
    if (s === 'critical') return 'critical';
    if (s === 'high') return 'high';
    if (s === 'low') return 'low';
    if (s === 'moderate') return 'moderate';
    // legacy / noisy:
    if (s === 'medium' || s === 'caution') return 'moderate';
    return 'moderate';
}

function severityToUi(sev: 'critical' | 'high' | 'moderate' | 'low'): 'critical' | 'high' | 'medium' | 'low' {
    return sev === 'moderate' ? 'medium' : sev;
}

function answerPolarity(answer: string): 'yes' | 'no' | 'unknown' {
    const a = norm(answer);
    if (!a) return 'unknown';
    if (a === 'כן' || a.startsWith('כן') || a.includes('כן,')) return 'yes';
    if (a === 'לא' || a.startsWith('לא') || a.includes('לא,')) return 'no';
    // heuristic for your existing labels:
    if (['מהבהבת', 'רועד', 'מאבד', 'תקוע', 'יש', 'גבוה'].some(k => a.includes(k))) return 'yes';
    if (['אין', 'לא באמת', 'תקין'].some(k => a.includes(k))) return 'no';
    return 'unknown';
}

function mechanicAdviceText(goToMechanic: unknown, severity: 'critical' | 'high' | 'moderate' | 'low'): string | null {
    if (!goToMechanic) return null;
    if (typeof goToMechanic === 'string') return goToMechanic;

    // patched schema: {immediately, soon, next_service}
    if (typeof goToMechanic === 'object') {
        const obj = goToMechanic as any;
        if (severity === 'critical' && obj.immediately) return obj.immediately;
        if ((severity === 'high' || severity === 'critical') && obj.soon) return obj.soon;
        return obj.next_service || obj.soon || obj.immediately || null;
    }
    return null;
}

// =============================================================================
// KB: SCENARIO DETERMINATION
// =============================================================================

/**
 * Determine which scenario in a warning-light KB to use.
 * Primary approach: match the FIRST answer to the first_question options.
 * Fallback: heuristic keywords across all answers.
 */
export function determineScenario(lightType: string, answers: UserAnswer[]): string | null {
    const lightData = (warningLightsKB as any)[lightType];
    if (!lightData?.scenarios) return null;

    const scenarios = lightData.scenarios as Record<string, any>;
    const firstQ = lightData.first_question;

    const firstAnswer = answers?.[0]?.answer ?? '';
    const matched = matchOption(firstQ?.options, firstAnswer);
    const optId = matched?.id;

    // If the option id directly maps to a scenario key (tpms: steady / flashing_then_steady / etc.)
    if (optId && scenarios[optId]) return optId;

    // If legacy scenario keys exist and answer indicates them
    const all = answers.map(a => norm(a.answer)).join(' ');

    const isFlashing = all.includes('מהבהב') || all.includes('מהבהבת');
    const isSteady = all.includes('קבוע') || all.includes('דולקת קבוע');
    const hasSymptoms = ['רועד', 'רעידות', 'מאבד כוח', 'תקוע', 'מגמגם'].some(s => all.includes(norm(s)));
    const isDriving = all.includes('נסיעה') || all.includes('נוסע') || all.includes('בנסיעה');
    const isFromParking = all.includes('חניה') || all.includes('בהתנעה');

    if (isFlashing && scenarios.flashing) return 'flashing';

    // Special: check_engine steady may split into steady_symptoms vs steady_normal
    if (hasSymptoms && scenarios.steady_symptoms) return 'steady_symptoms';
    if (isSteady && scenarios.steady_normal) return 'steady_normal';

    if (isDriving && scenarios.while_driving) return 'while_driving';
    if (isFromParking && scenarios.from_parking) return 'from_parking';

    // Safe default: first scenario key
    return Object.keys(scenarios)[0] || null;
}

// =============================================================================
// KB: SCORE MANAGEMENT
// =============================================================================

/**
 * Update cause scores based on the last asked question id.
 * In this KB, we use cause.id as the question id for cause questions.
 * For first_question / followups, we don't change scores here.
 * 
 * NEW: Uses explicit score_mapping from KB when available.
 * This fixes the bug where "כן, השמן תקין" was incorrectly scored as positive.
 */
export function updateScores(
    scores: Record<string, number>,
    questionId: string,
    answer: string,
    lightType: string,
    scenarioId: string
): Record<string, number> {
    const newScores = { ...scores };

    // ignore non-cause questions
    if (!questionId || questionId === 'first_question' || questionId.startsWith('followup')) {
        console.log(`[Scores] ⏭️ Skipping score update for questionId: ${questionId}`);
        return newScores;
    }

    const scenario = (warningLightsKB as any)[lightType]?.scenarios?.[scenarioId];
    const causes: any[] = Array.isArray(scenario?.causes) ? scenario.causes : [];
    const cause = causes.find(c => c?.id === questionId);

    if (!cause) {
        console.log(`[Scores] ⚠️ No matching cause for questionId: ${questionId}`);
        return newScores;
    }

    // Check for explicit score_mapping in KB first
    const scoreMapping = cause.key_question?.score_mapping;
    let polarity: 'yes' | 'no' | 'unknown' | 'uncertain_probable';
    let mappingSource = 'heuristic';

    if (scoreMapping && typeof scoreMapping === 'object') {
        const mapping = scoreMapping[answer];
        if (mapping === 'confirms') {
            polarity = 'yes';
            mappingSource = 'KB_mapping';
        } else if (mapping === 'rules_out') {
            polarity = 'no';
            mappingSource = 'KB_mapping';
        } else if (mapping === 'unknown') {
            polarity = 'unknown';
            mappingSource = 'KB_mapping';
        } else if (mapping === 'uncertain_probable') {
            // NEW: For high-probability causes that can't be ruled out
            // e.g., "לא בדקתי" for low_oil_level - doesn't confirm but doesn't rule out
            polarity = 'uncertain_probable';
            mappingSource = 'KB_mapping';
        } else {
            // Fallback to heuristic (for backward compatibility)
            polarity = answerPolarity(answer);
        }
    } else {
        // No score_mapping in KB, use heuristic
        polarity = answerPolarity(answer);
    }

    const base = typeof cause.probability === 'number' ? cause.probability : 0.5;

    // Scoring logic:
    // - 'yes' (confirms): Strong positive score
    // - 'no' (rules_out): Negative score
    // - 'uncertain_probable': Small positive score proportional to base probability
    //   (e.g., if user didn't check oil, we still consider low_oil_level likely since it's common)
    // - 'unknown': No change
    const delta =
        polarity === 'yes' ? 2.5 * (0.7 + base) :
            polarity === 'no' ? -1.0 * (0.5 + base) :
                polarity === 'uncertain_probable' ? 1.0 * base :  // Smaller positive boost based on probability
                    0;

    const oldScore = newScores[cause.id] || 0;
    newScores[cause.id] = oldScore + delta;

    console.log(`[Scores] 📊 Updated score for "${cause.id}": ${oldScore.toFixed(2)} -> ${newScores[cause.id].toFixed(2)} (delta: ${delta > 0 ? '+' : ''}${delta.toFixed(2)}, answer: "${answer}" -> ${polarity} [${mappingSource}])`);

    return newScores;
}



/**
 * Decide whether we have enough info to diagnose.
 * Requires BOTH:
 * 1. Minimum number of questions answered (to avoid premature diagnosis)
 * 2. Either: high enough score OR max questions reached
 */
export function shouldDiagnose(scores: Record<string, number>, count: number, severity: string): boolean {
    const maxScore = Math.max(...Object.values(scores), 0);
    const scoreCount = Object.values(scores).filter(s => s !== 0).length; // How many causes have non-zero scores
    const maxQ = severity === 'danger' ? MAX_QUESTIONS.danger : MAX_QUESTIONS.caution;

    // Log for debugging
    console.log(`[shouldDiagnose] count=${count}/${maxQ} | maxScore=${maxScore.toFixed(2)} | scoredCauses=${scoreCount} | threshold=${DIAGNOSIS_THRESHOLD}`);

    // Don't diagnose until we've asked minimum questions (prevents premature diagnosis)
    if (count < MIN_QUESTIONS_BEFORE_DIAGNOSIS) {
        console.log(`[shouldDiagnose] ❌ Not enough questions (${count} < ${MIN_QUESTIONS_BEFORE_DIAGNOSIS})`);
        return false;
    }

    // For critical situations (danger), require either:
    // - High score from multiple confirming answers
    // - OR max questions reached
    if (severity === 'danger') {
        if (maxScore >= DIAGNOSIS_THRESHOLD && scoreCount >= 2) {
            console.log(`[shouldDiagnose] ✅ Danger mode: high score with multiple confirmations`);
            return true;
        }
        if (count >= maxQ) {
            console.log(`[shouldDiagnose] ✅ Max questions reached`);
            return true;
        }
        console.log(`[shouldDiagnose] ❌ Need more data (danger mode)`);
        return false;
    }

    // Normal mode: diagnose if score is high enough OR we've asked all possible questions
    if (maxScore >= DIAGNOSIS_THRESHOLD || count >= maxQ) {
        console.log(`[shouldDiagnose] ✅ Normal mode: conditions met`);
        return true;
    }

    console.log(`[shouldDiagnose] ❌ Not ready yet`);
    return false;
}

// =============================================================================
// KB: QUESTION RETRIEVAL
// =============================================================================

export interface KBQuestion {
    id: string;
    text: string;
    options: string[];
    probability: number;
}

/**
 * Get next question to ask.
 * Priority:
 * 1) Followup question triggered by the last answer (if present)
 * 2) Highest-probability unasked cause.key_question
 */
export function getNextQuestion(
    lightType: string,
    scenarioId: string,
    askedIds: string[],
    lastAnswer: string
): KBQuestion | null {
    const lightData = (warningLightsKB as any)[lightType];
    const scenario = lightData?.scenarios?.[scenarioId];
    if (!lightData || !scenario) return null;

    // ---------------------------------------------------------------------------
    // 1) Followups (supports new & legacy schemas)
    // ---------------------------------------------------------------------------
    const firstQ = lightData.first_question;

    // New schema: first_question.followups: Record<optionId, KBQuestion-like>
    const followups = firstQ?.followups;
    if (followups && typeof followups === 'object') {
        // Identify which option user chose
        const matched = matchOption(firstQ?.options, lastAnswer);
        const key = matched?.id;
        const fq = key ? followups[key] : null;

        if (fq?.id && !askedIds.includes(fq.id)) {
            return {
                id: fq.id,
                text: fq.text,
                options: optionsToLabels(fq.options),
                probability: 0.95
            };
        }
    }

    // Legacy schema (what your old file had): followup_for_steady / followup_for_flashing
    const a = norm(lastAnswer);
    if (a.includes('קבוע') && firstQ?.followup_for_steady && !askedIds.includes('followup_steady')) {
        const f = firstQ.followup_for_steady;
        return { id: 'followup_steady', text: f.text, options: optionsToLabels(f.options), probability: 0.95 };
    }
    if (a.includes('מהבהב') && firstQ?.followup_for_flashing && !askedIds.includes('followup_flashing')) {
        const f = firstQ.followup_for_flashing;
        return { id: 'followup_flashing', text: f.text, options: optionsToLabels(f.options), probability: 0.95 };
    }

    // ---------------------------------------------------------------------------
    // 2) Cause questions
    // ---------------------------------------------------------------------------
    const causes: any[] = Array.isArray(scenario?.causes) ? scenario.causes : [];
    const questions: KBQuestion[] = [];

    for (const cause of causes) {
        if (!cause?.id || askedIds.includes(cause.id)) continue;

        const q = cause.key_question;
        if (!q?.text) continue;

        questions.push({
            id: cause.id,
            text: q.text,
            options: optionsToLabels(q.options),
            probability: typeof cause.probability === 'number' ? cause.probability : 0.5
        });
    }

    if (questions.length === 0) return null;
    return questions.sort((x, y) => y.probability - x.probability)[0];
}

// =============================================================================
// KB: INSTRUCTION TYPE (for self_fix_actions)
// =============================================================================

export interface KBInstruction {
    id: string;
    name: string;
    actionType: 'safety' | 'inspect' | 'fill' | 'adjust';
    priority?: 'FIRST' | 'STANDARD' | 'ONLY_IF_SAFE' | 'AFTER_COOLDOWN';
    condition?: string;
    steps: string[];
    warning?: string;
    followup_question?: {
        text: string;
        options: any[];
        resolution_paths?: Record<string, any>;
    };
}

export type KBNextStep =
    | { kind: 'instruction'; action: KBInstruction }
    | { kind: 'question'; question: KBQuestion }
    | null;

/**
 * Get next step in the KB flow.
 * Priority order:
 * 1) self_fix_actions with priority='FIRST' (if not yet shown)
 * 2) Followup questions from first_question
 * 3) Highest-probability unasked cause.key_question
 * 4) self_fix_actions with priority='STANDARD' (if not yet shown)
 * 
 * @param shownInstructionIds - Array of instruction IDs already shown to user
 */
export function getNextStep(
    lightType: string,
    scenarioId: string,
    askedIds: string[],
    shownInstructionIds: string[],
    lastAnswer: string
): KBNextStep {
    const lightData = (warningLightsKB as any)[lightType];
    const scenario = lightData?.scenarios?.[scenarioId];
    if (!lightData || !scenario) return null;

    const selfFixActions: any[] = Array.isArray(scenario.self_fix_actions)
        ? scenario.self_fix_actions
        : [];

    // ---------------------------------------------------------------------------
    // 1) FIRST priority self_fix_actions (before any cause questions)
    // ---------------------------------------------------------------------------
    for (const action of selfFixActions) {
        if (!action?.id) continue;
        if (shownInstructionIds.includes(action.id)) continue;
        if (action.priority !== 'FIRST') continue;

        // Check conditions for AFTER_COOLDOWN or ONLY_IF_SAFE
        // For now, FIRST priority is unconditional

        console.log(`[getNextStep] 🔧 Returning FIRST priority instruction: ${action.id}`);
        return {
            kind: 'instruction',
            action: {
                id: action.id,
                name: action.name || action.id,
                actionType: action.actionType || 'inspect',
                priority: action.priority,
                condition: action.condition,
                steps: Array.isArray(action.steps) ? action.steps : [],
                warning: action.warning,
                followup_question: action.followup_question
            }
        };
    }

    // ---------------------------------------------------------------------------
    // 2) Regular question flow (followups + cause.key_question)
    // ---------------------------------------------------------------------------
    const nextQuestion = getNextQuestion(lightType, scenarioId, askedIds, lastAnswer);
    if (nextQuestion) {
        return { kind: 'question', question: nextQuestion };
    }

    // ---------------------------------------------------------------------------
    // 3) STANDARD priority self_fix_actions (after cause questions exhausted)
    // ---------------------------------------------------------------------------
    for (const action of selfFixActions) {
        if (!action?.id) continue;
        if (shownInstructionIds.includes(action.id)) continue;
        if (action.priority === 'FIRST') continue; // Already handled above
        if (action.priority === 'AFTER_COOLDOWN') continue; // Special handling needed
        if (action.priority === 'ONLY_IF_SAFE') continue; // Special handling needed

        console.log(`[getNextStep] 🔧 Returning STANDARD priority instruction: ${action.id}`);
        return {
            kind: 'instruction',
            action: {
                id: action.id,
                name: action.name || action.id,
                actionType: action.actionType || 'inspect',
                priority: action.priority || 'STANDARD',
                condition: action.condition,
                steps: Array.isArray(action.steps) ? action.steps : [],
                warning: action.warning,
                followup_question: action.followup_question
            }
        };
    }

    return null;
}

// =============================================================================
// KB: IMMEDIATE ACTION
// =============================================================================

export function checkImmediateAction(lightType: string, scenarioId: string): string | null {
    const scenario = (warningLightsKB as any)[lightType]?.scenarios?.[scenarioId];
    return scenario?.immediate_action || null;
}

// =============================================================================
// KB: DIAGNOSIS GENERATION
// =============================================================================

/**
 * Generate explanation text for diagnosis results.
 * FIXED: No longer shows KB symptoms that may contradict user's actual answers.
 * Instead, generates explanation based on actual evidence level.
 */
function generateResultExplanation(
    topCause: any,
    hasPositiveEvidence: boolean,
    scoreValue: number,
    positiveAnswers: string[]
): string {
    // No positive evidence - diagnosis by elimination
    if (!hasPositiveEvidence) {
        return 'אבחון על בסיס שלילת אפשרויות אחרות - מומלץ בדיקה מקצועית';
    }

    // Strong positive evidence (score >= 2) - can show symptoms if available
    // But only if symptoms are general descriptions, not user actions
    if (scoreValue >= 2 && topCause?.symptoms?.length) {
        // Filter out symptoms that describe user actions (like "לא בדקתי...")
        const relevantSymptoms = (topCause.symptoms as string[]).filter(s =>
            !s.includes('לא בדקתי') && !s.includes('לא זוכר')
        );
        if (relevantSymptoms.length > 0) {
            return relevantSymptoms.join(' • ');
        }
    }

    // Medium/weak evidence - use positive answers or generic text
    if (positiveAnswers?.length > 0) {
        return positiveAnswers[0];
    }

    return 'מבוסס על התשובות שסיפקת';
}

/**
 * Generate a final diagnosis report object (consumed by the UI).
 * Shape is kept close to your existing usage in flow-handlers.ts.
 */

export function generateDiagnosis(
    lightType: string,
    scenarioId: string,
    scores: Record<string, number>,
    answers: UserAnswer[],
    vehicleInfo?: VehicleInfo,
    instructionsShown?: string[]
) {
    const lightData = (warningLightsKB as any)[lightType];
    const scenario = lightData?.scenarios?.[scenarioId];

    const lightName = lightData?.names?.he?.[0] || lightType || 'נורת אזהרה';

    const causes: any[] = Array.isArray(scenario?.causes) ? scenario.causes : [];
    const ranked = causes
        .map(c => ({ ...c, score: scores?.[c.id] ?? 0 }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const topCause = ranked[0] ?? null;

    const scenarioSeverity = asScenarioSeverity(scenario?.severity);
    const isCritical = scenarioSeverity === 'critical' || isCriticalLight(lightType);
    const isHigh = scenarioSeverity === 'high' || (topCause?.score ?? 0) >= 4;

    const normalizedSeverity: 'critical' | 'high' | 'moderate' | 'low' =
        isCritical ? 'critical' : isHigh ? 'high' : scenarioSeverity;

    const uiSeverity = severityToUi(normalizedSeverity);

    const mechanicAdvice = mechanicAdviceText(scenario?.go_to_mechanic, normalizedSeverity);

    const towConditions: string[] =
        Array.isArray(scenario?.tow_conditions) ? scenario.tow_conditions :
            isCritical ? ['הנורה אדומה/מהבהבת או יש רעשים חריגים', 'יש איבוד כוח משמעותי או ריח שרוף'] :
                [];

    const showTowButton = isCritical || uiSeverity === 'high';

    const statusInstruction =
        isCritical ? (scenario?.immediate_action || mechanicAdvice || 'עצור מיד ואל תמשיך בנסיעה!') :
            (mechanicAdvice || scenario?.recommendation || 'מומלץ לפנות למוסך לבדיקה מקצועית.');

    const statusText =
        isCritical ? 'נדרשת תשומת לב מיידית!' :
            uiSeverity === 'high' ? 'מומלץ לבדוק בהקדם.' :
                'ניתן להמשיך בזהירות ולבדוק בהמשך.';

    const selfFix = (Array.isArray(scenario?.self_fix_actions) ? scenario.self_fix_actions : []).map((a: any) => ({
        id: a.id,
        action: a.action,
        instruction: a.instruction,
        severity: a.severity,
        warning: a.warning,
        tools: a.tools,
        time_estimate: a.time_estimate,
        actionType: a.actionType || 'inspect'
    }));

    // Basic "evidence summary" from answers
    const positiveAnswers: string[] = (answers || [])
        .filter(a => answerPolarity(a.answer || '') === 'yes')
        .map(a => (a.question ? String(a.question).slice(0, 80) : null))
        .filter((x): x is string => x !== null);


    // 📊 IMPROVED confidence calculation:
    // Key insight: If topCause.score <= 0, we have NO positive evidence!
    // In that case, we're diagnosing by elimination only, which should be LOW confidence.
    const hasPositiveEvidence = (topCause?.score ?? 0) > 0;
    const scoreValue = topCause?.score ?? 0;

    let baseConfidence: number;
    let scoreBoost: number;
    let confidenceLevel: string;

    if (!hasPositiveEvidence) {
        // NO positive evidence - diagnosis by elimination only
        // This should be clearly marked as LOW confidence
        baseConfidence = 0.40;
        scoreBoost = 0; // No boost for negative/zero scores
        confidenceLevel = 'low';
        console.log(`[Diagnosis] ⚠️ WARNING: No positive evidence! Score=${scoreValue.toFixed(2)}`);
    } else if (scoreValue < 1.0) {
        // Some positive evidence but not strong
        baseConfidence = 0.50;
        scoreBoost = scoreValue * 0.15;
        confidenceLevel = 'medium';
    } else {
        // Strong positive evidence
        baseConfidence = isCritical ? 0.60 : 0.55;
        scoreBoost = Math.min(0.25, scoreValue * 0.12);
        confidenceLevel = scoreValue >= 1.5 ? 'high' : 'medium';
    }

    const answerBoost = hasPositiveEvidence
        ? Math.min(0.10, (answers?.length || 0) * 0.02)
        : Math.min(0.05, (answers?.length || 0) * 0.01); // Smaller boost without evidence

    const totalConfidence = Math.min(0.92, baseConfidence + scoreBoost + answerBoost);

    console.log(`[Diagnosis] 📈 Confidence calculation:`);
    console.log(`  Has positive evidence: ${hasPositiveEvidence} (score=${scoreValue.toFixed(2)})`);
    console.log(`  Base: ${(baseConfidence * 100).toFixed(0)}% + Score boost: ${(scoreBoost * 100).toFixed(0)}% + Answer boost: ${(answerBoost * 100).toFixed(0)}% = ${(totalConfidence * 100).toFixed(0)}%`);
    console.log(`  Confidence Level: ${confidenceLevel.toUpperCase()}`);

    const results = topCause
        ? [{
            issue: topCause.name,
            probability: Math.min(0.92, hasPositiveEvidence ? (0.55 + scoreValue * 0.12) : 0.40),
            // FIXED: Don't show KB symptoms that may contradict user's actual answers
            // Instead, show explanation based on actual evidence level
            explanation: generateResultExplanation(topCause, hasPositiveEvidence, scoreValue, positiveAnswers)
        }]
        : [{
            issue: 'לא זוהתה סיבה חד-משמעית',
            probability: 0.40,
            explanation: 'נדרש מידע נוסף או בדיקה מקצועית במוסך.'
        }];


    return {
        type: 'diagnosis_report',
        title: `אבחון: ${lightName}`,
        confidence: totalConfidence,
        confidenceLevel, // NEW: explicit level (low/medium/high)
        summary: {
            detected: [lightName],
            reported: positiveAnswers.slice(0, 4)
        },
        results,
        status: {
            color: isCritical ? 'red' : uiSeverity === 'high' ? 'yellow' : 'blue',
            text: statusText,
            instruction: statusInstruction
        },
        selfFix,
        nextSteps: scenario?.recommendation || mechanicAdvice || 'פנה למוסך לאבחון מקצועי.',
        recommendations: [
            mechanicAdvice ? mechanicAdvice : null,
            towConditions[0] ? `הזמן גרר אם: ${towConditions[0]}` : null
        ].filter(Boolean),
        disclaimer: hasPositiveEvidence
            ? 'האבחון מבוסס על תיאור בלבד ואינו מחליף בדיקה מקצועית במוסך.'
            : 'האבחון מבוסס על שלילת אפשרויות בלבד (ללא אינדיקציה חיובית). מומלץ מאוד בדיקה מקצועית במוסך.',
        mechanicReport: {
            topSuspect: topCause?.name || 'לא זוהה',
            score: topCause?.score || 0,
            severity: uiSeverity,
            status: statusText,
            instruction: statusInstruction,
            towConditions,
            blindSpots: (answers || []).filter(a => norm(a.answer).includes('לא יודע') || norm(a.answer).includes('לא בטוח')).map(a => a.question)
        },
        towConditions,
        showTowButton,
        severity: uiSeverity,
        severity_norm: normalizedSeverity,
        // NEW: Conversation summaries for user and mechanic
        conversationSummaries: generateConversationSummaries(
            lightType,
            scenarioId,
            answers,
            scores,
            vehicleInfo || {},
            topCause,
            ranked.slice(1, 4), // Top 3 additional causes
            scenario?.recommendation || mechanicAdvice || 'פנה למוסך לאבחון מקצועי.',
            uiSeverity,
            showTowButton,
            instructionsShown
        )
    };
}

// =============================================================================
// SCENARIO FLOW HELPERS (scenarios.ts trees)
// =============================================================================

export function updateSuspectsAndReport(
    currentScores: Record<string, number>,
    option: StepOption,
    scenario: Scenario,
    reportData: DiagnosticState['reportData']
) {
    const newScores = { ...(currentScores || {}) };
    const newReport: DiagnosticState['reportData'] = {
        verified: [...(reportData?.verified || [])],
        ruledOut: [...(reportData?.ruledOut || [])],
        skipped: [...(reportData?.skipped || [])],
        criticalFindings: [...(reportData?.criticalFindings || [])]
    };

    const actions = Array.isArray(option?.actions) ? option.actions : [];
    for (const action of actions) {
        if (action.type === 'VERIFIES' && action.suspectId) {
            newScores[action.suspectId] = (newScores[action.suspectId] || 0) + (action.weight ?? 2);
            if (option.logText) newReport.verified.push(option.logText);
        }

        if (action.type === 'RULES_OUT' && action.suspectId) {
            newScores[action.suspectId] = (newScores[action.suspectId] || 0) - (action.weight ?? 2);
            if (option.logText) newReport.ruledOut.push(option.logText);
        }

        if ((action.type as any) === 'SKIPPED' || (action.type as any) === 'SKIP') {
            if (option.logText) newReport.skipped.push(option.logText);
        }

        if (action.type === 'INFO') {
            if (option.logText) newReport.verified.push(option.logText);
        }
    }

    if (option.stopAlert?.message) {
        newReport.criticalFindings.push(option.stopAlert.message);
    }

    return { newScores, newReport };
}

export function generateScenarioReport(scenario: Scenario, state: DiagnosticState) {
    const suspects = scenario?.suspects || [];
    const scores = state?.suspects || {};
    const reportData = state?.reportData || { verified: [], ruledOut: [], skipped: [], criticalFindings: [] };

    const ranked = suspects
        .map(s => ({ ...s, score: scores[s.id] || 0 }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const top = ranked[0] || null;
    const score = top?.score ?? 0;

    const hasCritical = (reportData.criticalFindings || []).length > 0;

    const severity: 'low' | 'high' = hasCritical || score >= 4 ? 'high' : 'low';

    const blindSpots = (reportData.skipped || []).filter(Boolean);

    const towConditions =
        hasCritical
            ? ['יש סכנה בטיחותית מיידית', 'הרכב לא בטוח לנסיעה']
            : severity === 'high'
                ? ['הרכב לא מניע / יש איבוד כוח משמעותי']
                : [];

    const status =
        hasCritical ? 'עצור ובצע בדיקה מקצועית / גרירה במידת הצורך' :
            severity === 'high' ? 'מומלץ לפנות למוסך בהקדם' :
                'מומלץ להמשיך בזהירות ולבדוק כשמתאפשר';

    const instruction =
        hasCritical ? 'אל תמשיך בנסיעה. עצור במקום בטוח ופנה לעזרה.' :
            severity === 'high' ? 'פנה למוסך בהקדם לאבחון מקצועי.' :
                'אם התופעה חוזרת או מחמירה – פנה למוסך.';

    return {
        topSuspect: top?.name || 'לא זוהה',
        score,
        severity,
        status,
        instruction,
        towConditions,
        blindSpots
    };
}

// =============================================================================
// CONVERSATION SUMMARY SYSTEM
// =============================================================================

/**
 * Conversation history item for tracking Q&A pairs
 */
export interface ConversationItem {
    questionId: string;
    questionText: string;
    userAnswer: string;
    timestamp?: number;
}

/**
 * Vehicle info for summary
 */
export interface VehicleInfo {
    make?: string;
    model?: string;
    year?: number;
    plate?: string;
}

/**
 * Full summary for mechanic - contains all conversation details
 */
export interface MechanicSummary {
    vehicleInfo: VehicleInfo;
    lightDetected: string;
    lightName: string;
    scenario: string;
    scenarioDescription: string;
    conversationLog: ConversationItem[];
    userActionsPerformed: string[];
    topDiagnosis: {
        issue: string;
        probability: number;
        reasoning: string;
    };
    additionalSuspects: Array<{ issue: string; probability: number }>;
    recommendation: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    needsTow: boolean;
    formattedText: string;  // Ready-to-display format
}

/**
 * Short summary for user display in diagnosis card
 */
export interface UserSummary {
    shortDescription: string;
    topIssue: string;
    nextAction: string;
}

/**
 * Combined summary result
 */
export interface ConversationSummaries {
    mechanic: MechanicSummary;
    user: UserSummary;
}

/**
 * Build conversation history from context answers
 */
export function buildConversationHistory(
    answers: UserAnswer[] | undefined,
    instructionsShown: string[] | undefined
): ConversationItem[] {
    if (!answers || !Array.isArray(answers)) return [];

    return answers
        .filter(a => a.question && a.answer)
        .map((a, idx) => ({
            questionId: `q_${idx}`,
            questionText: String(a.question),
            userAnswer: String(a.answer),
            timestamp: Date.now()
        }));
}

/**
 * Get light display name from ID
 */
function getLightDisplayName(lightType: string): string {
    const names: Record<string, string> = {
        'oil_pressure_light': 'נורת לחץ שמן',
        'coolant_temperature_light': 'נורת טמפרטורת מנוע',
        'check_engine_light': 'נורת בדוק מנוע',
        'battery_light': 'נורת מצבר',
        'brake_light': 'נורת בלמים',
        'tpms_light': 'נורת לחץ אוויר בצמיגים',
        'abs_light': 'נורת ABS',
        'airbag_light': 'נורת כרית אוויר'
    };
    return names[lightType] || lightType;
}

/**
 * Get scenario description from ID
 */
function getScenarioDescription(lightType: string, scenarioId: string): string {
    const lightData = (warningLightsKB as any)[lightType];
    const scenario = lightData?.scenarios?.[scenarioId];
    return scenario?.description || scenarioId;
}

/**
 * Generate formatted mechanic report text
 */
function formatMechanicReport(summary: Omit<MechanicSummary, 'formattedText'>): string {
    const lines: string[] = [];

    lines.push('📋 דוח אבחון');
    lines.push('═'.repeat(30));

    // Vehicle info
    if (summary.vehicleInfo.make || summary.vehicleInfo.model) {
        const vehicleStr = [
            summary.vehicleInfo.make,
            summary.vehicleInfo.model,
            summary.vehicleInfo.year
        ].filter(Boolean).join(' ');
        lines.push(`🚗 רכב: ${vehicleStr}${summary.vehicleInfo.plate ? ` (${summary.vehicleInfo.plate})` : ''}`);
    }

    // Light and scenario
    lines.push(`🔴 נורה: ${summary.lightName}`);
    lines.push(`📍 תרחיש: ${summary.scenarioDescription}`);
    lines.push('');

    // Conversation log
    lines.push('📝 מהלך השיחה:');
    for (const item of summary.conversationLog) {
        lines.push(`• ${item.userAnswer}`);
    }
    lines.push('');

    // User actions
    if (summary.userActionsPerformed.length > 0) {
        lines.push('✅ פעולות שביצע הלקוח:');
        for (const action of summary.userActionsPerformed) {
            lines.push(`• ${action}`);
        }
        lines.push('');
    }

    // Diagnosis
    const probPct = Math.round(summary.topDiagnosis.probability * 100);
    lines.push(`🔍 אבחון: ${summary.topDiagnosis.issue} (${probPct}%)`);
    if (summary.topDiagnosis.reasoning) {
        lines.push(`   ${summary.topDiagnosis.reasoning}`);
    }

    // Additional suspects
    if (summary.additionalSuspects.length > 0) {
        lines.push('');
        lines.push('🔎 אפשרויות נוספות:');
        for (const suspect of summary.additionalSuspects) {
            const pct = Math.round(suspect.probability * 100);
            lines.push(`• ${suspect.issue} (${pct}%)`);
        }
    }

    lines.push('');
    lines.push(`🛠️ המלצה: ${summary.recommendation}`);

    // Severity
    const severityLabels: Record<string, string> = {
        critical: '🔴 קריטית',
        high: '🟠 גבוהה',
        medium: '🟡 בינונית',
        low: '🟢 נמוכה'
    };
    lines.push(`⚠️ חומרה: ${severityLabels[summary.severity] || summary.severity}`);

    if (summary.needsTow) {
        lines.push('');
        lines.push('🚛 נדרש גרר - הרכב לא בטוח לנסיעה');
    }

    return lines.join('\n');
}

/**
 * Generate short user summary from conversation
 */
export function generateUserSummary(
    lightType: string,
    scenarioId: string,
    conversationLog: ConversationItem[],
    topIssue: string,
    recommendation: string
): UserSummary {
    const lightName = getLightDisplayName(lightType);

    // Build a natural sentence from the conversation
    const keyPoints: string[] = [];

    // First answer usually describes when/how it happened
    if (conversationLog.length > 0) {
        keyPoints.push(conversationLog[0].userAnswer);
    }

    // Look for user confirmations of actions
    for (const item of conversationLog) {
        const ans = item.userAnswer.toLowerCase();
        if (ans.includes('עצרתי') || ans.includes('כיביתי')) {
            keyPoints.push('עצרת וכיבית את המנוע');
            break;
        }
        if (ans.includes('בדקתי') || ans.includes('מדיד')) {
            keyPoints.push('בדקת את מדיד השמן');
            break;
        }
    }

    // Build description
    let shortDescription = `${lightName} נדלקה`;
    if (keyPoints.length > 0) {
        shortDescription += `. ${keyPoints.join('. ')}`;
    }
    if (topIssue) {
        shortDescription += `. נמצא: ${topIssue}.`;
    }

    return {
        shortDescription,
        topIssue: topIssue || 'דרוש אבחון מקצועי',
        nextAction: recommendation || 'פנה למוסך לבדיקה'
    };
}

/**
 * Generate full mechanic summary from conversation
 */
export function generateMechanicSummary(
    lightType: string,
    scenarioId: string,
    conversationLog: ConversationItem[],
    scores: Record<string, number>,
    vehicleInfo: VehicleInfo,
    topDiagnosis: { issue: string; probability: number; reasoning?: string },
    additionalSuspects: Array<{ issue: string; probability: number }>,
    recommendation: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    needsTow: boolean,
    instructionsShown?: string[]
): MechanicSummary {
    const lightName = getLightDisplayName(lightType);
    const scenarioDescription = getScenarioDescription(lightType, scenarioId);

    // Determine user actions from instructions shown
    const userActionsPerformed: string[] = [];
    if (instructionsShown?.includes('immediate_action')) {
        userActionsPerformed.push('עצר וכיבה את המנוע');
    }
    if (instructionsShown?.includes('check_dipstick_emergency') || instructionsShown?.includes('check_dipstick')) {
        userActionsPerformed.push('בדק מפלס שמן במדיד');
    }
    if (instructionsShown?.includes('visual_check_tires')) {
        userActionsPerformed.push('בדק צמיגים ויזואלית');
    }
    if (instructionsShown?.includes('fill_air')) {
        userActionsPerformed.push('מילא אוויר בצמיגים');
    }

    const baseSummary = {
        vehicleInfo,
        lightDetected: lightType,
        lightName,
        scenario: scenarioId,
        scenarioDescription,
        conversationLog,
        userActionsPerformed,
        topDiagnosis: {
            issue: topDiagnosis.issue,
            probability: topDiagnosis.probability,
            reasoning: topDiagnosis.reasoning || ''
        },
        additionalSuspects,
        recommendation,
        severity,
        needsTow
    };

    return {
        ...baseSummary,
        formattedText: formatMechanicReport(baseSummary)
    };
}

/**
 * Generate both summaries from diagnosis context
 */
export function generateConversationSummaries(
    lightType: string,
    scenarioId: string,
    answers: UserAnswer[] | undefined,
    scores: Record<string, number>,
    vehicleInfo: VehicleInfo,
    topCause: { id: string; name: string; score: number } | null,
    additionalCauses: Array<{ id: string; name: string; score: number }>,
    recommendation: string,
    severity: 'critical' | 'high' | 'medium' | 'low',
    needsTow: boolean,
    instructionsShown?: string[]
): ConversationSummaries {
    const conversationLog = buildConversationHistory(answers, instructionsShown);

    const topDiagnosis = topCause
        ? {
            issue: topCause.name,
            probability: Math.min(0.92, 0.55 + (topCause.score * 0.12)),
            reasoning: ''
        }
        : {
            issue: 'לא זוהתה סיבה חד-משמעית',
            probability: 0.4,
            reasoning: 'נדרש אבחון מקצועי'
        };

    const additionalSuspects = additionalCauses.map(c => ({
        issue: c.name,
        probability: Math.min(0.85, 0.45 + (c.score * 0.10))
    }));

    const mechanic = generateMechanicSummary(
        lightType,
        scenarioId,
        conversationLog,
        scores,
        vehicleInfo,
        topDiagnosis,
        additionalSuspects,
        recommendation,
        severity,
        needsTow,
        instructionsShown
    );

    const user = generateUserSummary(
        lightType,
        scenarioId,
        conversationLog,
        topCause?.name || '',
        recommendation
    );

    return { mechanic, user };
}
