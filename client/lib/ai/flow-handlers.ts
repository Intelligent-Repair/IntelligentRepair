// lib/ai/flow-handlers.ts
/**
 * =============================================================================
 * FLOW HANDLERS - Business Logic for route.ts
 * =============================================================================
 * Anti-Gravity: route.ts routes; this file performs the work.
 * 
 * Hybrid Mode Support:
 * - If user types free-text instead of clicking a button, we try to map it
 *   to one of the expected options via AI (option_map mode).
 */

import { NextResponse } from 'next/server';
import { createOpenAIClient } from '@/lib/ai/client';
import { fetchImageAsInlineData } from '@/lib/ai/image-utils';
import { extractJSON } from '@/lib/ai/json-utils';
import { buildChatPrompt, buildGeneralExpertPrompt } from '@/lib/ai/prompt-builder';
import type { UserAnswer } from '@/lib/ai/types';
import warningLightsKB from '@/lib/knowledge/warning-lights.json';
import { SCENARIOS } from '@/lib/knowledge/scenarios';
import type { DiagnosticState, Scenario, StepOption, SafetyRule } from '@/lib/types/knowledge';
import {
    CRITICAL_LIGHTS,
    determineScenario,
    updateScores,
    shouldDiagnose,
    getNextQuestion,
    getNextStep,
    checkImmediateAction,
    generateDiagnosis,
    updateSuspectsAndReport,
    generateScenarioReport
} from '@/lib/ai/diagnostic-utils';
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

const mergeContext = (base: any, patch: any) => ({ ...(base ?? {}), ...(patch ?? {}) });

// =============================================================================
// BRIDGE MODE HELPERS
// =============================================================================

/**
 * Build a picker list of warning lights sorted by severity.
 * Used when bridge questions fail to identify the light.
 */
function buildLightPickerOptions(): string[] {
    const entries = Object.entries(warningLightsKB as any);
    const weight = (sev: string) =>
        sev === 'critical' ? 0 : sev === 'high' ? 1 : sev === 'moderate' ? 2 : 3;

    return entries
        .sort((a, b) => weight(String((a[1] as any)?.severity)) - weight(String((b[1] as any)?.severity)))
        .slice(0, 10)
        .map(([id, data]) => {
            const he = (data as any)?.names?.he?.[0] ?? id;
            return `${he} (${id})`;
        })
        .concat(['נורה אחרת / לא בטוח - אתאר במילים']);
}

/**
 * Extract lightId from a picker option string like "נורת שמן (oil_pressure_light)"
 */
function extractLightIdFromPicker(text: string): string | null {
    const m = String(text || '').match(/\(([\w_]+)\)/);
    return m?.[1] ?? null;
}

// =============================================================================
// RESOLVED/SUCCESS OPTION DETECTION
// =============================================================================

/**
 * Detects if user selected an option indicating the problem is resolved.
 * Checks for Hebrew patterns like "הנורה כבתה", "נפתר", "הכל תקין", or ✅ emoji.
 */
function isResolvedOption(optionText: string): boolean {
    if (!optionText) return false;
    const lower = optionText.toLowerCase();
    const resolvedPatterns = [
        '✅',
        'הנורה כבתה',
        'נפתר',
        'הכל תקין',
        'נסתדר',
        'resolved',
        'success',
        'fixed'
    ];
    return resolvedPatterns.some(p => lower.includes(p) || optionText.includes(p));
}

/**
 * Extracts a description of what was resolved based on context.
 */
function getResolvedIssueDescription(lightType: string, context: any): string {
    const lightNames: Record<string, string> = {
        'tpms_light': 'לחץ אוויר נמוך בצמיגים',
        'battery_light': 'מצבר חלש/מפורק',
        'brake_light': 'בלם יד היה משוך',
        'coolant_temperature_light': 'התחממות זמנית',
        'check_engine_light': 'מכסה דלק לא היה סגור',
        'oil_pressure_light': 'מפלס שמן נמוך'
    };
    return lightNames[lightType] || 'הבעיה נפתרה';
}

// =============================================================================
// SCENARIO-BASED INITIAL SCORE BOOST
// =============================================================================

/**
 * Apply initial score boost when a scenario is first determined.
 * Some scenarios already indicate a strong symptom before any key_question is asked.
 * 
 * For example:
 * - tpms_light + steady_pulling = "הרכב מושך לצד" → strong signal of puncture
 * - This gives immediate positive score to 'low_tire_puncture'
 */
function applyScenarioBoost(
    lightType: string,
    scenarioId: string,
    scores: Record<string, number>
): Record<string, number> {
    const newScores = { ...scores };

    // Define scenario-based boosts
    // Format: { lightType: { scenarioId: { causeId: boostAmount } } }
    const scenarioBoosts: Record<string, Record<string, Record<string, number>>> = {
        'tpms_light': {
            'steady_pulling': {
                // "הרכב מושך לצד" is a clear symptom of puncture
                'low_tire_puncture': 1.5  // Probability 0.8, give significant boost
            },
            'steady': {
                // Most common cause: simple low air pressure due to temperature/time
                // Give initial boost since this is the default assumption
                'temperature_change': 1.0  // Probability 0.6, give moderate boost
            }
        },
        'brake_light': {
            'from_parking': {
                // Most likely cause when brake light is on from parking
                'handbrake_engaged': 1.0
            }
        }
    };

    const lightBoosts = scenarioBoosts[lightType];
    if (!lightBoosts) return newScores;

    const boostsForScenario = lightBoosts[scenarioId];
    if (!boostsForScenario) return newScores;

    for (const [causeId, boost] of Object.entries(boostsForScenario)) {
        const oldScore = newScores[causeId] || 0;
        newScores[causeId] = oldScore + boost;
        console.log(`[Scores] ⚡ Scenario boost for "${causeId}": ${oldScore.toFixed(2)} -> ${newScores[causeId].toFixed(2)} (boost: +${boost.toFixed(2)}, scenario="${scenarioId}")`);
    }

    return newScores;
}


// =============================================================================
// KB RESOLUTION_PATHS LOOKUP
// =============================================================================

interface ResolutionPath {
    status: 'resolved' | 'resolved_temp' | 'needs_more_info' | 'needs_mechanic' | 'needs_tow' | 'pending' | 'wait_and_verify' | 'needs_attention' | 'needs_verification' | 'needs_mechanic_urgent' | 'needs_inspection' | 'critical';
    diagnosis?: string;
    recommendation?: string;
    message?: string;
    next_steps?: string[];
    next_question?: any;
    route_to_scenario?: string;
    next_action?: string;
    if_returns?: string;
}

/**
 * Look up resolution_paths from KB for the current self_fix_action followup.
 * Returns the resolution if found, or null.
 */
