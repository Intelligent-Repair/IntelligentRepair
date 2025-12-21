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
        text: question.question,
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

    case "ADD_MESSAGE": {
      const payload = action.payload;
      const images =
        payload.images && Array.isArray(payload.images)
          ? payload.images.filter((url) => typeof url === "string" && url.trim()).slice(0, 3)
          : [];

      const newMessage = {
        id: payload.id || generateMessageId(),
        sender: payload.sender,
        text: payload.text ?? "",
        images,
        timestamp: payload.timestamp || Date.now(),
        isInstruction: payload.isInstruction || false,
      };

      return {
        ...state,
        messages: [...state.messages, newMessage],
      };
    }

    case "REMOVE_LAST_ANSWER": {
      // Remove the last answer and its corresponding user message
      // Safety check: only remove if there are answers to remove
      if (state.answers.length === 0) {
        console.warn("[State Machine] REMOVE_LAST_ANSWER called but no answers to remove");
        return state;
      }
      
      const updatedAnswers = state.answers.slice(0, -1);
      
      // Find and remove the last user message
      let lastUserMessageIndex = -1;
      for (let i = state.messages.length - 1; i >= 0; i--) {
        if (state.messages[i].sender === "user") {
          lastUserMessageIndex = i;
          break;
        }
      }
      
      const updatedMessages = lastUserMessageIndex >= 0
        ? state.messages.filter((_, index) => index !== lastUserMessageIndex)
        : state.messages;

      return {
        ...state,
        answers: updatedAnswers,
        messages: updatedMessages,
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

