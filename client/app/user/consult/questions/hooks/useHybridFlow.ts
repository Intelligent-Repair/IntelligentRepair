"use client";

import { useState, useCallback, useRef } from "react";
import { DiagnosticState } from "@/lib/types/knowledge";

// Types for the UI state
export type Message = {
  id: string;
  sender: "user" | "ai" | "system";
  text: string;
  type?: string;
  images?: string[];
  meta?: any; // For holding extra data like mechanic report details
  isInstruction?: boolean; // Flag for special styling
};

export type FlowState = {
  status: "IDLE" | "PROCESSING" | "WAITING_USER" | "FINISHED" | "ERROR";
  messages: Message[];
  context: DiagnosticState; // The brain state from server
  currentOptions: string[]; // Options for the user buttons
  currentStepId?: string;   // Track current step ID
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

export function useHybridFlow() {
  const [state, setState] = useState<FlowState>({
    status: "IDLE",
    messages: [],
    context: INITIAL_CONTEXT,
    currentOptions: []
  });

  const isProcessing = useRef(false);
  // 🔧 Source of truth: refs for sync access in useCallback
  const messagesRef = useRef<Message[]>([]);
  const contextRef = useRef<DiagnosticState>(INITIAL_CONTEXT);

  // --- Helper to add messages ---
  const addMessage = useCallback((msg: Omit<Message, "id">) => {
    const newMessage = { ...msg, id: Date.now().toString() + Math.random() } as Message;
    messagesRef.current = [...messagesRef.current, newMessage];
    setState(prev => ({
      ...prev,
      messages: messagesRef.current
    }));
  }, []);

  // --- Helper to update context (single source of truth) ---
  const updateContext = useCallback((patch: Partial<DiagnosticState>) => {
    const merged = { ...contextRef.current, ...patch };
    contextRef.current = merged;
    setState(prev => ({ ...prev, context: merged }));
  }, []);

  // --- Main API Call ---
  const sendMessage = useCallback(async (
    userText: string,
    images: string[] = [],
    vehicleInfo?: any
  ) => {
    // Prevent duplicate calls
    if (isProcessing.current) {
      console.warn("[HybridFlow] Already processing, ignoring duplicate call");
      return;
    }
    isProcessing.current = true;

    // 1. Add User Message (Optimistic UI)
    if (userText) {
      addMessage({ sender: "user", text: userText, images });
    }

    setState(prev => ({ ...prev, status: "PROCESSING", currentOptions: [] }));

    try {
      // Build Q&A pairs from messagesRef (not state)
      const messages = messagesRef.current.filter(m => m.sender !== "system");
      const conversationHistory: { question: string; answer: string }[] = [];

      for (let i = 0; i < messages.length - 1; i++) {
        const q = messages[i];
        const a = messages[i + 1];

        const isAiQuestion =
          q.sender === "ai" &&
          q.type !== "instruction" &&
          q.type !== "mechanic_report" &&
          q.type !== "safety_instruction" &&
          q.isInstruction !== true;

        if (isAiQuestion && a.sender === "user") {
          conversationHistory.push({ question: q.text, answer: a.text });
        }
      }

      // Get initial description (first user message) for context
      const firstUserMessage = messagesRef.current.find(m => m.sender === "user");
      const initialDescription = firstUserMessage?.text || "";

      // Read from contextRef (source of truth)
      const currentContext = contextRef.current;

      console.log("[HybridFlow] 📤 Sending:", {
        userText: userText.slice(0, 50),
        historyPairs: conversationHistory.length,
        detectedLightType: currentContext.detectedLightType,
        activeFlow: currentContext.activeFlow
      });

      // 2. Single API Call
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
      console.log("[HybridFlow] 📥 Response type:", data.type);

      // 3. Merge context (once, consistently)
      const serverContext: Partial<DiagnosticState> = data.context ?? {};

      // Handle top-level fields that may come outside context
      const topLevelPatch: Partial<DiagnosticState> = {};
      if (data.detectedLightType) topLevelPatch.detectedLightType = data.detectedLightType;
      if (data.lightSeverity) topLevelPatch.lightSeverity = data.lightSeverity;
      if (data.kbSource !== undefined) topLevelPatch.kbSource = data.kbSource;
      if (data.isLightContext !== undefined) topLevelPatch.isLightContext = data.isLightContext;

      // Preserve known light type when server returns unidentified
      const finalLightType =
        (topLevelPatch.detectedLightType === "unidentified_light" &&
          currentContext.detectedLightType &&
          currentContext.detectedLightType !== "unidentified_light")
          ? currentContext.detectedLightType
          : (topLevelPatch.detectedLightType || serverContext.detectedLightType || currentContext.detectedLightType);

      const mergedContext: DiagnosticState = {
        ...currentContext,
        ...serverContext,
        ...topLevelPatch,
        detectedLightType: finalLightType
      };

      // Update single source of truth
      contextRef.current = mergedContext;

      // 4. Handle Response Types

      // --- A. Safety Alert (STOP) ---
      if (data.type === "safety_alert") {
        addMessage({
          sender: "system",
          type: "safety_alert",
          text: data.message,
          meta: {
            level: data.level,
            title: data.title,
            endConversation: data.endConversation,
            followUpMessage: data.followUpMessage,
            nextScenarioId: data.nextScenarioId
          }
        });

        if (data.finalCard) {
          setTimeout(() => {
            addMessage({
              sender: "ai",
              type: "mechanic_report",
              text: data.finalCard.summary?.detected?.join(', ') || 'מצב חירום',
              meta: { diagnosis: data.finalCard }
            });
          }, 1000);
        }

        if (data.endConversation || data.stopChat) {
          if (data.followUpMessage) {
            setTimeout(() => {
              addMessage({ sender: "system", text: data.followUpMessage });
            }, 1500);
          }
          setState(prev => ({
            ...prev,
            status: "FINISHED",
            currentOptions: [],
            context: mergedContext
          }));
        } else {
          setState(prev => ({
            ...prev,
            status: "WAITING_USER",
            currentOptions: ["הבנתי, אמשיך בזהירות"],
            context: { ...mergedContext, pendingScenarioId: data.nextScenarioId }
          }));
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

        setState(prev => ({
          ...prev,
          status: "WAITING_USER",
          context: mergedContext,
          currentOptions: options,
          currentStepId: mergedContext.currentStepId ?? undefined
        }));
        return;
      }

      // --- C. Safety Instruction ---
      if (data.type === "safety_instruction") {
        // Only mark as instruction if we have valid content
        const hasValidInstruction = data.instruction || data.text;

        addMessage({
          sender: "ai",
          text: hasValidInstruction || "הוראות בטיחות",
          type: "safety_instruction",
          isInstruction: !!hasValidInstruction,
          meta: {
            isCritical: true,
            actionType: 'critical',
            actionId: data.actionId,
            risk: data.risk,
            riskExplanation: data.riskExplanation,
            steps: data.steps,
            rawText: hasValidInstruction
          }
        });

        const finalOptions = data.options || ['כן, עצרתי', 'אני בדרך לעצור', 'לא יכול לעצור'];
        const finalContext = { ...mergedContext, lastActionType: "critical" as const };

        if (data.question) {
          setTimeout(() => {
            addMessage({ sender: "ai", text: data.question, type: "text" });
            setState(prev => ({
              ...prev,
              status: "WAITING_USER",
              currentOptions: finalOptions,
              context: finalContext
            }));
          }, 2000);
        } else {
          setState(prev => ({
            ...prev,
            status: "WAITING_USER",
            currentOptions: finalOptions,
            context: finalContext
          }));
        }
        return;
      }

      // --- D. Diagnosis Report (Finish) ---
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

        addMessage({
          sender: "ai",
          type: "mechanic_report",
          text: summaryText,
          meta: { diagnosis: data, title: data.title || "אבחון סופי" }
        });

        setState(prev => ({
          ...prev,
          status: "FINISHED",
          currentOptions: [],
          context: mergedContext
        }));
        return;
      }

      // --- E. Legacy AI Format (next_question) ---
      if (data.next_question && !data.type) {
        addMessage({ sender: "ai", text: data.next_question, type: "text" });

        setState(prev => ({
          ...prev,
          status: "WAITING_USER",
          currentOptions: ["כן", "לא", "לא יודע"],
          context: mergedContext
        }));
        return;
      }

      // --- F. Question or Instruction ---
      if (data.type === "question" || data.type === "instruction") {
        const isInstruction = data.type === "instruction";
        const text = isInstruction
          ? (data.instruction || data.text)
          : (data.question || data.message || data.text || data.content);
        const options = data.options || [];

        // Only set isInstruction=true if we have actual instruction content/steps
        const hasInstructionContent = isInstruction && (data.steps?.length > 0 || data.instruction);

        addMessage({
          sender: "ai",
          text: text,
          isInstruction: hasInstructionContent,
          type: isInstruction ? "instruction" : "text",
          meta: hasInstructionContent ? {
            actionType: data.actionType,
            actionId: data.actionId,
            steps: data.steps,
            name: data.name,
            rawText: text
          } : undefined
        });

        const instructionContext = isInstruction
          ? { ...mergedContext, lastActionType: data.actionType }
          : mergedContext;

        if (isInstruction && data.question) {
          setTimeout(() => {
            addMessage({ sender: "ai", text: data.question, type: "text" });
            setState(prev => ({
              ...prev,
              status: "WAITING_USER",
              currentOptions: data.options || ['הצלחתי', 'לא הצלחתי', 'צריך עזרה'],
              context: instructionContext
            }));
          }, 1500);
        } else {
          setState(prev => ({
            ...prev,
            status: "WAITING_USER",
            currentOptions: isInstruction
              ? ['הצלחתי לבצע', 'לא הצלחתי', 'צריך עזרה נוספת']
              : options,
            context: instructionContext
          }));
        }
        return;
      }

      // --- G. Unknown type fallback ---
      console.warn("[HybridFlow] Unknown response type:", data.type);
      const fallbackText = data.text || data.message || data.question || "המשך...";
      addMessage({ sender: "ai", text: fallbackText });
      setState(prev => ({
        ...prev,
        status: "WAITING_USER",
        currentOptions: data.options || [],
        context: mergedContext
      }));

    } catch (error) {
      console.error("[HybridFlow] Error:", error);
      addMessage({ sender: "system", text: "אירעה שגיאה בתקשורת. נסה שוב." });
      setState(prev => ({ ...prev, status: "ERROR", context: contextRef.current }));
    } finally {
      isProcessing.current = false;
    }
  }, [addMessage]);

  // --- Initializer ---
  const initFlow = useCallback((description: string, images: string[], vehicle: any) => {
    sendMessage(description, images, vehicle);
  }, [sendMessage]);

  return {
    state,
    initFlow,
    sendMessage,
    addMessage,
    updateContext
  };
}
