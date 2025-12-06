/**
 * Core TypeScript types for AI consultation flow
 */

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
}

export interface DiagnosisData {
  diagnosis: string[];
  self_checks: string[];
  warnings: string[];
  disclaimer: string;
  safety_notice?: string | null;
  recommendations?: string[] | null;
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
  sender: "ai" | "user";
  text: string;
  timestamp: number;
}

export interface AIQuestion {
  type: "yesno" | "multi";
  text: string;
  options?: string[];
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
  | { type: "RESET" };

