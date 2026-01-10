// lib/ai/flow-handlers.ts
import { NextResponse } from 'next/server';
import { createOpenAIClient } from '@/lib/ai/client';
import { fetchImageAsInlineData } from '@/lib/ai/image-utils';
import { extractJSON } from '@/lib/ai/json-utils';
import { buildChatPrompt, buildGeneralExpertPrompt } from '@/lib/ai/prompt-builder';
import type { UserAnswer } from '@/lib/ai/types';
import warningLightsKB from '@/lib/knowledge/warning-lights.json';
import type { DiagnosticState, Scenario, StepOption, SafetyRule } from '@/lib/types/knowledge';
import {
    CRITICAL_LIGHTS,
    determineScenario,
    updateScores,
    shouldDiagnose,
    getNextQuestion,
    getNextStep,
    checkImmediateAction,
    updateSuspectsAndReport,
    generateScenarioReport,
    matchOption
} from '@/lib/ai/diagnostic-utils';
// Note: hybrid-diagnosis.ts is deprecated - all lights now use unified-diagnosis-v2.ts
import { generateUnifiedDiagnosis } from '@/lib/ai/unified-diagnosis-v2';
import type { KBNextStep, KBInstruction } from '@/lib/ai/diagnostic-utils';

export interface FlowResult {
    response: any;
    handled: boolean;
}

export interface RequestContext {
    body: any;
    userText: string;
    answers: UserAnswer[];
    context?: DiagnosticState;
    hasImage: boolean;
}

// Safe merge: don't overwrite with null/undefined, union arrays
const mergeContext = (base: any, patch: any) => {
    const out: any = { ...(base ?? {}) };
    if (!patch) return out;
    for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null) continue;
        if (Array.isArray(v) && Array.isArray(out[k])) out[k] = Array.from(new Set([...out[k], ...v]));
        else out[k] = v;
    }
    return out;
};

// Deterministic option selection: number input or exact match only
function normalizeSelection(userText: string, options: string[]): { selected: string | null } {
    const t = (userText ?? '').trim();
    if (!t) return { selected: null };
    const n = Number(t);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return { selected: options[n - 1] };
    if (options.includes(t)) return { selected: t };
    return { selected: null };
}

// Build light picker for bridge mode
function buildLightPickerOptions(): string[] {
    const entries = Object.entries(warningLightsKB as any);
    const weight = (sev: string) => sev === 'critical' ? 0 : sev === 'high' ? 1 : sev === 'moderate' ? 2 : 3;
    return entries
        .sort((a, b) => weight(String((a[1] as any)?.severity)) - weight(String((b[1] as any)?.severity)))
        .slice(0, 10)
        .map(([id, data]) => `${(data as any)?.names?.he?.[0] ?? id} (${id})`)
        .concat(['נורה אחרת / לא בטוח - אתאר במילים']);
}

function extractLightIdFromPicker(text: string): string | null {
    const m = String(text || '').match(/\(([\w_]+)\)/);
    return m?.[1] ?? null;
}

// Detects if user selected a "resolved" option or wrote success phrase
function isResolvedOption(optionText: string): boolean {
    if (!optionText) return false;
    const lower = optionText.toLowerCase();
    const patterns = ['✅', 'הנורה כבתה', 'נפתר', 'הכל תקין', 'נסתדר', 'resolved', 'success', 'fixed'];
    return patterns.some(p => lower.includes(p) || optionText.includes(p));
}

// Detects free-text success/completion phrases
function isSuccessPhrase(text: string): boolean {
    if (!text) return false;
    const successPhrases = [
        'הצלחתי', 'ביצעתי', 'עשיתי', 'סיימתי', 'בוצע',
        'תיקנתי', 'מילאתי', 'כבתה', 'נכבתה', 'תקין עכשיו',
        'הכל בסדר', 'עובד', 'נפתר', 'סידרתי', 'המשכתי'
    ];
    return successPhrases.some(phrase => text.includes(phrase));
}

function getResolvedIssueDescription(lightType: string, context: any): string {
    const names: Record<string, string> = {
        'tpms_light': 'לחץ אוויר נמוך בצמיגים',
        'battery_light': 'מצבר חלש/מפורק',
        'brake_light': 'בלם יד היה משוך',
        'coolant_temperature_light': 'התחממות זמנית',
        'check_engine_light': 'מכסה דלק לא היה סגור',
        'oil_pressure_light': 'מפלס שמן נמוך'
    }
    return names[lightType] || 'הבעיה נפתרה';
}

// Apply initial score boost for specific scenarios
function applyScenarioBoost(lightType: string, scenarioId: string, scores: Record<string, number>): Record<string, number> {
    const newScores = { ...scores };
    const boosts: Record<string, Record<string, Record<string, number>>> = {
        'tpms_light': { 'steady_pulling': { 'low_tire_puncture': 1.5 }, 'steady': { 'temperature_change': 1.0 } },
        'brake_light': { 'from_parking': { 'handbrake_engaged': 1.0 } }
    };
    const lightBoosts = boosts[lightType]?.[scenarioId];
    if (!lightBoosts) return newScores;
    for (const [causeId, boost] of Object.entries(lightBoosts)) {
        newScores[causeId] = (newScores[causeId] || 0) + boost;
    }
    return newScores;
}

// Build conversation narrative from context for mechanic summary
function buildConversationNarrative(lightType: string, context: any, diagnosisText: string): string {
    const lightName = (warningLightsKB as any)[lightType]?.names?.he?.[0] || lightType;
    const parts: string[] = [];

    // Start with what was reported
    parts.push(`הלקוח דיווח על ${lightName}.`);

    // Add scenario info if available
    if (context.currentLightScenario) {
        const scenarioLabels: Record<string, string> = {
            'wont_start': 'הרכב לא מניע',
            'steady': 'הנורה דולקת קבוע',
            'flashing': 'הנורה מהבהבת',
            'intermittent': 'הנורה דולקת לסירוגין',
            'after_refuel': 'לאחר תדלוק',
            'during_drive': 'במהלך נסיעה',
            'from_parking': 'מחניה'
        };
        const scenario = scenarioLabels[context.currentLightScenario];
        if (scenario) parts.push(`מצב שדווח: ${scenario}.`);
    }

    // Add shown instructions (what checks were performed)
    if (context.shownInstructionIds?.length > 0) {
        const instructionNames: Record<string, string> = {
            'check_terminals': 'בדיקת קטבי מצבר',
            'jump_start': 'התנעה עם כבלים',
            'check_gas_cap': 'בדיקת מכסה דלק',
            'check_oil_level': 'בדיקת מפלס שמן',
            'check_coolant': 'בדיקת נוזל קירור',
            'check_tire_pressure': 'בדיקת לחץ אוויר'
        };
        const checks = context.shownInstructionIds
            .map((id: string) => instructionNames[id] || id)
            .join(', ');
        parts.push(`בדיקות שבוצעו: ${checks}.`);
    }

    // Add Q&A history from answeredQuestions if available
    if (context.answeredQuestions?.length > 0) {
        const qaStrings = context.answeredQuestions
            .map((qa: any) => `נשאל "${qa.question}" - השיב "${qa.answer}"`)
            .slice(-3) // Last 3 questions
            .join('. ');
        parts.push(qaStrings + '.');
    } else if (context.askedQuestionIds?.length > 0) {
        // Fallback to just showing what was asked
        parts.push(`נשאלו ${context.askedQuestionIds.length} שאלות.`);
    }

    // Add last question and answer if available
    if (context.currentQuestionText && context.lastUserAnswer) {
        parts.push(`שאלה אחרונה: "${context.currentQuestionText}" - תשובה: "${context.lastUserAnswer}".`);
    }

    // Add diagnosis result
    parts.push(`אבחון: ${diagnosisText}.`);

    return parts.join(' ');
}

