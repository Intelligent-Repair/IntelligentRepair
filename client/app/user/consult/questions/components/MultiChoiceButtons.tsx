"use client";

import React from "react";
import { motion } from "framer-motion";

interface MultiChoiceButtonsProps {
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
}

/**
 * Premium pill-shaped multi-choice buttons with press animations
 * Full-width responsive design with checkmark animation on selection
 * Supports 3-5 options for future question types
 */
export default function MultiChoiceButtons({ 
  options, 
  onSelect, 
  disabled = false 
}: MultiChoiceButtonsProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);

  const handleClick = React.useCallback((option: string) => {
    if (disabled || isProcessing) return;
    setSelected(option);
    setIsProcessing(true);
    
    // Animate press: shrink 5% + glow effect
    setTimeout(() => {
      onSelect(option);
      // Reset after a short delay to prevent rapid clicks
      setTimeout(() => {
        setIsProcessing(false);
        setSelected(null);
      }, 100);
    }, 150);
  }, [disabled, isProcessing, onSelect]);

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
      {options.map((option, index) => (
        <motion.button
          key={index}
          onClick={() => handleClick(option)}
          disabled={disabled || isProcessing}
          whileHover={!disabled && !isProcessing ? { scale: 1.02 } : {}}
          whileTap={!disabled && !isProcessing ? { scale: 0.95 } : {}}
          className={`w-full text-right px-6 py-4 rounded-full font-medium text-base transition-all duration-300 relative overflow-hidden ${
            disabled || isProcessing
              ? "bg-white/5 text-white/30 cursor-not-allowed"
              : selected === option
              ? "bg-gradient-to-r from-[#4A90E2] to-[#6A9CF2] text-white shadow-[0_0_20px_rgba(74,144,226,0.5)]"
              : "bg-white/10 hover:bg-white/15 text-white border border-white/20 hover:border-white/30 shadow-lg hover:shadow-xl"
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <span>{option}</span>
            {selected === option && (
              <motion.svg
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </motion.svg>
            )}
          </span>
        </motion.button>
      ))}
    </motion.div>
  );
}

