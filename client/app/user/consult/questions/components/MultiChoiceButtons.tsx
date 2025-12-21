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
      }}
      className="flex flex-row flex-wrap gap-2 justify-start"
      dir="rtl"
    >
      {options.map((option, index) => (
        <motion.button
          key={index}
          onClick={() => handleClick(option)}
          disabled={disabled || isProcessing}
          whileHover={!disabled && !isProcessing ? { scale: 1.05 } : {}}
          whileTap={!disabled && !isProcessing ? { scale: 0.95 } : {}}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
            disabled || isProcessing
              ? "bg-white/5 text-white/30 cursor-not-allowed border border-white/20"
              : selected === option
              ? "bg-gradient-to-r from-[#4A90E2] to-[#6A9CF2] border border-[#4A90E2] text-white shadow-[0_0_20px_rgba(74,144,226,0.5)]"
              : "bg-white/10 border border-white/20 text-white hover:bg-white/15 hover:border-white/30 shadow-lg hover:shadow-xl"
          }`}
        >
          {option}
        </motion.button>
      ))}
    </motion.div>
  );
}

