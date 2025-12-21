"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ChatBubble from "./components/ChatBubble";
import TypingIndicator from "./components/TypingIndicator";
import MultiChoiceButtons from "./components/MultiChoiceButtons";
import FreeTextInput from "./components/FreeTextInput";
import FinalDiagnosisCard from "./components/FinalDiagnosisCard";
import WarningBanner from "./components/WarningBanner";
import InstructionBubble from "./components/InstructionBubble";
import { useAIStateMachine } from "./hooks/useAIStateMachine";
import type { AIQuestion, DiagnosisData, VehicleInfo } from "../../../../lib/ai/types";
import { withRetry } from "../../../../lib/ai/retry";
import { supabase } from "@/lib/supabaseClient";
import { CarFront } from "lucide-react";

interface Vehicle {
  id: string;
  manufacturer: string;
  model: string;
  year: number | null;
  license_plate: string;
}

const SESSION_STORAGE_KEY = "consult_questions_state";
const DRAFT_IMAGES_KEY = "draft_images";
const RESEARCH_TIMEOUT_MS = 35000; // 35 seconds (within 30-45 range)
const QUESTIONS_TIMEOUT_MS = 30000; // 30 seconds for questions API

type ResearchPayload = {
  top_causes: string[];
  differentiating_factors: string[];
  summary?: string;
  raw?: string;
  reasoning?: string;
};

/**
 * Safe fallback research response that never throws
 */
function createSafeResearchFallback(): ResearchPayload {
  return {
    top_causes: [],
    differentiating_factors: [],
  };
}

/**
 * Safe timeout promise that resolves with fallback instead of rejecting
 */
function createSafeTimeoutPromise<T>(timeoutMs: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    setTimeout(() => {
      console.warn(`[Questions Page] Operation timed out after ${timeoutMs}ms, using fallback`);
      resolve(fallback);
    }, timeoutMs);
  });
}

/**
 * Fetch research with retry logic and safe timeout fallback
 * NOTE: New spec - vehicle info NOT sent to API
 */
