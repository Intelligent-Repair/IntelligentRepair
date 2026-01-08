// lib/ai/diagnostic-utils.ts
// Pure helpers for KB and Scenario flows

import warningLightsKB from '@/lib/knowledge/warning-lights.json';
import type { UserAnswer } from './types';
import type { DiagnosticState, Scenario, StepOption } from '@/lib/types/knowledge';

export const CRITICAL_LIGHTS = ['oil_pressure_light', 'coolant_temperature_light', 'brake_light'] as const;
export type CriticalLightId = typeof CRITICAL_LIGHTS[number];

function isCriticalLight(x: string): x is CriticalLightId {
    return (CRITICAL_LIGHTS as readonly string[]).includes(x);
}

const DIAGNOSIS_THRESHOLD = 4;
const MIN_QUESTIONS_BEFORE_DIAGNOSIS = 4;
const MAX_QUESTIONS = { danger: 6, caution: 6 } as const;

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

// Match user answer to option by id or label
export function matchOption(questionOptions: unknown, userAnswer: string): { id?: string; label: string } | null {
    const ans = norm(userAnswer);
    const opts: KBOption[] = Array.isArray(questionOptions) ? questionOptions : [];
    if (opts.length === 0) return null;

    // Numeric index selection
    const idx = Number(ans);
    if (Number.isFinite(idx) && idx >= 1 && idx <= opts.length) {
        const opt = opts[idx - 1];
        return { id: optionId(opt) ?? undefined, label: optionLabel(opt) };
    }

    // Exact match by label
    for (const opt of opts) {
        const label = norm(optionLabel(opt));
        if (!label) continue;
        if (ans === label) return { id: optionId(opt) ?? undefined, label: optionLabel(opt) };
    }

    // Partial match
    for (const opt of opts) {
        const labelNorm = norm(optionLabel(opt));
        if (!labelNorm) continue;
        if (labelNorm.length >= 6 && ans.includes(labelNorm.slice(0, 6))) {
            return { id: optionId(opt) ?? undefined, label: optionLabel(opt) };
        }
        if (ans.includes(labelNorm)) {
            return { id: optionId(opt) ?? undefined, label: optionLabel(opt) };
        }
    }

    return null;
}

function mapPolarityFromMapping(mappingObj: any, answerRaw: string): { polarity: 'yes' | 'no' | 'unknown' | 'uncertain_probable'; source: string } | null {
    if (!mappingObj || typeof mappingObj !== 'object') return null;
    const a = norm(answerRaw);
    if (!a) return null;

    for (const [k, v] of Object.entries(mappingObj)) {
        const key = norm(k);
        if (!key) continue;
        if (a === key || a.startsWith(key + ' ')) {
            const val = String(v);
            if (val === 'confirms' || val === 'yes') return { polarity: 'yes', source: 'KB_answers' };
            if (val === 'rules_out' || val === 'no') return { polarity: 'no', source: 'KB_answers' };
            if (val === 'unknown') return { polarity: 'unknown', source: 'KB_answers' };
            if (val === 'uncertain_probable') return { polarity: 'uncertain_probable', source: 'KB_answers' };
            return null;
        }
    }
    return null;
}

function asScenarioSeverity(raw: unknown): 'critical' | 'high' | 'moderate' | 'low' {
    const s = norm(raw);
    if (s === 'critical') return 'critical';
    if (s === 'high') return 'high';
    if (s === 'low') return 'low';
    if (s === 'moderate' || s === 'medium' || s === 'caution') return 'moderate';
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
    if (['מהבהבת', 'רועד', 'מאבד', 'תקוע', 'יש', 'גבוה'].some(k => a.includes(k))) return 'yes';
    if (['אין', 'לא באמת', 'תקין'].some(k => a.includes(k))) return 'no';
    return 'unknown';
}

function mechanicAdviceText(goToMechanic: unknown, severity: 'critical' | 'high' | 'moderate' | 'low'): string | null {
    if (!goToMechanic) return null;
    if (typeof goToMechanic === 'string') return goToMechanic;
    if (typeof goToMechanic === 'object') {
        const obj = goToMechanic as any;
        if (severity === 'critical' && obj.immediately) return obj.immediately;
        if ((severity === 'high' || severity === 'critical') && obj.soon) return obj.soon;
        return obj.next_service || obj.soon || obj.immediately || null;
    }
    return null;
}

