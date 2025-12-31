"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CarFront, ArrowRight } from "lucide-react";

// Components
import ChatBubble from "./components/ChatBubble";
import TypingIndicator from "./components/TypingIndicator";
import MultiChoiceButtons from "./components/MultiChoiceButtons";
import FreeTextInput from "./components/FreeTextInput";
import FinalDiagnosisCard from "./components/FinalDiagnosisCard";
import WarningBanner from "./components/WarningBanner";
import { supabase } from "@/lib/supabaseClient";
import InstructionBubble from "./components/InstructionBubble";
import { useHybridFlow } from "./hooks/useHybridFlow";
import type { AIQuestion, DiagnosisData, VehicleInfo } from "../../../../lib/ai/types";
import { withRetry } from "../../../../lib/ai/retry";

interface Vehicle {
  id: string;
  manufacturer: string;
  model: string;
  year: number | null;
  license_plate: string;
}

export default function QuestionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
          <div className="text-white/70 text-lg">טוען שאלון...</div>
        </div>
      }
    >
      <QuestionsContent />
    </Suspense>
  );
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
  if (data.type !== "question") {
    return null;
  }

  const questionText = data.question || data.next_question || data.text;
  if (!questionText || typeof questionText !== "string") {
    return null;
  }

  const options = Array.isArray(data.options)
    ? data.options.filter((o: any) => typeof o === "string" && o.trim()).slice(0, 5)
    : [];
  const safeOptions = options.length >= 3 ? options : ["כן", "לא", "לא בטוח"];

  const safetyWarning =
    typeof data.safety_warning === "string" && data.safety_warning.trim()
      ? data.safety_warning.trim()
      : null;

  const cautionNotice =
    typeof data.caution_notice === "string" && data.caution_notice.trim()
      ? data.caution_notice.trim()
      : null;

  return {
    question: {
      question: questionText,
      type: "multi",
      options: safeOptions,
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
=======
const DRAFT_IMAGES_KEY = "draft_images";
>>>>>>> rescue/ui-stable

function QuestionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL Params
  const vehicleId = searchParams.get("vehicle");
  const descriptionParam = searchParams.get("description");
  const description = descriptionParam ? decodeURIComponent(descriptionParam) : "";

  // Hybrid Flow State
  const { state, initFlow, sendMessage } = useHybridFlow();

  // Local UI State
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
=======
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const draftImagesRef = useRef<string[]>([]);
>>>>>>> rescue/ui-stable

  // 🔴 FIX: שימוש ב-Ref כדי למנוע אתחול כפול ב-React Strict Mode
  const hasInitialized = useRef(false);

  // 1. Load User & Vehicle
  useEffect(() => {
    const loadData = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) setUser({ id: authUser.id });

      if (vehicleId) {
        try {
          const res = await fetch(`/api/cars/get?car_id=${vehicleId}`);
          if (res.ok) setVehicle(await res.json());
        } catch (e) {
          console.error("Failed to load vehicle", e);
        }
      }
    };
    loadData();
  }, [vehicleId]);

  // 2. Initialize Chat (Fixed Logic)
  useEffect(() => {
    // 🔴 בדיקה: אם הרף כבר true, עצור מיד (מונע ריצה שנייה)
    if (hasInitialized.current) return;
    // אם אין עדיין נתונים, המתן
    if (!vehicle || !description) return;

    // 🔴 סימון מיידי שהאתחול בוצע
    hasInitialized.current = true;
    console.log("[QuestionsPage] Initializing flow with:", description);

    // טעינת תמונות
    const storedImages = window.sessionStorage.getItem(DRAFT_IMAGES_KEY);
    if (storedImages) {
      try {
        draftImagesRef.current = JSON.parse(storedImages);
      } catch (e) { console.error("Error loading images", e); }
    }

    // הפעלת הצ'אט
    initFlow(description, draftImagesRef.current, {
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      year: vehicle.year
    });

  }, [vehicle, description, initFlow]);

  // 3. Auto Scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, state.status]);

  // 4. Handle Final Save
  const handleSaveRequest = async (navigatePath: string) => {
    if (isFinalizing || !user || !vehicle) return;
    setIsFinalizing(true);

    try {
      const reportMsg = state.messages.find(m => m.type === "mechanic_report");
      const reportData = reportMsg?.meta?.diagnosis || {};
      const draftId = window.sessionStorage.getItem("draft_id");

      const res = await fetch("/api/requests/from-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft_id: draftId,
          user_id: user.id,
          car_id: vehicle.id,
          ai_diagnosis: reportMsg?.text || "אבחון הושלם",
          ai_confidence: 1.0,
          // Derive Q&A from actual message history
          ai_questions: state.messages
            .filter(m => m.sender === "ai" && m.type !== "mechanic_report")
            .map(m => m.text),
          ai_answers: state.messages
            .filter(m => m.sender === "user")
            .map(m => m.text),
          ai_recommendations: reportData.recommendations,
          image_urls: draftImagesRef.current,
          // NEW: Set status based on navigation path
          status: navigatePath === "HOME" ? "closed" : "open",
          // NEW: Include mechanic summary for the request
          ai_mechanic_summary: reportData.conversationSummaries?.mechanic || null,
        }),
      });

      const data = await res.json();

      if (data.request_id) {
        window.sessionStorage.removeItem(DRAFT_IMAGES_KEY);
        window.sessionStorage.removeItem("draft_id");
        router.push(navigatePath === "HOME" ? "/user" : `/user/requests/${data.request_id}`);
      } else {
        alert("שגיאה בשמירת הפנייה.");
      }
    } catch (e) {
      console.error("Save error:", e);
      alert("אירעה שגיאה. נסה שוב.");
    } finally {
      setIsFinalizing(false);
    }
  };

