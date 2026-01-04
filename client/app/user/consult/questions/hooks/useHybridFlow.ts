"use client";

import { useState, useCallback, useRef } from "react";
import { DiagnosticState } from "@/lib/types/knowledge";

// Types for the UI state
export type Message = {
  id: string;
  sender: "user" | "ai" | "system";
  text: string;
  type?: "text" | "safety_alert" | "safety_instruction" | "mechanic_report" | "instruction";
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
  // 🔧 FIX: Use ref to track messages for sync access in useCallback
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

  // --- Main API Call ---
  const sendMessage = useCallback(async (
    userText: string,
    images: string[] = [],
    vehicleInfo?: any
  ) => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    // 1. Add User Message (Optimistic UI)
    if (userText) {
      addMessage({ sender: "user", text: userText, images });
    }

    setState(prev => ({ ...prev, status: "PROCESSING", currentOptions: [] }));

    try {
      // 🔧 FIX: Build Q&A pairs for prompt context
      // The prompt expects: { question: "AI asked...", answer: "User replied..." }
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

      console.log("[HybridFlow] Sending history:", conversationHistory.length, "Q&A pairs");

      // Get initial description (first user message) for context
      const firstUserMessage = messagesRef.current.find(m => m.sender === "user");
      const initialDescription = firstUserMessage?.text || "";

      // 2. Call the Smart Router
      // 🔧 FIX: ALWAYS send context - it contains critical state like detectedLightType
      console.log("[HybridFlow] 📤 Sending context:", {
        detectedLightType: contextRef.current.detectedLightType,
        currentLightScenario: contextRef.current.currentLightScenario,
        currentScenarioId: contextRef.current.currentScenarioId,
        currentStepId: contextRef.current.currentStepId,
        causeScores: contextRef.current.causeScores
      });

      const response = await fetch("/api/ai/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          description: initialDescription, // 🔧 FIX: Always send initial problem description
          image_urls: images,
          context: contextRef.current, // 🔧 CRITICAL: Always send full context
          // 🔧 FIX: Always send conversation history for AI continuity
          answers: conversationHistory,
          vehicle: vehicleInfo
        })
      });

      const data = await response.json();
      console.log("[HybridFlow] Server Response:", data);

      // 🔧 FIX: Unified context merge using contextRef as source of truth
      const serverContext: Partial<DiagnosticState> = data.context ?? {};
      const currentContext = contextRef.current;

      // Patch שדות שעלולים להגיע בטופ-לבל (אצלכם לפעמים מגיעים גם מחוץ ל-context)
      const topLevelPatch: Partial<DiagnosticState> = {};

      const currentLight = currentContext.detectedLightType;
      const newLightFromData = (data as any).detectedLightType;
      const newLightFromContext = (serverContext as any).detectedLightType;
      const newLight = newLightFromData || newLightFromContext;

      const shouldPreserveCurrentLight =
        currentLight &&
        currentLight !== "unidentified_light" &&
        newLight === "unidentified_light";

      const shouldUpdateLight =
        newLight &&
        (!currentLight ||
          (currentLight === "unidentified_light" && newLight !== "unidentified_light") ||
          (currentLight !== "unidentified_light" && newLight !== "unidentified_light"));

      if (shouldUpdateLight && !shouldPreserveCurrentLight) {
        (topLevelPatch as any).detectedLightType = newLight;
      }

      if ((data as any).lightSeverity) (topLevelPatch as any).lightSeverity = (data as any).lightSeverity;
      if ((data as any).kbSource !== undefined) (topLevelPatch as any).kbSource = (data as any).kbSource;
      if ((data as any).isLightContext !== undefined) (topLevelPatch as any).isLightContext = (data as any).isLightContext;

      const mergedContext: DiagnosticState = {
        ...currentContext,
        ...serverContext,
        ...topLevelPatch,
        ...(shouldPreserveCurrentLight ? { detectedLightType: currentLight } : {}),
      };

      // Single source of truth
      contextRef.current = mergedContext;

      // 3. Handle Response Types

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

        // If finalCard is present, add it as a diagnosis report message
        if (data.finalCard) {
          setTimeout(() => {
            addMessage({
              sender: "ai",
              type: "mechanic_report",
              text: data.finalCard.summary?.detected?.join(', ') || 'מצב חירום',
              meta: {
                diagnosis: data.finalCard
              }
            });
          }, 1000);
        }

        // If endConversation or stopChat is true, finish (no further API calls)
        if (data.endConversation || data.stopChat) {
          // Add the follow-up message as a system message
          if (data.followUpMessage) {
            setTimeout(() => {
              addMessage({
                sender: "system",
                text: data.followUpMessage
              });
            }, 1500);
          }
          setState(prev => ({
            ...prev,
            status: "FINISHED",
            currentOptions: [],
            context: mergedContext
          }));
        } else {
          // Safety warning but conversation can continue (e.g., overheating -> scenario)
          setState(prev => ({
            ...prev,
            status: "WAITING_USER",
            currentOptions: ["הבנתי, אמשיך בזהירות"],
            // Store nextScenarioId in context for later use
            context: {
              ...mergedContext,
              pendingScenarioId: data.nextScenarioId
            }
          }));
        }
        return; // 🔴 CRITICAL: Exit early to prevent falling through
      }

      // --- B. Scenario Step (Next Question) ---
      else if (data.type === "scenario_step" || data.type === "scenario_start") {
        // Update context from server
        const newContext = mergedContext;
        const stepData = data.step || data.data; // Handle different payload structures
        const stepText = stepData?.text || stepData?.question || "שאלה הבאה...";

        // Extract options - handle both 'options' array of strings or objects
        let options: string[] = [];
        if (Array.isArray(stepData?.options)) {
          options = stepData.options.map((opt: any) => typeof opt === 'string' ? opt : opt.label);
        } else if (Array.isArray(data.options)) {
          options = data.options;
        }

        addMessage({
          sender: "ai",
          text: stepText
        });

        setState(prev => ({
          ...prev,
          status: "WAITING_USER",
          context: newContext,
          currentOptions: options,
          currentStepId: newContext.currentStepId
        }));
      }

      // --- C. CRITICAL SAFETY INSTRUCTION ---
      // 🚨 NEW: Handle immediate_action instructions with high priority
      else if (data.type === "safety_instruction") {
        console.log("[HybridFlow] 🚨 CRITICAL SAFETY INSTRUCTION received!");

        addMessage({
          sender: "ai",
          text: data.text || data.instruction,
          type: "safety_instruction",
          isInstruction: true,
          meta: {
            isCritical: true,
            actionType: 'critical',
            actionId: data.actionId,
            risk: data.risk,
            riskExplanation: data.riskExplanation,
            status: data.status
          }
        });

        // Add the followup question after a delay
        if (data.question) {
          setTimeout(() => {
            addMessage({
              sender: "ai",
              text: data.question,
              type: "text"
            });
            setState(prev => ({
              ...prev,
              status: "WAITING_USER",
              currentOptions: data.options || ['כן, עצרתי', 'אני בדרך לעצור', 'לא יכול לעצור'],
              context: {
                ...mergedContext,
                lastActionType: "critical"
              }
            }));
          }, 2000); // 2 second delay for critical safety messages
        } else {
          setState(prev => ({
            ...prev,
            status: "WAITING_USER",
            currentOptions: data.options || ['הבנתי', 'צריך עזרה נוספת'],
            context: {
              ...mergedContext,
              lastActionType: "critical"
            }
          }));
        }
      }

      // --- D. Mechanic Report (Finish) ---
      else if (data.type === "diagnosis_report" || data.type === "diagnosis") {
        // Normalize diagnosis structure
        const diagnosisData = data.diagnosis || data;

        // Handle summary - can be string or object { detected: [], reported: [] }
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

        // Use title if available
        const displayTitle = data.title || "אבחון סופי";

        addMessage({
          sender: "ai",
          type: "mechanic_report",
          text: summaryText,
          meta: {
            diagnosis: data,  // Store full diagnosis data for FinalDiagnosisCard
            title: displayTitle
          }
        });

        setState(prev => ({
          ...prev,
          status: "FINISHED",
          currentOptions: [], // No more questions
          context: mergedContext
        }));
      }

      // --- D. Legacy AI Format (next_question) ---
      // 🔧 FIX: Handle legacy AI response format with next_question instead of type
      else if (data.next_question && !data.type) {
        console.log("[HybridFlow] Legacy format detected - next_question:", data.next_question.substring(0, 50));

        addMessage({
          sender: "ai",
          text: data.next_question,
          type: "text"
        });

        // Extract options from possible_causes if available
        const options: string[] = [];
        if (data.possible_causes && Array.isArray(data.possible_causes)) {
          // Try to extract meaningful options from causes
          // For now, provide generic confirmation options
        }

        // Default options for yes/no questions
        const defaultOptions = ["כן", "לא", "לא יודע"];

        setState(prev => ({
          ...prev,
          status: "WAITING_USER",
          currentOptions: options.length > 0 ? options : defaultOptions,
          context: mergedContext
        }));
      }

      // --- E. AI Fallback / Instruction ---
      else if (data.type === "question" || data.type === "instruction") {
        const isInstruction = data.type === "instruction";
        // 🔧 FIX: Support all possible field names from AI: question, message, text, content
        const text = isInstruction
          ? (data.instruction || data.text)  // 🔧 FIX: Also accept 'text' for instructions
          : (data.question || data.message || data.text || data.content);
        const options = data.options || [];

        addMessage({
          sender: "ai",
          text: text,
          isInstruction: isInstruction,
          type: isInstruction ? "instruction" : "text",
          // 🔧 NEW: Store instruction metadata for UI rendering
          meta: isInstruction ? {
            actionType: data.actionType,
            actionId: data.actionId,
            steps: data.steps,
            name: data.name
          } : undefined
        });

        // If instruction, we might get a follow-up question immediately or need to re-ask
        if (isInstruction && data.question) {
          // Add the follow-up question as a separate message after a delay
          setTimeout(() => {
            addMessage({
              sender: "ai",
              text: data.question,
              type: "text" // Follow-up question after instruction
            });
            setState(prev => ({
              ...prev,
              status: "WAITING_USER",
              currentOptions: data.options || ['הצלחתי', 'לא הצלחתי', 'צריך עזרה'],
              context: {
                ...mergedContext,
                ...(isInstruction ? { lastActionType: data.actionType } : {})
              }
            }));
          }, 1500); // 🔧 Increased delay to give user time to read instruction
        } else {
          setState(prev => ({
            ...prev,
            status: "WAITING_USER",
            currentOptions: isInstruction
              ? ['הצלחתי לבצע', 'לא הצלחתי', 'צריך עזרה נוספת']  // 🔧 Default options for instructions
              : options,
            context: {
              ...mergedContext,
              ...(isInstruction ? { lastActionType: data.actionType } : {})
            }
          }));
        }
      }

    } catch (error) {
      console.error("[HybridFlow] Error:", error);
      addMessage({ sender: "system", text: "אירעה שגיאה בתקשורת. נסה שוב." });
      setState(prev => ({ ...prev, status: "ERROR" }));
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
    addMessage
  };
}

