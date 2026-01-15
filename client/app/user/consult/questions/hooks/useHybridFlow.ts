"use client";

import { useState, useCallback, useRef } from "react";
import { DiagnosticState } from "@/lib/types/knowledge";

export type Message = {
  id: string;
  sender: "user" | "ai" | "system";
  text: string;
  type?: string;
  images?: string[];
  meta?: any;
  isInstruction?: boolean;
};

export type FlowState = {
  status: "IDLE" | "PROCESSING" | "WAITING_USER" | "FINISHED" | "ERROR";
  messages: Message[];
  context: DiagnosticState;
  currentOptions: string[];
  currentStepId?: string;
};

const INITIAL_CONTEXT: DiagnosticState = {
  currentScenarioId: null,
  currentStepId: null,
  suspects: {},
  reportData: {
    verified: [],
    ruledOut: [],
    skipped: [],
    criticalFindings: []
  }
};

/**
 * Validates and merges context, preserving critical fields that should never be lost.
 * This prevents issues where server returns empty/null context losing flow state.
 */
function validateAndMergeContext(
  current: DiagnosticState,
  serverContext: Partial<DiagnosticState>
): DiagnosticState {
  // Critical fields that should be preserved if server doesn't explicitly set them
  const criticalFields: (keyof DiagnosticState)[] = [
    'detectedLightType',
    'lightSeverity',
    'activeFlow',
    'currentLightScenario',
    'askedQuestionIds',
    'causeScores',
    'vehicleInfo',
    'kbSource',
    'isLightContext'
  ];

  const merged: DiagnosticState = {
    ...INITIAL_CONTEXT,
    ...serverContext
  };

  // Preserve critical fields if server didn't explicitly set them
  for (const field of criticalFields) {
    if (merged[field] === undefined && current[field] !== undefined) {
      (merged as any)[field] = current[field];
    }
  }

  return merged;
}


