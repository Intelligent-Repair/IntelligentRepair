"use client";

import React from "react";
import { motion } from "framer-motion";
import { Eye, Wrench, Droplets, Settings2, AlertTriangle, CheckCircle2, Clock, Coins } from "lucide-react";



interface InstructionStep {
  step: string;
  actionType?: 'inspect' | 'fill' | 'adjust' | 'check' | 'warning' | 'critical' | 'default';
}

interface SelfFixMeta {
  difficulty?: 'easy' | 'medium' | 'hard';
  timeEstimate?: string;
  toolsNeeded?: string[];
  costEstimate?: { diy?: string; parts?: string; garage?: string };
  whenToStop?: string;
  successIndicators?: string[];
  warning?: string;
}

interface InstructionBubbleProps {
  message?: string;
  steps?: InstructionStep[] | string[];
  actionType?: 'inspect' | 'fill' | 'adjust' | 'check' | 'warning' | 'critical' | 'default';
  title?: string;
  isCritical?: boolean;
  /** Metadata for self-fix actions from KB */
  selfFixMeta?: SelfFixMeta;
}

// 🔧 אייקונים לפי סוג הפעולה
const actionIcons: Record<string, React.ElementType> = {
  inspect: Eye,
  fill: Droplets,
  adjust: Settings2,
  check: CheckCircle2,
  warning: AlertTriangle,
  critical: AlertTriangle,
  default: Wrench
};

// 🔧 צבעים לפי סוג הפעולה
const actionColors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  inspect: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-100',
    icon: 'text-blue-400'
  },
  fill: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-100',
    icon: 'text-emerald-400'
  },
  adjust: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-100',
    icon: 'text-purple-400'
  },
  check: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-100',
    icon: 'text-amber-400'
  },
  warning: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-100',
    icon: 'text-orange-400'
  },
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-100',
    icon: 'text-red-400'
  },
  default: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-100',
    icon: 'text-amber-400'
  }
};

/**
 * Special bubble for instruction messages with action-type icons
 * Icons: 👁️ Eye (inspect), 💧 Droplets (fill), ⚙️ Settings (adjust), 🔧 Wrench (default)
 */
