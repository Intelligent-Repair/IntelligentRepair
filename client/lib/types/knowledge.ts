// lib/types/knowledge.ts

export type ActionType = 'VERIFIES' | 'RULES_OUT' | 'INFO' | 'SKIPPED';
export type SeverityLevel = 'NORMAL' | 'CRITICAL';
export type SafetyLevel = 'CRITICAL' | 'WARNING';

// --- Types for car-symptoms.json (Schema v4) ---
export type SymptomMappingType = 'light' | 'symptom' | 'safety' | 'scenario';
export type SymptomSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SymptomUrgency = 'now' | 'soon' | 'next_service';
export type SymptomActionType = 'inspect' | 'check' | 'clean' | 'adjust' | 'fill';
export type SymptomDifficulty = 'easy' | 'medium' | 'hard';

/**
 * הערכת עלות לתיקון
 */
export interface CostEstimate {
  /** עלות לבדיקה עצמית */
  diy?: string;
  /** עלות חלפים בלבד */
  parts?: string;
  /** עלות במוסך כולל עבודה */
  garage?: string;
}

/**
 * פעולת תיקון עצמי פשוטה (ל-car-symptoms.json)
 * מבנה פשוט יותר מ-KBSelfFixAction של warning-lights
 */
export interface SimpleSelfFixAction {
  /** מזהה ייחודי */
  id: string;
  /** שם הפעולה */
  name: string;
  /** סוג הפעולה */
  actionType: SymptomActionType;
  /** רמת קושי */
  difficulty?: SymptomDifficulty;
  /** כלים נדרשים */
  tools_needed?: string[];
  /** זמן משוער לביצוע */
  time_estimate?: string;
  /** שלבי הביצוע */
  steps: string[];
  /** הערכת עלות */
  cost_estimate?: CostEstimate;
  /** מתי לעצור ולפנות למוסך */
  when_to_stop?: string;
  /** סימנים להצלחה */
  success_indicators?: string[];
  /** מה לעשות אם נכשל */
  next_if_failed?: 'needs_mechanic' | 'needs_tow' | 'continue_driving';
  /** אזהרה בטיחותית */
  warning?: string;
}

/**
 * מיפוי סימפטום בודד - יכול להיות נורה, סימפטום כללי, או מצב בטיחות
 */
export interface SymptomMapping {
  /** מזהה ייחודי לסימפטום */
  id?: string;
  /** מילות מפתח לזיהוי */
  keywords: string[];
  /** מזהה יעד (לנורות - lightId) */
  targetId?: string;
  /** סוג המיפוי */
  type: SymptomMappingType;
  /** רמת חומרה */
  severity?: SymptomSeverity;
  /** שאלות ראשוניות לשאול מה-KB לפני AI */
  first_questions?: string[];
  /** סיבות אפשריות לבעיה */
  possible_causes?: string[];
  /** דחיפות הטיפול */
  urgency?: SymptomUrgency;
  /** הערת בטיחות */
  safety_note?: string;
  /** פעולות תיקון עצמי */
  self_fix_actions?: SimpleSelfFixAction[];
}

/**
 * קטגוריית סימפטומים (נורות, רעשים, התנהגות וכו')
 */
export interface SymptomCategory {
  /** שם הקטגוריה */
  category: string;
  /** תיאור הקטגוריה */
  description: string;
  /** סוג ברירת מחדל עבור מיפויים בקטגוריה */
  type?: SymptomMappingType;
  /** רשימת המיפויים */
  mappings: SymptomMapping[];
}

/**
 * מבנה קובץ car-symptoms.json המלא
 */
export interface CarSymptomsKB {
  schemaVersion: number;
  description: string;
  symptoms: SymptomCategory[];
}


export interface Suspect {
  id: string;      // מזהה הרכיב (battery, starter)
  name: string;    // שם לתצוגה (מצבר, סטרטר)
  score: number;   // ציון נוכחי
}

export interface DiagnosticAction {
  type: ActionType;
  suspectId?: string;
  weight?: number;
}

