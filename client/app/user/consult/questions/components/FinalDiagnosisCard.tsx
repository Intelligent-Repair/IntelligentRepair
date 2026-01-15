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
  Truck,
  X,
  Phone,
  HelpCircle
} from "lucide-react";
import { towingCompanies, formatTelLink } from "@/lib/ui/towingCompanies";


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
  userReportSummary?: string;  // NEW: AI summary of what user reported
  onOpenMechanicRequest?: () => void;
}


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

  const [logoErrors, setLogoErrors] = React.useState<Record<string, boolean>>({});

  const handleLogoError = (companyName: string) => {
    setLogoErrors(prev => ({ ...prev, [companyName]: true }));
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
                  <a
                    key={company.name}
                    href={formatTelLink(company.number)}
                    className={`
                      w-full flex items-center justify-between p-4 rounded-2xl
                      bg-gradient-to-l ${company.color}
                      hover:opacity-90 transition-opacity
                      group
                    `}
                  >
                    <div className="flex items-center gap-4">
                      {/* Company Logo with fallback */}
                      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center overflow-hidden p-1">
                        {!logoErrors[company.name] ? (
                          <img
                            src={company.logo}
                            alt={company.name}
                            className="w-full h-full object-contain"
                            onError={() => handleLogoError(company.name)}
                          />
                        ) : (
                          <Phone size={20} className="text-gray-600" />
                        )}
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
                  </a>
                ))}

                {/* Other Option */}
                <a
                  href="tel:"
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
                </a>
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
  userReportSummary,
  onOpenMechanicRequest,
}: FinalDiagnosisCardProps) {
  const [showTowingModal, setShowTowingModal] = useState(false);
  const [showAllSelfFix, setShowAllSelfFix] = useState(false);

  // Handle summary - prefer userSummary from backend, fallback to legacy format
  const summaryText = conversationSummaries?.user?.shortDescription
    || (typeof summary === 'string'
      ? summary
      : [...(summary?.detected || []), ...(summary?.reported || [])].join('. '));

  // Sort results by probability (descending) for reliability
  const safeResults = Array.isArray(results) ? results : [];
  const normProb = (p: number) => {
    const n = Number(p);
    if (!Number.isFinite(n)) return 0;
    const v = n > 1 ? n / 100 : n;
    return Math.max(0, Math.min(1, v));
  };
  const sortedResults = [...safeResults].sort((a, b) => normProb(b.probability) - normProb(a.probability));
  const topDiagnosis = sortedResults[0];
  const additionalResults = sortedResults.slice(1);

  // Probability to percentage helper
  const pct = (p: number) => Math.round(normProb(p) * 100);

  // Normalize selfFix to handle string[] or object[] - NO client-side generation
  const normalizedSelfFix = (Array.isArray(selfFix) ? selfFix : [])
    .map(item => typeof item === "string" ? { step: item, actionType: "inspect" } : item)
    .filter((x: any) => typeof x?.step === "string" && x.step.trim().length > 0);

  // Filter recommendations - dedupe and trim only, keep all real recommendations
  const filteredRecommendations = Array.isArray(recommendations)
    ? [...new Set(recommendations)]
      .filter(x => typeof x === "string" && x.trim().length > 0)
    : [];

  // Get status config with fallback
  const statusColor = status?.color || 'yellow';
  const currentStatus = statusConfig[statusColor] || statusConfig.yellow;
  const StatusIcon = currentStatus.Icon;

  // Extract title without emoji
  const cleanTitle = title?.replace(/[🔍🚨🛠️🏥ℹ️]/g, '').trim() || 'אבחון סופי';

  // Derive confidence level from TOP DIAGNOSIS probability (not separate confidence field)
  // This makes more sense for the user - if top diagnosis is 80%, confidence should be "high"
  const topDiagnosisProbability = topDiagnosis?.probability;
  const effectiveConfidence = topDiagnosisProbability !== undefined
    ? normProb(topDiagnosisProbability)
    : (typeof confidence === "number" ? (confidence > 1 ? confidence / 100 : confidence) : undefined);

  const derivedConfidenceLabel = effectiveConfidence !== undefined
    ? effectiveConfidence < 0.55 ? 'נמוכה' : effectiveConfidence < 0.75 ? 'בינונית' : 'גבוהה'
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
            {/* Header - Compact Horizontal Row */}
            <div className="py-4 px-5 border-b border-white/5 relative overflow-hidden">
              {/* Background glow effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />

              <div className="flex items-center justify-between relative z-10">
                {/* Right: Icon + Title */}
                <div className="flex items-center gap-3">
                  {/* Compact Icon with subtle glow */}
                  <div className="relative">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                      <Activity size={20} className="text-cyan-400" />
                    </div>
                  </div>
                  {/* Title */}
                  <h3 className="text-xl font-bold text-white">
                    אבחון תקלה
                  </h3>
                </div>

                {/* Left: Confidence Badge */}
                {displayConfidenceLevel && (
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-300 font-semibold">ודאות {displayConfidenceLevel}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">

              {/* Primary Diagnosis Card with Circular Progress */}
              {topDiagnosis && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-2xl p-6 bg-gradient-to-br from-slate-800/80 to-slate-900/60 border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)]"
                >
                  <div className="flex items-center gap-6">
                    {/* Circular Progress Ring */}
                    <div className="relative flex-shrink-0">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                        {/* Background circle */}
                        <circle
                          cx="50" cy="50" r="42"
                          fill="none"
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth="8"
                        />
                        {/* Progress circle with glow */}
                        <circle
                          cx="50" cy="50" r="42"
                          fill="none"
                          stroke="url(#progressGradient)"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 42}`}
                          strokeDashoffset={`${2 * Math.PI * 42 * (1 - normProb(topDiagnosis.probability))}`}
                          className="drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                        />
                        <defs>
                          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="100%" stopColor="#22d3ee" />
                          </linearGradient>
                        </defs>
                      </svg>
                      {/* Percentage in center */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-black text-cyan-400">{pct(topDiagnosis.probability)}%</span>
                      </div>
                    </div>

                    {/* Diagnosis Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-cyan-500/20 text-cyan-300">האבחנה המובילה</span>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2 leading-tight">{topDiagnosis.issue}</h3>
                      {(topDiagnosis.explanation || topDiagnosis.description) && (
                        <p className="text-sm text-white/50 leading-relaxed line-clamp-2">
                          {topDiagnosis.explanation || topDiagnosis.description || ''}
                        </p>
                      )}
                    </div>
                  </div>
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

              {/* Additional Results - Dark Glass Cards with Mini Progress */}
              {additionalResults.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mb-2">
                  {additionalResults.map((result, idx) => (
                    <motion.div
                      key={idx}
                      variants={itemVariants}
                      className="rounded-xl p-4 bg-slate-800/60 backdrop-blur-sm border border-slate-600/30 hover:border-cyan-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {/* Mini Circular Progress */}
                        <div className="relative flex-shrink-0">
                          <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
                            <circle
                              cx="50" cy="50" r="40"
                              fill="none"
                              stroke="rgba(255,255,255,0.1)"
                              strokeWidth="10"
                            />
                            <circle
                              cx="50" cy="50" r="40"
                              fill="none"
                              stroke="#0891b2"
                              strokeWidth="10"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 40}`}
                              strokeDashoffset={`${2 * Math.PI * 40 * (1 - normProb(result.probability))}`}
                              className="drop-shadow-[0_0_5px_rgba(6,182,212,0.4)]"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold text-cyan-400">{pct(result.probability)}%</span>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-cyan-400/70 block mb-1">אפשרות {idx + 2}</span>
                          <p className="text-sm font-semibold text-white/90 line-clamp-2">{result.issue}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Self-Fix Actions - Only show when there are actions */}
              {normalizedSelfFix.length > 0 && (
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
                </motion.div>
              )}

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

              {/* Recommendations - Timeline Style Checklist */}
              {filteredRecommendations.length > 0 && (
                <motion.div
                  variants={itemVariants}
                  className="rounded-2xl p-5 bg-gradient-to-br from-slate-800/50 to-slate-900/30 border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)]"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 rounded-xl bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                      <Eye size={18} className="text-amber-400" />
                    </div>
                    <h4 className="text-lg font-bold text-white/90">בדיקות מומלצות להמשך</h4>
                  </div>

                  {/* Timeline List */}
                  <div className="relative mr-4">
                    {/* Vertical connecting line */}
                    <div className="absolute right-3.5 top-4 bottom-4 w-0.5 bg-gradient-to-b from-amber-500/40 via-amber-500/20 to-transparent" />

                    <ul className="space-y-4">
                      {filteredRecommendations.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-4 relative">
                          {/* Numbered Circle */}
                          <div className="relative z-10 flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/40 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                            <span className="text-xs font-bold text-amber-300">{idx + 1}</span>
                          </div>

                          {/* Text */}
                          <div className="flex-1 pt-0.5">
                            <span className="text-sm text-white/70 leading-relaxed">{item}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}

              {/* Action Buttons - Premium Style */}
              <motion.div variants={itemVariants} className="flex gap-3 pt-6">
                {status?.color !== 'green' && (
                  <button
                    onClick={onOpenMechanicRequest}
                    className="flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-lg transition-all shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)]"
                  >
                    <Wrench size={20} />
                    <span>פתח פנייה למוסך</span>
                  </button>
                )}
                {/* Tow button - Frosted Glass */}
                <button
                  onClick={() => setShowTowingModal(true)}
                  className="flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-white/10 backdrop-blur-md hover:bg-white/20 text-white/90 hover:text-white font-bold transition-all border border-white/20 hover:border-white/40"
                >
                  <Truck size={20} />
                  <span>הזמן גרר</span>
                </button>
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

