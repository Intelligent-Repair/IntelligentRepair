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

const mergeContext = (base: any, patch: any) => ({ ...(base ?? {}), ...(patch ?? {}) });

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncomingBody;

    const answers = body.answers ?? [];
    const context = body.context ?? {};
    const image_urls = body.image_urls ?? [];

    const activeFlow = context?.activeFlow ?? null;

    // Normalize user text (message/description/last answer)
    let userText = body.message || body.description || '';
    if (!userText && answers.length > 0) {
      const last = answers[answers.length - 1];
      userText = last?.answer || last?.text || '';
    }

    const hasImage = image_urls.length > 0;

    console.log(
      `[Router] 📥 "${(userText || '').slice(0, 60)}" | flow=${activeFlow ?? 'none'} | light=${context?.detectedLightType ?? 'none'} | scenario=${context?.currentScenarioId ?? 'none'} | image=${hasImage}`
    );

    // Build request context
    const reqContext: RequestContext = { body, userText, answers, context, hasImage };

    // =========================================================================
    // Step 1: Safety check ALWAYS (Anti-Gravity: no re-detection mid-flow)
    // =========================================================================
    const safetyRule = analyzeSafetyOnly(userText);
    if (safetyRule) return handleSafetyStop(safetyRule);

    // =========================================================================
    // Step 2: Continue existing flows (prefer activeFlow, fallback to legacy flags)
    // =========================================================================
    const legacyHasKnownLight =
      !!context?.detectedLightType && context.detectedLightType !== "unidentified_light";
    const legacyHasScenario = !!context?.currentScenarioId;

    if (activeFlow === "KB" || (!activeFlow && legacyHasKnownLight)) {
      const kbResult = await handleKBFlow(reqContext);
      if (kbResult.handled) return kbResult.response;
    }

    if (activeFlow === "SCENARIO" || (!activeFlow && legacyHasScenario)) {
      const scenarioResult = await handleScenarioStep(reqContext);
      if (scenarioResult.handled) return scenarioResult.response;
    }

    // =========================================================================
    // Step 3: Image path (no flow yet)
    // =========================================================================
    if (hasImage) {
      return await callExpertAI({ ...body, context: mergeContext(context, { isSymptomFlow: true }) });
    }

    // =========================================================================
    // Step 4: Fresh analysis (KB routing)
    // =========================================================================
    const analysis = analyzeUserContext(userText);

    if (analysis.type === 'SAFETY_STOP') {
      return handleSafetyStop(analysis.rule);
    }

    if (analysis.type === 'WARNING_LIGHT') {
      const kbStart = handleWarningLightDetection(analysis.lightId, analysis.severity, context);
      if (kbStart) return kbStart;

      // If KB can't start (missing light), fall back to AI but persist detectedLightType
      return await callExpertAI({
        ...body,
        context: mergeContext(context, { detectedLightType: analysis.lightId, isLightContext: true })
      });
    }

    if (analysis.type === 'START_SCENARIO') {
      const start = handleScenarioStart(analysis.scenarioId);
      if (start) return start;

      return await callExpertAI({ ...body, context: mergeContext(context, { isSymptomFlow: true }) });
    }

    // =========================================================================
    // Step 5: AI fallback (KEEP context)
    // =========================================================================
    return await callExpertAI({ ...body, context: mergeContext(context, { isSymptomFlow: true }) });
  } catch (error) {
    console.error('[Router] Error:', error);
    return NextResponse.json({
      type: 'question',
      text: 'נתקלתי בשגיאה. תוכל לתאר שוב את הבעיה?',
      options: ['אנסה שוב', 'אעדיף לגשת למוסך'],
      context: { lastError: 'ROUTE_ERROR' }
    });
  }
}