// --- עדכון 1: הוספת שדות למסגרת אדומה ולדוח מוסך ---
export interface StepOption {
  label: string;       // הטקסט על הכפתור
  nextStepId: string | null;  // לאן הולכים? (null = סוף השיחה)
  actions: DiagnosticAction[];

  // שדות חדשים:
  logText?: string;    // הטקסט שיישמר לדו"ח הסופי (למשל: "הלקוח זיהה רעש תיקתוק")
  severity?: SeverityLevel; // האם להקפיץ מסגרת אדומה?
  stopAlert?: {        // התוכן של המסגרת האדומה (אם יש)
    title: string;
    message: string;
  };
}

export interface ScenarioStep {
  id: string;
  text: string;
  options: StepOption[];
}

export interface Scenario {
  id: string;
  title: string;
  suspects: Suspect[];
  steps: Record<string, ScenarioStep>;
  startingStepId: string;
}

// --- עדכון 2: ניהול טוב יותר של הסטייט לטובת הדוח הסופי ---
export interface DiagnosticState {
  currentScenarioId: string | null;
  currentStepId: string | null;
  suspects: Record<string, number>;

  // הפרדנו את ההיסטוריה כדי שיהיה קל להדפיס דו"ח בסוף
  reportData: {
    verified: string[];  // דברים שאומתו (V)
    ruledOut: string[];  // דברים שנשללו (X)
    skipped: string[];   // דברים שהלקוח לא ידע (Skipped)
    criticalFindings: string[]; // דברים מסוכנים שנמצאו (כמו עשן)
  };

  // 🔧 Hybrid mode support
  mode?: 'kb' | 'option_map' | 'bridge' | 'expert';
  bridgeAttempts?: number;

  // 🔧 Option Mapper context (server keeps them)
  currentQuestionText?: string;
  currentQuestionOptions?: string[];
  optionMapAttempts?: number;

  // 🔧 Flow control fields for instruction handling
  lastActionType?: 'fill' | 'inspect' | 'safety' | 'adjust' | 'critical'; // Type of last instruction
  awaitingLightConfirmation?: boolean;  // Waiting for light status after fill

  // 🔧 Scenario transition field (used after safety warnings)
  pendingScenarioId?: string;  // Next scenario to start after user acknowledges warning

  // 🔧 Store detected light type from image analysis or KB detection
  detectedLightType?: string;  // e.g. 'oil_pressure_light', 'battery_light', 'check_engine_light'
  lightSeverity?: 'danger' | 'caution';  // Red lights = danger, Orange lights = caution
  kbSource?: boolean;  // True if the flow is driven by knowledge base
  isLightContext?: boolean;  // True if we're in a warning light diagnostic context
  isSymptomFlow?: boolean;  // 🔧 NEW: True if user describes symptoms without warning lights

  // 🔧 NEW: KB-driven warning light diagnosis state
  currentLightScenario?: string;  // e.g. 'steady_normal', 'flashing', 'steady_symptoms'
  causeScores?: Record<string, number>;  // Scores for each cause ID
  askedQuestionIds?: string[];  // Track which KB questions have been asked
  currentQuestionId?: string;  // Current question being asked (cause.id)

  // 🔧 NEW: Instruction tracking for self_fix_actions
  shownInstructionIds?: string[];  // Track which instructions have been shown
  lastInstructionId?: string;  // ID of the last instruction shown (for followup)
  awaitingInstructionResult?: boolean;  // Waiting for user to complete instruction

  // 🔧 NEW: Vehicle info for summary generation
  vehicleInfo?: {
    make?: string;
    model?: string;
    year?: number;
    plate?: string;
  };

  // 🔧 NEW: Active flow tracking to prevent KB vs SCENARIO conflicts
  activeFlow?: "KB" | "SCENARIO" | null;

  // 🔧 NEW: Bridge flow tracking
  bridgeQuestionCount?: number;
  lightPickerShown?: boolean;

  // 🔧 NEW: Q&A history for mechanic summary
  answeredQuestions?: Array<{ question: string; answer: string }>;
  lastUserAnswer?: string;
}