interface ResolutionPath {
    status: 'resolved' | 'resolved_temp' | 'needs_more_info' | 'needs_mechanic' | 'needs_tow' | 'pending' | 'wait_and_verify' | 'needs_attention' | 'needs_verification' | 'needs_mechanic_urgent' | 'needs_inspection' | 'critical' | 'continue_diagnosis';
    diagnosis?: string;
    recommendation?: string;
    message?: string;
    next_steps?: string[];
    next_question?: any;
    route_to_scenario?: string;
    next_action?: string;
    if_returns?: string;
}

// Look up resolution_paths from KB by optionId only (no label fallback)
function lookupResolutionPath(lightType: string, scenarioId: string, actionId: string | undefined, selectedOptionIdOrLabel: string): ResolutionPath | null {
    try {
        const lightData = (warningLightsKB as any)[lightType];
        if (!lightData?.scenarios?.[scenarioId]) return null;
        const scenario = lightData.scenarios[scenarioId];
        const selfFixActions = scenario.self_fix_actions || [];

        for (const action of selfFixActions) {
            const followup = action.followup_question;
            if (!followup?.resolution_paths) continue;
            const resolutionPaths = followup.resolution_paths;

            // Try by option ID directly
            if (resolutionPaths[selectedOptionIdOrLabel]) {
                return resolutionPaths[selectedOptionIdOrLabel];
            }

            // Try to find by matching option label to ID
            const options = followup.options || [];
            for (const opt of options) {
                if (typeof opt === 'object' && opt.label === selectedOptionIdOrLabel && resolutionPaths[opt.id]) {
                    return resolutionPaths[opt.id];
                }
            }
        }
        return null;
    } catch (err) {
        console.error('[KBFlow] Error looking up resolution_path:', err);
        return null;
    }
}

