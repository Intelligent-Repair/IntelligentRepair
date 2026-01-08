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

const mergeContext = (base: any, patch: any) => ({
  ...(base ?? {}),
  ...(patch ?? {})
});

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IncomingBody;

    const answers = body.answers ?? [];
    const context = body.context ?? {};
    const image_urls = body.image_urls ?? [];

    // Normalize user text (message / description / last answer)
    let userText = body.message || body.description || '';
    if (!userText && answers.length > 0) {
      const last = answers[answers.length - 1];
      userText = last?.answer || last?.text || '';
    }

    const hasImage = image_urls.length > 0;
    const hasKnownLight =
      !!context?.detectedLightType &&
      context.detectedLightType !== 'unidentified_light';
    const hasScenario = !!context?.currentScenarioId;

    const reqContext: RequestContext = {
      body,
      userText,
      answers,
      context,
      hasImage
    };

    // =========================================================
    // Step 1: Safety check – ALWAYS
    // =========================================================
    const safetyRule = analyzeSafetyOnly(userText);
    if (safetyRule) {
      return handleSafetyStop(safetyRule);
    }

    // =========================================================
    // Step 2: Continue existing flows
    // =========================================================
    if (hasKnownLight) {
      const result = await handleKBFlow(reqContext);
      if (result.handled) return result.response;

      return await callExpertAI({
        ...body,
        context: mergeContext(context, { isLightContext: true })
      });
    }

    if (hasScenario) {
      const result = await handleScenarioStep(reqContext);
      if (result.handled) return result.response;

      return await callExpertAI({
        ...body,
        context: mergeContext(context, { isSymptomFlow: true })
      });
    }

    // =========================================================
    // Step 3: Image-only path (no flow yet)
    // =========================================================
    if (hasImage) {
      return await callExpertAI({
        ...body,
        context: mergeContext(context, { isLightContext: true })
      });
    }

    // =========================================================
    // Step 4: Fresh analysis (KB routing)
    // =========================================================
    const analysis = analyzeUserContext(userText);

    if (analysis.type === 'SAFETY_STOP') {
      return handleSafetyStop(analysis.rule);
    }

    if (analysis.type === 'WARNING_LIGHT') {
      const kbStart = handleWarningLightDetection(
        analysis.lightId,
        analysis.severity
      );
      if (kbStart) return kbStart;

      return await callExpertAI({
        ...body,
        context: mergeContext(context, {
          detectedLightType: analysis.lightId,
          isLightContext: true
        })
      });
    }

    if (analysis.type === 'START_SCENARIO') {
      const start = handleScenarioStart(analysis.scenarioId);
      if (start) return start;

      return await callExpertAI({
        ...body,
        context: mergeContext(context, { isSymptomFlow: true })
      });
    }

    // =========================================================
    // Step 5: AI fallback (keep context)
    // =========================================================
    return await callExpertAI({
      ...body,
      context: mergeContext(context, { isSymptomFlow: true })
    });
  } catch (error) {
    console.error('[Questions API] Error:', error);
    return NextResponse.json({
      type: 'question',
      text: 'נתקלתי בשגיאה. תוכל לתאר שוב את הבעיה?',
      options: ['אנסה שוב', 'אעדיף לגשת למוסך']
    });
  }
}

