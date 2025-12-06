"use client";

import React from "react";
import { motion } from "framer-motion";

interface YesNoButtonsProps {
  onAnswer: (answer: boolean) => void;
  disabled?: boolean;
}

/**
 * Premium pill-shaped Yes/No buttons with press animations and glow effects
 * Full-width responsive design with checkmark animation on selection
 */
export default function YesNoButtons({ onAnswer, disabled = false }: YesNoButtonsProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [selected, setSelected] = React.useState<boolean | null>(null);

  const handleClick = React.useCallback((answer: boolean) => {
    if (disabled || isProcessing) return;
    setSelected(answer);
    setIsProcessing(true);
    
    // Animate press: shrink 5% + glow effect
    setTimeout(() => {
      onAnswer(answer);
      // Reset after a short delay to prevent rapid clicks
      setTimeout(() => {
        setIsProcessing(false);
        setSelected(null);
      }, 100);
    }, 150);
  }, [disabled, isProcessing, onAnswer]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        type: "spring",
        stiffness: 300,
        damping: 25,
        delay: 0.2 
      }}
      className="flex flex-col gap-3 mb-6 w-full"
      dir="rtl"
    >
      {/* Yes Button - Pill-shaped, full-width */}
      <motion.button
        onClick={() => handleClick(true)}
        disabled={disabled || isProcessing}
        whileHover={!disabled && !isProcessing ? { scale: 1.02 } : {}}
        whileTap={!disabled && !isProcessing ? { scale: 0.95 } : {}}
        className={`w-full px-6 py-4 rounded-full font-bold text-lg transition-all duration-300 relative overflow-hidden ${
          disabled || isProcessing
            ? "bg-white/5 text-white/30 cursor-not-allowed"
            : selected === true
            ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.5)]"
            : "bg-gradient-to-r from-green-500/20 to-green-600/20 hover:from-green-500/30 hover:to-green-600/30 text-white border border-green-500/30 hover:border-green-500/50 shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/30"
        }`}
      >
        <span className="flex items-center justify-center gap-2">
          {selected === true && (
            <motion.svg
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </motion.svg>
          )}
          כן
        </span>
      </motion.button>

      {/* No Button - Pill-shaped, full-width */}
      <motion.button
        onClick={() => handleClick(false)}
        disabled={disabled || isProcessing}
        whileHover={!disabled && !isProcessing ? { scale: 1.02 } : {}}
        whileTap={!disabled && !isProcessing ? { scale: 0.95 } : {}}
        className={`w-full px-6 py-4 rounded-full font-bold text-lg transition-all duration-300 relative overflow-hidden ${
          disabled || isProcessing
            ? "bg-white/5 text-white/30 cursor-not-allowed"
            : selected === false
            ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]"
            : "bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 text-white border border-red-500/30 hover:border-red-500/50 shadow-lg shadow-red-500/20 hover:shadow-xl hover:shadow-red-500/30"
        }`}
      >
        <span className="flex items-center justify-center gap-2">
          {selected === false && (
            <motion.svg
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </motion.svg>
          )}
          לא
        </span>
      </motion.button>
    </motion.div>
  );
}