// Process a resolution_path and return appropriate response
function handleResolutionPath(resolution: ResolutionPath, lightType: string, scenarioId: string, context: any, updatedScores: any): FlowResult | null {
    const mergedContext = mergeContext(context, {
        currentLightScenario: scenarioId,
        causeScores: updatedScores,
        pendingResolutionPaths: null,
        awaitingInstructionResult: false
    });

    // CONTINUE_DIAGNOSIS - proceed to next KB question (used for check_engine after immediate action)
    if (resolution.status === 'continue_diagnosis') {
        // Return null to let KB flow continue to next question
        return null;
    }

    // RESOLVED
    if (resolution.status === 'resolved' || resolution.status === 'resolved_temp') {
        const resolvedDescription = resolution.diagnosis || getResolvedIssueDescription(lightType, context);
        const lightName = (warningLightsKB as any)[lightType]?.names?.he?.[0] || lightType;
        return {
            handled: true,
            response: NextResponse.json({
                type: 'diagnosis_report',
                title: resolution.diagnosis || 'נפתר',
                severity: 'low',
                confidence: 0.8,
                results: [{ issue: resolvedDescription, probability: 0.8, explanation: resolution.recommendation || 'הבעיה נפתרה' }],
                status: { color: 'green', text: resolution.status === 'resolved_temp' ? 'נפתר זמנית' : 'הבעיה נפתרה', instruction: resolution.recommendation || 'ניתן להמשיך כרגיל' },
                recommendations: [resolution.recommendation, resolution.if_returns].filter(Boolean),
                endConversation: true,
                // Include conversationSummaries for garage dashboard
                conversationSummaries: {
                    mechanic: {
                        schemaVersion: 2,
                        vehicleType: context.vehicleInfo ? `${context.vehicleInfo.manufacturer || ''} ${context.vehicleInfo.model || ''} ${context.vehicleInfo.year || ''}`.trim() : 'לא ידוע',
                        originalComplaint: `נורת ${lightName}`,
                        conversationNarrative: buildConversationNarrative(lightType, context, resolvedDescription),
                        diagnoses: [{ issue: resolvedDescription, probability: 0.8 }],
                        recommendations: [resolution.recommendation, resolution.if_returns].filter(Boolean) as string[],
                        needsTow: false,
                        urgency: 'low' as const,
                        category: lightName
                    },
                    user: {
                        shortDescription: resolvedDescription,
                        topIssue: resolvedDescription,
                        nextAction: resolution.recommendation || 'ניתן להמשיך כרגיל'
                    }
                },
                context: mergedContext
            })
        };
    }

    // NEEDS_MORE_INFO
    if (resolution.status === 'needs_more_info') {
        if (resolution.next_action) {
            const lightData = (warningLightsKB as any)[lightType];
            const scenario = lightData?.scenarios?.[scenarioId];
            const nextAction = (scenario?.self_fix_actions || []).find((a: any) => a.id === resolution.next_action);
            if (nextAction) {
                const followupLabels = (nextAction.followup_question?.options || []).map((opt: any) => typeof opt === 'string' ? opt : opt?.label || '').filter(Boolean);
                return {
                    handled: true,
                    response: NextResponse.json({
                        type: 'instruction',
                        title: nextAction.name || resolution.message || 'צעד הבא',
                        actionType: nextAction.actionType || 'inspect',
                        steps: nextAction.steps || [],
                        warning: nextAction.warning,
                        question: nextAction.followup_question?.text,
                        options: followupLabels.length > 0 ? followupLabels : undefined,
                        detectedLightType: lightType,
                        kbSource: true,
                        context: mergeContext(mergedContext, {
                            shownInstructionIds: [nextAction.id],
                            lastInstructionId: nextAction.id,
                            awaitingInstructionResult: true,
                            currentQuestionId: nextAction.id,
                            currentQuestionText: nextAction.followup_question?.text,
                            currentQuestionOptions: followupLabels,
                            pendingResolutionPaths: nextAction.followup_question?.resolution_paths
                        })
                    })
                };
            }
        }
        if (resolution.next_steps?.length) {
            return { handled: true, response: NextResponse.json({ type: 'instruction', title: 'צעדים נוספים', steps: resolution.next_steps, text: resolution.next_steps.join('\n'), detectedLightType: lightType, kbSource: true, context: mergedContext }) };
        }
        if (resolution.message) {
            return { handled: true, response: NextResponse.json({ type: 'question', text: resolution.message, options: ['הבנתי, אמשיך', 'לא יכול לבצע'], detectedLightType: lightType, kbSource: true, context: mergedContext }) };
        }
    }

    // NEEDS_MECHANIC / NEEDS_TOW
    if (resolution.status === 'needs_mechanic' || resolution.status === 'needs_mechanic_urgent' || resolution.status === 'needs_tow') {
        const severity = resolution.status === 'needs_tow' ? 'critical' : 'high';
        const urgency = resolution.status === 'needs_tow' ? 'critical' as const : 'high' as const;
        const diagnosisText = resolution.diagnosis || 'נדרשת בדיקה במוסך';
        const lightName = (warningLightsKB as any)[lightType]?.names?.he?.[0] || lightType;
        return {
            handled: true,
            response: NextResponse.json({
                type: 'diagnosis_report',
                title: resolution.diagnosis || 'נדרש טיפול מקצועי',
                severity,
                confidence: 0.7,
                results: [{ issue: diagnosisText, probability: 0.7, explanation: resolution.recommendation || '' }],
                status: { color: resolution.status === 'needs_tow' ? 'red' : 'orange', text: resolution.status === 'needs_tow' ? 'הזמן גרר' : 'פנה למוסך', instruction: resolution.recommendation || 'יש לפנות למוסך בהקדם' },
                recommendations: [resolution.recommendation].filter(Boolean),
                endConversation: true,
                showTowButton: resolution.status === 'needs_tow',
                // Include conversationSummaries for garage dashboard
                conversationSummaries: {
                    mechanic: {
                        schemaVersion: 2,
                        vehicleType: context.vehicleInfo ? `${context.vehicleInfo.manufacturer || ''} ${context.vehicleInfo.model || ''} ${context.vehicleInfo.year || ''}`.trim() : 'לא ידוע',
                        originalComplaint: `נורת ${lightName}`,
                        conversationNarrative: buildConversationNarrative(lightType, context, diagnosisText),
                        diagnoses: [{ issue: diagnosisText, probability: 0.7 }],
                        recommendations: [resolution.recommendation].filter(Boolean) as string[],
                        needsTow: resolution.status === 'needs_tow',
                        urgency,
                        category: lightName
                    },
                    user: {
                        shortDescription: diagnosisText,
                        topIssue: diagnosisText,
                        nextAction: resolution.recommendation || 'יש לפנות למוסך בהקדם'
                    }
                },
                context: mergedContext
            })
        };
    }

    // PENDING / WAIT_AND_VERIFY
    if (resolution.status === 'pending' || resolution.status === 'wait_and_verify') {
        if (resolution.next_action) {
            const lightData = (warningLightsKB as any)[lightType];
            const scenario = lightData?.scenarios?.[scenarioId];
            const nextAction = (scenario?.self_fix_actions || []).find((a: any) => a.id === resolution.next_action);
            if (nextAction) {
                const followupLabels = (nextAction.followup_question?.options || []).map((opt: any) => typeof opt === 'string' ? opt : opt?.label || '').filter(Boolean);
                return {
                    handled: true,
                    response: NextResponse.json({
                        type: 'instruction',
                        title: nextAction.name || 'המתן ובדוק',
                        actionType: nextAction.actionType || 'inspect',
                        steps: nextAction.steps || [],
                        warning: nextAction.warning,
                        question: nextAction.followup_question?.text,
                        options: followupLabels.length > 0 ? followupLabels : undefined,
                        detectedLightType: lightType,
                        kbSource: true,
                        context: mergeContext(mergedContext, {
                            shownInstructionIds: [nextAction.id],
                            lastInstructionId: nextAction.id,
                            awaitingInstructionResult: true,
                            currentQuestionId: nextAction.id,
                            currentQuestionText: nextAction.followup_question?.text,
                            currentQuestionOptions: followupLabels,
                            pendingResolutionPaths: nextAction.followup_question?.resolution_paths
                        })
                    })
                };
            }
        }
        return { handled: true, response: NextResponse.json({ type: 'instruction', title: resolution.status === 'wait_and_verify' ? 'המתן ובדוק' : 'המשך', text: resolution.message || 'המשך לפי ההוראות', steps: resolution.next_steps || [resolution.message].filter(Boolean), detectedLightType: lightType, kbSource: true, context: mergedContext }) };
    }

    // NEEDS_VERIFICATION
    if (resolution.status === 'needs_verification') {
        if (resolution.next_action) {
            const lightData = (warningLightsKB as any)[lightType];
            const scenario = lightData?.scenarios?.[scenarioId];
            const nextAction = (scenario?.self_fix_actions || []).find((a: any) => a.id === resolution.next_action);
            if (nextAction) {
                const followupLabels = (nextAction.followup_question?.options || []).map((opt: any) => typeof opt === 'string' ? opt : opt?.label || '').filter(Boolean);
                return {
                    handled: true,
                    response: NextResponse.json({
                        type: 'instruction',
                        title: nextAction.name || 'בדיקה',
                        actionType: nextAction.actionType || 'inspect',
                        steps: nextAction.steps || [],
                        question: nextAction.followup_question?.text,
                        options: followupLabels.length > 0 ? followupLabels : undefined,
                        detectedLightType: lightType,
                        kbSource: true,
                        context: mergeContext(mergedContext, {
                            shownInstructionIds: [nextAction.id],
                            lastInstructionId: nextAction.id,
                            awaitingInstructionResult: true,
                            currentQuestionId: nextAction.id,
                            currentQuestionText: nextAction.followup_question?.text,
                            currentQuestionOptions: followupLabels,
                            pendingResolutionPaths: nextAction.followup_question?.resolution_paths
                        })
                    })
                };
            }
        }
        if (resolution.next_question) {
            const nextQ = resolution.next_question;
            const optionLabels = (nextQ.options || []).map((o: any) => typeof o === 'object' ? o.label : o);
            return {
                handled: true,
                response: NextResponse.json({
                    type: 'question',
                    text: nextQ.text,
                    options: optionLabels,
                    detectedLightType: lightType,
                    lightSeverity: context.lightSeverity || 'caution',
                    kbSource: true,
                    context: mergeContext(mergedContext, {
                        currentQuestionText: nextQ.text,
                        currentQuestionOptions: optionLabels,
                        pendingResolutionPaths: nextQ.resolution_paths
                    })
                })
            };
        }
    }

    return null;
}

// KB FLOW (Warning lights)
// All lights now use unified AI diagnosis (hybrid-diagnosis.ts deprecated)