// Determine scenario by checking all answers against first_question and followup options
export function determineScenario(lightType: string, answers: UserAnswer[]): string | null {
    const lightData = (warningLightsKB as any)[lightType];
    if (!lightData?.scenarios) return null;

    const scenarios = lightData.scenarios as Record<string, any>;
    const firstQ = lightData.first_question;
    if (!firstQ?.options) return null;

    // Check each answer to find a scenario key match
    for (let i = answers.length - 1; i >= 0; i--) {
        const answerText = answers[i]?.answer ?? '';
        if (!answerText) continue;

        // Try matching against first_question options
        const firstMatch = matchOption(firstQ.options, answerText);
        if (firstMatch?.id && scenarios[firstMatch.id]) {
            return firstMatch.id;
        }

        // Try matching against followup options (for hierarchical flows like check_engine_light)
        const followups = firstQ.followups;
        if (followups && typeof followups === 'object') {
            for (const followupKey of Object.keys(followups)) {
                const followupQ = followups[followupKey];
                if (!followupQ?.options) continue;

                const followupMatch = matchOption(followupQ.options, answerText);
                if (followupMatch?.id && scenarios[followupMatch.id]) {
                    return followupMatch.id;
                }
            }
        }
    }

    return null;
}

// Update cause scores based on key_question.id match only
export function updateScores(scores: Record<string, number>, questionId: string, answer: string, lightType: string, scenarioId: string): Record<string, number> {
    const newScores = { ...scores };

    const scenario = (warningLightsKB as any)[lightType]?.scenarios?.[scenarioId];
    const causes: any[] = Array.isArray(scenario?.causes) ? scenario.causes : [];

    // Find cause by key_question.id match only
    const cause = causes.find(c => c?.key_question?.id === questionId);
    if (!cause) return newScores;

    const answersMapping = cause.key_question?.answers;
    const scoreMapping = cause.key_question?.score_mapping;

    let polarity: 'yes' | 'no' | 'unknown' | 'uncertain_probable' = 'unknown';

    const fromAnswers = mapPolarityFromMapping(answersMapping, answer);
    if (fromAnswers) {
        polarity = fromAnswers.polarity;
    } else if (scoreMapping && typeof scoreMapping === 'object') {
        const fromScoreMap = mapPolarityFromMapping(scoreMapping, answer);
        if (fromScoreMap) polarity = fromScoreMap.polarity;
        else polarity = answerPolarity(answer);
    } else {
        polarity = answerPolarity(answer);
    }

    const base = typeof cause.probability === 'number' ? cause.probability : 0.5;
    const delta = polarity === 'yes' ? 2.5 * (0.7 + base) : polarity === 'no' ? -1.0 * (0.5 + base) : polarity === 'uncertain_probable' ? 1.0 * base : 0;

    const oldScore = newScores[cause.id] || 0;
    newScores[cause.id] = oldScore + delta;

    return newScores;
}

// Decide if enough info to diagnose
export function shouldDiagnose(scores: Record<string, number>, count: number, severity: string): boolean {
    const values = Object.values(scores);
    const maxScore = Math.max(...values, 0);
    const positiveCount = values.filter(s => s > 0.25).length;
    const maxQ = severity === 'danger' ? MAX_QUESTIONS.danger : MAX_QUESTIONS.caution;

    if (count < MIN_QUESTIONS_BEFORE_DIAGNOSIS) return false;

    if (severity === 'danger') {
        if (maxScore >= DIAGNOSIS_THRESHOLD && positiveCount >= 2) return true;
        if (count >= maxQ) return true;
        return false;
    }

    return maxScore >= DIAGNOSIS_THRESHOLD || count >= maxQ;
}

export interface KBQuestion {
    id: string;
    text: string;
    options: string[];
    probability: number;
}

