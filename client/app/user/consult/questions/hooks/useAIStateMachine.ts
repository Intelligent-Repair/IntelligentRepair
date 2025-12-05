"use client";

import { useReducer, useCallback } from "react";
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