export async function handleKBFlow(req: RequestContext): Promise<FlowResult> {
    const { userText, answers, context } = req;
    if (!context?.detectedLightType || context.detectedLightType === 'unidentified_light') {
        return { response: null, handled: false };
    }

    const lightType = context.detectedLightType;
    const uiSeverity = context.lightSeverity || 'caution';

    // 🚨 SAFETY CHECK: Detect critical safety phrases mid-conversation
    // This catches cases like user mentioning "עשן מהמנוע" while in KB flow
    const { analyzeSafetyOnly } = await import('@/lib/ai/context-analyzer');
    const safetyRule = analyzeSafetyOnly(userText);
    if (safetyRule) {
        console.log(`[KBFlow] 🚨 Safety rule triggered mid-conversation: ${safetyRule.id}`);
        return {
            handled: true,
            response: handleSafetyStop(safetyRule)
        };
    }

    console.log(`[KBFlow] Light: ${lightType} | Scenario: ${context.currentLightScenario || 'detecting'} | Answer: "${userText}"`);

    // Deterministic option mapping (no AI)
    let effectiveText = userText;
    const currentOptions = (context as any).currentQuestionOptions as string[] | undefined;

    if (currentOptions?.length && userText && !currentOptions.includes(userText.trim())) {
        const { selected } = normalizeSelection(userText, currentOptions);
        if (selected) {
            effectiveText = selected;
        } else if (isSuccessPhrase(userText) || isResolvedOption(userText)) {
            // User wrote success phrase like "הצלחתי לבצע" - treat as resolved/completed
            console.log(`[KBFlow] Success phrase detected: "${userText}" - treating as completion`);
            // Find a positive/success option if available, otherwise proceed to diagnosis
            const positiveOption = currentOptions.find(opt =>
                opt.includes('הצלחתי') || opt.includes('כבתה') || opt.includes('תקין') ||
                opt.includes('בוצע') || opt.includes('סיימתי') || isResolvedOption(opt)
            );
            if (positiveOption) {
                effectiveText = positiveOption;
            } else {
                // No matching option - generate resolved diagnosis
                const lightName = (warningLightsKB as any)[lightType]?.names?.he?.[0] || lightType;
                return {
                    handled: true,
                    response: NextResponse.json({
                        type: 'diagnosis_report',
                        title: `נורת ${lightName}`,
                        confidence: 0.8,
                        confidenceLevel: 'high',
                        results: [{ issue: 'ביצעת את ההוראות בהצלחה', probability: 0.9, explanation: 'הבעיה ככל הנראה נפתרה' }],
                        status: { color: 'green', text: 'נפתר!', instruction: 'אם הנורה נשארת דולקת אחרי נסיעה קצרה, פנה למוסך.' },
                        selfFix: [],
                        nextSteps: 'עקוב אחר הנורה בנסיעות הבאות',
                        recommendations: ['בדוק שהנורה אכן כבתה', 'אם הנורה חוזרת - פנה למוסך'],
                        endConversation: true,
                        // Include conversationSummaries for garage dashboard
                        conversationSummaries: {
                            mechanic: {
                                schemaVersion: 2,
                                vehicleType: (context as any).vehicleInfo ? `${(context as any).vehicleInfo?.manufacturer || (context as any).vehicleInfo?.make || ''} ${(context as any).vehicleInfo?.model || ''} ${(context as any).vehicleInfo?.year || ''}`.trim() : 'לא ידוע',
                                originalComplaint: `נורת ${lightName}`,
                                conversationNarrative: buildConversationNarrative(lightType, context, 'הבעיה נפתרה'),
                                diagnoses: [{ issue: 'הבעיה נפתרה', probability: 0.9 }],
                                recommendations: ['בדוק שהנורה אכן כבתה', 'אם הנורה חוזרת - פנה למוסך'],
                                needsTow: false,
                                urgency: 'low' as const,
                                category: lightName
                            },
                            user: {
                                shortDescription: 'הבעיה נפתרה בהצלחה',
                                topIssue: 'הבעיה נפתרה',
                                nextAction: 'עקוב אחר הנורה בנסיעות הבאות'
                            }
                        },
                        context: mergeContext(context, { resolved: true })
                    })
                };
            }
        } else {
            return {
                handled: true,
                response: NextResponse.json({
                    type: 'question',
                    text: 'כדי שאוכל להמשיך, בבקשה בחר אחת מהאפשרויות.',
                    options: currentOptions,
                    detectedLightType: lightType,
                    lightSeverity: uiSeverity,
                    kbSource: true,
                    context: mergeContext(context, { currentQuestionOptions: currentOptions })
                })
            };
        }
    }

    // Determine scenario - include current answer for first_question scenario detection
    let scenarioId: string | undefined = context.currentLightScenario || undefined;
    const isNewScenario = !scenarioId;
    if (!scenarioId) {
        // Include current answer for scenario detection (answers from context may not include it yet)
        const currentAnswer: UserAnswer = { question: context.currentQuestionText || 'first_question', answer: effectiveText };
        const answersWithCurrent = [...(answers || []), currentAnswer];
        scenarioId = determineScenario(lightType, answersWithCurrent) || undefined;

        if (scenarioId) {
            console.log(`[KBFlow] Scenario determined: ${scenarioId} from answer: "${effectiveText}"`);
        }
    }

    // If no scenario found, check for followup questions from first_question
    if (!scenarioId) {
        const lightData = (warningLightsKB as any)[lightType];
        const firstQ = lightData?.first_question;
        const followups = firstQ?.followups;

        if (followups && typeof followups === 'object') {
            // Match current answer to first_question option to get followup
            const matched = matchOption(firstQ?.options, effectiveText);
            const optionId = matched?.id;
            const followupQ = optionId ? followups[optionId] : null;

            if (followupQ?.text && followupQ?.options) {
                const followupOptions = followupQ.options.map((o: any) => typeof o === 'string' ? o : o?.label || '').filter(Boolean);
                console.log(`[KBFlow] No scenario yet, showing followup for "${optionId}"`);

                return {
                    handled: true,
                    response: NextResponse.json({
                        type: 'question',
                        text: followupQ.text,
                        options: followupOptions,
                        detectedLightType: lightType,
                        lightSeverity: uiSeverity,
                        kbSource: true,
                        context: mergeContext(context, {
                            firstAnswerState: optionId, // Save the first answer (steady/flashing)
                            askedQuestionIds: [...(context.askedQuestionIds || []), 'first_question'],
                            currentQuestionId: followupQ.id || `followup_${optionId}`,
                            currentQuestionText: followupQ.text,
                            currentQuestionOptions: followupOptions,
                            lastUserAnswer: effectiveText,
                            answeredQuestions: [...(context.answeredQuestions || []), { question: context.currentQuestionText || 'שאלה ראשונה', answer: effectiveText }]
                        })
                    })
                };
            }
        }

        console.log(`[KBFlow] No scenario and no followup found for answer: "${effectiveText}"`);
        return { response: null, handled: false };
    }

    // Immediate action check
    const immediateAction = checkImmediateAction(lightType, scenarioId);
    const shownImmediate = context.shownInstructionIds?.includes('immediate_action');

    if (immediateAction && !shownImmediate) {
        // Resolution paths depend on light type
        const immediateResolutionPaths: Record<string, any> = lightType === 'oil_pressure_light'
            ? {
                'כן, עצרתי': { status: 'wait_and_verify', next_action: 'check_dipstick_emergency', message: 'מצוין! עכשיו נבדוק את מפלס השמן.' },
                'אני בדרך לעצור': { status: 'critical', message: '⚠️ עצור לחלוטין וכבה את המנוע מיד!' },
                'לא יכול': { status: 'needs_tow', diagnosis: 'לא ניתן לעצור את הרכב', recommendation: 'נסה לעצור בצד הדרך. אם לא ניתן - התקשר לגרר מיד.' }
            }
            : {
                // For other lights (check_engine, etc) - proceed to diagnostic questions
                'כן, עצרתי': { status: 'continue_diagnosis', message: 'מצוין! עכשיו נאבחן את הבעיה.' },
                'אני בדרך לעצור': { status: 'critical', message: '⚠️ עצור לחלוטין וכבה את המנוע מיד!' },
                'לא יכול': { status: 'needs_tow', diagnosis: 'לא ניתן לעצור את הרכב', recommendation: 'עצור בצד הדרך והזמן גרר דרך האפליקציה.' }
            };
        return {
            handled: true,
            response: NextResponse.json({
                type: 'safety_instruction',
                actionType: 'critical',
                text: immediateAction,
                instruction: immediateAction,
                question: 'האם עצרת וכיבית את המנוע?',
                options: ['כן, עצרתי', 'אני בדרך לעצור', 'לא יכול'],
                context: mergeContext(context, {
                    currentLightScenario: scenarioId,
                    shownInstructionIds: ['immediate_action'],
                    currentQuestionId: 'immediate_action_confirm',
                    currentQuestionText: 'האם עצרת וכיבית את המנוע?',
                    currentQuestionOptions: ['כן, עצרתי', 'אני בדרך לעצור', 'לא יכול'],
                    pendingResolutionPaths: immediateResolutionPaths
                })
            })
        };
    }

    // Score updates
    let baseScores = { ...(context.causeScores || {}) };
    if (isNewScenario) baseScores = applyScenarioBoost(lightType, scenarioId, baseScores);
    const lastQuestionId = context.currentQuestionId || 'first_question';
    const updatedScores = updateScores(baseScores, lastQuestionId, effectiveText, lightType, scenarioId);

    // Check pending resolution_paths
    if ((context as any).pendingResolutionPaths) {
        const pendingPaths = (context as any).pendingResolutionPaths;
        let optionId = effectiveText;
        for (const key of Object.keys(pendingPaths)) {
            if (effectiveText.includes(key) || key.includes(effectiveText) || effectiveText === key) {
                optionId = key;
                break;
            }
        }
        const resolution = pendingPaths[optionId];
        if (resolution) {
            const result = handleResolutionPath(resolution, lightType, scenarioId, context, updatedScores);
            if (result) return result;
        }
    }

    // KB resolution lookup
    const kbResolution = lookupResolutionPath(lightType, scenarioId, context.currentQuestionId, effectiveText);
    if (kbResolution) {
        const result = handleResolutionPath(kbResolution, lightType, scenarioId, context, updatedScores);
        if (result) return result;
    }

    // Resolved option fallback
    if (isResolvedOption(effectiveText)) {
        const resolvedDesc = getResolvedIssueDescription(lightType, context);
        const lightName = (warningLightsKB as any)[lightType]?.names?.he?.[0] || lightType;
        return {
            handled: true,
            response: NextResponse.json({
                type: 'diagnosis_report',
                title: 'נפתר',
                severity: 'low',
                confidence: 0.8,
                results: [{ issue: resolvedDesc, probability: 0.8, explanation: 'המשתמש דיווח שהנורה כבתה' }],
                status: { color: 'green', text: 'הבעיה נפתרה', instruction: 'ניתן להמשיך כרגיל' },
                recommendations: ['בדוק שוב מחר בבוקר', 'אם הנורה חוזרת – פנה למוסך'],
                endConversation: true,
                // Include conversationSummaries for garage dashboard
                conversationSummaries: {
                    mechanic: {
                        schemaVersion: 2,
                        vehicleType: context.vehicleInfo ? `${(context.vehicleInfo as any).manufacturer || context.vehicleInfo.make || ''} ${context.vehicleInfo.model || ''} ${context.vehicleInfo.year || ''}`.trim() : 'לא ידוע',
                        originalComplaint: `נורת ${lightName}`,
                        conversationNarrative: buildConversationNarrative(lightType, context, resolvedDesc),
                        diagnoses: [{ issue: resolvedDesc, probability: 0.8 }],
                        recommendations: ['בדוק שוב מחר בבוקר', 'אם הנורה חוזרת – פנה למוסך'],
                        needsTow: false,
                        urgency: 'low' as const,
                        category: lightName
                    },
                    user: {
                        shortDescription: resolvedDesc,
                        topIssue: resolvedDesc,
                        nextAction: 'ניתן להמשיך כרגיל'
                    }
                },
                context: mergeContext(context, { currentLightScenario: scenarioId, causeScores: updatedScores })
            })
        };
    }

    // Build askedIds
    const askedIds = [...(context.askedQuestionIds || [])];
    if (!askedIds.includes(lastQuestionId)) askedIds.push(lastQuestionId);

    // Check if should diagnose - now uses AI for ALL diagnoses
    if (shouldDiagnose(updatedScores, askedIds.length, uiSeverity)) {
        console.log('[KBFlow] Ready to diagnose - using AI unified diagnosis');

        // Build conversation history for AI
        const conversationHistory = answers.map(a => ({
            role: 'user' as const,
            content: `${(a as any).question || ''} → ${a.answer}`
        }));

        // Call unified AI diagnosis
        const unifiedDiag = await generateUnifiedDiagnosis({
            lightType,
            scenarioId,
            conversationHistory,
            vehicleInfo: context.vehicleInfo,
            requestDescription: answers[0]?.answer || '',
            answers
        });

        const userDiag = unifiedDiag.userDiagnosis;
        const mechSummary = unifiedDiag.mechanicSummary;

        return {
            handled: true,
            response: NextResponse.json({
                type: 'diagnosis_report',
                title: userDiag.title,
                confidence: userDiag.confidence,
                confidenceLevel: userDiag.confidenceLevel,
                results: mechSummary.diagnoses.map(d => ({
                    issue: d.issue,
                    probability: d.probability,
                    explanation: userDiag.explanation
                })),
                status: {
                    color: userDiag.severity === 'critical' ? 'red' : userDiag.severity === 'high' ? 'orange' : 'yellow',
                    text: userDiag.topIssue,
                    instruction: userDiag.nextAction
                },
                selfFix: [],
                nextSteps: userDiag.nextAction,
                recommendations: userDiag.recommendations,
                endConversation: true,
                showTowButton: userDiag.needsTow,
                // Include conversationSummaries for frontend to save
                conversationSummaries: {
                    mechanic: mechSummary,
                    user: {
                        shortDescription: userDiag.explanation,
                        topIssue: userDiag.topIssue,
                        nextAction: userDiag.nextAction
                    }
                },
                context: mergeContext(context, {
                    currentLightScenario: scenarioId,
                    causeScores: updatedScores,
                    askedQuestionIds: askedIds
                })
            })
        };
    }

    // Get next step
    const shownInstructionIds = context.shownInstructionIds || [];
    const nextStep = getNextStep(lightType, scenarioId, askedIds, shownInstructionIds, effectiveText);

    if (nextStep?.kind === 'instruction') {
        const action = nextStep.action;
        const followupLabels = (action.followup_question?.options || []).map((opt: any) => typeof opt === 'string' ? opt : opt?.label || '').filter(Boolean);
        return {
            handled: true,
            response: NextResponse.json({
                type: 'instruction',
                title: action.name,
                actionType: action.actionType,
                steps: action.steps,
                warning: action.warning,
                condition: action.condition,
                question: action.followup_question?.text,
                options: followupLabels.length > 0 ? followupLabels : undefined,
                detectedLightType: lightType,
                lightSeverity: uiSeverity,
                kbSource: true,
                context: mergeContext(context, {
                    currentLightScenario: scenarioId,
                    causeScores: updatedScores,
                    askedQuestionIds: [lastQuestionId],
                    shownInstructionIds: [action.id],
                    lastInstructionId: action.id,
                    awaitingInstructionResult: true,
                    currentQuestionId: action.id,
                    currentQuestionText: action.followup_question?.text,
                    currentQuestionOptions: followupLabels,
                    pendingResolutionPaths: action.followup_question?.resolution_paths
                })
            })
        };
    }

    if (nextStep?.kind === 'question') {
        const nextQ = nextStep.question;
        return {
            handled: true,
            response: NextResponse.json({
                type: 'question',
                text: nextQ.text,
                options: nextQ.options,
                detectedLightType: lightType,
                lightSeverity: uiSeverity,
                kbSource: true,
                context: mergeContext(context, {
                    currentLightScenario: scenarioId,
                    causeScores: updatedScores,
                    askedQuestionIds: [lastQuestionId],
                    currentQuestionId: nextQ.id,
                    currentQuestionText: nextQ.text,
                    currentQuestionOptions: nextQ.options
                })
            })
        };
    }

    // ⚠️ ANTI-PREMATURE-DIAGNOSIS: If we haven't asked enough questions, don't jump to diagnosis!
    const MIN_QUESTIONS_FOR_DIAGNOSIS = 3;
    const questionCount = askedIds.length;

    if (questionCount < MIN_QUESTIONS_FOR_DIAGNOSIS) {
        console.log(`[KBFlow] Only ${questionCount} questions asked (min: ${MIN_QUESTIONS_FOR_DIAGNOSIS}). Using AI to continue conversation.`);
        // Route to AI to ask more clarifying questions before diagnosis
        return {
            response: null,
            handled: false  // Will fallback to callExpertAI in route.ts
        };
    }

    // No more steps AND enough questions asked: generate unified AI diagnosis for ALL lights
    console.log(`[KBFlow] Generating unified AI diagnosis for ${lightType} (${questionCount} questions asked)`);

    // Build conversation history for AI
    const conversationHistory = answers.map(a => ({
        role: 'user' as const,
        content: `${(a as any).question || ''} → ${a.answer}`
    }));

    // Call unified AI diagnosis (works for ALL lights, including former HYBRID_LIGHTS)
    const unifiedDiag = await generateUnifiedDiagnosis({
        lightType,
        scenarioId,
        conversationHistory,
        vehicleInfo: context.vehicleInfo,
        requestDescription: answers[0]?.answer || '',
        answers
    });

    const userDiag = unifiedDiag.userDiagnosis;
    const mechSummary = unifiedDiag.mechanicSummary;

    return {
        handled: true,
        response: NextResponse.json({
            type: 'diagnosis_report',
            title: userDiag.title,
            confidence: userDiag.confidence,
            confidenceLevel: userDiag.confidenceLevel,
            results: mechSummary.diagnoses.map(d => ({
                issue: d.issue,
                probability: d.probability,
                explanation: userDiag.explanation
            })),
            status: {
                color: userDiag.severity === 'critical' ? 'red' : userDiag.severity === 'high' ? 'orange' : 'yellow',
                text: userDiag.topIssue,
                instruction: userDiag.nextAction
            },
            selfFix: [],
            nextSteps: userDiag.nextAction,
            recommendations: userDiag.recommendations,
            endConversation: true,
            showTowButton: userDiag.needsTow,
            detectedLightType: lightType,
            kbSource: true,
            // Include conversationSummaries for frontend to save
            conversationSummaries: {
                mechanic: mechSummary,
                user: {
                    shortDescription: userDiag.explanation,
                    topIssue: userDiag.topIssue,
                    nextAction: userDiag.nextAction
                }
            },
            context: mergeContext(context, {
                currentLightScenario: scenarioId,
                causeScores: updatedScores,
                askedQuestionIds: askedIds
            })
        })
    };
}