function lookupResolutionPath(
    lightType: string,
    scenarioId: string,
    actionId: string | undefined,
    selectedOptionIdOrLabel: string
): ResolutionPath | null {
    try {
        const lightData = (warningLightsKB as any)[lightType];
        if (!lightData?.scenarios?.[scenarioId]) return null;

        const scenario = lightData.scenarios[scenarioId];
        const selfFixActions = scenario.self_fix_actions || [];

        // Find the current action (by actionId or just iterate all)
        for (const action of selfFixActions) {
            const followup = action.followup_question;
            if (!followup?.resolution_paths) continue;

            const resolutionPaths = followup.resolution_paths;

            // Try to find by option ID first
            if (resolutionPaths[selectedOptionIdOrLabel]) {
                console.log(`[KBFlow] 🔍 Found resolution_path for ID: ${selectedOptionIdOrLabel}`);
                return resolutionPaths[selectedOptionIdOrLabel];
            }

            // Try to find by matching option label to ID
            const options = followup.options || [];
            for (const opt of options) {
                if (typeof opt === 'object' && opt.label === selectedOptionIdOrLabel) {
                    if (resolutionPaths[opt.id]) {
                        console.log(`[KBFlow] 🔍 Found resolution_path for ID (via label match): ${opt.id}`);
                        return resolutionPaths[opt.id];
                    }
                }
            }

            // Fallback: try label as key (for legacy string-keyed resolution_paths)
            if (resolutionPaths[selectedOptionIdOrLabel]) {
                console.log(`[KBFlow] 🔍 Found resolution_path for label: ${selectedOptionIdOrLabel}`);
                return resolutionPaths[selectedOptionIdOrLabel];
            }
        }

        return null;
    } catch (err) {
        console.error('[KBFlow] Error looking up resolution_path:', err);
        return null;
    }
}

/**
 * Process a resolution_path and return appropriate response.
 */
