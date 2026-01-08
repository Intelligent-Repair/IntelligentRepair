"use client";

import React, { useCallback, useState } from "react";
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
  const [selected, setSelected] = useState<boolean | null>(null);

  const handleClick = useCallback((answer: boolean) => {
    if (disabled) return;
    setSelected(answer);
    onAnswer(answer);
  }, [disabled, onAnswer]);

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
      {/* Yes Button */}
      <motion.button
        onClick={() => handleClick(true)}
        disabled={disabled}
        whileHover={!disabled ? { scale: 1.05 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${disabled
            ? "bg-white/5 text-white/30 cursor-not-allowed border border-white/20"
            : selected === true
              ? "bg-gradient-to-r from-[#4A90E2] to-[#6A9CF2] border border-[#4A90E2] text-white shadow-[0_0_20px_rgba(74,144,226,0.5)]"
              : "bg-white/10 border border-white/20 text-white hover:bg-white/15 hover:border-white/30 shadow-lg hover:shadow-xl"
          }`}
      >
        כן
      </motion.button>

      {/* No Button */}
      <motion.button
        onClick={() => handleClick(false)}
        disabled={disabled}
        whileHover={!disabled ? { scale: 1.05 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${disabled
            ? "bg-white/5 text-white/30 cursor-not-allowed border border-white/20"
            : selected === false
              ? "bg-gradient-to-r from-[#4A90E2] to-[#6A9CF2] border border-[#4A90E2] text-white shadow-[0_0_20px_rgba(74,144,226,0.5)]"
              : "bg-white/10 border border-white/20 text-white hover:bg-white/15 hover:border-white/30 shadow-lg hover:shadow-xl"
          }`}
      >
        לא
      </motion.button>
    </motion.div>
  );
}