// Expert AI fallback
export async function callExpertAI(body: any): Promise<any> {
    const { message, description, answers = [], image_urls = [], context } = body;
    const currentInput = message || description || '';
    const detectedLight = context?.detectedLightType;

    const pickedId = extractLightIdFromPicker(currentInput || '');
    // Route all lights to KB flow (HYBRID_LIGHTS will use AI for diagnosis only)
    if (pickedId && (warningLightsKB as any)[pickedId]) {
        const sev = (warningLightsKB as any)[pickedId]?.severity ?? 'low';
        return handleWarningLightDetection(pickedId, sev === 'critical' ? 'danger' : 'caution', context);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'No API Key', context: mergeContext(context, { lastError: 'NO_API_KEY' }) }, { status: 500 });
    }

    const client: any = createOpenAIClient(apiKey, 'gpt-4o', { responseFormat: { type: 'json_object' } });
    const images = await Promise.all((image_urls || []).slice(0, 3).map((url: string) => fetchImageAsInlineData(url).catch(() => null))).then(res => res.filter(Boolean));
    const hasImages = images.length > 0;

    const bridgeCount = Number(context?.bridgeQuestionCount ?? 0);

    // Check if user indicated no warning light - switch to symptom-based expert mode
    const noLightPhrases = ['אין נורה', 'לא, אין נורה', 'אין נורת אזהרה', 'לא דולקת', 'נורה לא דולקת', 'בלי נורה', 'ללא נורה'];
    const userSaidNoLight = noLightPhrases.some(phrase => currentInput.includes(phrase)) ||
        answers.some((a: UserAnswer) => noLightPhrases.some(phrase => (a.answer || '').includes(phrase)));

    // Force expert mode if: no light detected, user said no light, OR we've asked too many bridge questions
    const shouldUseExpertMode = userSaidNoLight || (!detectedLight && bridgeCount >= 3) || context?.isSymptomFlow;
    const canBridge = !hasImages && !detectedLight && !shouldUseExpertMode && bridgeCount < 3;
    const ctx = { mode: canBridge ? ('bridge' as const) : ('expert' as const), bridgeQuestionCount: bridgeCount };

    // Use appropriate prompt based on mode
    let prompt: string;
    if (shouldUseExpertMode) {
        console.log(`[Expert AI] Using symptom-based expert mode (noLight: ${userSaidNoLight}, bridgeCount: ${bridgeCount})`);
        prompt = buildGeneralExpertPrompt(currentInput, answers, hasImages, ctx);
    } else if (hasImages || detectedLight || canBridge) {
        prompt = buildChatPrompt(currentInput, answers, hasImages, answers.length, detectedLight ?? null, ctx);
    } else {
        prompt = buildChatPrompt(currentInput, answers, hasImages, answers.length, null, { mode: 'expert' as const });
    }

    try {
        const raw = await client.generateContent(prompt, { images: images as any, responseFormat: { type: 'json_object' } });
        const parsed = extractJSON(raw);
        const result: any = parsed ?? {};

        // Check both top-level and candidate.warning_light from AI response (extended extraction)
        let lightType = result.warning_light
            || result.light_type
            || result.detected_light
            || result.light_id
            || result.detectedLightType
            || result.candidate?.warning_light
            || result.candidate?.light_id
            || result.candidate?.detected_light
            || detectedLight;
        if (typeof lightType === 'string') lightType = lightType.trim();

        // Get confidence from candidate if available
        const candidateConfidence = result.candidate?.confidence ?? 0;

        // STRICT VALIDATION: Only accept warning light detection if:
        // 1. There's an image (visual proof), OR
        // 2. User explicitly mentioned light-related keywords, OR
        // 3. Light was already detected in context (continuing flow)
        const lightKeywords = ['נורה', 'נורת', 'אור', 'הבהוב', 'דולק', 'נדלק', 'נדלקה', 'מהבהב', 'מהבהבת', 'לוח מחוונים', 'אזהרה'];
        const allText = [currentInput, ...answers.map((a: UserAnswer) => `${a.question || ''} ${a.answer || ''}`)].join(' ');
        const userMentionedLight = lightKeywords.some(kw => allText.includes(kw));
        const hasExistingLight = Boolean(detectedLight) || Boolean(context?.detectedLightType);

        const canRouteToKB = hasImages || userMentionedLight || hasExistingLight;

        if (!canRouteToKB && lightType && !detectedLight) {
            console.log(`[Expert AI] Ignoring false positive light detection: "${lightType}" (no image, no light keywords)`);
            lightType = null; // Clear false detection
        }

        // Route detected lights to KB flow (HYBRID_LIGHTS will use AI for diagnosis, but KB for questions)
        if (lightType && (warningLightsKB as any)[lightType] && candidateConfidence >= 0.6 && canRouteToKB) {
            const severity = (CRITICAL_LIGHTS as any).includes(lightType) ? 'danger' : (context?.lightSeverity || 'caution');
            console.log(`[Expert AI] Detected light from candidate: ${lightType} (confidence: ${candidateConfidence}) - routing to KB flow`);
            return handleWarningLightDetection(lightType, severity, context);
        }

        // Direct detection without candidate (only if valid)
        if (lightType && (warningLightsKB as any)[lightType] && !result.candidate && canRouteToKB) {
            const severity = (CRITICAL_LIGHTS as any).includes(lightType) ? 'danger' : (context?.lightSeverity || 'caution');
            return handleWarningLightDetection(lightType, severity, context);
        }

        if (!lightType && bridgeCount >= 3 && !context?.lightPickerShown) {
            return NextResponse.json({
                type: 'question',
                text: 'כדי לדייק: איזו נורת אזהרה ראית? אם אתה לא בטוח, בחר את הקרובה ביותר.',
                options: buildLightPickerOptions(),
                context: mergeContext(context, { lightPickerShown: true, activeFlow: null })
            });
        }

        // Handle diagnosis_report - this is a valid final state
        if (result.type === 'diagnosis_report') {
            return NextResponse.json({ ...result, endConversation: true, context: mergeContext(context, result?.context) });
        }

        // Handle ai_response - NEVER end conversation prematurely!
        // Either route to KB if light detected, or convert to question
        if (result.type === 'ai_response') {
            console.log(`[Expert AI] NON-FINAL ai_response received - converting to question or KB route`);

            // If we detected a valid light, route to KB
            if (lightType && (warningLightsKB as any)[lightType]) {
                const severity = (CRITICAL_LIGHTS as any).includes(lightType) ? 'danger' : 'caution';
                console.log(`[Expert AI] ai_response -> routing to KB for light: ${lightType}`);
                return handleWarningLightDetection(lightType, severity, context);
            }

            // Otherwise, convert to a question to continue conversation
            console.log(`[Expert AI] ai_response -> converting to question (no valid light detected)`);
            return NextResponse.json({
                type: 'question',
                text: result.text ?? 'כדי לדייק, תוכל לתאר מה אתה רואה?',
                options: result.options ?? buildLightPickerOptions(),
                context: mergeContext(context, { activeFlow: null, ...(result.context ?? {}) })
            });
        }

        // Normalize options for all AI responses (AI may return {id, label} objects)
        const normalizedResult = { ...result };
        if (Array.isArray(result.options)) {
            normalizedResult.options = result.options.map((o: any) => typeof o === 'string' ? o : o?.label || String(o)).filter(Boolean);
        }

        // FIRST IMAGE PROTECTION: Never end conversation on first image without questions
        if (hasImages && answers.length === 0) {
            console.log(`[Expert AI] First image received - ensuring conversation continues`);

            // If we have a light, route to KB
            if (lightType && (warningLightsKB as any)[lightType]) {
                const severity = (CRITICAL_LIGHTS as any).includes(lightType) ? 'danger' : 'caution';
                console.log(`[Expert AI] First image -> detected light ${lightType}, routing to KB`);
                return handleWarningLightDetection(lightType, severity, context);
            }

            // Otherwise, ask clarifying question
            console.log(`[Expert AI] First image -> no light detected, asking for clarification`);
            return NextResponse.json({
                type: 'question',
                text: result.text ?? 'קיבלתי את התמונה. האם יש נורת אזהרה דולקת בלוח המחוונים?',
                options: result.options ?? buildLightPickerOptions(),
                context: mergeContext(context, { activeFlow: null, firstImageProcessed: true })
            });
        }

        // DEAD-END DETECTION: Check for empty/stuck responses or too many questions
        const questionCount2 = answers.length;
        const MAX_QUESTIONS = 8;
        const emptyPhrases = ['המשך', 'המשך...', 'continue', 'ok', 'אוקיי'];
        const isEmptyResponse = !result.text || emptyPhrases.some(p => (result.text || '').trim().toLowerCase() === p.toLowerCase());
        const hasNoOptions = !normalizedResult.options || normalizedResult.options.length === 0;
        const isStuck = isEmptyResponse || (hasNoOptions && result.type === 'question');

        if (isStuck || questionCount2 >= MAX_QUESTIONS) {
            console.log(`[Expert AI] Dead-end detected: isStuck=${isStuck}, questionCount=${questionCount2} - using unified diagnosis`);

            // Use unified diagnosis generator for consistent quality
            const conversationHistory = answers.map((a: UserAnswer) => ({
                role: 'user' as const,
                content: `${a.question} → ${a.answer}`
            }));

            const unifiedDiag = await generateUnifiedDiagnosis({
                requestDescription: currentInput,
                conversationHistory,
                vehicleInfo: undefined, // Not available in this context
                lightType: context?.detectedLightType
            });

            // Extract user-facing diagnosis from unified result
            const userDiag = unifiedDiag.userDiagnosis;
            const mechSummary = unifiedDiag.mechanicSummary;

            return NextResponse.json({
                type: 'diagnosis_report',
                title: userDiag.title || 'אבחון תקלה',
                confidence: userDiag.confidence,
                confidenceLevel: userDiag.confidenceLevel,
                results: mechSummary.diagnoses.map(d => ({
                    issue: d.issue,
                    probability: d.probability,
                    explanation: userDiag.explanation
                })),
                status: {
                    color: userDiag.severity === 'critical' ? 'red' : userDiag.severity === 'high' ? 'orange' : 'yellow',
                    text: userDiag.topIssue,
                    instruction: userDiag.nextAction
                },
                selfFix: [],
                nextSteps: userDiag.nextAction,
                recommendations: userDiag.recommendations,
                disclaimer: 'האבחון מבוסס על תיאור הבעיה. מומלץ אישור במוסך.',
                endConversation: true,
                showTowButton: userDiag.needsTow,
                category: mechSummary.category,
                // Include conversationSummaries in expected format for frontend
                conversationSummaries: {
                    mechanic: mechSummary,
                    user: {
                        shortDescription: userDiag.explanation,
                        topIssue: userDiag.topIssue,
                        nextAction: userDiag.nextAction
                    }
                },
                mechanicSummary: mechSummary, // Also include directly for backward compatibility
                context: mergeContext(context, { unifiedDiagnosis: true })
            });
        }

        if (result.type === 'question' && canBridge) {
            return NextResponse.json({ ...normalizedResult, context: mergeContext(context, { bridgeQuestionCount: bridgeCount + 1, isSymptomFlow: true, activeFlow: null, ...(result?.context ?? {}) }) });
        }

        return NextResponse.json({ ...normalizedResult, context: mergeContext(context, result?.context) });
    } catch (err: any) {
        console.error('[Expert AI] Error:', err);
        const isContentFilter = err?.message?.includes('content filter') || err?.message?.includes('refusal');
        if (isContentFilter && hasImages) {
            return NextResponse.json({ type: 'question', text: 'לא הצלחתי לזהות את התמונה. האם תוכל לתאר את נורת האזהרה במילים?', options: buildLightPickerOptions(), context: mergeContext(context, { activeFlow: null, isSymptomFlow: true, bridgeQuestionCount: 0 }) });
        }
        return NextResponse.json({ type: 'question', text: 'נתקלתי בבעיה. נסה לתאר שוב את הבעיה.', options: ['אנסה שוב', 'אעדיף לגשת למוסך'], context: mergeContext(context, { lastError: 'EXPERT_AI_ERROR' }) });
    }
}