function handleResolutionPath(
    resolution: ResolutionPath,
    lightType: string,
    scenarioId: string,
    context: any,
    updatedScores: any
): FlowResult | null {
    const mergedContext = mergeContext(context, {
        currentLightScenario: scenarioId,
        causeScores: updatedScores,
        pendingResolutionPaths: null,
        awaitingInstructionResult: false
    });

    // RESOLVED statuses -> diagnosis_report
    if (resolution.status === 'resolved' || resolution.status === 'resolved_temp') {
        console.log(`[KBFlow] ✅ Resolution status: ${resolution.status}`);
        return {
            handled: true,
            response: NextResponse.json({
                type: 'diagnosis_report',
                title: resolution.diagnosis || 'נפתר',
                severity: 'low',
                confidence: 0.8,
                results: [
                    {
                        issue: resolution.diagnosis || getResolvedIssueDescription(lightType, context),
                        probability: 0.8,
                        explanation: resolution.recommendation || 'הבעיה נפתרה בהצלחה'
                    }
                ],
                status: {
                    color: 'green',
                    text: resolution.status === 'resolved_temp' ? 'נפתר זמנית' : 'הבעיה נפתרה',
                    instruction: resolution.recommendation || 'ניתן להמשיך כרגיל'
                },
                recommendations: [
                    resolution.recommendation,
                    resolution.if_returns
                ].filter(Boolean),
                endConversation: true,
                context: mergedContext
            })
        };
    }

    // NEEDS_MORE_INFO -> return instruction with next_steps OR trigger next_action
    if (resolution.status === 'needs_more_info') {
        console.log(`[KBFlow] ℹ️ Resolution: needs_more_info`);

        // If there's a next_action, fetch that instruction from KB and return it
        if (resolution.next_action) {
            console.log(`[KBFlow]   next_action: ${resolution.next_action}`);

            // Fetch the actual action from KB
            const lightData = (warningLightsKB as any)[lightType];
            const scenario = lightData?.scenarios?.[scenarioId];
            const selfFixActions = scenario?.self_fix_actions || [];
            const nextAction = selfFixActions.find((a: any) => a.id === resolution.next_action);

            if (nextAction) {
                // Return the full instruction with actual steps
                const followupOptions = nextAction.followup_question?.options || [];
                const followupLabels = followupOptions.map((opt: any) =>
                    typeof opt === 'string' ? opt : opt?.label || ''
                ).filter(Boolean);

                console.log(`[KBFlow] 📋 Found next_action instruction: ${nextAction.id}`);
                console.log(`[KBFlow]   Steps: ${nextAction.steps?.length || 0}`);

                return {
                    handled: true,
                    response: NextResponse.json({
                        type: 'instruction',
                        title: nextAction.name || resolution.message || 'צעד הבא',
                        actionType: nextAction.actionType || 'inspect',
                        steps: nextAction.steps || [],
                        warning: nextAction.warning,
                        condition: nextAction.condition,
                        question: nextAction.followup_question?.text,
                        options: followupLabels.length > 0 ? followupLabels : undefined,
                        detectedLightType: lightType,
                        kbSource: true,
                        context: mergeContext(mergedContext, {
                            shownInstructionIds: [...(context.shownInstructionIds || []), nextAction.id],
                            lastInstructionId: nextAction.id,
                            awaitingInstructionResult: true,
                            currentQuestionId: nextAction.id,
                            currentQuestionText: nextAction.followup_question?.text,
                            currentQuestionOptions: followupLabels,
                            pendingResolutionPaths: nextAction.followup_question?.resolution_paths,
                            optionMapAttempts: 0
                        })
                    })
                };
            } else {
                // Fallback: just return the message if action not found
                console.log(`[KBFlow] ⚠️ next_action "${resolution.next_action}" not found in KB`);
                return {
                    handled: true,
                    response: NextResponse.json({
                        type: 'instruction',
                        title: resolution.message || 'צעד הבא',
                        steps: [resolution.message].filter(Boolean),
                        text: resolution.message,
                        detectedLightType: lightType,
                        kbSource: true,
                        context: mergedContext
                    })
                };
            }
        }

        // Otherwise return next_steps as instruction
        if (resolution.next_steps?.length) {
            console.log(`[KBFlow]   next_steps: ${resolution.next_steps.length} steps`);
            return {
                handled: true,
                response: NextResponse.json({
                    type: 'instruction',
                    title: 'צעדים נוספים',
                    steps: resolution.next_steps,
                    text: resolution.next_steps.join('\n'),
                    detectedLightType: lightType,
                    kbSource: true,
                    context: mergedContext
                })
            };
        }

        // Fallback: just show message
        if (resolution.message) {
            return {
                handled: true,
                response: NextResponse.json({
                    type: 'question',
                    text: resolution.message,
                    options: ['הבנתי, אמשיך', 'לא יכול לבצע'],
                    detectedLightType: lightType,
                    kbSource: true,
                    context: mergedContext
                })
            };
        }
    }

    // NEEDS_MECHANIC / NEEDS_TOW -> diagnosis with mechanic recommendation
    if (resolution.status === 'needs_mechanic' || resolution.status === 'needs_mechanic_urgent' || resolution.status === 'needs_tow') {
        console.log(`[KBFlow] 🔧 Resolution: ${resolution.status}`);
        const severity = resolution.status === 'needs_tow' ? 'critical' : 'high';
        return {
            handled: true,
            response: NextResponse.json({
                type: 'diagnosis_report',
                title: resolution.diagnosis || 'נדרש טיפול מקצועי',
                severity,
                confidence: 0.7,
                results: [
                    {
                        issue: resolution.diagnosis || 'נדרשת בדיקה במוסך',
                        probability: 0.7,
                        explanation: resolution.recommendation || ''
                    }
                ],
                status: {
                    color: resolution.status === 'needs_tow' ? 'red' : 'orange',
                    text: resolution.status === 'needs_tow' ? 'הזמן גרר' : 'פנה למוסך',
                    instruction: resolution.recommendation || 'יש לפנות למוסך בהקדם'
                },
                recommendations: [resolution.recommendation].filter(Boolean),
                endConversation: true,
                context: mergedContext
            })
        };
    }

    // PENDING / WAIT_AND_VERIFY -> return message and/or trigger next_action
    if (resolution.status === 'pending' || resolution.status === 'wait_and_verify') {
        console.log(`[KBFlow] ⏳ Resolution: ${resolution.status}`);

        // If there's a next_action, fetch that instruction from KB and return it
        if (resolution.next_action) {
            console.log(`[KBFlow]   next_action: ${resolution.next_action}`);

            // Fetch the actual action from KB
            const lightData = (warningLightsKB as any)[lightType];
            const scenario = lightData?.scenarios?.[scenarioId];
            const selfFixActions = scenario?.self_fix_actions || [];
            const nextAction = selfFixActions.find((a: any) => a.id === resolution.next_action);

            if (nextAction) {
                // Return the full instruction with actual steps
                const followupOptions = nextAction.followup_question?.options || [];
                const followupLabels = followupOptions.map((opt: any) =>
                    typeof opt === 'string' ? opt : opt?.label || ''
                ).filter(Boolean);

                console.log(`[KBFlow] 📋 Found next_action instruction: ${nextAction.id}`);
                console.log(`[KBFlow]   Steps: ${nextAction.steps?.length || 0}`);

                return {
                    handled: true,
                    response: NextResponse.json({
                        type: 'instruction',
                        title: nextAction.name || resolution.message || 'המתן ובדוק',
                        actionType: nextAction.actionType || 'inspect',
                        steps: nextAction.steps || [],
                        warning: nextAction.warning,
                        condition: nextAction.condition,
                        question: nextAction.followup_question?.text,
                        options: followupLabels.length > 0 ? followupLabels : undefined,
                        detectedLightType: lightType,
                        kbSource: true,
                        context: mergeContext(mergedContext, {
                            shownInstructionIds: [...(context.shownInstructionIds || []), nextAction.id],
                            lastInstructionId: nextAction.id,
                            awaitingInstructionResult: true,
                            currentQuestionId: nextAction.id,
                            currentQuestionText: nextAction.followup_question?.text,
                            currentQuestionOptions: followupLabels,
                            pendingResolutionPaths: nextAction.followup_question?.resolution_paths,
                            optionMapAttempts: 0
                        })
                    })
                };
            }
        }

        // Fallback: just return message
        return {
            handled: true,
            response: NextResponse.json({
                type: 'instruction',
                title: resolution.status === 'wait_and_verify' ? 'המתן ובדוק' : 'המשך',
                text: resolution.message || 'המשך לפי ההוראות',
                steps: resolution.next_steps || [resolution.message].filter(Boolean),
                detectedLightType: lightType,
                kbSource: true,
                context: mergedContext
            })
        };
    }

    // NEEDS_VERIFICATION with next_action -> fetch that instruction from KB
    if (resolution.status === 'needs_verification' && resolution.next_action) {
        console.log(`[KBFlow] 🔄 Resolution: needs_verification with next_action: ${resolution.next_action} `);

        // Fetch the actual action from KB
        const lightData = (warningLightsKB as any)[lightType];
        const scenario = lightData?.scenarios?.[scenarioId];
        const selfFixActions = scenario?.self_fix_actions || [];
        const nextAction = selfFixActions.find((a: any) => a.id === resolution.next_action);

        if (nextAction) {
            // Return the full instruction with actual steps
            const followupOptions = nextAction.followup_question?.options || [];
            const followupLabels = followupOptions.map((opt: any) =>
                typeof opt === 'string' ? opt : opt?.label || ''
            ).filter(Boolean);

            console.log(`[KBFlow] 📋 Found next_action instruction: ${nextAction.id} `);
            console.log(`[KBFlow]   Steps: ${nextAction.steps?.length || 0} `);

            return {
                handled: true,
                response: NextResponse.json({
                    type: 'instruction',
                    title: nextAction.name || resolution.message || 'בדיקה',
                    actionType: nextAction.actionType || 'inspect',
                    steps: nextAction.steps || [],
                    warning: nextAction.warning,
                    condition: nextAction.condition,
                    question: nextAction.followup_question?.text,
                    options: followupLabels.length > 0 ? followupLabels : undefined,
                    detectedLightType: lightType,
                    kbSource: true,
                    context: mergeContext(mergedContext, {
                        shownInstructionIds: [...(context.shownInstructionIds || []), nextAction.id],
                        lastInstructionId: nextAction.id,
                        awaitingInstructionResult: true,
                        currentQuestionId: nextAction.id,
                        currentQuestionText: nextAction.followup_question?.text,
                        currentQuestionOptions: followupLabels,
                        pendingResolutionPaths: nextAction.followup_question?.resolution_paths,
                        optionMapAttempts: 0
                    })
                })
            };
        } else {
            console.log(`[KBFlow] ⚠️ next_action "${resolution.next_action}" not found in KB for verification`);
        }
    }

    // NEEDS_VERIFICATION with next_question -> ask the follow-up
    if (resolution.status === 'needs_verification' && resolution.next_question) {
        console.log('[KBFlow] 🔄 Resolution: needs_verification, asking follow-up question');
        const nextQ = resolution.next_question;
        const optionLabels = (nextQ.options || []).map((o: any) =>
            typeof o === 'object' ? o.label : o
        );
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
                    optionMapAttempts: 0,
                    // Store the nested resolution_paths for next iteration
                    pendingResolutionPaths: nextQ.resolution_paths
                })
            })
        };
    }

    return null; // Not handled by resolution_paths
}

// =============================================================================
// OPTION MAPPER AI HELPER
// =============================================================================

