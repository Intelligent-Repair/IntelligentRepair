"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ChatBubble from "./components/ChatBubble";
import TypingIndicator from "./components/TypingIndicator";
import MultiChoiceButtons from "./components/MultiChoiceButtons";
import FinalDiagnosisCard from "./components/FinalDiagnosisCard";
import { useAIStateMachine } from "./hooks/useAIStateMachine";
import type { AIQuestion, DiagnosisData, VehicleInfo } from "@/lib/ai/types";
import type { AIQuestionResponse } from "@/lib/ai/types";

interface Vehicle {
  id: string;
  manufacturer: string;
  model: string;
  year: number | null;
  license_plate: string;
}

const MAX_QUESTIONS = 5;
const SESSION_STORAGE_KEY = "consult_questions_state";

type ResearchPayload = {
  top_causes: string[];
  differentiating_factors: string[];
  summary?: string;
  raw?: string;
  reasoning?: string;
};

/**
 * Convert API response to AIQuestion
 */
function parseQuestion(data: any): AIQuestion | null {
  // Check if this is a diagnosis response
  if (data.should_finish === true || data.final_diagnosis) {
    return null;
  }

  if (!data.next_question || typeof data.next_question !== "string") {
    return null;
  }

  const isMultiChoice = data.options && Array.isArray(data.options) && data.options.length > 2;
  const options = isMultiChoice && data.options
    ? data.options.slice(0, 5)
    : data.options && Array.isArray(data.options) && data.options.length > 0
    ? data.options
    : ["כן", "לא"];

  return {
    type: isMultiChoice ? "multi" : "yesno",
    text: data.next_question,
    options: isMultiChoice ? options : undefined,
  };
}

/**
 * Convert API response to DiagnosisData
 */
function parseDiagnosis(data: any): DiagnosisData | null {
  if (data.should_finish !== true && !data.final_diagnosis) return null;

  // Handle fallback diagnosis structure (when API returns fallback)
  if (!data.final_diagnosis && data.should_finish) {
    // This is a fallback diagnosis from the API
    return {
      diagnosis: ["לא ניתן לקבוע אבחון מדויק. מומלץ לבצע בדיקה מקצועית במוסך."],
      self_checks: ["בדוק אם הבעיה מתרחשת רק בתנאים ספציפיים"],
      warnings: ["אם יש רעש חריג, עצור נסיעה מיידית"],
      disclaimer: "מידע זה הוא הערכה ראשונית בלבד ואינו מהווה תחליף לבדיקה מקצועית במוסך.",
      safety_notice: (data.safety_notice && typeof data.safety_notice === "string") ? data.safety_notice : null,
      recommendations: Array.isArray(data.recommendations) && data.recommendations.length > 0 
        ? data.recommendations 
        : ["קבע תור לבדיקה במוסך מוסמך"],
    };
  }

  if (!data.final_diagnosis) return null;

  // Parse normal diagnosis response (recommendations are at top level)
  return {
    diagnosis: Array.isArray(data.final_diagnosis.diagnosis) ? data.final_diagnosis.diagnosis : [],
    self_checks: Array.isArray(data.final_diagnosis.self_checks)
      ? data.final_diagnosis.self_checks
      : [],
    warnings: Array.isArray(data.final_diagnosis.warnings) ? data.final_diagnosis.warnings : [],
    disclaimer:
      typeof data.final_diagnosis.disclaimer === "string"
        ? data.final_diagnosis.disclaimer
        : "אבחון זה הוא הערכה בלבד ואינו מהווה תחליף לבדיקה מקצועית במוסך.",
    safety_notice:
      (data.safety_notice && typeof data.safety_notice === "string") ? data.safety_notice : null,
    recommendations: Array.isArray(data.recommendations) && data.recommendations.length > 0 
      ? data.recommendations 
      : null,
  };
}

/**
 * Store diagnosis in sessionStorage for summary page
 */
