"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import {
  aiStateReducer,
  createInitialState,
  stateMachineHelpers,
} from "@/lib/ai/state-machine";
import type { AIState, AIAction, AIQuestion, DiagnosisData, VehicleInfo } from "@/lib/ai/types";

/**
 * React hook for AI state machine
 */
export function useAIStateMachine() {
  const [state, dispatch] = useReducer(aiStateReducer, createInitialState());
  const previousDraftIdRef = useRef<string | null>(null);

  // Watch for draft_id changes and reset state when it changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkDraftId = () => {
      const currentDraftId = window.sessionStorage.getItem("draft_id");
      
      // Reset ONLY if draft_id actually changed (not on initial mount with same ID)
      // This ensures we reset on new consultations (different draft_id) but not on remounts
      if (
        previousDraftIdRef.current !== null &&
        previousDraftIdRef.current !== currentDraftId
      ) {
        console.log(
          "[useAIStateMachine] Draft ID changed:",
          previousDraftIdRef.current,
          "->",
          currentDraftId,
          "- Resetting AI state machine"
        );
        dispatch({ type: "RESET" });
        console.log("[AI] state reset due to draft change", currentDraftId);
      }
      
      // Update ref to current draft_id (even if null, to track changes)
      // On initial mount, this sets the baseline
      previousDraftIdRef.current = currentDraftId;
    };

    // Check immediately on mount to initialize the ref
    // This sets previousDraftIdRef.current to the current draft_id
    // Subsequent changes will trigger reset
    checkDraftId();

    // Set up interval to check for changes periodically
    // This handles cases where draft_id is changed programmatically in the same tab
    const intervalId = setInterval(checkDraftId, 500);

    // Also listen to storage events (for cross-tab changes)
    // Note: storage events only fire for changes in OTHER tabs/windows,
    // so we rely on the interval for same-tab changes
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

  const actions = {
    init: useCallback((payload: { vehicle: VehicleInfo; description: string }) => {
      dispatch({ type: "INIT", payload });
    }, []),

    startAsking: useCallback(() => {
      dispatch({ type: "ASKING" });
    }, []),

    nextQuestion: useCallback((question: AIQuestion) => {
      dispatch({ type: "NEXT_QUESTION", payload: question });
    }, []),

    answer: useCallback((answer: string, question: string) => {
      dispatch({ type: "ANSWER", payload: { answer, question } });
    }, []),

    processing: useCallback(() => {
      dispatch({ type: "PROCESSING" });
    }, []),

    finish: useCallback((diagnosis: DiagnosisData) => {
      dispatch({ type: "FINISH", payload: diagnosis });
    }, []),

    error: useCallback((error: string) => {
      dispatch({ type: "ERROR", payload: error });
    }, []),

    addMessage: useCallback((payload: any) => {
      dispatch({ type: "ADD_MESSAGE", payload } as AIAction);
    }, []),

    removeLastAnswer: useCallback(() => {
      dispatch({ type: "REMOVE_LAST_ANSWER" });
    }, []),

    reset: useCallback(() => {
      dispatch({ type: "RESET" });
    }, []),
  };

  return {
    state,
    dispatch: actions,
    helpers: stateMachineHelpers,
  };
}