interface OptionMapResult {
    selectedOptionLabel: string | null;
    needClarification: string | null;
}

/**
 * Call AI to map a free-text user answer to one of the expected options.
 */
async function callOptionMapperAI(params: {
    userText: string;
    detectedLightType?: string;
    answers: UserAnswer[];
    questionText: string;
    options: string[];
    context?: any;
}): Promise<OptionMapResult> {
    const { userText, detectedLightType, answers, questionText, options } = params;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn('[OptionMapper] No API key, skipping mapping');
        return { selectedOptionLabel: null, needClarification: null };
    }

    try {
        const client: any = createOpenAIClient(apiKey, 'gpt-4o', { responseFormat: { type: 'json_object' } });

        const ctx = {
            mode: 'option_map' as const,
            currentQuestionText: questionText,
            currentQuestionOptions: options
        };

        const prompt = buildChatPrompt(
            userText,
            answers,
            false,
            answers.length,
            detectedLightType ?? null,
            ctx
        );

        console.log(`[OptionMapper] 🎯 Mapping "${userText}" to options: [${options.join(', ')}]`);

        const raw = await client.generateContent(prompt, {
            responseFormat: { type: 'json_object' }
        });

        const parsed = extractJSON(raw);
        if (!parsed) {
            console.warn('[OptionMapper] Failed to parse JSON response');
            return { selectedOptionLabel: null, needClarification: null };
        }

        const selectedLabel = parsed.selectedOptionLabel ?? null;
        const clarification = parsed.needClarification ?? null;

        // Validate that selectedLabel is actually one of the options
        if (selectedLabel && options.includes(selectedLabel)) {
            console.log(`[OptionMapper] ✅ Mapped to: "${selectedLabel}"`);
            return { selectedOptionLabel: selectedLabel, needClarification: null };
        }

        if (clarification) {
            console.log(`[OptionMapper] ❓ Needs clarification: "${clarification}"`);
            return { selectedOptionLabel: null, needClarification: clarification };
        }

        console.log('[OptionMapper] ⚠️ No valid mapping found');
        return { selectedOptionLabel: null, needClarification: null };
    } catch (err) {
        console.error('[OptionMapper] Error:', err);
        return { selectedOptionLabel: null, needClarification: null };
    }
}