export default function InstructionBubble({
  message,
  steps,
  actionType = 'default',
  title,
  isCritical = false,
  selfFixMeta
}: InstructionBubbleProps) {
  // Determine effective action type
  const effectiveType = isCritical ? 'critical' : actionType;
  const colors = actionColors[effectiveType] || actionColors.default;
  const Icon = actionIcons[effectiveType] || actionIcons.default;

  // 🔧 FIX: Treat empty array as no steps provided
  const hasSteps = steps && steps.length > 0;

  // Parse steps - if steps is empty/undefined, try to extract from message
  const instructionSteps: InstructionStep[] = hasSteps
    ? (steps as any[]).map(s => typeof s === 'string' ? { step: s } : s)
    : message
      ? message.split('\n')
        .map(line => line.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim())
        .filter(line => line.length > 0)
        .map(line => ({ step: line }))
      : [];

  // 🔧 FIX: Show message text above steps if both exist
  const showMessageAbove = hasSteps && message && message.trim().length > 0;

  // Title text - format emojis properly
  const titleText = title || (isCritical ? 'פעולה מיידית נדרשת!' : 'הוראות בדיקה');

  // 🔧 FIX: Handle completely empty state
  const hasContent = instructionSteps.length > 0 || (message && message.trim().length > 0);

  // Difficulty labels
  const difficultyLabels: Record<string, { text: string; color: string }> = {
    easy: { text: 'קל', color: 'text-green-400' },
    medium: { text: 'בינוני', color: 'text-yellow-400' },
    hard: { text: 'מתקדם', color: 'text-red-400' }
  };

  // Check if we have any metadata to show
  const hasMetadata = selfFixMeta && (
    selfFixMeta.difficulty ||
    selfFixMeta.timeEstimate ||
    (selfFixMeta.toolsNeeded && selfFixMeta.toolsNeeded.length > 0) ||
    selfFixMeta.costEstimate
  );

  // CRITICAL EMERGENCY CARD - Glassmorphism design with red glow
  if (isCritical) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25
        }}
        className="flex w-full mb-4 justify-center"
        dir="rtl"
      >
        <div className="
          w-[90%] max-w-md p-6 
          bg-[#0f172a]/95 backdrop-blur-sm
          rounded-2xl 
          shadow-[0_0_30px_rgba(220,38,38,0.3)]
          border-2 border-red-600
          text-center
        ">
          {/* Large Warning Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full border-2 border-red-600 flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.4)]">
              <AlertTriangle size={32} className="text-red-600" />
            </div>
          </div>

          {/* Main Title - Big and Bold */}
          <h2 className="text-2xl font-black text-red-500 mb-3">
            סכנה! עצירה מיידית
          </h2>

          {/* Instructions */}
          {instructionSteps.length > 0 && (
            <div className="space-y-2 mb-4">
              {instructionSteps.map((item, index) => (
                <p key={index} className="text-white text-lg leading-relaxed">
                  {item.step}
                </p>
              ))}
            </div>
          )}

          {/* Additional message if provided */}
          {showMessageAbove && (
            <p className="text-white/80 text-sm mb-4">{message}</p>
          )}

          {/* Warning Footer */}
          <div className="pt-4 border-t border-red-600/30">
            <p className="text-red-500 text-sm font-medium flex items-center justify-center gap-2">
              <AlertTriangle size={14} />
              המשך נסיעה עלול לגרום נזק לרכב!
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  // NORMAL INSTRUCTION CARD - Standard design for non-critical
  return (
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
      className="flex w-full mb-4 justify-start"
      dir="rtl"
    >
      <div className={`
        max-w-[85%] sm:max-w-[75%] p-4 
        ${colors.bg} backdrop-blur-md ${colors.border} ${colors.text}
        rounded-[20px] rounded-br-sm 
        shadow-[0_4px_16px_rgba(245,158,11,0.15)]
        border
      `}>
        {/* Header with icon on RIGHT (RTL) */}
        <div className="flex items-center gap-2 mb-3 flex-row-reverse justify-end">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <Icon size={18} className={colors.icon} />
          </div>
          <span className={`font-bold text-sm ${colors.icon}`}>
            {isCritical && <AlertTriangle size={14} className="inline ml-1" />}
            {titleText}
          </span>
        </div>

        {/* Self-fix metadata section (NEW) */}
        {hasMetadata && (
          <div className="mb-4 pb-3 border-b border-white/10 space-y-2">
            <div className="flex flex-wrap gap-3 text-xs">
              {/* Difficulty */}
              {selfFixMeta?.difficulty && (
                <span className={`flex items-center gap-1 ${difficultyLabels[selfFixMeta.difficulty]?.color || 'text-white/70'}`}>
                  <span className="opacity-60">קושי:</span>
                  {difficultyLabels[selfFixMeta.difficulty]?.text || selfFixMeta.difficulty}
                </span>
              )}
              {/* Time */}
              {selfFixMeta?.timeEstimate && (
                <span className="flex items-center gap-1 text-white/70">
                  <Clock size={12} />
                  {selfFixMeta.timeEstimate}
                </span>
              )}
              {/* Tools */}
              {selfFixMeta?.toolsNeeded && selfFixMeta.toolsNeeded.length > 0 && (
                <span className="flex items-center gap-1 text-white/70">
                  <Wrench size={12} />
                  {selfFixMeta.toolsNeeded.join(', ')}
                </span>
              )}
            </div>

            {/* Cost estimate */}
            {selfFixMeta?.costEstimate && (
              <div className="flex flex-wrap gap-2 text-xs">
                <Coins size={12} className="text-emerald-400 mt-0.5" />
                {selfFixMeta.costEstimate.diy && (
                  <span className="text-emerald-300">DIY: {selfFixMeta.costEstimate.diy}</span>
                )}
                {selfFixMeta.costEstimate.garage && (
                  <span className="text-amber-300">מוסך: {selfFixMeta.costEstimate.garage}</span>
                )}
              </div>
            )}

            {/* Warning */}
            {selfFixMeta?.warning && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-xs text-red-200">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-red-400" />
                {selfFixMeta.warning}
              </div>
            )}
          </div>
        )}

        {/* 🔧 FIX: Show message text above steps when both exist */}
        {showMessageAbove && (
          <div className="mb-4 pb-3 border-b border-white/10">
            <p className="text-sm leading-relaxed">{message}</p>
          </div>
        )}

        {/* Steps list */}
        {instructionSteps.length > 0 ? (
          <div className="space-y-2">
            {instructionSteps.map((item, index) => {
              const stepType = item.actionType || effectiveType;
              const StepIcon = actionIcons[stepType] || actionIcons.default;
              const stepColors = actionColors[stepType] || colors;

              // Check if line is a numbered step
              const isNumbered = /^\d+\./.test(item.step);
              const cleanStep = item.step.replace(/^\d+\.\s*/, '');

              return (
                <div
                  key={index}
                  className="flex items-start gap-3 flex-row-reverse"
                >
                  {/* Step icon on RIGHT */}
                  <div className={`
                    flex-shrink-0 w-7 h-7 rounded-full 
                    ${stepColors.bg} border ${stepColors.border}
                    flex items-center justify-center mt-0.5
                  `}>
                    {isNumbered ? (
                      <span className={`text-xs font-bold ${stepColors.icon}`}>
                        {item.step.match(/^\d+/)?.[0]}
                      </span>
                    ) : (
                      <StepIcon size={14} className={stepColors.icon} />
                    )}
                  </div>

                  {/* Step text */}
                  <div className="flex-1 text-right">
                    <span className="text-sm leading-relaxed">
                      {isNumbered ? cleanStep : item.step}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !hasContent ? (
          /* 🔧 FIX: Empty state fallback */
          <p className="text-sm text-white/60 text-center">לא התקבלו הוראות</p>
        ) : null}

        {/* Critical warning footer */}
        {isCritical && (
          <div className="mt-4 pt-3 border-t border-red-500/30">
            <p className="text-xs text-red-300/80 text-center flex items-center justify-center gap-1">
              <AlertTriangle size={12} /> אל תמשיך בנסיעה לפני ביצוע הפעולות למעלה
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