function storeDiagnosis(data: DiagnosisData, apiData: any) {
  const diagnosisData: any = { ...data };
  if (apiData.recommendations) {
    diagnosisData.recommendations = apiData.recommendations;
  }
  if (apiData.safety_notice) {
    diagnosisData.safety_notice = apiData.safety_notice;
  }
  sessionStorage.setItem("consult_diagnosis", JSON.stringify(diagnosisData));
}

/**
 * Save conversation state to sessionStorage
 */
function saveSessionState(vehicle: VehicleInfo | null, description: string, research: ResearchPayload | null, answers: any[]) {
  try {
    const state = {
      vehicle,
      description,
      research,
      answers,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save session state:", err);
  }
}

/**
 * Load conversation state from sessionStorage
 */
function loadSessionState(): { vehicle: VehicleInfo | null; description: string; research: ResearchPayload | null; answers: any[] } | null {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;
    const state = JSON.parse(stored);
    // Check if state is less than 1 hour old
    if (Date.now() - state.timestamp > 60 * 60 * 1000) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return state;
  } catch (err) {
    console.error("Failed to load session state:", err);
    return null;
  }
}

export default function QuestionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const vehicleId = searchParams.get("vehicle");
  const descriptionParam = searchParams.get("description");
  const description = descriptionParam ? decodeURIComponent(descriptionParam) : "";

  // State machine
  const { state, dispatch, helpers } = useAIStateMachine();

  // Local UI state
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const researchRef = useRef<ResearchPayload | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const initializedFromSessionRef = useRef(false);
  const isResearchFetchingRef = useRef(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      const timeoutId = setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [state.messages, isTyping]);

  // Fetch vehicle details
  useEffect(() => {
    if (!vehicleId || vehicle) return;

    const fetchVehicle = async () => {
      try {
        const response = await fetch(`/api/cars/get?car_id=${vehicleId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch vehicle");
        }
        const data = await response.json();
        setVehicle(data);
      } catch (err) {
        console.error("Error fetching vehicle:", err);
        dispatch.error("שגיאה בטעינת פרטי רכב");
      }
    };

    fetchVehicle();
  }, [vehicleId, vehicle]);

  // Initialize state machine and load from session
  useEffect(() => {
    if (hasInitializedRef.current || !vehicle) return;

    // Try to load from session first
    const sessionState = loadSessionState();
    if (sessionState && sessionState.vehicle && sessionState.description) {
      initializedFromSessionRef.current = true;
      researchRef.current = sessionState.research;
      
      // Initialize state machine with session data
      dispatch.init({
        vehicle: sessionState.vehicle,
        description: sessionState.description,
      });

      // Restore answers from session - these will be used when fetching next question
      // Note: We don't restore messages here - they will be reconstructed when we fetch the next question
      // The answers array in sessionState will be used directly in the API call
      
      hasInitializedRef.current = true;
      return;
    }

    // Initialize from URL params
    if (vehicle && description && state.status === "IDLE" && !state.vehicle) {
      dispatch.init({
        vehicle: {
          manufacturer: vehicle.manufacturer,
          model: vehicle.model,
          year: vehicle.year,
        },
        description: description.trim(),
      });
      hasInitializedRef.current = true;
    }
  }, [vehicle, description, state.status, state.vehicle]);

  // Fetch first/next question when initialized
  useEffect(() => {
    // Skip if we don't have the required data
    if (!state.vehicle || !state.description) return;
    // Skip if already processing
    if (isProcessingRef.current) return;
    // Skip if we already have a current question (waiting for answer)
    if (state.currentQuestion) return;
    // Skip if already finished
    if (state.status === "FINISHED") return;
    // Skip if we're in an error state (user needs to handle it)
    if (state.status === "ERROR") return;
    
    // If initialized from session, we still need to fetch the next question
    // The session has answers but not the current question
    const sessionState = initializedFromSessionRef.current ? loadSessionState() : null;
    const answersToUse = sessionState?.answers || [];
    
    // If we have 5+ answers, we should show diagnosis, not fetch another question
    if (answersToUse.length >= MAX_QUESTIONS) {
      // This shouldn't happen if session is valid, but handle it
      return;
    }

    let cancelled = false;
    isProcessingRef.current = true;

    const fetchFirstQuestion = async () => {
      try {
        dispatch.startAsking();
        setIsTyping(true);

        // Phase 1: research (only once, check session first)
        if (!researchRef.current && !isResearchFetchingRef.current) {
          isResearchFetchingRef.current = true;
          try {
            // Add timeout to research fetch (15 seconds max)
            const researchPromise = fetch("/api/ai/research", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                description: state.description,
                vehicle: state.vehicle!,
              }),
            });

            const timeoutPromise = new Promise<Response>((_, reject) =>
              setTimeout(() => reject(new Error("Research timeout")), 15000)
            );

            const researchRes = await Promise.race([researchPromise, timeoutPromise]);

            if (cancelled) {
              isResearchFetchingRef.current = false;
              return;
            }

            if (!researchRes.ok) {
              researchRef.current = {
                top_causes: [],
                differentiating_factors: [],
              };
            } else {
              const researchData = await researchRes.json();
              researchRef.current = {
                top_causes: Array.isArray(researchData.top_causes)
                  ? researchData.top_causes
                  : [],
                differentiating_factors: Array.isArray(researchData.differentiating_factors)
                  ? researchData.differentiating_factors
                  : [],
                summary: typeof researchData.summary === "string" ? researchData.summary : undefined,
                raw: typeof researchData.raw === "string" ? researchData.raw : undefined,
              };
            }
          } catch (err) {
            if (!cancelled) {
              console.error("Error during research phase:", err);
              // Always set fallback research data to continue flow
              researchRef.current = {
                top_causes: [],
                differentiating_factors: [],
              };
            }
          } finally {
            isResearchFetchingRef.current = false;
          }
        }

        if (cancelled) {
          setIsTyping(false);
          return;
        }

        // Get answers from session if restoring, otherwise use empty array
        const sessionState = initializedFromSessionRef.current ? loadSessionState() : null;
        const answersToUse = sessionState?.answers || [];

        // Save research to session (with current answers)
        saveSessionState(state.vehicle, state.description, researchRef.current, answersToUse);

        // Phase 2: questions
        const requestBody = {
          research: researchRef.current || { top_causes: [], differentiating_factors: [] },
          description: state.description,
          vehicle: state.vehicle!,
          answers: answersToUse,
        };
        
        console.log("[Questions Page] Calling /api/ai/questions with:", {
          descriptionLength: state.description?.length,
          vehicle: `${state.vehicle?.manufacturer} ${state.vehicle?.model}`,
          researchHasData: !!(researchRef.current?.top_causes?.length || researchRef.current?.differentiating_factors?.length),
          answersCount: answersToUse.length,
          isRestoringFromSession: initializedFromSessionRef.current,
        });
        
        // Add timeout to questions fetch (20 seconds max)
        const questionsPromise = fetch("/api/ai/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const timeoutPromise = new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("Questions API timeout")), 20000)
        );

        const response = await Promise.race([questionsPromise, timeoutPromise]);

        if (cancelled) {
          setIsTyping(false);
          return;
        }

        // API always returns 200 with valid JSON, but handle edge cases
        let data: any;
        try {
          data = await response.json();
        } catch (parseError) {
          console.error("[Questions Page] Failed to parse response:", parseError);
          // Use fallback question if parsing fails
          data = {
            should_finish: false,
            next_question: "האם יש תסמינים נוספים?",
            options: ["כן", "לא"],
          };
        }

        if (cancelled) {
          setIsTyping(false);
          return;
        }

        console.log("[Questions Page] Received response:", {
          should_finish: data.should_finish,
          has_next_question: !!data.next_question,
          has_final_diagnosis: !!data.final_diagnosis,
          options: data.options,
        });

        setIsTyping(false);

        // Check for final diagnosis first (including fallback)
        if (data.should_finish) {
          const diagnosis = parseDiagnosis(data);
          if (diagnosis) {
            dispatch.finish(diagnosis);
            storeDiagnosis(diagnosis, data);
          } else {
            // Fallback if parsing fails
            dispatch.error("לא התקבל אבחון");
          }
        } else {
          // Parse and dispatch question
          const question = parseQuestion(data);
          if (question) {
            dispatch.nextQuestion(question);
          } else {
            // If parsing fails, use a fallback question instead of error
            console.warn("[Questions Page] Failed to parse question, using fallback");
            const fallbackQuestion: AIQuestion = {
              type: "yesno",
              text: "האם יש תסמינים נוספים?",
              options: ["כן", "לא"],
            };
            dispatch.nextQuestion(fallbackQuestion);
          }
        }
      } catch (err) {
        if (cancelled) {
          setIsTyping(false);
          return;
        }
        setIsTyping(false);
        console.error("Error fetching first question:", err);
        // Instead of showing error, show a fallback question to keep flow going
        const fallbackQuestion: AIQuestion = {
          type: "yesno",
          text: "האם יש תסמינים נוספים?",
          options: ["כן", "לא"],
        };
        dispatch.nextQuestion(fallbackQuestion);
      } finally {
        setIsTyping(false);
        isProcessingRef.current = false;
      }
    };

    fetchFirstQuestion();

    return () => {
      cancelled = true;
      isProcessingRef.current = false;
      isResearchFetchingRef.current = false;
    };
  }, [state.status, state.vehicle, state.description, state.messages.length]);

  // Handle answer submission
  const handleAnswer = useCallback(
    async (answer: boolean | string) => {
      // Prevent duplicate submissions
      if (isProcessingRef.current || isTyping || !helpers.canAnswer(state)) {
        return;
      }

      const currentQuestion = state.currentQuestion;
      if (!currentQuestion || state.answers.length >= MAX_QUESTIONS) {
        return;
      }

      const answerText = typeof answer === "boolean" ? (answer ? "כן" : "לא") : answer;

      // Mark as processing immediately
      isProcessingRef.current = true;
      
      // Dispatch answer action (this adds user message)
      dispatch.answer(answerText, currentQuestion.text);
      dispatch.processing();
      setIsTyping(true);

      try {
        // Ensure research is available (should already be set from initial load)
        if (!researchRef.current && !isResearchFetchingRef.current) {
          isResearchFetchingRef.current = true;
          try {
            // Add timeout to research fetch (15 seconds max)
            const researchPromise = fetch("/api/ai/research", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                description: state.description,
                vehicle: state.vehicle!,
              }),
            });

            const timeoutPromise = new Promise<Response>((_, reject) =>
              setTimeout(() => reject(new Error("Research timeout")), 15000)
            );

            const researchRes = await Promise.race([researchPromise, timeoutPromise]);

            if (!researchRes.ok) {
              researchRef.current = {
                top_causes: [],
                differentiating_factors: [],
              };
            } else {
              const researchData = await researchRes.json();
              researchRef.current = {
                top_causes: Array.isArray(researchData.top_causes) ? researchData.top_causes : [],
                differentiating_factors: Array.isArray(researchData.differentiating_factors)
                  ? researchData.differentiating_factors
                  : [],
                summary: typeof researchData.summary === "string" ? researchData.summary : undefined,
                raw: typeof researchData.raw === "string" ? researchData.raw : undefined,
              };
            }
          } catch (err) {
            console.error("Error during research phase:", err);
            // Always set fallback research data to continue flow
            researchRef.current = {
              top_causes: [],
              differentiating_factors: [],
            };
          } finally {
            isResearchFetchingRef.current = false;
          }
        }

        // Build new answers array with current answer
        const newAnswers = [
          ...state.answers,
          { question: currentQuestion.text, answer: answerText },
        ];

        // Save to session
        saveSessionState(state.vehicle, state.description, researchRef.current, newAnswers);

        // Fetch next question or diagnosis
        // Add timeout to questions fetch (20 seconds max)
        const questionsPromise = fetch("/api/ai/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            research: researchRef.current || { top_causes: [], differentiating_factors: [] },
            description: state.description,
            vehicle: state.vehicle!,
            answers: newAnswers,
          }),
        });

        const timeoutPromise = new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("Questions API timeout")), 20000)
        );

        const response = await Promise.race([questionsPromise, timeoutPromise]);

        // API always returns 200 with valid JSON, but handle edge cases
        let data: any;
        try {
          data = await response.json();
        } catch (parseError) {
          console.error("[Questions Page] Failed to parse response:", parseError);
          // Use fallback question if parsing fails
          data = {
            should_finish: false,
            next_question: "האם יש תסמינים נוספים?",
            options: ["כן", "לא"],
          };
        }

        setIsTyping(false);

        // Check if finished (server enforces max questions - including fallback)
        if (data.should_finish === true) {
          const diagnosis = parseDiagnosis(data);
          if (diagnosis) {
            dispatch.finish(diagnosis);
            storeDiagnosis(diagnosis, data);
            // Clear session state after diagnosis
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
          } else {
            // Even if parsing fails, show fallback diagnosis
            const fallbackDiagnosis: DiagnosisData = {
              diagnosis: ["לא ניתן לקבוע אבחון מדויק. מומלץ לבצע בדיקה מקצועית."],
              self_checks: [],
              warnings: [],
              disclaimer: "מידע זה הוא הערכה ראשונית בלבד.",
              safety_notice: null,
              recommendations: null,
            };
            dispatch.finish(fallbackDiagnosis);
          }
        } else {
          // Parse and dispatch next question
          const question = parseQuestion(data);
          if (question) {
            dispatch.nextQuestion(question);
          } else {
            // If parsing fails, use a fallback question instead of error
            console.warn("[Questions Page] Failed to parse question, using fallback");
            const fallbackQuestion: AIQuestion = {
              type: "yesno",
              text: "האם יש תסמינים נוספים?",
              options: ["כן", "לא"],
            };
            dispatch.nextQuestion(fallbackQuestion);
          }
        }
      } catch (err) {
        setIsTyping(false);
        console.error("Error getting next question:", err);
        // Instead of showing error, show a fallback question to keep flow going
        const fallbackQuestion: AIQuestion = {
          type: "yesno",
          text: "האם יש תסמינים נוספים?",
          options: ["כן", "לא"],
        };
        dispatch.nextQuestion(fallbackQuestion);
      } finally {
        setIsTyping(false);
        isProcessingRef.current = false;
      }
    },
    [state, dispatch, helpers, isTyping]
  );

  // Error state
  if (helpers.hasError(state)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white/10 backdrop-blur-xl border border-red-500/30 rounded-3xl shadow-2xl p-8 max-w-md">
          <div className="text-red-400 text-xl font-bold mb-4">שגיאה</div>
          <div className="text-white/70 mb-6">{state.error}</div>
          <motion.button
            onClick={() => router.push("/user/consult/form?vehicle=" + vehicleId)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full p-4 bg-gradient-to-r from-[#4A90E2] to-[#5c60ff] text-white font-bold rounded-xl"
          >
            חזור לטופס
          </motion.button>
        </div>
      </div>
    );
  }

  const currentQuestion = state.currentQuestion;

  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-[#0a0f1c] via-[#0d1424] to-[#0a0f1c] p-4 md:p-6 relative overflow-hidden"
      dir="rtl"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20% 50%, rgba(74, 144, 226, 0.03) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(106, 156, 242, 0.02) 0%, transparent 50%),
          url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")
        `,
        boxShadow: "inset 0 0 200px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.2) 100%)",
        }}
      />

      <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col relative z-10">
        <div className="flex-1 overflow-y-auto mb-4 space-y-4 py-6 px-2">
          {/* Vehicle Info Banner */}
          {vehicle && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-lg border border-white/15 rounded-3xl p-5 mb-4 shadow-[0_4px_16px_rgba(255,255,255,0.08)]"
            >
              <div className="text-white/70 text-sm mb-2">רכב נבחר</div>
              <div className="text-white font-bold text-lg">
                {vehicle.manufacturer} {vehicle.model} {vehicle.year && `(${vehicle.year})`}
              </div>
              <div className="text-white/60 text-sm">{vehicle.license_plate}</div>
            </motion.div>
          )}

          {/* Chat Messages - Render from state machine messages */}
          <AnimatePresence mode="popLayout">
            {state.messages.map((msg, index) => {
              const messageKey = `msg-${msg.id}`;
              const isLastMessage = index === state.messages.length - 1;
              const isDiagnosisMessage = msg.text === "אבחון סופי" && state.diagnosis;

              if (msg.sender === "ai") {
                // Render diagnosis message
                if (isDiagnosisMessage && state.diagnosis) {
                  return (
                    <FinalDiagnosisCard key={messageKey} diagnosis={state.diagnosis} />
                  );
                }

                // Check if this is the current question
                const isCurrentQuestion = currentQuestion && msg.text === currentQuestion.text && isLastMessage;

                return (
                  <React.Fragment key={messageKey}>
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ 
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                        delay: 0.1
                      }}
                      className="mb-4"
                    >
                      <ChatBubble
                        message={msg.text}
                        isUser={false}
                        typewriter={false}
                      />
                    </motion.div>

                    {/* Show buttons for current question */}
                    {isCurrentQuestion &&
                      helpers.canAnswer(state) && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="mb-6"
                        >
                          <MultiChoiceButtons
                            options={
                              currentQuestion.options && currentQuestion.options.length > 0
                                ? currentQuestion.options.slice(0, 5)
                                : ["כן", "לא"]
                            }
                            onSelect={(option) => handleAnswer(option)}
                            disabled={isTyping || isProcessingRef.current}
                          />
                        </motion.div>
                      )}
                  </React.Fragment>
                );
              } else {
                // User message
                return (
                  <motion.div
                    key={messageKey}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ 
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                      delay: 0.1
                    }}
                    className="mb-4"
                  >
                    <ChatBubble message={msg.text} isUser={true} />
                  </motion.div>
                );
              }
            })}
          </AnimatePresence>

          {/* Typing indicator (only when waiting for AI response) */}
          {isTyping && !helpers.isFinished(state) && (
            <AnimatePresence>
              <TypingIndicator />
            </AnimatePresence>
          )}

          {/* Action buttons after diagnosis */}
          {helpers.isFinished(state) && state.diagnosis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 25,
                delay: 0.5,
              }}
              className="flex flex-col gap-4 mb-4 w-full mt-6"
              dir="rtl"
            >
              <motion.button
                onClick={() => router.push("/user/consult/send-to-garage")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full p-5 bg-gradient-to-r from-[#4A90E2] to-[#6A9CF2] text-white font-bold text-lg rounded-full shadow-[0_4px_20px_rgba(74,144,226,0.35)] hover:shadow-[0_6px_24px_rgba(74,144,226,0.5)] transition-all duration-300"
              >
                פתיחת פנייה למוסך
              </motion.button>

              <motion.button
                onClick={() => router.push("/user")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full p-5 bg-white/10 hover:bg-white/15 backdrop-blur-md text-white font-bold text-lg rounded-full border border-white/20 hover:border-white/30 shadow-[0_4px_16px_rgba(255,255,255,0.08)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.12)] transition-all duration-300"
              >
                סיום ייעוץ (חזרה לתפריט)
              </motion.button>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>
    </div>
  );
}
