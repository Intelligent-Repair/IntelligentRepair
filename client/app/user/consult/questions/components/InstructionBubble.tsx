"use client";

import React from "react";
import { motion } from "framer-motion";
import { Eye, Wrench, Droplets, Settings2, AlertTriangle, CheckCircle2 } from "lucide-react";



interface InstructionStep {
  step: string;
  actionType?: 'inspect' | 'fill' | 'adjust' | 'check' | 'warning' | 'default';
}

interface InstructionBubbleProps {
  message?: string;
  steps?: InstructionStep[] | string[];
  actionType?: 'inspect' | 'fill' | 'adjust' | 'check' | 'warning' | 'critical' | 'default';
  title?: string;
  isCritical?: boolean;
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
  isCritical = false
}: InstructionBubbleProps) {
  // Determine effective action type
  const effectiveType = isCritical ? 'critical' : actionType;
  const colors = actionColors[effectiveType] || actionColors.default;
  const Icon = actionIcons[effectiveType] || actionIcons.default;

  // Parse steps from message if not provided
  const instructionSteps: InstructionStep[] = steps
    ? (steps as any[]).map(s => typeof s === 'string' ? { step: s } : s)
    : message
      ? message.split('\n')
        .map(line => line.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim())
        .filter(line => line.length > 0)
        .map(line => ({ step: line }))
      : [];

  // Title text - format emojis properly
  const titleText = title || (isCritical ? 'פעולה מיידית נדרשת!' : 'הוראות בדיקה');

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
        ${isCritical ? 'border-2 animate-pulse' : 'border'}
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

        {/* Steps list */}
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
