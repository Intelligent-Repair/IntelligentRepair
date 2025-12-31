"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Stethoscope,
  ChevronLeft,
  Shield,
  Activity,
  Eye,
  Droplets,
  Settings2,
  Info,
  MapPin,
  Truck,
  X,
  Phone,
  HelpCircle
} from "lucide-react";


// --- Types ---
interface DiagnosisResult {
  issue: string;
  probability: number;
  description?: string;
  explanation?: string;
}

interface SummaryObject {
  detected?: string[];
  reported?: string[];
}

interface StatusObject {
  color?: "red" | "yellow" | "green" | "blue";
  text?: string;
  instruction?: string;
}

interface SelfFixStep {
  step: string;
  actionType?: string;
}

interface MechanicReport {
  topSuspect: string;
  score?: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  status?: string;
  instruction?: string;
  towConditions?: string[];
  blindSpots?: string[];
}

// NEW: Context for generating smart suggestions
interface DiagnosisContext {
  lightType?: string;      // e.g., 'oil_pressure_light'
  scenario?: string;       // e.g., 'while_driving'
  topIssue?: string;       // e.g., 'low_oil_level'
  needsOil?: boolean;
  needsTow?: boolean;
  canDrive?: boolean;
}

// NEW: User summary from backend
interface UserSummary {
  shortDescription: string;
  topIssue: string;
  nextAction: string;
}

// NEW: Mechanic summary from backend
interface MechanicSummaryType {
  formattedText: string;
  vehicleInfo?: { make?: string; model?: string; year?: number; plate?: string };
  lightName?: string;
  scenarioDescription?: string;
  topDiagnosis?: { issue: string; probability: number };
  recommendation?: string;
  severity?: string;
  needsTow?: boolean;
}

// NEW: Combined summaries from backend
interface ConversationSummaries {
  user: UserSummary;
  mechanic: MechanicSummaryType;
}

interface FinalDiagnosisCardProps {
  title?: string;
  summary: string | SummaryObject;
  results: DiagnosisResult[];
  confidence: number;
  confidenceLevel?: string;
  status?: StatusObject;
  reasoning?: string;
  selfFix?: SelfFixStep[];
  nextSteps?: string;
  recommendations?: string[];
  disclaimer?: string;
  // 🔧 NEW: Additional fields from backend
  mechanicReport?: MechanicReport;
  towConditions?: string[];
  showTowButton?: boolean;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  diagnosisContext?: DiagnosisContext;
  conversationSummaries?: ConversationSummaries;  // NEW
  onOpenMechanicRequest?: () => void;
}

// Helper: Generate contextual suggestions based on diagnosis
function getContextualSuggestions(ctx?: DiagnosisContext, topIssue?: string): SelfFixStep[] {
  const suggestions: SelfFixStep[] = [];

  // Oil-related suggestions
  if (ctx?.needsOil || ctx?.lightType === 'oil_pressure_light' || topIssue?.includes('oil') || topIssue?.includes("שמן")) {
    suggestions.push(
      { step: "בדוק מה סוג השמן שהרכב שלך צריך - זה כתוב על מכסה השמן או במדריך לרכב", actionType: "inspect" },
      { step: "התקשר לחבר או בן משפחה שירכוש שמן מתחנת דלק ויביא אליך", actionType: "fill" },
      { step: "אם יש לך שמן - מלא עד לסימן MAX ונסה להניע", actionType: "fill" }
    );
  }

  // Tow-needed suggestions
  if (ctx?.needsTow) {
    suggestions.push(
      { step: "הזמן גרר דרך האפליקציה או הלחצן למטה", actionType: "safety" },
      { step: "הדלק אורות חירום וחכה במקום בטוח", actionType: "safety" }
    );
  }

  // Can drive suggestions
  if (ctx?.canDrive) {
    suggestions.push(
      { step: "ניתן לנסוע בזהירות למוסך קרוב", actionType: "inspect" },
      { step: "קבע תור למוסך מוכר תוך 1-2 ימים", actionType: "inspect" }
    );
  }

  // General suggestions if nothing specific
  if (suggestions.length === 0) {
    suggestions.push(
      { step: "צלם תמונה של לוח מכשירים למוסך", actionType: "inspect" },
      { step: "התקשר למוסך מוכר לקביעת תור", actionType: "inspect" }
    );
  }

  return suggestions;
}