// =============================================================================
// KB FLOW (Warning lights)
// =============================================================================
export async function handleKBFlow(req: RequestContext): Promise<FlowResult> {
    const { userText, answers, context } = req;

    if (!context?.detectedLightType || context.detectedLightType === 'unidentified_light') {
        return { response: null, handled: false };
    }

    const lightType = context.detectedLightType;
    const uiSeverity = context.lightSeverity || 'caution';

    // 📋 CONVERSATION LOG: Log current state
    console.log(`\n${'='.repeat(60)} `);
    console.log(`[KBFlow] 📋 CONVERSATION STATE: `);
    console.log(`  Light: ${lightType} | Scenario: ${context.currentLightScenario || 'detecting...'} | Severity: ${uiSeverity} `);
    console.log(`  Last Question: "${(context as any).currentQuestionText || 'N/A'}"`);
    console.log(`  User Answer: "${userText}"`);
    console.log(`  Total Answers: ${answers?.length || 0} `);
    if (context.causeScores && Object.keys(context.causeScores).length > 0) {
        console.log(`  Current Scores: ${JSON.stringify(context.causeScores)} `);
    }
    console.log(`${'='.repeat(60)} \n`);

    // ---------------------------------------------------------------------------
    // Option Mapping: If user typed free-text and we have expected options
    // ---------------------------------------------------------------------------
    let effectiveText = userText;
    const currentOptions = (context as any).currentQuestionOptions as string[] | undefined;
    const optionMapAttempts = ((context as any).optionMapAttempts ?? 0) as number;

    if (
        currentOptions &&
        Array.isArray(currentOptions) &&
        currentOptions.length > 0 &&
        userText &&
        !currentOptions.includes(userText.trim()) &&
        optionMapAttempts < 1
    ) {
        const mapResult = await callOptionMapperAI({
            userText,
            detectedLightType: lightType,
            answers,
            questionText: (context as any).currentQuestionText ?? 'בחר/י אפשרות',
            options: currentOptions,
            context
        });

        if (mapResult.selectedOptionLabel) {
            effectiveText = mapResult.selectedOptionLabel;
            console.log(`[KBFlow] 🔄 Mapped user input to: "${effectiveText}"`);
        } else if (mapResult.needClarification) {
            // Ask for clarification without advancing
            return {
                handled: true,
                response: NextResponse.json({
                    type: 'question',
                    text: mapResult.needClarification,
                    options: currentOptions,
                    detectedLightType: lightType,
                    lightSeverity: uiSeverity,
                    kbSource: true,
                    context: mergeContext(context, {
                        optionMapAttempts: optionMapAttempts + 1
                    })
                })
            };
        }
        // else: fallback, continue with original userText
    }

    // Determine scenario (based on first question answer)
    let scenarioId: string | undefined = context.currentLightScenario || undefined;
    const isNewScenario = !scenarioId;
    if (!scenarioId) {
        scenarioId = determineScenario(lightType, answers) || undefined;
        console.log(`[KBFlow] 🎯 Scenario: ${scenarioId ?? 'none'} `);
    }
    if (!scenarioId) return { response: null, handled: false };

    // Critical immediate action (e.g., oil pressure / coolant temp while driving)
    const immediateAction = checkImmediateAction(lightType, scenarioId);
    const shownImmediate = context.shownInstructionIds?.includes('immediate_action');

    if (immediateAction && !shownImmediate) {
        console.log('[KBFlow] 🚨 IMMEDIATE ACTION:', immediateAction);

        // Build resolution paths for the confirmation question
        // These will trigger the appropriate next action based on user response
        const immediateResolutionPaths: Record<string, any> = {
            'כן, עצרתי': {
                status: 'wait_and_verify',
                next_action: 'check_dipstick_emergency',
                message: 'מצוין! עכשיו נבדוק את מפלס השמן.'
            },
            'אני בדרך לעצור': {
                status: 'critical',
                message: '⚠️ עצור לחלוטין וכבה את המנוע מיד!'
            },
            'לא יכול': {
                status: 'needs_tow',
                diagnosis: 'לא ניתן לעצור את הרכב',
                recommendation: 'נסה לעצור בצד הדרך. אם לא ניתן - התקשר לגרר מיד.'
            }
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
                    shownInstructionIds: [...(context.shownInstructionIds || []), 'immediate_action'],
                    currentQuestionId: 'immediate_action_confirm',
                    currentQuestionText: 'האם עצרת וכיבית את המנוע?',
                    currentQuestionOptions: ['כן, עצרתי', 'אני בדרך לעצור', 'לא יכול'],
                    pendingResolutionPaths: immediateResolutionPaths,
                    optionMapAttempts: 0
                })
            })
        };
    }

    // NEW: Apply initial score boost when scenario is newly determined
    // Some scenarios already indicate a strong symptom (e.g., "car pulling to side" = puncture)
    let baseScores = { ...(context.causeScores || {}) };
    if (isNewScenario) {
        baseScores = applyScenarioBoost(lightType, scenarioId, baseScores);
    }

    // Score update based on last asked question
    const lastQuestionId = context.currentQuestionId || 'first_question';
    const updatedScores = updateScores(baseScores, lastQuestionId, effectiveText, lightType, scenarioId);


    // ---------------------------------------------------------------------------
    // Check for KB resolution_paths (from followup_question of self_fix_action)
    // ---------------------------------------------------------------------------

    // First check if we have pending resolution_paths from a nested verification question
    if ((context as any).pendingResolutionPaths) {
        const pendingPaths = (context as any).pendingResolutionPaths;

        // Try to find the option ID from the effectiveText (it might be a label)
        let optionId = effectiveText;
        const currentOpts = (context as any).currentQuestionOptions as string[] | undefined;

        // If currentQuestionOptions are available, try matching by index or exact match
        if (currentOpts && pendingPaths) {
            // Check each key in pendingPaths
            for (const key of Object.keys(pendingPaths)) {
                if (effectiveText.includes(key) || key.includes(effectiveText) || effectiveText === key) {
                    optionId = key;
                    break;
                }
            }
        }

        const resolution = pendingPaths[optionId];
        if (resolution) {
            console.log(`[KBFlow] 📋 Found pending resolution_path for: ${optionId} `);
            const result = handleResolutionPath(resolution, lightType, scenarioId, context, updatedScores);
            if (result) return result;
        }
    }

    // Then try to look up resolution_paths from KB
    const kbResolution = lookupResolutionPath(lightType, scenarioId, context.currentQuestionId, effectiveText);
    if (kbResolution) {
        const result = handleResolutionPath(kbResolution, lightType, scenarioId, context, updatedScores);
        if (result) return result;
    }

    // ---------------------------------------------------------------------------
    // Fallback: Check for RESOLVED option by pattern matching
    // ---------------------------------------------------------------------------
    if (isResolvedOption(effectiveText)) {
        console.log('[KBFlow] ✅ User indicated problem is RESOLVED');
        const resolvedIssue = getResolvedIssueDescription(lightType, context);
        return {
            handled: true,
            response: NextResponse.json({
                type: 'diagnosis_report',
                title: 'נפתר',
                severity: 'low',
                confidence: 0.8,
                results: [
                    {
                        issue: resolvedIssue,
                        probability: 0.8,
                        explanation: 'המשתמש דיווח שהנורה כבתה לאחר הפעולה שביצע'
                    }
                ],
                status: {
                    color: 'green',
                    text: 'הבעיה נפתרה',
                    instruction: 'ניתן להמשיך כרגיל'
                },
                recommendations: [
                    'בדוק שוב מחר בבוקר',
                    'אם הנורה חוזרת – פנה למוסך'
                ],
                endConversation: true,
                context: mergeContext(context, {
                    currentLightScenario: scenarioId,
                    causeScores: updatedScores
                })
            })
        };
    }

    // Build askedIds BEFORE checking shouldDiagnose
    const askedIds = [...(context.askedQuestionIds || [])];
    if (!askedIds.includes(lastQuestionId)) askedIds.push(lastQuestionId);

    // FIXED: Use askedIds.length (KB questions only) instead of answers.length (all answers including AI Expert)
    // This prevents premature diagnosis when KB flow starts after several AI Expert questions
    const kbQuestionCount = askedIds.length;

    if (shouldDiagnose(updatedScores, kbQuestionCount, uiSeverity)) {
        const diagnosis = generateDiagnosis(
            lightType,
            scenarioId,
            updatedScores,
            answers,
            context.vehicleInfo,
            context.shownInstructionIds
        );
        console.log(`[KBFlow] ✅ Generating KB diagnosis`);
        console.log(`  Top Issue: ${diagnosis.results?.[0]?.issue} `);
        console.log(`  Confidence: ${(diagnosis.confidence * 100).toFixed(0)}% (${(diagnosis.confidenceLevel || 'unknown').toUpperCase()})`);
        console.log(`  Final Scores: ${JSON.stringify(updatedScores)} `);
        return {
            handled: true,
            response: NextResponse.json(diagnosis)
        };
    }

    // ---------------------------------------------------------------------------
    // Get next step: instruction (self_fix_action) or question (cause.key_question)
    // ---------------------------------------------------------------------------
    const shownInstructionIds = context.shownInstructionIds || [];
    const nextStep = getNextStep(lightType, scenarioId, askedIds, shownInstructionIds, effectiveText);

    // Handle INSTRUCTION (self_fix_action with steps)
    if (nextStep?.kind === 'instruction') {
        const action = nextStep.action;
        const followupOptions = action.followup_question?.options || [];
        const followupLabels = followupOptions.map((opt: any) =>
            typeof opt === 'string' ? opt : opt?.label || ''
        ).filter(Boolean);

        console.log(`[KBFlow] 📋 INSTRUCTION: `);
        console.log(`  ID: ${action.id} `);
        console.log(`  Name: "${action.name}"`);
        console.log(`  Steps: ${action.steps.length} steps`);
        console.log(`  Has followup: ${!!action.followup_question} `);

        return {
            handled: true,
            response: NextResponse.json({
                type: 'instruction',
                title: action.name,
                actionType: action.actionType,
                steps: action.steps,
                warning: action.warning,
                condition: action.condition,
                // Followup question (verification after completing instruction)
                question: action.followup_question?.text,
                options: followupLabels.length > 0 ? followupLabels : undefined,
                detectedLightType: lightType,
                lightSeverity: uiSeverity,
                kbSource: true,
                context: mergeContext(context, {
                    currentLightScenario: scenarioId,
                    causeScores: updatedScores,
                    askedQuestionIds: askedIds,
                    shownInstructionIds: [...shownInstructionIds, action.id],
                    lastInstructionId: action.id,
                    awaitingInstructionResult: true,
                    currentQuestionId: action.id, // Use instruction ID for tracking
                    currentQuestionText: action.followup_question?.text,
                    currentQuestionOptions: followupLabels,
                    pendingResolutionPaths: action.followup_question?.resolution_paths,
                    optionMapAttempts: 0
                })
            })
        };
    }

    // Handle QUESTION (cause.key_question or followup)
    if (nextStep?.kind === 'question') {
        const nextQ = nextStep.question;
        console.log(`[KBFlow] ❓ NEXT QUESTION: `);
        console.log(`  ID: ${nextQ.id} `);
        console.log(`  Text: "${nextQ.text}"`);
        console.log(`  Options: [${nextQ.options.join(', ')}]`);
        console.log(`  Asked so far: [${askedIds.join(', ')}]`);
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
                    askedQuestionIds: askedIds,
                    currentQuestionId: nextQ.id,
                    currentQuestionText: nextQ.text,
                    currentQuestionOptions: nextQ.options,
                    optionMapAttempts: 0
                })
            })
        };
    }

    // No more steps: generate diagnosis
    return {
        handled: true,
        response: NextResponse.json(generateDiagnosis(
            lightType,
            scenarioId,
            updatedScores,
            answers,
            context.vehicleInfo,
            context.shownInstructionIds
        ))
    };
}