async function fetchResearchWithRetry(
  description: string,
  signal?: AbortSignal
): Promise<ResearchPayload> {
  const researchFallback = createSafeResearchFallback();

  try {
    // Wrap fetch in retry logic (max 2 retries with ~1500ms delay)
    const fetchWithRetry = () =>
      withRetry(
        async () => {
          const response = await fetch("/api/ai/research", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description,
            }),
            signal,
          });

          if (!response.ok) {
            throw new Error(`Research API returned ${response.status}`);
          }

          return response;
        },
        {
          maxRetries: 2,
          backoffMs: [1500, 1500], // ~1500ms delay between retries
        }
      );

    // Race between fetch and safe timeout
    const researchPromise = fetchWithRetry();
    const timeoutPromise = createSafeTimeoutPromise<Response>(
      RESEARCH_TIMEOUT_MS,
      new Response(
        JSON.stringify({
          success: false,
          message: "Research timed out — using fallback response.",
          data: {
            causes: [],
            suggestions: [],
            warnings: [],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const researchRes = await Promise.race([researchPromise, timeoutPromise]);

    // Parse response
    try {
      const researchData = await researchRes.json();

      // Check if this is the timeout fallback response
      if (researchData.success === false && researchData.message?.includes("timed out")) {
        console.warn("[Questions Page] Research timed out — using fallback response.");
        return researchFallback;
      }

      // Return parsed research data
      return {
        top_causes: Array.isArray(researchData.top_causes) ? researchData.top_causes : [],
        differentiating_factors: Array.isArray(researchData.differentiating_factors)
          ? researchData.differentiating_factors
          : [],
        summary: typeof researchData.summary === "string" ? researchData.summary : undefined,
        raw: typeof researchData.raw === "string" ? researchData.raw : undefined,
      };
    } catch (parseError) {
      console.error("[Questions Page] Failed to parse research response:", parseError);
      return researchFallback;
    }
  } catch (err) {
    console.error("[Questions Page] Research fetch failed after retries:", err);
    return researchFallback;
  }
}

/**
 * Convert API response to AIQuestion and optional safety warning/caution notice
 */
function parseQuestion(
  data: any
): { question: AIQuestion; safetyWarning: string | null; cautionNotice: string | null } | null {
  // Accept both "question" and "text_input" types
  if (data.type !== "question" && data.type !== "text_input") {
    return null;
  }

  const questionText = data.question || data.next_question || data.text;
  if (!questionText || typeof questionText !== "string") {
    return null;
  }

  // Check if this is a text input question (open-ended)
  const isTextInput = data.type === "text_input";
  
  // Extract options from response
  const options = Array.isArray(data.options)
    ? data.options.filter((o: any) => typeof o === "string" && o.trim()).slice(0, 5)
    : [];
  
  // Determine if this is an open-ended question (no options or empty options)
  const isOpenEnded = isTextInput || options.length === 0;
  
  // Only use fallback options for yes/no questions (not for open-ended)
  // If we have 0 options, it's an open-ended question - don't add fallback
  // If we have 1 option, it's invalid - use fallback
  // If we have 2+ options, use them as-is
  const safeOptions = isOpenEnded
    ? [] // No options for open-ended questions
    : options.length >= 2 
      ? options 
      : ["כן", "לא"]; // Fallback only for yes/no questions with invalid options

  const safetyWarning =
    typeof data.safety_warning === "string" && data.safety_warning.trim()
      ? data.safety_warning.trim()
      : null;

  const cautionNotice =
    typeof data.caution_notice === "string" && data.caution_notice.trim()
      ? data.caution_notice.trim()
      : null;

  // Determine question type
  let questionType: "yesno" | "multi" | "text";
  if (isOpenEnded) {
    questionType = "text";
  } else if (options.length === 2) {
    questionType = "yesno";
  } else {
    questionType = "multi";
  }

  return {
    question: {
      question: questionText,
      type: questionType,
      options: safeOptions.length > 0 ? safeOptions : undefined, // undefined if empty array
      shouldStop: typeof data.shouldStop === "boolean" ? data.shouldStop : false,
    },
    safetyWarning,
    cautionNotice,
  };
}

/**
 * Convert API response to DiagnosisData
 */
function parseDiagnosis(data: any): DiagnosisData | null {
  // New schema: direct diagnosis from /api/ai/questions
  if (
    data &&
    data.type === "diagnosis" &&
    typeof data.summary === "string" &&
    Array.isArray(data.results)
  ) {
    return {
      // These fields are used by the UI via FinalDiagnosisCard
      // and may not exist on the legacy DiagnosisData type,
      // so we allow them through as-is.
      ...(data as any),
    } as any;
  }

  if (data.type !== "diagnosis" && !data.final_diagnosis && data.should_finish !== true) return null;

  // Handle fallback diagnosis structure (when API returns fallback)
  if (!data.final_diagnosis && (data.should_finish || data.type === "diagnosis")) {
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

  if (!data.final_diagnosis && data.type === "diagnosis" && data.diagnosis) {
    const diag = data.diagnosis;
    return {
      diagnosis: Array.isArray(diag.diagnosis) ? diag.diagnosis : [],
      self_checks: Array.isArray(diag.self_checks) ? diag.self_checks : [],
      warnings: Array.isArray(diag.warnings) ? diag.warnings : [],
      disclaimer:
        typeof diag.disclaimer === "string"
          ? diag.disclaimer
          : "אבחון זה הוא הערכה בלבד ואינו מהווה תחליף לבדיקה מקצועית במוסך.",
      safety_notice: typeof diag.safety_notice === "string" ? diag.safety_notice : null,
      recommendations: Array.isArray(diag.recommendations) ? diag.recommendations : null,
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
  const [draftImagesLoaded, setDraftImagesLoaded] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);
  const [cautionNotice, setCautionNotice] = useState<string | null>(null);
  const researchRef = useRef<ResearchPayload | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const initializedFromSessionRef = useRef(false);
  const isResearchFetchingRef = useRef(false);
  const draftImagesRef = useRef<string[]>([]);
  const hasPushedDraftMessageRef = useRef(false);
  const previousDraftIdRef = useRef<string | null>(null);
  const initialQuestionsRequestedRef = useRef(false);
  const finalizedRequestIdRef = useRef<string | null>(null);

  // Load draft images FIRST before any reset
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(DRAFT_IMAGES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          draftImagesRef.current = parsed
            .filter((url: unknown): url is string => typeof url === "string" && url.trim().length > 0)
            .slice(0, 3);
        }
      }
      setDraftImagesLoaded(true);
    } catch (err) {
      console.error("[Questions Page] Failed to load draft images:", err);
      setDraftImagesLoaded(true);
    }
  }, []);

  // Reset draft/session state on fresh entry to avoid stale consultations
  // NOTE: This runs AFTER draft images are loaded, and does NOT clear draft_images
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      window.sessionStorage.removeItem("consult_diagnosis");
      researchRef.current = null;
      hasInitializedRef.current = false;
      initializedFromSessionRef.current = false;
      hasPushedDraftMessageRef.current = false;
      warningsShownRef.current = false;
      setSafetyWarning(null);
      setCautionNotice(null);
      // NOTE: We do NOT clear draft_images here - they are loaded in the previous effect
    } catch (err) {
      console.error("[Questions Page] Failed to reset draft/session state:", err);
    }
  }, []);

  // Track if we've already shown warnings to avoid duplicates
  const warningsShownRef = useRef(false);

  // CRITICAL: Watch for draft_id changes and clear session state when it changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkDraftId = () => {
      const currentDraftId = window.sessionStorage.getItem("draft_id");
      
      // If draft_id changed, clear all session state
      if (previousDraftIdRef.current !== null && previousDraftIdRef.current !== currentDraftId) {
        console.log(
          "[Questions Page] Draft ID changed:",
          previousDraftIdRef.current,
          "->",
          currentDraftId,
          "- Clearing session state"
        );
        // Clear all session state
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
        window.sessionStorage.removeItem("draft_images");
        window.sessionStorage.removeItem("consult_diagnosis");
        // Reset refs
        researchRef.current = null;
        hasInitializedRef.current = false;
        initializedFromSessionRef.current = false;
        hasPushedDraftMessageRef.current = false;
        draftImagesRef.current = [];
      }
      
      previousDraftIdRef.current = currentDraftId;
    };

    // Check immediately
    checkDraftId();

    // Set up interval to check for changes
    const intervalId = setInterval(checkDraftId, 500);

    // Listen to storage events
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "draft_id") {
        checkDraftId();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

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

  // Fetch user
  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (authUser) {
          setUser({ id: authUser.id });
        }
      } catch (err) {
        console.error("Error getting user:", err);
      }
    };

    getUser();
  }, []);

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

  useEffect(() => {
    if (hasPushedDraftMessageRef.current) return;
    if (!state.description) return;

    const userImages = draftImagesRef.current;
    const userText = state.description.trim();

    if (!userText && userImages.length === 0) return;

    dispatch.addMessage({
      sender: "user",
      text: userText,
      images: userImages,
    });

    hasPushedDraftMessageRef.current = true;
  }, [state.description, dispatch]);

  // Fetch first/next question when initialized
  useEffect(() => {
    // Skip if we don't have the required data
    if (!state.vehicle || !state.description) return;
    // Wait until draft images are loaded from sessionStorage (even if empty)
    if (!draftImagesLoaded) return;
    // Ensure we only trigger the initial questions request once
    if (initialQuestionsRequestedRef.current) return;
    initialQuestionsRequestedRef.current = true;
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
    
    // Log draft consultation payload for diagnose endpoint
    const draftId = typeof window !== "undefined" ? window.sessionStorage.getItem("draft_id") : null;
    const userImages = draftImagesRef.current;
    const hasImages = userImages && userImages.length > 0;
    
    if (hasImages) {
      console.log("[DIAGNOSE] draft_id:", draftId);
      console.log("[DIAGNOSE] description:", state.description);
      console.log("[DIAGNOSE] image_urls:", userImages, "count=", userImages?.length);
      console.log("[DIAGNOSE] vehicle:", state.vehicle);
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
            // Use safe research fetch with retry and timeout fallback
            // NOTE: New spec - vehicle info NOT sent to API
            const researchData = await fetchResearchWithRetry(
              state.description,
              undefined // No abort signal needed here
            );

            if (cancelled) {
              isResearchFetchingRef.current = false;
              return;
            }

            researchRef.current = researchData;
          } catch (err) {
            if (!cancelled) {
              console.error("Error during research phase:", err);
              // Always set fallback research data to continue flow
              researchRef.current = createSafeResearchFallback();
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

        const descLen = state.description ? state.description.length : 0;
        console.log("[QuestionsPage] fetchFirstQuestion start", {
          descLen,
          images: draftImagesRef.current.length,
        });

        // Phase 2: questions
        // Ensure images are sent as array of URLs (max 3)
        const imageUrls = Array.isArray(draftImagesRef.current) 
          ? draftImagesRef.current.slice(0, 3).filter(url => typeof url === "string" && url.trim().length > 0)
          : [];
        
        // Send vehicle info only when needed (for instructions about oil/pressure/coolant)
        // We'll check on backend if it's needed, but send it to be safe
        const requestBody = {
          description: state.description,
          answers: answersToUse,
          image_urls: imageUrls,
          vehicle: state.vehicle ? {
            manufacturer: state.vehicle.manufacturer,
            model: state.vehicle.model,
            year: state.vehicle.year,
          } : undefined,
        };
        
        console.log("[QuestionsPage] /api/ai/questions payload", { 
          imageCount: imageUrls.length, 
          images: imageUrls,
          descriptionLength: state.description?.length,
          answersCount: answersToUse.length,
        });
        
        // Fetch questions and surface a friendly notice if it takes too long
        const questionsPromise = fetch("/api/ai/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const timeoutId = window.setTimeout(() => {
          if (cancelled) return;
          // Stop typing indicator and inform the user while keeping the request alive
          setIsTyping(false);
          dispatch.addMessage({
            sender: "ai",
            text: "הבדיקה לוקחת יותר זמן מהרגיל, ממשיך לנתח…",
          });
        }, QUESTIONS_TIMEOUT_MS);

        let response: Response;
        try {
          response = await questionsPromise;
        } finally {
          clearTimeout(timeoutId);
        }

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

        console.log("[QuestionsPage] fetchFirstQuestion done", {
          type: data.type,
          hasOptions: !!data.options,
        });

        console.log("[Questions Page] Received response:", {
          type: data.type,
          has_next_question: !!data.next_question || !!data.question,
          has_final_diagnosis: !!data.final_diagnosis,
          options: data.options,
        });

        setIsTyping(false);

        if (data.type === "diagnosis" || data.should_finish) {
          const diagnosis = parseDiagnosis(data);
          if (diagnosis) {
            dispatch.finish(diagnosis);
            storeDiagnosis(diagnosis, data);
          } else {
            // Fallback if parsing fails - use safe fallback diagnosis instead of error
            console.warn("[Questions Page] Failed to parse diagnosis, using fallback");
            const fallbackDiagnosis: DiagnosisData = {
              diagnosis: ["לא ניתן לקבוע אבחון מדויק. מומלץ לבצע בדיקה מקצועית במוסך."],
              self_checks: ["בדוק אם הבעיה מתרחשת רק בתנאים ספציפיים"],
              warnings: ["אם יש רעש חריג, עצור נסיעה מיידית"],
              disclaimer: "מידע זה הוא הערכה ראשונית בלבד ואינו מהווה תחליף לבדיקה מקצועית במוסך.",
              safety_notice: null,
              recommendations: ["קבע תור לבדיקה במוסך מוסמך"],
            };
            dispatch.finish(fallbackDiagnosis);
            storeDiagnosis(fallbackDiagnosis, data);
          }
        } else {
        // Parse and dispatch question + optional safety warning/caution notice
        const parsed = parseQuestion(data);
        if (parsed) {
          const { question, safetyWarning: warning, cautionNotice: caution } = parsed;
          // Store warnings in state (only once, on first question)
          if (!warningsShownRef.current) {
            if (warning) {
              setSafetyWarning(warning);
            }
            if (caution) {
              setCautionNotice(caution);
            }
            warningsShownRef.current = true;
          }
          dispatch.nextQuestion(question);
        } else {
            // If parsing fails, use a fallback question instead of error
            console.warn("[Questions Page] Failed to parse question, using fallback");
            const fallbackQuestion: AIQuestion = {
              question: "האם יש תסמינים נוספים?",
              type: "multi",
              options: ["כן", "לא", "לא בטוח"],
              shouldStop: false,
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
          question: "האם יש תסמינים נוספים?",
          type: "multi",
          options: ["כן", "לא", "לא בטוח"],
          shouldStop: false,
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
  }, [state.vehicle, state.description, draftImagesLoaded]);

  // Handle answer submission
  const handleAnswer = useCallback(
    async (answer: string) => {
      // Prevent duplicate submissions
      if (helpers.isFinished(state) || isProcessingRef.current || isTyping || !helpers.canAnswer(state)) {
        return;
      }

      const currentQuestion = state.currentQuestion;
      if (!currentQuestion) {
        return;
      }

      const answerText = answer;

      // Mark as processing immediately
      isProcessingRef.current = true;
      
      // Dispatch answer action (this adds user message)
      dispatch.answer(answerText, currentQuestion.question);
      dispatch.processing();
      setIsTyping(true);

      try {
        // Ensure research is available (should already be set from initial load)
        if (!researchRef.current && !isResearchFetchingRef.current) {
          isResearchFetchingRef.current = true;
          try {
            // Use safe research fetch with retry and timeout fallback
            // NOTE: New spec - vehicle info NOT sent to API
            const researchData = await fetchResearchWithRetry(
              state.description,
              undefined // No abort signal needed here
            );
            researchRef.current = researchData;
          } catch (err) {
            console.error("Error during research phase:", err);
            // Always set fallback research data to continue flow
            researchRef.current = createSafeResearchFallback();
          } finally {
            isResearchFetchingRef.current = false;
          }
        }

        // Build new answers array with current answer
        const newAnswers = [
          ...state.answers,
          { question: currentQuestion.question, answer: answerText },
        ];

        // Log the answer for debugging
        console.log("[Questions Page] Submitting answer:", {
          question: currentQuestion.question,
          answer: answerText,
          answersCount: newAnswers.length,
        });

        // Save to session
        saveSessionState(state.vehicle, state.description, researchRef.current, newAnswers);

        // Ensure images are sent as array of URLs (max 3)
        const imageUrls = Array.isArray(draftImagesRef.current) 
          ? draftImagesRef.current.slice(0, 3).filter(url => typeof url === "string" && url.trim().length > 0)
          : [];

        console.log("[QuestionsPage] /api/ai/questions payload", { 
          imageCount: imageUrls.length, 
          images: imageUrls 
        });

        // Send vehicle info for instructions about oil/pressure/coolant
        // Backend will only use it when relevant
        const questionsPromise = fetch("/api/ai/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: state.description,
            answers: newAnswers,
            image_urls: imageUrls,
            vehicle: state.vehicle ? {
              manufacturer: state.vehicle.manufacturer,
              model: state.vehicle.model,
              year: state.vehicle.year,
            } : undefined,
          }),
        });

        const timeoutId = window.setTimeout(() => {
          // Stop typing indicator and inform the user while keeping the request alive
          setIsTyping(false);
          dispatch.addMessage({
            sender: "ai",
            text: "הבדיקה לוקחת יותר זמן מהרגיל, ממשיך לנתח…",
          });
        }, QUESTIONS_TIMEOUT_MS);

        let response: Response;
        try {
          response = await questionsPromise;
        } finally {
          clearTimeout(timeoutId);
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

        setIsTyping(false);

        if (data.type === "diagnosis" || data.should_finish === true) {
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
        } else if (data.type === "instruction") {
          // Handle instruction message - show instructions and then re-ask the question
          try {
            console.log("[Questions Page] Received instruction response:", data);
            
            const instructionText = typeof data.instruction === "string" ? data.instruction : "";
            const questionText = typeof data.question === "string" ? data.question : "";
            const options = Array.isArray(data.options) ? data.options : ["כן", "לא", "לא בטוח"];
            
            console.log("[Questions Page] Instruction data:", {
              hasInstruction: !!instructionText,
              hasQuestion: !!questionText,
              instructionLength: instructionText.length,
              questionLength: questionText.length,
              answersCount: state.answers.length,
            });
            
            if (instructionText && questionText) {
              // Safety check: only remove if we have answers
              if (state.answers.length > 0) {
                // Remove the last "uncertain" answer from state since we're re-asking
                // This prevents counting "לא בטוח" as a real answer
                console.log("[Questions Page] Removing last answer and showing instructions");
                dispatch.removeLastAnswer();
                
                // Update session state with removed answer
                const updatedAnswers = state.answers.slice(0, -1);
                saveSessionState(state.vehicle, state.description, researchRef.current, updatedAnswers);
              } else {
                console.warn("[Questions Page] No answers to remove, but received instruction");
              }
              
              // Add instruction message with special flag
              dispatch.addMessage({
                sender: "ai",
                text: instructionText,
                isInstruction: true,
              });
              
              // Then add the question to re-ask
              const questionToReAsk: AIQuestion = {
                question: questionText,
                type: "multi",
                options: options,
                shouldStop: false,
              };
              dispatch.nextQuestion(questionToReAsk);
            } else {
              // Fallback if instruction format is invalid
              console.warn("[Questions Page] Instruction response missing required fields, using fallback");
              const parsed = parseQuestion(data);
              if (parsed) {
                dispatch.nextQuestion(parsed.question);
              } else {
                const fallbackQuestion: AIQuestion = {
                  question: "האם יש תסמינים נוספים?",
                  type: "multi",
                  options: ["כן", "לא", "לא בטוח"],
                  shouldStop: false,
                };
                dispatch.nextQuestion(fallbackQuestion);
              }
            }
          } catch (instructionError) {
            console.error("[Questions Page] Error handling instruction:", instructionError);
            // Fallback to regular question flow
            const parsed = parseQuestion(data);
            if (parsed) {
              dispatch.nextQuestion(parsed.question);
            } else {
              const fallbackQuestion: AIQuestion = {
                question: "האם יש תסמינים נוספים?",
                type: "multi",
                options: ["כן", "לא", "לא בטוח"],
                shouldStop: false,
              };
              dispatch.nextQuestion(fallbackQuestion);
            }
          }
        } else {
        // Parse and dispatch next question (warnings are only for first question, so we ignore them here)
        const parsed = parseQuestion(data);
        if (parsed) {
          dispatch.nextQuestion(parsed.question);
        } else {
            // If parsing fails, use a fallback question instead of error
            console.warn("[Questions Page] Failed to parse question, using fallback");
            const fallbackQuestion: AIQuestion = {
              question: "האם יש תסמינים נוספים?",
              type: "multi",
              options: ["כן", "לא", "לא בטוח"],
              shouldStop: false,
            };
            dispatch.nextQuestion(fallbackQuestion);
          }
        }
      } catch (err) {
        setIsTyping(false);
        console.error("Error getting next question:", err);
        // Instead of showing error, show a fallback question to keep flow going
        const fallbackQuestion: AIQuestion = {
          question: "האם יש תסמינים נוספים?",
          type: "multi",
          options: ["כן", "לא", "לא בטוח"],
          shouldStop: false,
        };
        dispatch.nextQuestion(fallbackQuestion);
      } finally {
        setIsTyping(false);
        isProcessingRef.current = false;
      }
    },
    [state, dispatch, helpers, isTyping]
  );
  // Finalize draft and create request (idempotent-safe)
  const finalizeDraftAndCreateRequest = useCallback(async (): Promise<string | null> => {
    if (typeof window === "undefined") return null;

    // If we've already created a request in this session, reuse its ID
    if (finalizedRequestIdRef.current) {
      return finalizedRequestIdRef.current;
    }

    if (isFinalizing) {
      return null;
    }

    const draftId = window.sessionStorage.getItem("draft_id");

    if (!draftId) {
      console.error("[FinalizeDraft] Missing draft_id in sessionStorage");
      alert("לא נמצאה טיוטה פעילה. נסה להתחיל את הייעוץ מחדש.");
      return null;
    }

    if (!state.vehicle || !vehicle) {
      console.error("[FinalizeDraft] Missing vehicle in consult state");
      alert("חסרים פרטי רכב לשמירת הפנייה. נסה לחזור ולבחור רכב מחדש.");
      return null;
    }

    if (!user?.id) {
      console.error("[FinalizeDraft] Missing authenticated user");
      alert("לא הצלחנו לזהות את המשתמש. נסה להתחבר מחדש.");
      return null;
    }

    if (!state.diagnosis) {
      console.error("[FinalizeDraft] Missing AI diagnosis in state");
      alert("האבחון טרם הושלם. אנא המתן לסיום הניתוח לפני שמירה.");
      return null;
    }

    try {
      setIsFinalizing(true);

      const aiQuestions = state.answers.map((a) => a.question);
      const aiAnswers = state.answers.map((a) => a.answer);

      const aiDiagnosis =
        (state.diagnosis as any).summary ||
        (Array.isArray(state.diagnosis.diagnosis)
          ? state.diagnosis.diagnosis.join(" | ")
          : undefined);

      const aiConfidence = (state.diagnosis as any).confidence;
      const aiRecommendations = state.diagnosis.recommendations ?? null;

      const imageUrls = Array.isArray(draftImagesRef.current)
        ? draftImagesRef.current
            .slice(0, 3)
            .filter((url) => typeof url === "string" && url.trim().length > 0)
        : [];

      const res = await fetch("/api/requests/from-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft_id: draftId,
          user_id: user.id,
          car_id: vehicle.id,
          ai_diagnosis: aiDiagnosis,
          ai_confidence: aiConfidence,
          ai_questions: aiQuestions,
          ai_answers: aiAnswers,
          ai_recommendations: aiRecommendations,
          image_urls: imageUrls,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch (parseError) {
        console.error("[FinalizeDraft] Failed to parse response JSON:", parseError);
      }

      if (!res.ok || !data?.request_id) {
        console.error("[FinalizeDraft] Failed to finalize draft", {
          status: res.status,
          data,
        });
        alert("השמירה נכשלה. נסה שוב בעוד רגע.");
        return null;
      }

      const requestId: string = data.request_id;
      finalizedRequestIdRef.current = requestId;

      // Clean up all draft-related data only after successful creation
      try {
        window.sessionStorage.removeItem("draft_id");
        window.sessionStorage.removeItem("draft_images");
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
        window.sessionStorage.removeItem("consult_diagnosis");
      } catch (cleanupError) {
        console.error("[FinalizeDraft] Failed to clear draft data from sessionStorage", cleanupError);
      }

      draftImagesRef.current = [];

      return requestId;
    } catch (err) {
      console.error("[FinalizeDraft] Unexpected error while finalizing draft:", err);
      alert("אירעה שגיאה בלתי צפויה בזמן שמירת הפנייה. נסה שוב בעוד רגע.");
      return null;
    } finally {
      setIsFinalizing(false);
    }
  }, [isFinalizing, state.answers, state.diagnosis, state.vehicle, user, vehicle]);

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
  const canAnswer = helpers.canAnswer(state) && !helpers.isFinished(state);

  return (
    <div
      className="h-[100dvh] flex flex-col bg-gradient-to-br from-[#0a0f1c] via-[#0d1424] to-[#0a0f1c] overflow-hidden"
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
      {/* Scroll Area - Messages Only */}
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Vehicle Floating Pill */}
          {vehicle && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full flex justify-center mb-6 z-10 relative"
            >
              <div className="w-fit max-w-2xl mx-auto rounded-full bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-2xl px-8 py-3 flex flex-row items-center gap-4">
                {/* Icon */}
                <div className="p-2.5 bg-blue-500/20 rounded-full text-blue-400 flex-shrink-0">
                  <CarFront size={20} />
                </div>
                
                {/* Divider */}
                <div className="h-8 w-[1px] bg-white/10 flex-shrink-0" />
                
                {/* Text Content */}
                <div className="flex flex-col gap-0.5">
                  {/* Vehicle Title */}
                  <h1 className="text-lg font-bold text-white">
                    {vehicle.manufacturer} {vehicle.model}
                  </h1>
                  
                  {/* Vehicle Details */}
                  <p className="text-sm text-slate-400">
                    {vehicle.year && `שנת ${vehicle.year}`} {vehicle.year && vehicle.license_plate && " | "} {vehicle.license_plate && `מ.ר. ${vehicle.license_plate}`}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Safety Warning Banner */}
          {safetyWarning && (
            <WarningBanner
              message={safetyWarning}
              type="danger"
              onClose={() => setSafetyWarning(null)}
            />
          )}

          {/* Caution Notice Banner */}
          {cautionNotice && (
            <WarningBanner
              message={cautionNotice}
              type="caution"
              onClose={() => setCautionNotice(null)}
            />
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
                  const diagProps =
                    (state.diagnosis as any).summary && (state.diagnosis as any).results
                      ? (state.diagnosis as any)
                      : {
                          summary: Array.isArray(state.diagnosis.diagnosis)
                            ? state.diagnosis.diagnosis.slice(0, 1).join(" | ") || "אבחון סופי"
                            : "אבחון סופי",
                          results: Array.isArray(state.diagnosis.diagnosis)
                            ? state.diagnosis.diagnosis.slice(0, 3).map((issue: string) => ({
                                issue,
                                probability: 0,
                              }))
                            : [],
                          confidence: 0,
                        };
                  return (
                    <FinalDiagnosisCard key={messageKey} {...diagProps} />
                  );
                }

                // Render instruction message (when user says "not sure")
                if (msg.isInstruction && msg.text) {
                  return (
                    <InstructionBubble key={messageKey} message={msg.text} />
                  );
                }

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
                  >
                    <ChatBubble
                      message={msg.text}
                      isUser={false}
                      typewriter={false}
                    />
                  </motion.div>
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
                  >
                    <ChatBubble message={msg.text} images={msg.images} isUser={true} />
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
              className="flex flex-col gap-4 w-full mt-6"
              dir="rtl"
            >
              <motion.button
                onClick={async () => {
                  const requestId = await finalizeDraftAndCreateRequest();
                  if (requestId) {
                    router.push(`/user/requests/${requestId}`);
                  }
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={isFinalizing}
                className={`w-full p-5 bg-gradient-to-r from-[#4A90E2] to-[#6A9CF2] text-white font-bold text-lg rounded-full shadow-[0_4px_20px_rgba(74,144,226,0.35)] hover:shadow-[0_6px_24px_rgba(74,144,226,0.5)] transition-all duration-300 ${
                  isFinalizing ? "opacity-60 cursor-not-allowed hover:shadow-none" : ""
                }`}
              >
                {isFinalizing ? "שומר את הפנייה…" : "פתיחת פנייה למוסך"}
              </motion.button>

              <motion.button
                onClick={async () => {
                  const requestId = await finalizeDraftAndCreateRequest();
                  if (requestId) {
                    router.push("/user");
                  }
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={isFinalizing}
                className={`w-full p-5 bg-white/10 hover:bg-white/15 backdrop-blur-md text-white font-bold text-lg rounded-full border border-white/20 hover:border-white/30 shadow-[0_4px_16px_rgba(255,255,255,0.08)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.12)] transition-all duration-300 ${
                  isFinalizing ? "opacity-60 cursor-not-allowed hover:shadow-none" : ""
                }`}
              >
                {isFinalizing ? "שומר את הפנייה…" : "סיום ייעוץ (חזרה לתפריט)"}
              </motion.button>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Fixed Footer - Input Area */}
      {!helpers.isFinished(state) && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0f1c] via-[#0d1424]/95 to-transparent z-50" dir="rtl">
          <div className="max-w-4xl mx-auto w-full">
            {/* Choice Chips - Only show if question has explicit options (not for open-ended text questions) */}
            {currentQuestion && canAnswer && 
             currentQuestion.options && 
             currentQuestion.options.length > 0 && 
             currentQuestion.type !== "text" && (
              <div className="mb-3">
                <MultiChoiceButtons
                  options={currentQuestion.options.slice(0, 5)}
                  onSelect={(option) => handleAnswer(option)}
                  disabled={isTyping || isProcessingRef.current || helpers.isFinished(state)}
                />
              </div>
            )}
            
            {/* Text Input */}
            <FreeTextInput
              onSubmit={(text) => handleAnswer(text)}
              disabled={isTyping || isProcessingRef.current || !canAnswer}
              placeholder={
                currentQuestion && 
                (!currentQuestion.options || currentQuestion.options.length === 0 || currentQuestion.type === "text")
                  ? "כתוב תשובה מפורטת..."
                  : "או כתוב תשובה משלך..."
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