// --- Towing Companies Data ---
const towingCompanies = [
  {
    name: "שגריר",
    number: "*8888",
    displayNumber: "8888*",  // RTL display
    color: "from-red-600 to-red-700",
    logo: "/towing/shagrir.jpg"
  },
  {
    name: "דרכים",
    number: "*2008",
    displayNumber: "2008*",
    color: "from-orange-500 to-orange-600",
    logo: "/towing/Drachim.png"
  },
  {
    name: "ממסי שירותי גרירה",
    number: "*5202",
    displayNumber: "5202*",
    color: "from-slate-800 to-slate-900",
    logo: "/towing/Memsi.png"
  },
];

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15
    }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const }
  }
} as const;

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" as const }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 }
  }
} as const;


// --- Status Configuration ---
const statusConfig = {
  red: {
    wrapper: "bg-red-950/50 border-red-500/50",
    glow: "shadow-[0_0_40px_rgba(239,68,68,0.3)]",
    iconWrapper: "bg-red-500/25 shadow-[0_0_20px_rgba(239,68,68,0.4)]",
    iconColor: "text-red-400",
    textColor: "text-red-50",
    subTextColor: "text-red-200/80",
    buttonBg: "bg-red-600 hover:bg-red-500",
    Icon: AlertTriangle
  },
  yellow: {
    wrapper: "bg-amber-950/40 border-amber-500/40",
    glow: "shadow-[0_0_40px_rgba(245,158,11,0.2)]",
    iconWrapper: "bg-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.3)]",
    iconColor: "text-amber-400",
    textColor: "text-amber-50",
    subTextColor: "text-amber-200/80",
    buttonBg: "bg-amber-600 hover:bg-amber-500",
    Icon: AlertCircle
  },
  green: {
    wrapper: "bg-emerald-950/40 border-emerald-500/40",
    glow: "shadow-[0_0_40px_rgba(16,185,129,0.2)]",
    iconWrapper: "bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]",
    iconColor: "text-emerald-400",
    textColor: "text-emerald-50",
    subTextColor: "text-emerald-200/80",
    buttonBg: "bg-emerald-600 hover:bg-emerald-500",
    Icon: CheckCircle2
  },
  blue: {
    wrapper: "bg-blue-950/40 border-blue-500/40",
    glow: "shadow-[0_0_40px_rgba(59,130,246,0.2)]",
    iconWrapper: "bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.3)]",
    iconColor: "text-blue-400",
    textColor: "text-blue-50",
    subTextColor: "text-blue-200/80",
    buttonBg: "bg-blue-600 hover:bg-blue-500",
    Icon: Info
  }
};

// Action type icons
const actionTypeIcons: Record<string, React.ElementType> = {
  inspect: Eye,
  fill: Droplets,
  adjust: Settings2,
  safety: AlertTriangle
};