// =============================================================================
// Scenario flow (static trees in scenarios.ts)
// =============================================================================
export async function handleScenarioStep(req: RequestContext): Promise<FlowResult> {
    const { userText, context, answers } = req;

    if (!context?.currentScenarioId || !context.currentStepId) {
        return { response: null, handled: false };
    }

    const scenario: Scenario | undefined = (SCENARIOS as any)[context.currentScenarioId];
    const step = scenario?.steps?.[context.currentStepId];

    if (!scenario || !step) {
        console.log('[ScenarioStep] ⚠️ Scenario state error');
        return { response: null, handled: false };
    }

    // Choose option by label match (buttons send label text)
    const normalized = (userText || '').trim();
    const optionLabels = step.options.map(o => o.label);
    let selectedOption = step.options.find(o => o.label === normalized) ?? null;

    // ---------------------------------------------------------------------------
    // Option Mapping: If no direct match, try AI mapping
    // ---------------------------------------------------------------------------
    if (!selectedOption && normalized && optionLabels.length > 0) {
        const optionMapAttempts = ((context as any).optionMapAttempts ?? 0) as number;

        if (optionMapAttempts < 1) {
            const mapResult = await callOptionMapperAI({
                userText: normalized,
                detectedLightType: (context as any).detectedLightType,
                answers: answers || [],
                questionText: step.text,
                options: optionLabels,
                context
            });

            if (mapResult.selectedOptionLabel) {
                selectedOption = step.options.find(o => o.label === mapResult.selectedOptionLabel) ?? null;
                if (selectedOption) {
                    console.log(`[ScenarioStep] 🔄 Mapped user input to: "${mapResult.selectedOptionLabel}"`);
                }
            } else if (mapResult.needClarification) {
                // Re-ask with clarification
                return {
                    handled: true,
                    response: NextResponse.json({
                        type: 'scenario_step',
                        step: { id: step.id, text: mapResult.needClarification, options: optionLabels },
                        context: mergeContext(context, {
                            optionMapAttempts: optionMapAttempts + 1
                        })
                    })
                };
            }
        }
    }

    if (!selectedOption) {
        // Fallback: re-ask current step
        return {
            handled: true,
            response: NextResponse.json({
                type: 'scenario_step',
                step: { id: step.id, text: step.text, options: optionLabels },
                context: mergeContext(context, {
                    optionMapAttempts: 0
                })
            })
        };
    }

    // Apply actions using existing utility (keeps your report format consistent)
    const reportData = context.reportData ?? { verified: [], ruledOut: [], skipped: [], criticalFindings: [] };
    const { newScores, newReport } = updateSuspectsAndReport(
        context.suspects || {},
        selectedOption,
        scenario,
        reportData
    );
    const hasCritical = Array.isArray(newReport?.criticalFindings) && newReport.criticalFindings.length > 0;

    // Stop alert at option level
    if (selectedOption.stopAlert) {
        return {
            handled: true,
            response: NextResponse.json({
                type: 'safety_alert',
                title: selectedOption.stopAlert.title,
                message: selectedOption.stopAlert.message,
                level: 'CRITICAL',
                stopChat: true,
                context: mergeContext(context, { suspects: newScores, reportData: newReport })
            })
        };
    }

    const nextStepId = selectedOption.nextStepId;

    // End of scenario → report
    if (!nextStepId) {
        const report = generateScenarioReport(scenario, { suspects: newScores, reportData: newReport } as DiagnosticState);
        return {
            handled: true,
            response: NextResponse.json({
                type: 'diagnosis_report',
                title: `🔍 אבחון: ${report.topSuspect} `,
                confidence: Math.min(0.9, 0.5 + report.score * 0.1),
                summary: { detected: newReport.verified, reported: newReport.criticalFindings },
                results: [
                    { issue: report.topSuspect, probability: 0.8, explanation: newReport.verified.join(', ') || '' }
                ],
                status: {
                    color: hasCritical ? 'red' : 'yellow',
                    text: report.status,
                    instruction: report.instruction
                },
                selfFix: [],
                nextSteps: 'פנה למוסך לאבחון מקצועי.',
                recommendations:
                    report.blindSpots.length > 0
                        ? [`דילגת על ${report.blindSpots.length} בדיקות`, 'מומלץ לפנות למוסך']
                        : ['מומלץ לפנות למוסך'],
                disclaimer: 'האבחון מבוסס על תיאור בלבד ואינו מחליף בדיקה מקצועית במוסך.',
                mechanicReport: {
                    topSuspect: report.topSuspect,
                    score: report.score,
                    severity: report.severity,
                    status: report.status,
                    instruction: report.instruction,
                    towConditions: report.towConditions,
                    blindSpots: report.blindSpots
                },
                towConditions: report.towConditions,
                showTowButton: hasCritical || report.severity === 'high',
                severity: report.severity,
                endConversation: true,
                context: mergeContext(context, {
                    suspects: newScores,
                    reportData: newReport,
                    currentScenarioId: null,
                    currentStepId: null,
                    activeFlow: null
                })
            })
        };
    }

    // Next step
    const nextStep = scenario.steps[nextStepId];
    if (!nextStep) {
        return { response: null, handled: false };
    }

    const nextOptions = nextStep.options.map(o => o.label);

    return {
        handled: true,
        response: NextResponse.json({
            type: 'scenario_step',
            step: { id: nextStep.id, text: nextStep.text, options: nextOptions },
            context: mergeContext(context, {
                currentScenarioId: scenario.id,
                currentStepId: nextStep.id,
                suspects: newScores,
                reportData: newReport,
                currentQuestionText: nextStep.text,
                currentQuestionOptions: nextOptions,
                optionMapAttempts: 0
            })
        })
    };
}

