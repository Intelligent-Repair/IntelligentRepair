// app/api/ai/questions/route.ts
import { NextResponse } from 'next/server';
import { analyzeUserContext, analyzeSafetyOnly } from '@/lib/ai/context-analyzer';
import {
  handleKBFlow,
  callExpertAI,
  handleWarningLightDetection,
  handleSafetyStop,
  type RequestContext
} from '@/lib/ai/flow-handlers';

type IncomingBody = {
  message?: string;
  description?: string;
  answers?: any[];
  image_urls?: string[];
  context?: any;
};

type DecisionTrace = Array<[string, string]>;

// Sanitize context: clear conflicting flow fields, remove unidentified_light sentinel
function sanitizeIncomingContext(ctx: any): any {
  const c = { ...(ctx ?? {}) };
  if (c.activeFlow === 'KB') {
    delete c.currentScenarioId; delete c.currentStepId; delete c.suspects; delete c.reportData;
  }
  if (c.activeFlow === 'SCENARIO') {
    delete c.detectedLightType; delete c.currentLightScenario; delete c.currentQuestionId;
    delete c.causeScores; delete c.askedQuestionIds; delete c.shownInstructionIds; delete c.pendingResolutionPaths;
  }
  if (c.detectedLightType === 'unidentified_light') {
    delete c.detectedLightType;
    c.pendingLightClarification = true;
  }
  return c;
}

// Safe merge: don't overwrite with null/undefined, union arrays
function safeMergeContext(base: any, patch: any): any {
  const out = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && Array.isArray(out[k])) out[k] = Array.from(new Set([...out[k], ...v]));
    else out[k] = v;
  }
  return out;
}

