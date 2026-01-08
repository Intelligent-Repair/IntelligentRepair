/**
 * Core TypeScript types for AI consultation flow
 */

export interface InlineDataPart {
  inlineData: {
    mimeType: string;
    data: string; // base64 encoded
  };
}

export interface VehicleInfo {
  manufacturer: string;
  model: string;
  year?: number | null;
}

export interface UserAnswer {
  question: string;
  answer: string; // "כן" / "לא" / "אפשרות אחרת"
}

export interface ResearchData {
  top_causes: string[];
  differentiating_factors: string[];
  reasoning: string;
  severity: "low" | "medium" | "high" | "critical";
  keywords: string[];
}

export interface DiagnosisData {
  diagnosis: string[];
  self_checks: string[];
  warnings: string[];
  disclaimer: string;
  safety_notice?: string | null;
  recommendations?: string[] | null;
}

/**
 * Structured diagnosis result with probabilities and optional guidance
 * (used for ranked final diagnoses).
 */
export interface DiagnosisResult {
  issue: string;
  probability: number; // keep existing scale (0–1 or 0–100 depending on usage)
  explanation?: string;

  // Only expected to be populated for the top (most probable) diagnosis
  self_checks?: string[]; // simple actions user can safely perform
  do_not?: string[]; // safety warnings / when NOT to continue
}

export interface AIQuestionResponse {
  should_finish: boolean;
  confidence: number;
  next_question: string | null;
  options: string[] | null;
  final_diagnosis: DiagnosisData | null;
}

export interface ChatMessage {
  id: string;
  sender: "ai" | "user" | "system";
  text: string;
  type?: AIQuestionType | string;
  meta?: any;
  images?: string[];
  timestamp?: number;
  isInstruction?: boolean;
}

export type AIQuestionType =
  | "question"
  | "scenario_step"
  | "scenario_start"
  | "safety_alert"
  | "safety_instruction"
  | "instruction"
  | "mechanic_report"
  | "diagnosis_report"
  | "ai_response"
  | "option_map"
  | "yesno"
  | "multi"
  | "text";

export interface AIQuestion {
  type: AIQuestionType;
  text?: string;
  question?: string;
  options?: string[];
  shouldStop?: boolean;
  [k: string]: any;
}

/**
 * State machine states
 */
export type AIStateStatus =
  | "IDLE"
  | "ASKING"
  | "WAITING_FOR_ANSWER"
  | "PROCESSING"
  | "FINISHED"
  | "ERROR";

export interface AIState {
  status: AIStateStatus;
  messages: ChatMessage[];
  currentQuestion: AIQuestion | null;
  answers: UserAnswer[];
  diagnosis: DiagnosisData | null;
  error: string | null;
  vehicle: VehicleInfo | null;
  description: string;
}

/**
 * State machine actions
 */
export type AIAction =
  | { type: "INIT"; payload: { vehicle: VehicleInfo; description: string } }
  | { type: "ASKING" }
  | { type: "NEXT_QUESTION"; payload: AIQuestion }
  | { type: "ANSWER"; payload: { answer: string; question: string } }
  | { type: "PROCESSING" }
  | { type: "FINISH"; payload: DiagnosisData }
  | { type: "ERROR"; payload: string }
  | { type: "RESET" }
  | { type: "ADD_MESSAGE"; payload: Partial<ChatMessage> & { sender: "ai" | "user" } }
  | { type: "REMOVE_LAST_ANSWER" }; // Remove last answer (e.g., when user says "not sure" and we re-ask)