// --- עדכון 3: שדות שליטה בחוקי בטיחות ---
export interface SafetyRule {
  id: string;
  keywords: string[];
  message: string;
  level: SafetyLevel;

  // שדות חדשים למניעת תקיעה:
  endConversation?: boolean; // האם לסיים את השיחה מיד אחרי האישור?
  followUpMessage?: string;  // מה הבוט עונה אחרי שהמשתמש כותב "עצרתי"?
  nextScenarioId?: string;   // (אופציונלי) לאיזה תרחיש לעבור אחרי האזהרה?
}

// --- עדכון 4: טיפוסים עבור warning-lights.json ---
export type KBActionType = 'safety' | 'inspect' | 'fill' | 'adjust';

export interface KBQuestionOption {
  id: string;
  label: string;
}

/**
 * סטטוסים אפשריים עבור resolution_paths
 */
export type KBResolutionStatus =
  | 'resolved'           // הבעיה נפתרה לחלוטין
  | 'resolved_temp'      // נפתרה באופן זמני - דורש מעקב
  | 'pending'            // ממתין לפעולה נוספת מהמשתמש
  | 'needs_more_info'    // צריך מידע נוסף
  | 'needs_verification' // צריך אימות לאחר פעולה
  | 'needs_inspection'   // צריך בדיקה נוספת
  | 'needs_mechanic'     // צריך מוסך (לא דחוף)
  | 'needs_mechanic_urgent' // צריך מוסך דחוף
  | 'needs_tow'          // צריך גרר
  | 'needs_attention'    // דורש תשומת לב / מעבר לתרחיש אחר
  | 'wait_and_verify'    // המתן ובדוק שוב
  | 'critical';          // מצב קריטי

/**
 * נתיב פתרון - מה קורה בהתאם לתשובת המשתמש
 */
export interface KBResolutionPath {
  /** סטטוס הפתרון */
  status: KBResolutionStatus;
  /** אבחנה טקסטואלית */
  diagnosis?: string;
  /** המלצה למשתמש */
  recommendation?: string;
  /** הודעה כללית להצגה */
  message?: string;
  /** צעדים הבאים (רשימה) */
  next_steps?: string[];
  /** האם ניתן לנסוע למוסך */
  drive_ok?: boolean;
  /** פעולה הבאה (ID של self_fix_action) */
  next_action?: string;
  /** הערה נוספת */
  note?: string;
  /** שאלת המשך נוספת */
  next_question?: KBQuestion;
  /** מעבר לתרחיש אחר */
  route_to_scenario?: string;
  /** מידע נוסף אם הבעיה חוזרת */
  if_returns?: string;
}

export interface KBQuestion {
  text: string;
  options: KBQuestionOption[] | string[];
  /** טקסט אזהרה להצגה (לא חובה) */
  warning?: string;
  /** שאלת המשך בהתאם ל-id שנבחר באפשרויות */
  followups?: Record<string, KBQuestion>;
  /** נתיבי פתרון בהתאם לתשובה שנבחרה */
  resolution_paths?: Record<string, KBResolutionPath>;
}

export interface KBCause {
  id: string;
  name: string;
  probability: number;
  symptoms?: string[];
  key_question?: KBQuestion;
  /** הערה נוספת על הסיבה */
  note?: string;
}

export interface KBSelfFixAction {
  id: string;
  name: string;
  actionType: KBActionType;
  /** סדר עדיפויות להצגה/ביצוע */
  priority?: 'FIRST' | 'STANDARD' | 'ONLY_IF_SAFE' | 'AFTER_COOLDOWN';
  /** תנאי להצגת הפעולה */
  condition?: string;
  steps?: string[];
  /** שאלת המשך - תומכת ב-resolution_paths */
  followup_question?: KBQuestion;
  /** אזהרה בטיחותית (לא חובה) */
  warning?: string;
}

/**
 * המלצה למוסך - פורמט מקוצר עם זמנים
 */
export interface GoToMechanicTimeBased {
  immediately?: string;
  soon?: string;
  next_service?: string;
}

/**
 * המלצה למוסך - פורמט עם סיבה ודחיפות
 */