// =============================================================================
// Expert AI fallback
// =============================================================================
export async function callExpertAI(body: any): Promise<any> {
    const { message, description, answers = [], image_urls = [], context } = body;
    const currentInput = message || description || '';
    const detectedLight = context?.detectedLightType;

    // 🔧 CHECK: If user picked a light from the picker, jump directly to KB
    const pickedId = extractLightIdFromPicker(currentInput || '');
    if (pickedId && (warningLightsKB as any)[pickedId]) {
        const sev = (warningLightsKB as any)[pickedId]?.severity ?? 'low';
        console.log(`[Expert AI] 🎯 User picked light from picker: ${pickedId}`);
        return handleWarningLightDetection(pickedId, sev === 'critical' ? 'danger' : 'caution', context);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            { error: 'No API Key', context: mergeContext(context, { lastError: 'NO_API_KEY' }) },
            { status: 500 }
        );
    }

    const client: any = createOpenAIClient(apiKey, 'gpt-4o', { responseFormat: { type: 'json_object' } });

    const images = await Promise.all(
        (image_urls || []).slice(0, 3).map((url: string) => fetchImageAsInlineData(url).catch(() => null))
    ).then(res => res.filter(Boolean));

    const hasImages = images.length > 0;

    // 🔧 BRIDGE MODE: Text-only goes through bridge first (up to 3 questions)
    const bridgeCount = Number(context?.bridgeQuestionCount ?? 0);
    const canBridge = !hasImages && !detectedLight && bridgeCount < 3;

    const ctx = {
        mode: canBridge ? ('bridge' as const) : ('expert' as const),
        bridgeQuestionCount: bridgeCount
    };

    console.log(`[Expert AI] 🧠 Mode: ${hasImages ? 'IMAGE' : detectedLight ? 'KB' : canBridge ? 'BRIDGE' : 'EXPERT'}, bridgeCount: ${bridgeCount}`);

    // 🔧 All modes use buildChatPrompt for consistent JSON output
    const prompt = (hasImages || detectedLight || canBridge)
        ? buildChatPrompt(currentInput, answers, hasImages, answers.length, detectedLight ?? null, ctx)
        : buildChatPrompt(currentInput, answers, hasImages, answers.length, null, { mode: 'expert' as const });

    try {
        const raw = await client.generateContent(prompt, {
            images: images as any,
            responseFormat: { type: 'json_object' }
        });

        const parsed = extractJSON(raw);
        const result: any = parsed ?? {};

        // Normalize light type from AI response (many aliases)
        let lightType =
            result.warning_light ||
            result.light_type ||
            result.detected_light ||
            result.light_id ||
            result.detectedLightType ||
            detectedLight;

        if (typeof lightType === 'string') lightType = lightType.trim();

        console.log(`[Expert AI] 🔍 Detected light: ${lightType || 'none'}`);

        // If we identified a known light, jump to KB flow
        if (lightType && (warningLightsKB as any)[lightType]) {
            const severity = (CRITICAL_LIGHTS as any).includes(lightType) ? 'danger' : (context?.lightSeverity || 'caution');
            return handleWarningLightDetection(lightType, severity, context);
        }

        // 🔧 BRIDGE EXHAUSTED: Show light picker if bridge questions are exhausted
        if (!lightType && bridgeCount >= 3 && !context?.lightPickerShown) {
            console.log('[Expert AI] 🎨 Bridge exhausted, showing light picker');
            return NextResponse.json({
                type: 'question',
                text: 'כדי לדייק: איזו נורת אזהרה ראית? אם אתה לא בטוח, בחר את הקרובה ביותר.',
                options: buildLightPickerOptions(),
                context: mergeContext(context, { lightPickerShown: true, activeFlow: null })
            });
        }

        // Handle diagnosis_report or ai_response - ensure conversation ends
        if (result.type === 'diagnosis_report' || result.type === 'ai_response') {
            console.log('[Expert AI] 📋 Final response, ending conversation');
            return NextResponse.json({
                ...result,
                type: result.type === 'ai_response' ? 'diagnosis_report' : result.type,
                endConversation: true,
                context: mergeContext(context, result?.context)
            });
        }

        // 🔧 BRIDGE QUESTION: Increment counter for bridge questions
        if (result.type === 'question' && canBridge) {
            return NextResponse.json({
                ...result,
                context: mergeContext(context, {
                    bridgeQuestionCount: bridgeCount + 1,
                    isSymptomFlow: true,
                    activeFlow: null,
                    ...(result?.context ?? {})
                })
            });
        }

        // Otherwise return the AI payload as-is, but persist context
        return NextResponse.json({
            ...result,
            context: mergeContext(context, result?.context)
        });
    } catch (err: any) {
        console.error('[Expert AI] Error:', err);

        // Check if this is a content filter refusal
        const isContentFilter = err?.message?.includes('content filter') ||
            err?.message?.includes('refusal') ||
            err?.message?.includes("can't assist");

        if (isContentFilter && hasImages) {
            // Content filter blocked the image - ask user to describe in text
            return NextResponse.json({
                type: 'question',
                text: 'לא הצלחתי לזהות את התמונה. האם תוכל לתאר את נורת האזהרה במילים? (למשל: צורת הסמל, הצבע, מתי הופיעה)',
                options: buildLightPickerOptions(),
                context: mergeContext(context, {
                    activeFlow: null,
                    detectedLightType: 'unidentified_light',
                    isSymptomFlow: true,
                    bridgeQuestionCount: 0
                })
            });
        }

        return NextResponse.json({
            type: 'question',
            text: 'נתקלתי בבעיה. נסה לתאר שוב את הבעיה.',
            options: ['אנסה שוב', 'אעדיף לגשת למוסך'],
            context: mergeContext(context, { lastError: 'EXPERT_AI_ERROR' })
        });
    }
}

// =============================================================================
// Initial flow starters
// =============================================================================
export function handleWarningLightDetection(lightId: string, severity: string, existingContext?: any): any {
    const lightData = (warningLightsKB as any)[lightId];
    if (!lightData?.first_question) return null;

    const q = lightData.first_question;
    const name = lightData.names?.he?.[0] || lightId;
    const isCritical = (CRITICAL_LIGHTS as any).includes(lightId);
    const questionOptions = q.options?.map((o: any) => o.label || o) || ['כן', 'לא', 'לא בטוח'];
    const questionText = `זיהיתי ${name}. ${isCritical ? 'זו נורה קריטית! ' : ''}${q.text} `;

    const newContext = {
        detectedLightType: lightId,
        lightSeverity: isCritical ? 'danger' : severity,
        isLightContext: true,
        askedQuestionIds: ['first_question'],
        currentQuestionId: 'first_question',
        causeScores: {},
        currentQuestionText: questionText,
        currentQuestionOptions: questionOptions,
        optionMapAttempts: 0,
        activeFlow: "KB" as const
    };

    return NextResponse.json({
        type: 'question',
        text: questionText,
        options: questionOptions,
        detectedLightType: lightId,
        lightSeverity: isCritical ? 'danger' : severity,
        kbSource: true,
        context: { ...(existingContext ?? {}), ...newContext }
    });
}