<<<<<<< HEAD
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
        
        // New spec: Don't send vehicle info to API (only for DB storage)
        const requestBody = {
          description: state.description,
          answers: answersToUse,
          image_urls: imageUrls,
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

        // New spec: Don't send vehicle info to API (only for DB storage)
        // Fetch next question or diagnosis and surface a notice if it takes too long
        const questionsPromise = fetch("/api/ai/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: state.description,
            answers: newAnswers,
            image_urls: imageUrls,
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
=======
  const isProcessing = state.status === "PROCESSING";
  const isFinished = state.status === "FINISHED";
>>>>>>> rescue/ui-stable

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
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-center pointer-events-none">
        {vehicle && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-fit max-w-2xl rounded-full bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl px-6 py-2 flex items-center gap-3 pointer-events-auto"
          >
            <div className="p-2 bg-blue-500/20 rounded-full text-blue-400">
              <CarFront size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-none">
                {vehicle.manufacturer} {vehicle.model}
              </h1>
              <span className="text-xs text-slate-400">
                {vehicle.year} • {vehicle.license_plate}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Chat */}
      <div className="flex-1 overflow-y-auto p-4 pt-24 pb-32 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-2">

<<<<<<< HEAD
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
=======
>>>>>>> rescue/ui-stable
          <AnimatePresence mode="popLayout">
            {state.messages.map((msg) => {

<<<<<<< HEAD
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

                // Check if this is the current question
                const isCurrentQuestion = currentQuestion && msg.text === currentQuestion.question && isLastMessage;

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
                      helpers.canAnswer(state) && !helpers.isFinished(state) && (
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
                            disabled={isTyping || isProcessingRef.current || helpers.isFinished(state)}
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
                    <ChatBubble message={msg.text} images={msg.images} isUser={true} />
                  </motion.div>
=======
              // 🔴 FIX APPLIED: Data Transformation for Mechanic Report
              if (msg.type === "mechanic_report") {
                const diagnosisData = msg.meta?.diagnosis || {};
                const rawDiagnosis = diagnosisData.results || msg.meta?.diagnosis?.diagnosis || [];
                const safetyNotice = diagnosisData.disclaimer || msg.meta?.diagnosis?.safety_notice;

                // Transform string[] or result objects to DiagnosisResult[]
                const structuredResults = Array.isArray(rawDiagnosis)
                  ? rawDiagnosis.map((item: any, idx: number) => {
                    if (typeof item === 'string') {
                      return {
                        issue: item,
                        probability: idx === 0 ? 0.9 : 0.7,
                        explanation: idx === 0
                          ? "זוהה כתרחיש הסביר ביותר ע\"פ הבדיקות שביצענו."
                          : "אפשרות נוספת שיש לקחת בחשבון."
                      };
                    }
                    return item; // Already structured
                  })
                  : [];

                return (
                  <FinalDiagnosisCard
                    key={msg.id}
                    title={diagnosisData.title || msg.meta?.title}
                    summary={diagnosisData.summary || msg.text}
                    results={structuredResults}
                    confidence={diagnosisData.confidence || 1}
                    confidenceLevel={diagnosisData.confidenceLevel}
                    status={diagnosisData.status}
                    reasoning={diagnosisData.reasoning}
                    selfFix={diagnosisData.selfFix}
                    nextSteps={diagnosisData.nextSteps}
                    recommendations={diagnosisData.recommendations || msg.meta?.diagnosis?.recommendations || []}
                    disclaimer={safetyNotice || "האבחון הינו המלצה בלבד ואינו מהווה תחליף לבדיקת מוסך."}
                  />
>>>>>>> rescue/ui-stable
                );
              }

              // 📋 Instruction Messages - use InstructionBubble with steps
              if (msg.type === "instruction" || msg.isInstruction) {
                const instructionMeta = msg.meta || {};
                return (
                  <InstructionBubble
                    key={msg.id}
                    title={instructionMeta.name || "הוראות בדיקה"}
                    message={msg.text}
                    steps={instructionMeta.steps || []}
                    actionType={instructionMeta.actionType || "inspect"}
                    isCritical={instructionMeta.actionType === "critical" || instructionMeta.isCritical}
                  />
                );
              }

              return (
                <ChatBubble
                  key={msg.id}
                  message={msg.text}
                  images={msg.images}
                  isUser={msg.sender === "user"}
                  type={msg.type}
                  meta={msg.meta}
                />
              );
            })}
          </AnimatePresence>

          {isProcessing && (
            <div className="flex justify-start w-full px-4">
              <TypingIndicator />
            </div>
          )}

          {isFinished && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-3 mt-6"
            >
<<<<<<< HEAD
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
=======
              <button
                onClick={() => handleSaveRequest("HOME")}
                disabled={isFinalizing}
                className="w-full p-4 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 transition-all"
              >
                סיום וחזרה לתפריט הראשי
              </button>
>>>>>>> rescue/ui-stable
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area */}
      {!isFinished && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0f1c] via-[#0d1424]/95 to-transparent z-50" dir="rtl">
          <div className="max-w-4xl mx-auto w-full flex flex-col gap-3">

            {state.currentOptions.length > 0 && !isProcessing && (
              <MultiChoiceButtons
                options={state.currentOptions}
                onSelect={(opt) => sendMessage(opt)}
                disabled={isProcessing}
              />
            )}

            <FreeTextInput
              onSubmit={(text) => sendMessage(text)}
              disabled={isProcessing}
              placeholder={
                state.currentOptions.length > 0
                  ? "או הקלד תשובה משלך..."
                  : "כתוב תשובה..."
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}