// Get next question to ask
export function getNextQuestion(lightType: string, scenarioId: string, askedIds: string[], lastAnswer: string): KBQuestion | null {
    const lightData = (warningLightsKB as any)[lightType];
    const scenario = lightData?.scenarios?.[scenarioId];
    if (!lightData || !scenario) return null;

    const firstQ = lightData.first_question;

    // New schema followups
    const followups = firstQ?.followups;
    if (followups && typeof followups === 'object') {
        const matched = matchOption(firstQ?.options, lastAnswer);
        const key = matched?.id;
        const fq = key ? followups[key] : null;
        if (fq?.id && !askedIds.includes(fq.id)) {
            return { id: fq.id, text: fq.text, options: optionsToLabels(fq.options), probability: 0.95 };
        }
    }

    // Legacy followups
    const a = norm(lastAnswer);
    if (a.includes('קבוע') && firstQ?.followup_for_steady && !askedIds.includes('followup_steady')) {
        const f = firstQ.followup_for_steady;
        return { id: 'followup_steady', text: f.text, options: optionsToLabels(f.options), probability: 0.95 };
    }
    if (a.includes('מהבהב') && firstQ?.followup_for_flashing && !askedIds.includes('followup_flashing')) {
        const f = firstQ.followup_for_flashing;
        return { id: 'followup_flashing', text: f.text, options: optionsToLabels(f.options), probability: 0.95 };
    }

    // Cause questions
    const causes: any[] = Array.isArray(scenario?.causes) ? scenario.causes : [];
    const questions: KBQuestion[] = [];
    for (const cause of causes) {
        if (!cause?.id || askedIds.includes(cause.id)) continue;
        const q = cause.key_question;
        if (!q?.text) continue;
        questions.push({ id: cause.id, text: q.text, options: optionsToLabels(q.options), probability: typeof cause.probability === 'number' ? cause.probability : 0.5 });
    }

    if (questions.length === 0) return null;
    return questions.sort((x, y) => y.probability - x.probability)[0];
}

export interface KBInstruction {
    id: string;
    name: string;
    actionType: 'safety' | 'inspect' | 'fill' | 'adjust';
    priority?: 'FIRST' | 'STANDARD' | 'ONLY_IF_SAFE' | 'AFTER_COOLDOWN';
    condition?: string;
    steps: string[];
    warning?: string;
    followup_question?: { text: string; options: any[]; resolution_paths?: Record<string, any> };
}

export type KBNextStep = { kind: 'instruction'; action: KBInstruction } | { kind: 'question'; question: KBQuestion } | null;

// Get next step in KB flow
export function getNextStep(lightType: string, scenarioId: string, askedIds: string[], shownInstructionIds: string[], lastAnswer: string): KBNextStep {
    const lightData = (warningLightsKB as any)[lightType];
    const scenario = lightData?.scenarios?.[scenarioId];
    if (!lightData || !scenario) return null;

    const selfFixActions: any[] = Array.isArray(scenario.self_fix_actions) ? scenario.self_fix_actions : [];

    // FIRST priority actions
    for (const action of selfFixActions) {
        if (!action?.id || shownInstructionIds.includes(action.id) || action.priority !== 'FIRST') continue;
        return {
            kind: 'instruction',
            action: { id: action.id, name: action.name || action.id, actionType: action.actionType || 'inspect', priority: action.priority, condition: action.condition, steps: Array.isArray(action.steps) ? action.steps : [], warning: action.warning, followup_question: action.followup_question }
        };
    }

    // Questions
    const nextQuestion = getNextQuestion(lightType, scenarioId, askedIds, lastAnswer);
    if (nextQuestion) return { kind: 'question', question: nextQuestion };

    // STANDARD priority actions
    for (const action of selfFixActions) {
        if (!action?.id || shownInstructionIds.includes(action.id)) continue;
        if (action.priority === 'FIRST' || action.priority === 'AFTER_COOLDOWN' || action.priority === 'ONLY_IF_SAFE') continue;
        return {
            kind: 'instruction',
            action: { id: action.id, name: action.name || action.id, actionType: action.actionType || 'inspect', priority: action.priority || 'STANDARD', condition: action.condition, steps: Array.isArray(action.steps) ? action.steps : [], warning: action.warning, followup_question: action.followup_question }
        };
    }

    return null;
}

export function checkImmediateAction(lightType: string, scenarioId: string): string | null {
    const scenario = (warningLightsKB as any)[lightType]?.scenarios?.[scenarioId];
    return scenario?.immediate_action || null;
}