export function handleScenarioStart(scenarioId: string): any {
    const scenario: Scenario | undefined = (SCENARIOS as any)[scenarioId];
    if (!scenario) return null;

    console.log(`[FlowHandler] 🎬 Starting scenario: ${scenario.title} `);
    const firstStep = scenario.steps[scenario.startingStepId];
    const suspects: Record<string, number> = {};
    scenario.suspects.forEach(s => (suspects[s.id] = 0));
    const stepOptions = firstStep.options.map(o => o.label);

    return NextResponse.json({
        type: 'scenario_start',
        title: scenario.title,
        step: { id: firstStep.id, text: firstStep.text, options: stepOptions },
        context: {
            currentScenarioId: scenario.id,
            currentStepId: firstStep.id,
            suspects,
            reportData: { verified: [], ruledOut: [], skipped: [], criticalFindings: [] },
            currentQuestionText: firstStep.text,
            currentQuestionOptions: stepOptions,
            optionMapAttempts: 0,
            activeFlow: "SCENARIO" as const
        }
    });
}

export function handleSafetyStop(rule: SafetyRule): any {
    console.log(`[FlowHandler] 🚨 CRITICAL SAFETY STOP: ${rule.id} `);

    // Rule-specific emergency instructions
    const ruleConfigs: Record<string, {
        detected: string[];
        issue: string;
        explanation: string;
        nextSteps: string;
        recommendations: string[];
        towConditions: string[];
    }> = {
        smoke_fire: {
            detected: ['עשן או אש מהרכב'],
            issue: 'סכנת שריפה ברכב',
            explanation: 'זוהו סימני עשן או אש. יש לעצור מיידית, לכבות את המנוע ולהתרחק מהרכב.',
            nextSteps: 'התרחק מהרכב לפחות 30 מטר והתקשר לכיבוי אש (102) ואז לביטוח.',
            recommendations: ['אל תפתח את המכסה!', 'התרחק מהרכב מיד', 'התקשר ל-102', 'אל תנסה לכבות לבד'],
            towConditions: ['עשן מהמנוע', 'ריח שריפה', 'להבות נראות']
        },
        brake_failure: {
            detected: ['כשל בבלמים'],
            issue: 'תקלת בלמים קריטית',
            explanation: 'הבלמים אינם פועלים כראוי. אסור להמשיך בנסיעה.',
            nextSteps: 'עצור במקום הבטוח הקרוב והזמן גרר.',
            recommendations: ['אל תמשיך לנסוע!', 'השתמש בבלם יד בזהירות', 'הזמן גרר מיידית'],
            towConditions: ['בלמים לא מגיבים', 'דוושה שוקעת לרצפה', 'רעש חריג בבלימה']
        },
        oil_pressure: {
            detected: ['אובדן לחץ שמן'],
            issue: 'לחץ שמן קריטי',
            explanation: 'לחץ השמן במנוע ירד לרמה מסוכנת. המשך נסיעה עלול לגרום לנזק בלתי הפיך למנוע.',
            nextSteps: 'כבה את המנוע מיידית ואל תנסה להניע שוב. הזמן גרר.',
            recommendations: ['כבה את המנוע מיד', 'אל תנסה להניע!', 'הזמן גרר', 'בדוק מפלס שמן אחרי שהמנוע קר'],
            towConditions: ['נורת שמן אדומה דולקת', 'רעש מנוע חריג', 'ריח שמן שרוף']
        },
        coolant_temp: {
            detected: ['התחממות יתר של המנוע'],
            issue: 'טמפרטורת מנוע קריטית',
            explanation: 'המנוע מתחמם יתר על המידה. המשך נסיעה עלול לגרום לנזק חמור.',
            nextSteps: 'עצור מיידית, כבה את המנוע והמתן שיתקרר. אל תפתח את מכסה הרדיאטור!',
            recommendations: ['עצור מיד', 'כבה את המנוע', 'אל תפתח מכסה רדיאטור!', 'המתן 30 דקות לפני בדיקה'],
            towConditions: ['מחוג טמפרטורה באדום', 'אדים מהמנוע', 'ריח מתוק של נוזל קירור']
        },
        steering_fail: {
            detected: ['תקלה בהגה'],
            issue: 'כשל במערכת ההיגוי',
            explanation: 'מערכת ההיגוי אינה מגיבה כראוי. נסיעה בתנאים אלה מסוכנת ביותר.',
            nextSteps: 'עצור בצד הדרך בזהירות מרבית והזמן גרר.',
            recommendations: ['עצור בזהירות', 'הדלק אורות חירום', 'אל תמשיך לנסוע', 'הזמן גרר'],
            towConditions: ['הגה כבד מאוד', 'הגה לא מגיב', 'רעשים בהיגוי']
        }
    };

    // Find matching config or use default
    const matchedKey = Object.keys(ruleConfigs).find(key => rule.id.includes(key));
    const config = matchedKey ? ruleConfigs[matchedKey] : {
        detected: ['מצב חירום'],
        issue: 'תקלה קריטית ברכב',
        explanation: rule.message,
        nextSteps: 'עצור מיידית במקום בטוח והזמן גרר.',
        recommendations: ['עצור מיד', 'הדלק אורות חירום', 'הזמן גרר'],
        towConditions: ['מצב חירום כללי']
    };

    // Build finalCard for FinalDiagnosisCard
    const finalCard = {
        title: 'מצב חירום',
        summary: {
            detected: config.detected,
            reported: [rule.message]
        },
        results: [{
            issue: config.issue,
            probability: 0.95,
            explanation: config.explanation
        }],
        confidence: 0.95,
        status: {
            color: 'red' as const,
            text: 'עצור מיד!',
            instruction: rule.message
        },
        nextSteps: config.nextSteps,
        recommendations: config.recommendations,
        disclaimer: 'זהו מצב חירום. האבחון מבוסס על המידע שסיפקת. פעל בהתאם להנחיות הבטיחות.',
        showTowButton: true,
        severity: 'critical' as const,
        towConditions: config.towConditions,
        mechanicReport: {
            topSuspect: config.issue,
            score: 10,
            severity: 'critical' as const,
            status: 'עצור מיד!',
            instruction: config.nextSteps,
            towConditions: config.towConditions,
            blindSpots: []
        }
    };

    return NextResponse.json({
        type: 'safety_alert',
        title: 'עצור מיד!',
        message: rule.message,
        level: rule.level,
        stopChat: !!rule.endConversation,
        endConversation: !!rule.endConversation,
        followUpMessage: rule.followUpMessage,
        nextScenarioId: rule.nextScenarioId,
        finalCard
    });
}