export async function POST(req: Request) {
  const decisionTrace: DecisionTrace = [];

  try {
    const body = (await req.json()) as IncomingBody;
    const debug = req.url.includes('debug=1') || body?.context?.debug === true;

    const userText = (body.message ?? body.description ?? '').trim();
    const answers = body.answers ?? [];
    const image_urls = body.image_urls ?? [];
    const hasImage = image_urls.length > 0;

    // Validation
    if (!userText && (answers.length === 0) && !hasImage) {
      decisionTrace.push(['VALIDATION', 'Empty input']);
      return NextResponse.json({
        type: 'error',
        text: 'לא קיבלתי הודעה. אנא תאר/י את הבעיה ברכב.',
        options: ['נסה שוב'],
        context: debug ? { decisionTrace } : {}
      }, { status: 400 });
    }

    const context = sanitizeIncomingContext(body.context);

    console.log(`[Router] 📥 "${userText.slice(0, 60)}" | flow=${context.activeFlow ?? 'none'} | light=${context.detectedLightType ?? 'none'} | scenario=${context.currentScenarioId ?? 'none'} | image=${hasImage}`);

    decisionTrace.push(['INIT', `flow=${context.activeFlow ?? 'none'}`]);

    // Step 1: Safety check
    const safetyRule = analyzeSafetyOnly(userText);
    if (safetyRule) {
      decisionTrace.push(['SAFETY_STOP', safetyRule.id]);
      return handleSafetyStop(safetyRule);
    }
    decisionTrace.push(['SAFETY', 'Passed']);

    // Step 2: Continue existing KB flow
    if (context.activeFlow === 'KB' && context.detectedLightType) {
      decisionTrace.push(['CONTINUE_KB', context.detectedLightType]);
      const mergedContext = safeMergeContext(context, { activeFlow: 'KB' }) as any;
      if (debug) { mergedContext.debug = true; mergedContext.decisionTrace = decisionTrace; }

      const reqContext: RequestContext = {
        body: { ...body, message: userText }, userText, answers, context: mergedContext, hasImage
      };
      const kbResult = await handleKBFlow(reqContext);
      if (kbResult.handled) return kbResult.response;

      // KB returned not handled (edge case fallback) - route to Expert AI
      decisionTrace.push(['KB_FALLBACK', `${context.detectedLightType} - fallback to AI`]);

      // Step 2b: Continue symptom flow - show self-fix actions if available
    } else if (context.isSymptomFlow && context.matchedSymptomId && context.hasSelfFixActions) {
      decisionTrace.push(['CONTINUE_SYMPTOM', context.matchedSymptomId]);

      // Load the symptom data to get self_fix_actions
      const carSymptomsData = await import('@/lib/knowledge/car-symptoms.json');
      let matchedSymptom: any = null;

      for (const category of (carSymptomsData as any).symptoms || []) {
        for (const mapping of category.mappings || []) {
          if (mapping.id === context.matchedSymptomId) {
            matchedSymptom = mapping;
            break;
          }
        }
        if (matchedSymptom) break;
      }

      const selfFixActions = matchedSymptom?.self_fix_actions || [];
      const firstAction = selfFixActions[0];

      if (firstAction && !context.selfFixShown) {
        // Show the self-fix action as an instruction
        decisionTrace.push(['SHOW_SELF_FIX', firstAction.id]);

        return NextResponse.json({
          type: 'instruction',
          text: `💡 הנה מה שאפשר לבדוק בעצמך: **${firstAction.name}**`,
          instruction: firstAction.name,
          steps: firstAction.steps,
          meta: {
            actionId: firstAction.id,
            difficulty: firstAction.difficulty,
            timeEstimate: firstAction.time_estimate,
            toolsNeeded: firstAction.tools_needed,
            costEstimate: firstAction.cost_estimate,
            whenToStop: firstAction.when_to_stop,
            successIndicators: firstAction.success_indicators,
            warning: firstAction.warning
          },
          options: ['ביצעתי את הבדיקה', 'אני לא יכול לבדוק', 'אני מעדיף לפנות למוסך'],
          context: safeMergeContext(context, {
            selfFixShown: true,
            currentSelfFixId: firstAction.id
          })
        });
      }

      // Self-fix was already shown or doesn't exist - go to AI
      decisionTrace.push(['SYMPTOM_TO_AI', 'After self-fix or no actions']);
      const symptomAiContext = safeMergeContext(context, { activeFlow: 'AI' }) as any;
      if (debug) symptomAiContext.decisionTrace = decisionTrace;
      return await callExpertAI({ ...body, message: userText, context: symptomAiContext });
    }

    // Note: SCENARIO flow removed - all symptom-based analysis now goes directly to AI

    // Step 3: Image analysis - use IMAGE mode, NOT symptom flow
    if (hasImage) {
      decisionTrace.push(['IMAGE', 'Processing with AI (IMAGE mode)']);
      // CRITICAL: Do NOT set isSymptomFlow=true for images! This prevents IMAGE_IDENTIFICATION mode.
      const aiContext = safeMergeContext(context, { isImageFlow: true, activeFlow: 'AI' }) as any;
      if (debug) aiContext.decisionTrace = decisionTrace;
      return await callExpertAI({ ...body, message: userText, context: aiContext });
    }

    // Step 4: Fresh analysis
    const analysis = analyzeUserContext(userText);
    decisionTrace.push(['ANALYZE', analysis.type]);

    if (analysis.type === 'SAFETY_STOP') {
      decisionTrace.push(['SAFETY_STOP', analysis.rule.id]);
      return handleSafetyStop(analysis.rule);
    }

    if (analysis.type === 'WARNING_LIGHT') {
      decisionTrace.push(['START_KB', `${analysis.lightId} (${analysis.severity})`]);
      const kbStart = handleWarningLightDetection(analysis.lightId, analysis.severity, context);
      if (kbStart) return kbStart;

      decisionTrace.push(['START_KB', 'No KB entry, falling to AI']);
      const aiContext = safeMergeContext(context, { isLightContext: true, pendingLightClarification: true, activeFlow: 'AI' }) as any;
      if (debug) aiContext.decisionTrace = decisionTrace;
      return await callExpertAI({ ...body, message: userText, context: aiContext });
    }

    // Step 4b: SYMPTOM_MATCH - Ask KB first_questions before going to AI
    if (analysis.type === 'SYMPTOM_MATCH') {
      const { symptom, category } = analysis;
      decisionTrace.push(['SYMPTOM_MATCH', `${symptom.id} (${category})`]);

      // Get first question from KB (if available)
      const firstQuestion = symptom.first_questions?.[0];
      // Get self-fix actions if available
      const selfFixActions = (symptom as any).self_fix_actions || [];
      const firstSelfFix = selfFixActions[0];

      if (firstQuestion) {
        // Ask the KB question first, but enrich context for future AI processing
        const symptomContext = safeMergeContext(context, {
          activeFlow: 'AI',
          isSymptomFlow: true,
          matchedSymptomId: symptom.id,
          matchedSymptomCategory: category,
          possibleCauses: symptom.possible_causes,
          symptomSeverity: symptom.severity,
          symptomUrgency: symptom.urgency,
          safetyNote: symptom.safety_note,
          kbQuestionsAsked: [firstQuestion],
          hasSelfFixActions: selfFixActions.length > 0
        }) as any;

        if (debug) symptomContext.decisionTrace = decisionTrace;

        // Return the KB question with options based on severity
        const options = symptom.urgency === 'now'
          ? ['כן', 'לא', 'לא בטוח', 'אני צריך עזרה מיידית']
          : ['כן', 'לא', 'לא בטוח'];

        return NextResponse.json({
          type: 'question',
          text: firstQuestion,
          options,
          kbSource: true,
          symptomInfo: {
            id: symptom.id,
            category,
            severity: symptom.severity,
            possibleCauses: symptom.possible_causes,
            safetyNote: symptom.safety_note
          },
          // Include self-fix action info for UI to show helpful tips
          selfFixAction: firstSelfFix ? {
            id: firstSelfFix.id,
            name: firstSelfFix.name,
            difficulty: firstSelfFix.difficulty,
            timeEstimate: firstSelfFix.time_estimate,
            costEstimate: firstSelfFix.cost_estimate,
            toolsNeeded: firstSelfFix.tools_needed
          } : null,
          context: symptomContext
        });
      }

      // No KB question, go directly to AI with enriched context
      const aiContext = safeMergeContext(context, {
        isSymptomFlow: true,
        matchedSymptomId: symptom.id,
        matchedSymptomCategory: category,
        possibleCauses: symptom.possible_causes,
        activeFlow: 'AI'
      }) as any;
      if (debug) aiContext.decisionTrace = decisionTrace;
      return await callExpertAI({ ...body, message: userText, context: aiContext });
    }

    // Note: START_SCENARIO removed - symptoms now go directly to AI for better handling

    // Step 5: AI fallback
    decisionTrace.push(['AI_FALLBACK', 'No match']);
    const aiContext = safeMergeContext(context, { isSymptomFlow: true, activeFlow: 'AI' }) as any;
    if (debug) aiContext.decisionTrace = decisionTrace;
    return await callExpertAI({ ...body, message: userText, context: aiContext });

  } catch (error) {
    console.error('[Router] Error:', error);
    decisionTrace.push(['ERROR', error instanceof Error ? error.message : 'Unknown']);
    return NextResponse.json({
      type: 'question',
      text: 'נתקלתי בשגיאה. תוכל לתאר שוב את הבעיה?',
      options: ['אנסה שוב', 'אעדיף לגשת למוסך'],
      context: { lastError: 'ROUTE_ERROR', decisionTrace }
    });
  }
}
