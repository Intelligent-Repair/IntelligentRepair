"use client";

import React, { useEffect, useCallback, useState } from "react";
import { motion } from "framer-motion";

interface MultiChoiceButtonsProps {
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
}

export default function MultiChoiceButtons({
  options,
  onSelect,
  disabled = false
}: MultiChoiceButtonsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  // 🔧 FIX: Reset selection when options change
  useEffect(() => {
    setSelected(null);
  }, [options]);

  const handleClick = useCallback((option: string) => {
    if (disabled) return;
    setSelected(option);
    onSelect(option);
  }, [disabled, onSelect]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex flex-row flex-wrap gap-2 justify-start"
      dir="rtl"
    >
      {options.map((option, idx) => {
        const isSelected = selected === option;

        return (
          <motion.button
            key={`${option}-${idx}`}
            onClick={() => handleClick(option)}
            disabled={disabled}
            aria-pressed={isSelected}
            whileHover={!disabled ? { scale: 1.05 } : {}}
            whileTap={!disabled ? { scale: 0.95 } : {}}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${disabled
                ? "bg-white/5 text-white/30 cursor-not-allowed border border-white/20"
                : isSelected
                  ? "bg-gradient-to-r from-[#4A90E2] to-[#6A9CF2] border border-[#4A90E2] text-white shadow-[0_0_20px_rgba(74,144,226,0.5)]"
                  : "bg-white/10 border border-white/20 text-white hover:bg-white/15 hover:border-white/30 shadow-lg hover:shadow-xl"
              }`}
          >
            {option}
          </motion.button>
        );
      })}
    </motion.div>
  );
}