function generateResultExplanation(topCause: any, hasPositiveEvidence: boolean, scoreValue: number, positiveAnswers: string[]): string {
    if (!hasPositiveEvidence) return 'אבחון על בסיס שלילת אפשרויות אחרות - מומלץ בדיקה מקצועית';
    if (scoreValue >= 2 && topCause?.symptoms?.length) {
        const relevant = (topCause.symptoms as string[]).filter(s => !s.includes('לא בדקתי') && !s.includes('לא זוכר'));
        if (relevant.length > 0) return relevant.join(' • ');
    }
    if (positiveAnswers?.length > 0) return positiveAnswers[0];
    return 'מבוסס על התשובות שסיפקת';
}

export interface VehicleInfo { make?: string; model?: string; year?: number; plate?: string; }

export function generateDiagnosis(lightType: string, scenarioId: string, scores: Record<string, number>, answers: UserAnswer[], vehicleInfo?: VehicleInfo, instructionsShown?: string[]) {
    const lightData = (warningLightsKB as any)[lightType];
    const scenario = lightData?.scenarios?.[scenarioId];
    const lightName = lightData?.names?.he?.[0] || lightType || 'נורת אזהרה';

    const causes: any[] = Array.isArray(scenario?.causes) ? scenario.causes : [];
    const ranked = causes.map(c => ({ ...c, score: scores?.[c.id] ?? 0 })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const topCause = ranked[0] ?? null;

    const scenarioSeverity = asScenarioSeverity(scenario?.severity);
    const isCritical = scenarioSeverity === 'critical' || isCriticalLight(lightType);
    const isHigh = scenarioSeverity === 'high' || (topCause?.score ?? 0) >= 4;
    const normalizedSeverity: 'critical' | 'high' | 'moderate' | 'low' = isCritical ? 'critical' : isHigh ? 'high' : scenarioSeverity;
    const uiSeverity = severityToUi(normalizedSeverity);

    const mechanicAdvice = mechanicAdviceText(scenario?.go_to_mechanic, normalizedSeverity);
    const towConditions: string[] = Array.isArray(scenario?.tow_conditions) ? scenario.tow_conditions : isCritical ? ['הנורה אדומה/מהבהבת או יש רעשים חריגים'] : [];
    const showTowButton = isCritical || uiSeverity === 'high';

    const statusInstruction = isCritical ? (scenario?.immediate_action || mechanicAdvice || 'עצור מיד ואל תמשיך בנסיעה!') : (mechanicAdvice || scenario?.recommendation || 'מומלץ לפנות למוסך לבדיקה מקצועית.');
    const statusText = isCritical ? 'נדרשת תשומת לב מיידית!' : uiSeverity === 'high' ? 'מומלץ לבדוק בהקדם.' : 'ניתן להמשיך בזהירות ולבדוק בהמשך.';

    const selfFix = (Array.isArray(scenario?.self_fix_actions) ? scenario.self_fix_actions : []).map((a: any) => ({ id: a.id, action: a.action, instruction: a.instruction, severity: a.severity, warning: a.warning, tools: a.tools, time_estimate: a.time_estimate, actionType: a.actionType || 'inspect' }));

    const positiveAnswers: string[] = (answers || []).filter(a => answerPolarity(a.answer || '') === 'yes').map(a => (a.question ? String(a.question).slice(0, 80) : null)).filter((x): x is string => x !== null);

    const hasPositiveEvidence = (topCause?.score ?? 0) > 0;
    const scoreValue = topCause?.score ?? 0;

    let baseConfidence: number, scoreBoost: number, confidenceLevel: string;
    if (!hasPositiveEvidence) {
        baseConfidence = 0.40; scoreBoost = 0; confidenceLevel = 'low';
    } else if (scoreValue < 1.0) {
        baseConfidence = 0.50; scoreBoost = scoreValue * 0.15; confidenceLevel = 'medium';
    } else {
        baseConfidence = isCritical ? 0.60 : 0.55; scoreBoost = Math.min(0.25, scoreValue * 0.12); confidenceLevel = scoreValue >= 1.5 ? 'high' : 'medium';
    }

    const answerBoost = hasPositiveEvidence ? Math.min(0.10, (answers?.length || 0) * 0.02) : Math.min(0.05, (answers?.length || 0) * 0.01);
    const totalConfidence = Math.min(0.92, baseConfidence + scoreBoost + answerBoost);

    const results = topCause ? [{ issue: topCause.name, probability: Math.min(0.92, hasPositiveEvidence ? (0.55 + scoreValue * 0.12) : 0.40), explanation: generateResultExplanation(topCause, hasPositiveEvidence, scoreValue, positiveAnswers) }] : [{ issue: 'לא זוהתה סיבה חד-משמעית', probability: 0.40, explanation: 'נדרש מידע נוסף או בדיקה מקצועית במוסך.' }];

    return {
        type: 'diagnosis_report',
        title: `אבחון: ${lightName}`,
        confidence: totalConfidence,
        confidenceLevel,
        summary: { detected: [lightName], reported: positiveAnswers.slice(0, 4) },
        results,
        status: { color: isCritical ? 'red' : uiSeverity === 'high' ? 'yellow' : 'blue', text: statusText, instruction: statusInstruction },
        selfFix,
        nextSteps: scenario?.recommendation || mechanicAdvice || 'פנה למוסך לאבחון מקצועי.',
        recommendations: [mechanicAdvice, towConditions[0] ? `הזמן גרר אם: ${towConditions[0]}` : null].filter(Boolean),
        disclaimer: hasPositiveEvidence ? 'האבחון מבוסס על תיאור בלבד ואינו מחליף בדיקה מקצועית במוסך.' : 'האבחון מבוסס על שלילת אפשרויות בלבד. מומלץ מאוד בדיקה מקצועית.',
        mechanicReport: { topSuspect: topCause?.name || 'לא זוהה', score: topCause?.score || 0, severity: uiSeverity, status: statusText, instruction: statusInstruction, towConditions, blindSpots: (answers || []).filter(a => norm(a.answer).includes('לא יודע') || norm(a.answer).includes('לא בטוח')).map(a => a.question) },
        towConditions,
        showTowButton,
        severity: uiSeverity,
        severity_norm: normalizedSeverity,
        conversationSummaries: generateConversationSummaries(lightType, scenarioId, answers, scores, vehicleInfo || {}, topCause, ranked.slice(1, 4), scenario?.recommendation || mechanicAdvice || 'פנה למוסך לאבחון מקצועי.', uiSeverity, showTowButton, instructionsShown)
    };
}

// Scenario flow helpers
export function updateSuspectsAndReport(currentScores: Record<string, number>, option: StepOption, scenario: Scenario, reportData: DiagnosticState['reportData']) {
    const newScores = { ...(currentScores || {}) };
    const newReport: DiagnosticState['reportData'] = {
        verified: [...(reportData?.verified || [])],
        ruledOut: [...(reportData?.ruledOut || [])],
        skipped: [...(reportData?.skipped || [])],
        criticalFindings: [...(reportData?.criticalFindings || [])]
    };

    const actions = Array.isArray(option?.actions) ? option.actions : [];
    for (const action of actions) {
        if (action.type === 'VERIFIES' && action.suspectId) { newScores[action.suspectId] = (newScores[action.suspectId] || 0) + (action.weight ?? 2); if (option.logText) newReport.verified.push(option.logText); }
        if (action.type === 'RULES_OUT' && action.suspectId) { newScores[action.suspectId] = (newScores[action.suspectId] || 0) - (action.weight ?? 2); if (option.logText) newReport.ruledOut.push(option.logText); }
        if ((action.type as any) === 'SKIPPED' || (action.type as any) === 'SKIP') { if (option.logText) newReport.skipped.push(option.logText); }
        if (action.type === 'INFO') { if (option.logText) newReport.verified.push(option.logText); }
    }

    if (option.stopAlert?.message) newReport.criticalFindings.push(option.stopAlert.message);

    return { newScores, newReport };
}

export function generateScenarioReport(scenario: Scenario, state: DiagnosticState) {
    const suspects = scenario?.suspects || [];
    const scores = state?.suspects || {};
    const reportData = state?.reportData || { verified: [], ruledOut: [], skipped: [], criticalFindings: [] };

    const ranked = suspects.map(s => ({ ...s, score: scores[s.id] || 0 })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const top = ranked[0] || null;
    const score = top?.score ?? 0;
    const hasCritical = (reportData.criticalFindings || []).length > 0;
    const severity: 'low' | 'high' = hasCritical || score >= 4 ? 'high' : 'low';
    const blindSpots = (reportData.skipped || []).filter(Boolean);
    const towConditions = hasCritical ? ['יש סכנה בטיחותית מיידית'] : severity === 'high' ? ['הרכב לא מניע'] : [];
    const status = hasCritical ? 'עצור ובצע בדיקה מקצועית' : severity === 'high' ? 'מומלץ לפנות למוסך בהקדם' : 'מומלץ להמשיך בזהירות';
    const instruction = hasCritical ? 'אל תמשיך בנסיעה. עצור במקום בטוח.' : severity === 'high' ? 'פנה למוסך בהקדם.' : 'אם התופעה חוזרת – פנה למוסך.';

    return { topSuspect: top?.name || 'לא זוהה', score, severity, status, instruction, towConditions, blindSpots };
}

// Conversation summary types
export interface ConversationItem { questionId: string; questionText: string; userAnswer: string; timestamp?: number; }
export interface MechanicSummary { vehicleInfo: VehicleInfo; lightDetected: string; lightName: string; scenario: string; scenarioDescription: string; conversationLog: ConversationItem[]; userActionsPerformed: string[]; topDiagnosis: { issue: string; probability: number; reasoning: string }; additionalSuspects: Array<{ issue: string; probability: number }>; recommendation: string; severity: 'critical' | 'high' | 'medium' | 'low'; needsTow: boolean; formattedText: string; }
export interface UserSummary { shortDescription: string; topIssue: string; nextAction: string; }
export interface ConversationSummaries { mechanic: MechanicSummary; user: UserSummary; }

export function buildConversationHistory(answers: UserAnswer[] | undefined, instructionsShown: string[] | undefined): ConversationItem[] {
    if (!answers || !Array.isArray(answers)) return [];
    return answers.filter(a => a.question && a.answer).map((a, idx) => ({ questionId: `q_${idx}`, questionText: String(a.question), userAnswer: String(a.answer), timestamp: Date.now() }));
}

function getLightDisplayName(lightType: string): string {
    const names: Record<string, string> = { 'oil_pressure_light': 'נורת לחץ שמן', 'coolant_temperature_light': 'נורת טמפרטורת מנוע', 'check_engine_light': 'נורת בדוק מנוע', 'battery_light': 'נורת מצבר', 'brake_light': 'נורת בלמים', 'tpms_light': 'נורת לחץ אוויר בצמיגים', 'abs_light': 'נורת ABS', 'airbag_light': 'נורת כרית אוויר' };
    return names[lightType] || lightType;
}

function getScenarioDescription(lightType: string, scenarioId: string): string {
    const lightData = (warningLightsKB as any)[lightType];
    return lightData?.scenarios?.[scenarioId]?.description || scenarioId;
}

function formatMechanicReport(summary: Omit<MechanicSummary, 'formattedText'>): string {
    const lines: string[] = ['📋 דוח אבחון', '═'.repeat(30)];
    if (summary.vehicleInfo.make || summary.vehicleInfo.model) {
        const vehicleStr = [summary.vehicleInfo.make, summary.vehicleInfo.model, summary.vehicleInfo.year].filter(Boolean).join(' ');
        lines.push(`🚗 רכב: ${vehicleStr}${summary.vehicleInfo.plate ? ` (${summary.vehicleInfo.plate})` : ''}`);
    }
    lines.push(`🔴 נורה: ${summary.lightName}`, `📍 תרחיש: ${summary.scenarioDescription}`, '', '📝 מהלך השיחה:');
    for (const item of summary.conversationLog) lines.push(`• ${item.userAnswer}`);
    lines.push('');
    if (summary.userActionsPerformed.length > 0) { lines.push('✅ פעולות שביצע הלקוח:'); for (const action of summary.userActionsPerformed) lines.push(`• ${action}`); lines.push(''); }
    lines.push(`🔍 אבחון: ${summary.topDiagnosis.issue} (${Math.round(summary.topDiagnosis.probability * 100)}%)`);
    if (summary.topDiagnosis.reasoning) lines.push(`   ${summary.topDiagnosis.reasoning}`);
    if (summary.additionalSuspects.length > 0) { lines.push('', '🔎 אפשרויות נוספות:'); for (const s of summary.additionalSuspects) lines.push(`• ${s.issue} (${Math.round(s.probability * 100)}%)`); }
    lines.push('', `🛠️ המלצה: ${summary.recommendation}`);
    const severityLabels: Record<string, string> = { critical: '🔴 קריטית', high: '🟠 גבוהה', medium: '🟡 בינונית', low: '🟢 נמוכה' };
    lines.push(`⚠️ חומרה: ${severityLabels[summary.severity] || summary.severity}`);
    if (summary.needsTow) lines.push('', '🚛 נדרש גרר');
    return lines.join('\n');
}

export function generateUserSummary(lightType: string, scenarioId: string, conversationLog: ConversationItem[], topIssue: string, recommendation: string): UserSummary {
    const lightName = getLightDisplayName(lightType);
    const keyPoints: string[] = [];
    if (conversationLog.length > 0) keyPoints.push(conversationLog[0].userAnswer);
    for (const item of conversationLog) {
        const ans = item.userAnswer.toLowerCase();
        if (ans.includes('עצרתי') || ans.includes('כיביתי')) { keyPoints.push('עצרת וכיבית את המנוע'); break; }
        if (ans.includes('בדקתי') || ans.includes('מדיד')) { keyPoints.push('בדקת את מדיד השמן'); break; }
    }
    let shortDescription = `${lightName} נדלקה`;
    if (keyPoints.length > 0) shortDescription += `. ${keyPoints.join('. ')}`;
    if (topIssue) shortDescription += `. נמצא: ${topIssue}.`;
    return { shortDescription, topIssue: topIssue || 'דרוש אבחון מקצועי', nextAction: recommendation || 'פנה למוסך לבדיקה' };
}

export function generateMechanicSummary(lightType: string, scenarioId: string, conversationLog: ConversationItem[], scores: Record<string, number>, vehicleInfo: VehicleInfo, topDiagnosis: { issue: string; probability: number; reasoning?: string }, additionalSuspects: Array<{ issue: string; probability: number }>, recommendation: string, severity: 'critical' | 'high' | 'medium' | 'low', needsTow: boolean, instructionsShown?: string[]): MechanicSummary {
    const lightName = getLightDisplayName(lightType);
    const scenarioDescription = getScenarioDescription(lightType, scenarioId);
    const userActionsPerformed: string[] = [];
    if (instructionsShown?.includes('immediate_action')) userActionsPerformed.push('עצר וכיבה את המנוע');
    if (instructionsShown?.includes('check_dipstick_emergency') || instructionsShown?.includes('check_dipstick')) userActionsPerformed.push('בדק מפלס שמן במדיד');
    if (instructionsShown?.includes('visual_check_tires')) userActionsPerformed.push('בדק צמיגים ויזואלית');
    if (instructionsShown?.includes('fill_air')) userActionsPerformed.push('מילא אוויר בצמיגים');
    const baseSummary = { vehicleInfo, lightDetected: lightType, lightName, scenario: scenarioId, scenarioDescription, conversationLog, userActionsPerformed, topDiagnosis: { issue: topDiagnosis.issue, probability: topDiagnosis.probability, reasoning: topDiagnosis.reasoning || '' }, additionalSuspects, recommendation, severity, needsTow };
    return { ...baseSummary, formattedText: formatMechanicReport(baseSummary) };
}

export function generateConversationSummaries(lightType: string, scenarioId: string, answers: UserAnswer[] | undefined, scores: Record<string, number>, vehicleInfo: VehicleInfo, topCause: { id: string; name: string; score: number } | null, additionalCauses: Array<{ id: string; name: string; score: number }>, recommendation: string, severity: 'critical' | 'high' | 'medium' | 'low', needsTow: boolean, instructionsShown?: string[]): ConversationSummaries {
    const conversationLog = buildConversationHistory(answers, instructionsShown);
    const topDiagnosis = topCause ? { issue: topCause.name, probability: Math.min(0.92, 0.55 + (topCause.score * 0.12)), reasoning: '' } : { issue: 'לא זוהתה סיבה חד-משמעית', probability: 0.4, reasoning: 'נדרש אבחון מקצועי' };
    const additionalSuspects = additionalCauses.map(c => ({ issue: c.name, probability: Math.min(0.85, 0.45 + (c.score * 0.10)) }));
    const mechanic = generateMechanicSummary(lightType, scenarioId, conversationLog, scores, vehicleInfo, topDiagnosis, additionalSuspects, recommendation, severity, needsTow, instructionsShown);
    const user = generateUserSummary(lightType, scenarioId, conversationLog, topCause?.name || '', recommendation);
    return { mechanic, user };
}
