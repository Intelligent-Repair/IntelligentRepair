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

  // --- Helper to add messages ---
  const addMessage = useCallback((msg: Omit<Message, "id">) => {
    const newMessage = { ...msg, id: Date.now().toString() + Math.random() } as Message;
    messagesRef.current = [...messagesRef.current, newMessage];
    setState(prev => ({
      ...prev,
      messages: messagesRef.current
    }));
  }, []);

  // --- Success Detection: Check if last AI messages include instruction ---
  const wasLastMessageInstruction = useCallback((): boolean => {
    const messages = messagesRef.current;
    console.log("[HybridFlow] Checking for instruction. Total messages:", messages.length);

    // 🔧 FIX: Check last TWO AI messages (instruction + follow-up question)
    // Because instruction is followed by "האם הצלחת לבצע?" which is not marked as instruction
    let aiMessagesFound = 0;
    for (let i = messages.length - 1; i >= 0 && aiMessagesFound < 2; i--) {
      const msg = messages[i];

      if (msg.sender === "ai") {
        aiMessagesFound++;
        console.log(`[HybridFlow] AI Message ${aiMessagesFound}: type=${msg.type}, isInstruction=${msg.isInstruction}`);

        // If any of the last 2 AI messages is an instruction, return true
        if (msg.type === "instruction" || msg.isInstruction === true) {
          console.log("[HybridFlow] Found instruction in recent messages!");
          return true;
        }
      }
    }
    console.log("[HybridFlow] No instruction found in last 2 AI messages");
    return false;
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

    // 🔧 FIX: Intercept success responses after instructions to ask about light
    const successPhrases = [
      "כן, הצלחתי", "הצלחתי",
      "כן, עשיתי", "עשיתי",
      "כן, מילאתי", "מילאתי",
      "כן, ניסיתי", "ניסיתי",
      "כן, בדקתי", "בדקתי",
      "כן, ביצעתי", "ביצעתי"
    ];
    const isSuccessResponse = successPhrases.some(phrase =>
      userText.includes(phrase) || userText === phrase
    );

    if (isSuccessResponse && wasLastMessageInstruction()) {
      // 🔧 NEW: Check actionType to determine flow
      const actionType = state.context?.lastActionType;
      console.log("[HybridFlow] Success after instruction - actionType:", actionType);

      if (actionType === "fill") {
        // Fill action - ask if light turned off
        console.log("[HybridFlow] Fill action - asking about light status");
        setTimeout(() => {
          addMessage({
            sender: "ai",
            text: "מעולה! עכשיו בוא נוודא שהבעיה נפתרה. האם נורת האזהרה כבתה?",
            type: "text"
          });
          setState(prev => ({
            ...prev,
            status: "WAITING_USER",
            currentOptions: ["כן, הנורה כבתה", "לא, הנורה עדיין דולקת", "לא בטוח"],
            context: { ...prev.context, awaitingLightConfirmation: true }
          }));
          isProcessing.current = false;
        }, 500);
        return; // Skip API call
      } else {
        // Inspect action or unknown - continue to AI for next step
        console.log("[HybridFlow] Inspect action - continuing to AI for next step");
        // Don't return - let API call continue for next diagnostic question
      }
    }

    // 🔧 NEW: Handle failure responses after instructions - continue diagnosis
    const failurePhrases = [
      "לא הצלחתי", "לא, לא הצלחתי",
      "לא עבד", "לא, לא עבד",
      "הפעולה לא עזרה", "זה לא עזר",
      "עדיין לא עובד", "לא פתר את הבעיה"
    ];
    const isFailureResponse = failurePhrases.some(phrase =>
      userText.includes(phrase)
    );

    if (isFailureResponse && wasLastMessageInstruction()) {
      console.log("[HybridFlow] Failure after instruction detected - continuing diagnosis");

      // Ask AI what to do next, with context that the action failed
      addMessage({
        sender: "ai",
        text: "הבנתי שהפעולה לא עזרה. בוא נבדוק אפשרויות נוספות...",
        type: "text"
      });

      // Continue to API but with context that the action failed
      setState(prev => ({ ...prev, status: "PROCESSING" }));
      // Don't return - let the API call continue with original text
      // The AI will understand from history that the action failed
    }

    // 🔧 FIX: Handle light confirmation responses - go to diagnosis
    const lightConfirmPhrases = ["כן, הנורה כבתה", "הנורה כבתה", "כן, נעלמה", "נעלמה"];
    const lightOffConfirmed = lightConfirmPhrases.some(phrase =>
      userText.includes(phrase)
    );

    if (lightOffConfirmed) {
      console.log("[HybridFlow] Light off confirmed - generating success diagnosis");

      addMessage({
        sender: "ai",
        type: "mechanic_report",
        text: "הבעיה נפתרה בהצלחה! הנורה כבתה, מה שמעיד שהפעולה שביצעת פתרה את התקלה.",
        meta: {
          diagnosis: {
            diagnosis: ["הבעיה נפתרה בהצלחה"],
            recommendations: ["המשך לעקוב אחרי לוח המחוונים", "אם הנורה חוזרת - פנה למוסך"],
            safety_notice: null
          }
        }
      });
      setState(prev => ({
        ...prev,
        status: "FINISHED",
        currentOptions: []
      }));
      isProcessing.current = false;
      return;
    }

    setState(prev => ({ ...prev, status: "PROCESSING" }));

    try {
      // 🔧 FIX: Build Q&A pairs for prompt context
      // The prompt expects: { question: "AI asked...", answer: "User replied..." }
      const messages = messagesRef.current.filter(m => m.sender !== "system");
      const conversationHistory: { question: string; answer: string }[] = [];

      // Pair AI messages (questions) with following user messages (answers)
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.sender === "ai") {
          // Find the next user message as the answer
          const nextUserMsg = messages.slice(i + 1).find(m => m.sender === "user");
          if (nextUserMsg) {
            conversationHistory.push({
              question: msg.text,
              answer: nextUserMsg.text
            });
          }
        }
      }

      console.log("[HybridFlow] Sending history:", conversationHistory.length, "Q&A pairs");

      // Get initial description (first user message) for context
      const firstUserMessage = messagesRef.current.find(m => m.sender === "user");
      const initialDescription = firstUserMessage?.text || "";

      // 2. Call the Smart Router
      // 🔧 FIX: ALWAYS send context - it contains critical state like detectedLightType
      console.log("[HybridFlow] 📤 Sending context:", {
        detectedLightType: state.context.detectedLightType,
        currentLightScenario: state.context.currentLightScenario,
        currentScenarioId: state.context.currentScenarioId,
        currentStepId: state.context.currentStepId,
        causeScores: state.context.causeScores
      });

      const response = await fetch("/api/ai/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          description: initialDescription, // 🔧 FIX: Always send initial problem description
          image_urls: images,
          context: state.context, // 🔧 CRITICAL: Always send full context
          // 🔧 FIX: Always send conversation history for AI continuity
          answers: conversationHistory,
          vehicle: vehicleInfo
        })
      });

      const data = await response.json();
      console.log("[HybridFlow] Server Response:", data);

      // 🔧 FIX: Clean merge approach for context updates
      // This handles all fields including hybrid mode (currentQuestionText, currentQuestionOptions, optionMapAttempts, mode, bridgeAttempts)
      const serverContext = data.context ?? {};

      // Top-level fields that may exist on data directly (not nested in context)
      const topLevelPatch: Partial<DiagnosticState> = {};

      // Light type handling with smart protection
      const currentLight = state.context.detectedLightType;
      const newLightFromData = data.detectedLightType;
      const newLightFromContext = serverContext.detectedLightType;
      const newLight = newLightFromData || newLightFromContext;

      // Only update light type if:
      // - No current light, OR
      // - Current is 'unidentified_light' and new is specific, OR
      // - New is specific (not 'unidentified_light')
      const shouldUpdateLight = newLight && (
        !currentLight ||
        (currentLight === 'unidentified_light' && newLight !== 'unidentified_light') ||
        (currentLight !== 'unidentified_light' && newLight !== 'unidentified_light')
      );

      // Don't let 'unidentified_light' overwrite a specific light type
      const shouldPreserveCurrentLight = currentLight &&
        currentLight !== 'unidentified_light' &&
        newLight === 'unidentified_light';

      if (shouldUpdateLight && !shouldPreserveCurrentLight) {
        topLevelPatch.detectedLightType = newLight;
        console.log("[HybridFlow] 💡 Updating light type:", currentLight, "→", newLight);
      }

      // Other top-level fields
      if (data.lightSeverity) topLevelPatch.lightSeverity = data.lightSeverity;
      if (data.kbSource !== undefined) topLevelPatch.kbSource = data.kbSource;
      if (data.isLightContext !== undefined) topLevelPatch.isLightContext = data.isLightContext;

      // Merge: prev.context <- serverContext <- topLevelPatch
      // This preserves existing values while allowing server updates
      const mergedContext: DiagnosticState = {
        ...state.context,
        ...serverContext,
        ...topLevelPatch
      };

      // Protect light type from being overwritten by unidentified_light
      if (shouldPreserveCurrentLight) {
        mergedContext.detectedLightType = currentLight;
      }

      // Update state with merged context
      const hasContextChanges = JSON.stringify(mergedContext) !== JSON.stringify(state.context);
      if (hasContextChanges) {
        setState(prev => ({
          ...prev,
          context: {
            ...prev.context,
            ...serverContext,
            ...topLevelPatch,
            // Protect light type
            ...(shouldPreserveCurrentLight ? { detectedLightType: currentLight } : {})
          }
        }));
        console.log("[HybridFlow] 📝 Context merged. New fields:", Object.keys(serverContext));
      }

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
            currentOptions: []
          }));
        } else {
          // Safety warning but conversation can continue (e.g., overheating -> scenario)
          setState(prev => ({
            ...prev,
            status: "WAITING_USER",
            currentOptions: ["הבנתי, אמשיך בזהירות"],
            // Store nextScenarioId in context for later use
            context: {
              ...prev.context,
              pendingScenarioId: data.nextScenarioId
            }
          }));
        }
        return; // 🔴 CRITICAL: Exit early to prevent falling through
      }

      // --- B. Scenario Step (Next Question) ---
      else if (data.type === "scenario_step" || data.type === "scenario_start") {
        // Update context from server
        const newContext = data.context || state.context;
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

        // Update context with safety instruction state
        if (data.context) {
          setState(prev => ({
            ...prev,
            context: {
              ...prev.context,
              ...data.context,
              lastActionType: 'critical'
            }
          }));
        }

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
            }));
          }, 2000); // 2 second delay for critical safety messages
        } else {
          setState(prev => ({
            ...prev,
            status: "WAITING_USER",
            currentOptions: data.options || ['הבנתי', 'צריך עזרה נוספת'],
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
          currentOptions: [] // No more questions
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

        // 🔧 NEW: Update context with instruction state from server
        if (isInstruction && data.context) {
          setState(prev => ({
            ...prev,
            context: {
              ...prev.context,
              ...data.context,
              lastActionType: data.actionType
            }
          }));
          console.log("[HybridFlow] 📋 Instruction context updated:", data.actionType, data.actionId);
        } else if (isInstruction && data.actionType) {
          setState(prev => ({
            ...prev,
            context: { ...prev.context, lastActionType: data.actionType }
          }));
          console.log("[HybridFlow] Stored actionType:", data.actionType);
        }

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
            }));
          }, 1500); // 🔧 Increased delay to give user time to read instruction
        } else {
          setState(prev => ({
            ...prev,
            status: "WAITING_USER",
            currentOptions: isInstruction
              ? ['הצלחתי לבצע', 'לא הצלחתי', 'צריך עזרה נוספת']  // 🔧 Default options for instructions
              : options,
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
  }, [state.context, addMessage]);

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

