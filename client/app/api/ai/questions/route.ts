// app/api/ai/questions/route.ts
import { NextResponse } from 'next/server';
import { analyzeUserContext, analyzeSafetyOnly } from '@/lib/ai/context-analyzer';
import {
  handleKBFlow,
  handleScenarioStep,
  callExpertAI,
  handleWarningLightDetection,
  handleScenarioStart,
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
      const aiContext = safeMergeContext(mergedContext, { activeFlow: 'AI' }) as any;
      if (debug) aiContext.decisionTrace = decisionTrace;
      return await callExpertAI({ ...body, message: userText, context: aiContext });
    }

    // Step 2b: Continue existing SCENARIO flow
    if (context.activeFlow === 'SCENARIO' && context.currentScenarioId) {
      decisionTrace.push(['CONTINUE_SCENARIO', context.currentScenarioId]);
      const mergedContext = safeMergeContext(context, { activeFlow: 'SCENARIO' }) as any;
      if (debug) { mergedContext.debug = true; mergedContext.decisionTrace = decisionTrace; }

      const reqContext: RequestContext = {
        body: { ...body, message: userText }, userText, answers, context: mergedContext, hasImage
      };
      const scenarioResult = await handleScenarioStep(reqContext);
      if (scenarioResult.handled) return scenarioResult.response;
      decisionTrace.push(['CONTINUE_SCENARIO', 'Not handled']);
    }

    // Step 3: Image analysis
    if (hasImage) {
      decisionTrace.push(['IMAGE', 'Processing with AI']);
      const aiContext = safeMergeContext(context, { isSymptomFlow: true, activeFlow: 'AI' }) as any;
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

    if (analysis.type === 'START_SCENARIO') {
      decisionTrace.push(['START_SCENARIO', analysis.scenarioId]);
      const scenarioStart = handleScenarioStart(analysis.scenarioId);
      if (scenarioStart) return scenarioStart;
      decisionTrace.push(['START_SCENARIO', 'No definition, falling to AI']);
    }

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