// Initial flow starters
export function handleWarningLightDetection(lightId: string, severity: string, existingContext?: any): any {
    const lightData = (warningLightsKB as any)[lightId];
    if (!lightData?.first_question) return null;

    const q = lightData.first_question;
    const name = lightData.names?.he?.[0] || lightId;
    const isCritical = (CRITICAL_LIGHTS as any).includes(lightId);
    const questionOptions = q.options?.map((o: any) => o.label || o) || ['כן', 'לא', 'לא בטוח'];
    const questionText = `זיהיתי ${name}. ${isCritical ? 'זו נורה קריטית! ' : ''}${q.text}`;

    return NextResponse.json({
        type: 'question',
        text: questionText,
        options: questionOptions,
        detectedLightType: lightId,
        lightSeverity: isCritical ? 'danger' : severity,
        kbSource: true,
        context: { ...(existingContext ?? {}), detectedLightType: lightId, lightSeverity: isCritical ? 'danger' : severity, isLightContext: true, askedQuestionIds: ['first_question'], currentQuestionId: 'first_question', causeScores: {}, currentQuestionText: questionText, currentQuestionOptions: questionOptions, activeFlow: 'KB' as const }
    });
}

export function handleSafetyStop(rule: SafetyRule): any {
    const ruleConfigs: Record<string, { detected: string[]; issue: string; explanation: string; nextSteps: string; recommendations: string[]; towConditions: string[] }> = {
        smoke_fire: { detected: ['עשן או אש מהרכב'], issue: 'סכנת שריפה ברכב', explanation: 'זוהו סימני עשן או אש. יש לעצור מיידית, לכבות את המנוע ולהתרחק מהרכב.', nextSteps: 'התרחק מהרכב לפחות 30 מטר והתקשר לכיבוי אש (102) ואז לביטוח.', recommendations: ['אל תפתח את המכסה!', 'התרחק מהרכב מיד', 'התקשר ל-102', 'אל תנסה לכבות לבד'], towConditions: ['עשן מהמנוע', 'ריח שריפה', 'להבות נראות'] },
        brake_failure: { detected: ['כשל בבלמים'], issue: 'תקלת בלמים קריטית', explanation: 'הבלמים אינם פועלים כראוי. אסור להמשיך בנסיעה.', nextSteps: 'עצור במקום הבטוח הקרוב והזמן גרר.', recommendations: ['אל תמשיך לנסוע!', 'השתמש בבלם יד בזהירות', 'הזמן גרר מיידית'], towConditions: ['בלמים לא מגיבים', 'דוושה שוקעת לרצפה', 'רעש חריג בבלימה'] },
        oil_pressure: { detected: ['אובדן לחץ שמן'], issue: 'לחץ שמן קריטי', explanation: 'לחץ השמן במנוע ירד לרמה מסוכנת. המשך נסיעה עלול לגרום לנזק בלתי הפיך למנוע.', nextSteps: 'כבה את המנוע מיידית ואל תנסה להניע שוב. הזמן גרר.', recommendations: ['כבה את המנוע מיד', 'אל תנסה להניע!', 'הזמן גרר', 'בדוק מפלס שמן אחרי שהמנוע קר'], towConditions: ['נורת שמן אדומה דולקת', 'רעש מנוע חריג', 'ריח שמן שרוף'] },
        coolant_temp: { detected: ['התחממות יתר של המנוע'], issue: 'טמפרטורת מנוע קריטית', explanation: 'המנוע מתחמם יתר על המידה. המשך נסיעה עלול לגרום לנזק חמור.', nextSteps: 'עצור מיידית, כבה את המנוע והמתן שיתקרר. אל תפתח את מכסה הרדיאטור!', recommendations: ['עצור מיד', 'כבה את המנוע', 'אל תפתח מכסה רדיאטור!', 'המתן 30 דקות לפני בדיקה'], towConditions: ['מחוג טמפרטורה באדום', 'אדים מהמנוע', 'ריח מתוק של נוזל קירור'] },
        steering_fail: { detected: ['תקלה בהגה'], issue: 'כשל במערכת ההיגוי', explanation: 'מערכת ההיגוי אינה מגיבה כראוי. נסיעה בתנאים אלה מסוכנת ביותר.', nextSteps: 'עצור בצד הדרך בזהירות מרבית והזמן גרר.', recommendations: ['עצור בזהירות', 'הדלק אורות חירום', 'אל תמשיך לנסוע', 'הזמן גרר'], towConditions: ['הגה כבד מאוד', 'הגה לא מגיב', 'רעשים בהיגוי'] }
    };

    const matchedKey = Object.keys(ruleConfigs).find(key => rule.id.includes(key));
    const config = matchedKey ? ruleConfigs[matchedKey] : { detected: ['מצב חירום'], issue: 'תקלה קריטית ברכב', explanation: rule.message, nextSteps: 'עצור מיידית במקום בטוח והזמן גרר.', recommendations: ['עצור מיד', 'הדלק אורות חירום', 'הזמן גרר'], towConditions: ['מצב חירום כללי'] };

    const finalCard = {
        title: 'מצב חירום',
        summary: { detected: config.detected, reported: [rule.message] },
        results: [{ issue: config.issue, probability: 0.95, explanation: config.explanation }],
        confidence: 0.95,
        status: { color: 'red' as const, text: 'עצור מיד!', instruction: rule.message },
        nextSteps: config.nextSteps,
        recommendations: config.recommendations,
        disclaimer: 'זהו מצב חירום. האבחון מבוסס על המידע שסיפקת. פעל בהתאם להנחיות הבטיחות.',
        showTowButton: true,
        severity: 'critical' as const,
        towConditions: config.towConditions,
        mechanicReport: { topSuspect: config.issue, score: 10, severity: 'critical' as const, status: 'עצור מיד!', instruction: config.nextSteps, towConditions: config.towConditions, blindSpots: [] }
    };

    return NextResponse.json({ type: 'safety_alert', title: 'עצור מיד!', message: rule.message, level: rule.level, stopChat: !!rule.endConversation, endConversation: !!rule.endConversation, followUpMessage: rule.followUpMessage, nextScenarioId: rule.nextScenarioId, finalCard });
}