export interface GoToMechanicWithUrgency {
  reason: string;
  urgency: 'now' | 'soon' | 'later';
}

/**
 * טיפוס איחוד להמלצת מוסך - תומך בשני הפורמטים
 */
export type GoToMechanicAdvice = GoToMechanicTimeBased | GoToMechanicWithUrgency;

export interface KBScenario {
  description: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  risk?: string;
  immediate_action?: string;
  go_to_mechanic?: string | GoToMechanicAdvice;
  recommendation?: string;
  summary_for_user?: string;
  final_recommendation?: string;
  post_fix_recommendation?: string;
  model_summary?: string;
  drive_to_mechanic_ok?: boolean | string;
  causes?: KBCause[];
  self_fix_actions?: KBSelfFixAction[];
  tow_conditions?: string[];
}

/**
 * רמת חומרה של נורת אזהרה
 */
export type WarningLightSeverity = 'low' | 'moderate' | 'high' | 'critical';

export interface WarningLight {
  names: { he: string[]; en: string[] };
  symbol: string;
  colors: string[];
  /** רמת חומרה כללית של הנורה */
  severity: WarningLightSeverity;
  /** מזהה חוק בטיחות קשור (לחיבור ל-safety-rules) */
  safetyRuleId?: string;
  /** משמעות צבעים שונים של הנורה */
  color_meaning?: Record<string, string>;
  /** חשיבות/הסבר כללי על הנורה */
  importance?: string;
  first_question: KBQuestion;
  scenarios: Record<string, KBScenario>;
}

// --- עדכון 5: מבנה פשוט חדש עבור warning-lights.json (schemaVersion: simple-v1) ---

/**
 * בדיקה עצמית שהמשתמש יכול לבצע
 */
export interface SimpleSelfCheck {
  /** הוראה למשתמש */
  instruction: string;
  /** מה לחפש */
  what_to_look_for: string;
  /** מה המשמעות אם מצא */
  if_found: string;
}

/**
 * תיקון מהיר שהמשתמש יכול לבצע
 */
export interface SimpleQuickFix {
  /** הפעולה לביצוע */
  action: string;
  /** איך יודעים שזה עבד */
  success_indicator: string;
}

/**
 * רמת חומרה פשוטה
 */
export type SimpleWarningLightSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * נורת אזהרה במבנה הפשוט (AI-First)
 * זהו המבנה החדש שמשמש כמקור מידע ל-AI
 */
export interface SimpleWarningLight {
  /** שם בעברית */
  name_he: string;
  /** שם באנגלית */
  name_en: string;
  /** שמות נרדפים שמשתמשים עשויים להשתמש בהם */
  aliases?: string[];
  /** סמל אמוג'י */
  symbol: string;
  /** צבעים אפשריים */
  colors: string[];
  /** נורות קשורות שעשויות להופיע יחד */
  related_lights?: string[];
  /** רמת חומרה */
  severity: SimpleWarningLightSeverity;
  /** האם אפשר להמשיך לנסוע */
  can_drive: boolean;
  /** מרחק מקסימלי בק"מ שאפשר לנסוע */
  max_distance_km: number;
  /** מהירות מקסימלית מומלצת */
  speed_limit_kmh: number;
  /** מה הנורה אומרת */
  what_it_means: string;
  /** סיבות נפוצות עם אחוזים */
  common_causes: string[];
  /** בדיקות עצמיות */
  self_checks: SimpleSelfCheck[];
  /** תיקונים מהירים */
  quick_fixes: SimpleQuickFix[];
  /** מתי לעצור מיד */
  when_to_stop_immediately: string[];
  /** מתי צריך מוסך */
  when_garage_needed: string[];
  /** טווח עלויות משוער */
  estimated_repair_cost_range: string;
  /** זמן תיקון טיפוסי */
  typical_repair_time: string;
  /** טיפים מקצועיים */
  pro_tips: string[];
}

/**
 * מבנה קובץ warning-lights.json במבנה הפשוט
 */
export interface SimpleWarningLightsKB {
  schemaVersion: string;
  [lightId: string]: SimpleWarningLight | string;
}