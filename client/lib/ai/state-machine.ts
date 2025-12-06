/**
 * Deterministic state machine for AI consultation flow
 * Pure functions, no side effects, UI-friendly
 */

import type {
  AIState,
  AIAction,
  AIQuestion,
  UserAnswer,
  DiagnosisData,
  VehicleInfo,
} from "./types";

/**
 * Initial state
 */
export function createInitialState(): AIState {
  return {
    status: "IDLE",
    messages: [],
    currentQuestion: null,
    answers: [],
    diagnosis: null,
    error: null,
    vehicle: null,
    description: "",
  };
}

/**
 * Generate unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * State reducer - pure function
 */
export function aiStateReducer(state: AIState, action: AIAction): AIState {
  switch (action.type) {
    case "INIT": {
      return {
        ...state,
        status: "IDLE",
        vehicle: action.payload.vehicle,
        description: action.payload.description,
        error: null,
      };
    }

    case "ASKING": {
      return {
        ...state,
        status: "ASKING",
        error: null,
      };
    }

    case "NEXT_QUESTION": {
      const question = action.payload;
      const newMessage = {
        id: generateMessageId(),
        sender: "ai" as const,
        text: question.text,
        timestamp: Date.now(),
      };

      return {
        ...state,
        status: "WAITING_FOR_ANSWER",
        currentQuestion: question,
        messages: [...state.messages, newMessage],
        error: null,
      };
    }

    case "ANSWER": {
      const { answer, question } = action.payload;
      const newAnswer: UserAnswer = { question, answer };
      const newMessage = {
        id: generateMessageId(),
        sender: "user" as const,
        text: answer,
        timestamp: Date.now(),
      };

      return {
        ...state,
        status: "PROCESSING",
        currentQuestion: null,
        answers: [...state.answers, newAnswer],
        messages: [...state.messages, newMessage],
        error: null,
      };
    }

    case "PROCESSING": {
      return {
        ...state,
        status: "PROCESSING",
        error: null,
      };
    }

    case "FINISH": {
      const diagnosis = action.payload;
      const newMessage = {
        id: generateMessageId(),
        sender: "ai" as const,
        text: "אבחון סופי",
        timestamp: Date.now(),
      };

      return {
        ...state,
        status: "FINISHED",
        currentQuestion: null,
        diagnosis,
        messages: [...state.messages, newMessage],
        error: null,
      };
    }

    case "ERROR": {
      return {
        ...state,
        status: "ERROR",
        error: action.payload,
      };
    }

    case "RESET": {
      return createInitialState();
    }

    default: {
      return state;
    }
  }
}

/**
 * State machine helper functions
 */
export const stateMachineHelpers = {
  /**
   * Check if state allows answering
   */
  canAnswer(state: AIState): boolean {
    return (
      state.status === "WAITING_FOR_ANSWER" &&
      state.currentQuestion !== null &&
      state.answers.length < 5
    );
  },

  /**
   * Check if state is finished
   */
  isFinished(state: AIState): boolean {
    return state.status === "FINISHED";
  },

  /**
   * Check if state is processing
   */
  isProcessing(state: AIState): boolean {
    return state.status === "PROCESSING" || state.status === "ASKING";
  },

  /**
   * Check if state has error
   */
  hasError(state: AIState): boolean {
    return state.status === "ERROR";
  },

  /**
   * Get current question type
   */
  getQuestionType(state: AIState): "yesno" | "multi" | null {
    return state.currentQuestion?.type || null;
  },
};