// --- Towing Modal Component ---
function TowingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  const handleCall = (number: string) => {
    window.location.href = `tel:${encodeURIComponent(number)}`;
  };

  const handleOther = () => {
    window.location.href = "tel:";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 mx-auto max-w-md z-50"
            dir="rtl"
          >
            <div className="bg-slate-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-red-500/20">
                      <Truck size={22} className="text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">הזמנת גרר</h3>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X size={20} className="text-white/60" />
                  </button>
                </div>
                <p className="mt-3 text-sm text-white/50 leading-relaxed">
                  באיזו חברת גרירה הביטוח שלך משתמש?
                  <span className="block text-xs text-white/30 mt-1">
                    (אם אתה לא יודע, תוכל להסתכל בפוליסת הביטוח שלך)
                  </span>
                </p>
              </div>

              {/* Company Options */}
              <div className="p-4 space-y-3">
                {towingCompanies.map((company) => (
                  <button
                    key={company.name}
                    onClick={() => handleCall(company.number)}
                    className={`
                      w-full flex items-center justify-between p-4 rounded-2xl
                      bg-gradient-to-l ${company.color}
                      hover:opacity-90 transition-opacity
                      group
                    `}
                  >
                    <div className="flex items-center gap-4">
                      {/* Company Logo */}
                      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center overflow-hidden p-1">
                        <img
                          src={company.logo}
                          alt={company.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            // Fallback to phone icon if logo not found
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <Phone size={20} className="text-gray-600 hidden" />
                      </div>
                      <div className="text-right">
                        <span className="text-base font-bold text-white block">
                          {company.name}
                        </span>
                        <span className="text-sm text-white/70 font-mono" dir="ltr">
                          {company.displayNumber}
                        </span>
                      </div>
                    </div>
                    <ChevronLeft size={20} className="text-white/60 group-hover:translate-x-[-4px] transition-transform" />
                  </button>
                ))}

                {/* Other Option */}
                <button
                  onClick={handleOther}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/10">
                      <HelpCircle size={18} className="text-white/60" />
                    </div>
                    <span className="text-base font-medium text-white/70">
                      אחר (פתח חייגן)
                    </span>
                  </div>
                  <ChevronLeft size={20} className="text-white/40 group-hover:translate-x-[-4px] transition-transform" />
                </button>
              </div>

              {/* Footer Tip */}
              <div className="px-5 py-3 bg-white/[0.02] border-t border-white/5">
                <p className="text-xs text-white/30 text-center">
                  לחיצה תפתח את החייגן עם המספר
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- Main Component ---
export default function FinalDiagnosisCard({
  title,
  summary,
  results,
  confidence,
  confidenceLevel,
  status,
  reasoning,
  selfFix,
  nextSteps,
  recommendations,
  disclaimer,
  mechanicReport,
  towConditions,
  showTowButton,
  severity,
  diagnosisContext,
  conversationSummaries,
  onOpenMechanicRequest,
}: FinalDiagnosisCardProps) {
  const [showTowingModal, setShowTowingModal] = useState(false);
  const [showAllSelfFix, setShowAllSelfFix] = useState(false);

  // Handle summary - prefer userSummary from backend, fallback to legacy format
  const summaryText = conversationSummaries?.user?.shortDescription
    || (typeof summary === 'string'
      ? summary
      : [...(summary?.detected || []), ...(summary?.reported || [])].join('. '));

  const safeResults = Array.isArray(results) ? results : [];
  const topDiagnosis = safeResults[0];
  const additionalResults = safeResults.slice(1); // Show ALL additional results

  // Probability helpers
  const normProb = (p: number) => (p > 1 ? p / 100 : p);
  const pct = (p: number) => Math.round(normProb(p) * 100);

  // Normalize selfFix to handle string[] or object[]
  const providedSelfFix = (Array.isArray(selfFix) ? selfFix : [])
    .map(item => typeof item === "string" ? { step: item, actionType: "inspect" } : item)
    .filter((x: any) => typeof x?.step === "string" && x.step.trim().length > 0);

  // Use contextual suggestions if no selfFix provided
  const contextualSuggestions = getContextualSuggestions(diagnosisContext, topDiagnosis?.issue);
  const normalizedSelfFix = providedSelfFix.length > 0 ? providedSelfFix : contextualSuggestions;

  // Filter recommendations - remove generic "go to mechanic" items
  const filteredRecommendations = Array.isArray(recommendations)
    ? [...new Set(recommendations)]
      .filter(x => typeof x === "string" && x.trim().length > 0)
      .filter(x => !/(מומלץ לפנות למוסך|פנה למוסך|לך למוסך)/i.test(x))
    : [];

  // Get status config with fallback
  const statusColor = status?.color || 'yellow';
  const currentStatus = statusConfig[statusColor] || statusConfig.yellow;
  const StatusIcon = currentStatus.Icon;

  // Extract title without emoji
  const cleanTitle = title?.replace(/[🔍🚨🛠️🏥ℹ️]/g, '').trim() || 'אבחון סופי';

  // Derive confidence level from numeric confidence
  const normalizedConfidence = typeof confidence === "number"
    ? (confidence > 1 ? confidence / 100 : confidence)
    : undefined;

  const derivedConfidenceLabel = normalizedConfidence !== undefined
    ? normalizedConfidence < 0.55 ? 'נמוכה' : normalizedConfidence < 0.75 ? 'בינונית' : 'גבוהה'
    : undefined;

  const displayConfidenceLevel = confidenceLevel ?? derivedConfidenceLabel;

  // 🔧 FIXED: Determine if we need emergency buttons based on severity
  const effectiveSeverity = severity || mechanicReport?.severity;
  const showEmergencyButtons =
    status?.color === 'red' ||
    effectiveSeverity === 'critical' ||
    effectiveSeverity === 'high' ||
    showTowButton === true;

  // Determine if tow button should be shown - always show for critical scenarios
  const shouldShowTow = !!(
    showTowButton ||
    towConditions?.length ||
    mechanicReport?.towConditions?.length ||
    status?.color === 'red' ||
    effectiveSeverity === 'critical' ||
    effectiveSeverity === 'high'
  );

  return (
    <>
      {/* Towing Modal */}
      <TowingModal
        isOpen={showTowingModal}
        onClose={() => setShowTowingModal(false)}
      />

      <motion.div
        className="w-full max-w-2xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        dir="rtl"
      >
        <div className="space-y-4">

          {/* Emergency Status Banner */}
          {status && status.text && (
            <motion.div
              variants={itemVariants}
              className={`
                relative overflow-hidden rounded-3xl p-6
                ${currentStatus.wrapper} ${currentStatus.glow}
                border backdrop-blur-xl
              `}
            >
              <div className="flex items-center gap-5">
                {/* Icon with glow */}
                <div className={`p-4 rounded-2xl ${currentStatus.iconWrapper}`}>
                  <StatusIcon size={32} className={currentStatus.iconColor} strokeWidth={2.5} />
                </div>

                <div className="flex-1">
                  <h2 className={`text-2xl font-bold ${currentStatus.textColor}`}>
                    {status.text || ''}
                  </h2>
                  {status.instruction && (
                    <p className={`mt-1.5 text-base ${currentStatus.subTextColor}`}>
                      {status.instruction}
                    </p>
                  )}
                </div>
              </div>

              {/* Emergency Action Button - Tow Only */}
              {showEmergencyButtons && shouldShowTow && (
                <div className="mt-5">
                  <button
                    onClick={() => setShowTowingModal(true)}
                    className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl ${currentStatus.buttonBg} text-white font-bold text-lg transition-colors shadow-lg`}
                  >
                    <Truck size={24} />
                    <span>הזמן גרר</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Main Diagnosis Card */}
          <motion.div
            variants={itemVariants}
            className="rounded-3xl bg-slate-950/80 border border-white/10 backdrop-blur-xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-blue-500/15 shadow-[0_0_20px_rgba(59,130,246,0.25)]">
                    <Stethoscope size={24} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white truncate">{cleanTitle}</h3>
                  </div>
                </div>

                {displayConfidenceLevel && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                    <Activity size={14} className="text-emerald-400" />
                    <span className="text-sm text-white/70 font-medium">ודאות {displayConfidenceLevel}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">

              {/* Summary Card - What was detected/reported */}
              {summaryText && summaryText.trim().length > 0 && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-xl p-4 bg-white/[0.03] border border-white/10"
                >
                  <div className="flex items-center gap-2 mb-2 text-white/60">
                    <Info size={16} />
                    <span className="text-sm font-medium">אז מה זיהינו בעצם?</span>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{summaryText}</p>
                </motion.div>
              )}

              {/* Top Diagnosis */}
              {topDiagnosis && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-2xl p-5 bg-gradient-to-bl from-blue-500/10 via-purple-500/5 to-transparent border border-blue-500/20"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.25)] flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-400">1</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white/70">האבחנה המובילה</h4>
                    {typeof topDiagnosis.probability === 'number' && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-xs font-medium text-blue-300">
                        {pct(topDiagnosis.probability)}%
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{topDiagnosis.issue}</h3>
                  {(topDiagnosis.explanation || topDiagnosis.description) && (
                    <p className="text-sm text-white/50 leading-relaxed">
                      {topDiagnosis.explanation || topDiagnosis.description || ''}
                    </p>
                  )}
                </motion.div>
              )}

              {/* Reasoning Section - Why did we reach this conclusion? */}
              {reasoning && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-2xl p-5 bg-gradient-to-l from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/20"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.2)] flex-shrink-0">
                      <Activity size={18} className="text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-base font-semibold text-white/90 mb-2">למה הגענו למסקנה הזו?</h4>
                      <p className="text-sm text-white/60 leading-relaxed">{reasoning}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Additional Results Grid */}
              {additionalResults.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {additionalResults.map((result, idx) => (
                    <motion.div
                      key={idx}
                      variants={itemVariants}
                      className="rounded-xl p-4 bg-white/[0.03] border border-white/5"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                          <span className="text-xs font-medium text-white/50">{idx + 2}</span>
                        </div>
                        <span className="text-xs text-white/40">אפשרות נוספת</span>
                        {typeof result.probability === 'number' && (
                          <span className="mr-auto px-1.5 py-0.5 rounded bg-white/10 text-xs text-white/50">
                            {pct(result.probability)}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white/70">{result.issue}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Self-Fix Actions */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl p-5 bg-white/[0.03] border border-white/10"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <Wrench size={18} className="text-emerald-400" />
                  </div>
                  <h4 className="text-base font-semibold text-white/80">מה ניתן לעשות כרגע?</h4>
                </div>
                {normalizedSelfFix.length > 0 ? (
                  <>
                    <ul className="space-y-3">
                      {(showAllSelfFix ? normalizedSelfFix : normalizedSelfFix.slice(0, 4)).map((item: any, idx: number) => {
                        const ActionIcon = actionTypeIcons[item.actionType || 'inspect'] || Eye;
                        return (
                          <li key={idx} className="flex items-start gap-4 flex-row-reverse">
                            <ActionIcon size={18} className="text-emerald-400/60 mt-1 flex-shrink-0" />
                            <div className="flex-1 pt-0.5 text-right">
                              <span className="text-sm text-white/70 leading-relaxed">{item.step}</span>
                            </div>
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                              <span className="text-xs font-semibold text-emerald-400/80">{idx + 1}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {normalizedSelfFix.length > 4 && (
                      <button
                        onClick={() => setShowAllSelfFix(!showAllSelfFix)}
                        className="mt-3 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        {showAllSelfFix ? 'הסתר' : `ראה עוד (${normalizedSelfFix.length - 4})`}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-white/50">אין פעולות בטוחות לביצוע עצמאי כרגע. מומלץ לפנות למוסך או לסיוע דרך.</p>
                )}
              </motion.div>

              {/* Next Steps */}
              {nextSteps && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-2xl p-5 bg-gradient-to-l from-indigo-500/10 via-blue-500/5 to-transparent border border-indigo-500/20"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-indigo-500/15 shadow-[0_0_15px_rgba(99,102,241,0.2)] flex-shrink-0">
                      <Shield size={20} className="text-indigo-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="text-base font-semibold text-white/90">המשך טיפול מומלץ</h4>
                        <ChevronLeft size={16} className="text-indigo-400" />
                      </div>
                      <p className="text-sm text-white/50 leading-relaxed">{nextSteps}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Recommendations - only show if meaningful items exist */}
              {filteredRecommendations.length > 0 && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-xl p-4 bg-white/[0.02] border border-white/5"
                >
                  <div className="flex items-center gap-2 mb-3 text-white/50">
                    <Wrench size={14} />
                    <span className="text-xs font-medium">בדיקות מומלצות להמשך</span>
                  </div>
                  <ul className="space-y-2">
                    {filteredRecommendations.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-white/40">
                        <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-2 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* Action Buttons - mechanic button always visible */}
              <motion.div variants={itemVariants} className="flex gap-3 pt-2">
                <button
                  onClick={onOpenMechanicRequest}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
                >
                  <span>פתח פנייה למוסך</span>
                  <Wrench size={18} />
                </button>
                {shouldShowTow && (
                  <button
                    onClick={() => setShowTowingModal(true)}
                    className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium transition-colors border border-white/20"
                  >
                    <span>התקשר לגרר</span>
                    <Truck size={18} />
                  </button>
                )}
              </motion.div>
            </div>

            {/* Disclaimer Footer */}
            {disclaimer && (
              <div className="px-6 py-4 border-t border-white/5 bg-white/[0.01]">
                <div className="flex items-center gap-2">
                  <Info size={14} className="text-white/30 flex-shrink-0" />
                  <p className="text-xs text-white/30 leading-relaxed">{disclaimer}</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}