export function useHybridFlow() {
  const [state, setState] = useState<FlowState>({
    status: "IDLE",
    messages: [],
    context: INITIAL_CONTEXT,
    currentOptions: []
  });

  const isProcessing = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const contextRef = useRef<DiagnosticState>(INITIAL_CONTEXT);

  const addMessage = useCallback((msg: Omit<Message, "id">) => {
    const newMessage = { ...msg, id: Date.now().toString() + Math.random() } as Message;
    messagesRef.current = [...messagesRef.current, newMessage];
    setState(prev => ({ ...prev, messages: messagesRef.current }));
  }, []);

  const sendMessage = useCallback(async (
    userText: string,
    images: string[] = [],
    vehicleInfo?: any
  ) => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    if (userText) {
      addMessage({ sender: "user", text: userText, images });
    }

    setState(prev => ({ ...prev, status: "PROCESSING", currentOptions: [] }));

    try {
      const messages = messagesRef.current.filter(m => m.sender !== "system");
      const conversationHistory: { question: string; answer: string }[] = [];

      for (let i = 0; i < messages.length - 1; i++) {
        const q = messages[i];
        const a = messages[i + 1];
        const isAiQuestion = q.sender === "ai" && q.type !== "instruction" && q.type !== "mechanic_report" && q.type !== "safety_instruction" && q.isInstruction !== true;
        if (isAiQuestion && a.sender === "user") {
          conversationHistory.push({ question: q.text, answer: a.text });
        }
      }

      const firstUserMessage = messagesRef.current.find(m => m.sender === "user");
      const initialDescription = firstUserMessage?.text || "";
      const currentContext = contextRef.current;

      const response = await fetch("/api/ai/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          description: initialDescription,
          image_urls: images,
          context: currentContext,
          answers: conversationHistory,
          vehicle: vehicleInfo
        })
      });

      const data = await response.json();

      // === Server context is the source of truth ===
      // But we must preserve critical fields if server returns null/empty context
      const serverContext = data.context ?? {};
      const preservedContext = validateAndMergeContext(currentContext, serverContext);
      contextRef.current = preservedContext;
      const nextContext = preservedContext;

      // --- A. Safety Alert ---
      if (data.type === "safety_alert") {
        addMessage({
          sender: "system",
          type: "safety_alert",
          text: data.message,
          meta: { level: data.level, title: data.title, endConversation: data.endConversation, followUpMessage: data.followUpMessage, nextScenarioId: data.nextScenarioId }
        });

        if (data.finalCard) {
          setTimeout(() => {
            addMessage({ sender: "ai", type: "mechanic_report", text: data.finalCard.summary?.detected?.join(', ') || 'מצב חירום', meta: { diagnosis: data.finalCard } });
          }, 1000);
        }

        if (data.endConversation || data.stopChat) {
          if (data.followUpMessage) {
            setTimeout(() => { addMessage({ sender: "system", text: data.followUpMessage }); }, 1500);
          }
          setState(prev => ({ ...prev, status: "FINISHED", currentOptions: [], context: nextContext }));
        } else {
          setState(prev => ({ ...prev, status: "WAITING_USER", currentOptions: ["הבנתי, אמשיך בזהירות"], context: nextContext }));
        }
        return;
      }

      // --- B. Scenario Step ---
      if (data.type === "scenario_step" || data.type === "scenario_start") {
        const stepData = data.step || data.data;
        const stepText = stepData?.text || stepData?.question || "שאלה הבאה...";
        let options: string[] = [];
        if (Array.isArray(stepData?.options)) {
          options = stepData.options.map((opt: any) => typeof opt === 'string' ? opt : opt.label);
        } else if (Array.isArray(data.options)) {
          options = data.options;
        }
        addMessage({ sender: "ai", text: stepText });
        setState(prev => ({ ...prev, status: "WAITING_USER", context: nextContext, currentOptions: options, currentStepId: nextContext.currentStepId ?? undefined }));
        return;
      }

      // --- C. Safety Instruction ---
      if (data.type === "safety_instruction") {
        const hasValidInstruction = data.instruction || data.text;
        addMessage({
          sender: "ai",
          text: hasValidInstruction || "הוראות בטיחות",
          type: "safety_instruction",
          isInstruction: !!hasValidInstruction,
          meta: { isCritical: true, actionType: 'critical', actionId: data.actionId, risk: data.risk, riskExplanation: data.riskExplanation, steps: data.steps, rawText: hasValidInstruction }
        });

        const finalOptions = data.options || ['כן, עצרתי', 'אני בדרך לעצור', 'לא יכול לעצור'];

        if (data.question) {
          setTimeout(() => {
            addMessage({ sender: "ai", text: data.question, type: "text" });
            setState(prev => ({ ...prev, status: "WAITING_USER", currentOptions: finalOptions, context: nextContext }));
          }, 2000);
        } else {
          setState(prev => ({ ...prev, status: "WAITING_USER", currentOptions: finalOptions, context: nextContext }));
        }
        return;
      }

      // --- D. Diagnosis Report ---
      if (data.type === "diagnosis_report" || data.type === "diagnosis") {
        const diagnosisData = data.diagnosis || data;
        let summaryText = "אבחון הושלם";
        if (typeof data.summary === 'string') {
          summaryText = data.summary;
        } else if (typeof data.summary === 'object' && data.summary) {
          const detected = data.summary.detected || [];
          const reported = data.summary.reported || [];
          summaryText = [...detected, ...reported].filter(Boolean).join('. ') || "אבחון הושלם";
        } else if (typeof diagnosisData.summary === 'string') {
          summaryText = diagnosisData.summary;
        }

        addMessage({ sender: "ai", type: "mechanic_report", text: summaryText, meta: { diagnosis: data, title: data.title || "אבחון סופי" } });
        setState(prev => ({ ...prev, status: "FINISHED", currentOptions: [], context: nextContext }));
        return;
      }

      // --- E. Legacy AI Format ---
      if (data.next_question && !data.type) {
        addMessage({ sender: "ai", text: data.next_question, type: "text" });
        setState(prev => ({ ...prev, status: "WAITING_USER", currentOptions: ["כן", "לא", "לא יודע"], context: nextContext }));
        return;
      }

      // --- F. Question or Instruction ---
      if (data.type === "question" || data.type === "instruction") {
        const isInstruction = data.type === "instruction";
        const text = isInstruction ? (data.instruction || data.text) : (data.question || data.message || data.text || data.content);
        const options = data.options || [];
        const hasInstructionContent = isInstruction && (data.steps?.length > 0 || data.instruction);

        // Build meta with self-fix info if available
        const instructionMeta = hasInstructionContent ? {
          actionType: data.actionType || data.meta?.actionType,
          actionId: data.actionId || data.meta?.actionId,
          steps: data.steps || data.meta?.steps,
          name: data.name || data.instruction,
          rawText: text,
          // Self-fix metadata (NEW)
          difficulty: data.meta?.difficulty,
          timeEstimate: data.meta?.timeEstimate,
          toolsNeeded: data.meta?.toolsNeeded,
          costEstimate: data.meta?.costEstimate,
          warning: data.meta?.warning,
          whenToStop: data.meta?.whenToStop,
          successIndicators: data.meta?.successIndicators
        } : undefined;

        addMessage({
          sender: "ai",
          text: text,
          isInstruction: hasInstructionContent,
          type: isInstruction ? "instruction" : "text",
          meta: instructionMeta
        });

        if (isInstruction && data.question) {
          setTimeout(() => {
            addMessage({ sender: "ai", text: data.question, type: "text" });
            setState(prev => ({ ...prev, status: "WAITING_USER", currentOptions: data.options || ['הצלחתי', 'לא הצלחתי', 'צריך עזרה'], context: nextContext }));
          }, 1500);
        } else {
          setState(prev => ({
            ...prev,
            status: "WAITING_USER",
            currentOptions: isInstruction ? ['ביצעתי את הבדיקה', 'אני לא יכול לבדוק', 'מעדיף מוסך'] : options,
            context: nextContext
          }));
        }
        return;
      }

      // --- G. Unknown type fallback ---
      const fallbackText = data.text || data.message || data.question || "המשך...";
      addMessage({ sender: "ai", text: fallbackText });
      setState(prev => ({ ...prev, status: "WAITING_USER", currentOptions: data.options || [], context: nextContext }));

    } catch (error) {
      addMessage({ sender: "system", text: "אירעה שגיאה בתקשורת. נסה שוב." });
      setState(prev => ({ ...prev, status: "ERROR", context: contextRef.current }));
    } finally {
      isProcessing.current = false;
    }
  }, [addMessage]);

  const initFlow = useCallback((description: string, images: string[], vehicle: any) => {
    sendMessage(description, images, vehicle);
  }, [sendMessage]);

  return { state, initFlow, sendMessage, addMessage };
}
