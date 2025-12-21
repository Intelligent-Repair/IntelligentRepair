"use client";

import React from "react";
import { motion } from "framer-motion";

interface InstructionBubbleProps {
  message: string;
}

/**
 * Special bubble for instruction messages (when user says "not sure")
 * Has a distinct visual style to differentiate from regular AI messages
 */
export default function InstructionBubble({ message }: InstructionBubbleProps) {
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
      <div className="max-w-[85%] sm:max-w-[75%] p-4 bg-amber-500/10 backdrop-blur-md border border-amber-500/30 text-amber-100 rounded-[20px] rounded-br-sm shadow-[0_4px_16px_rgba(245,158,11,0.15)]">
        <div className="text-base leading-relaxed whitespace-pre-wrap break-words" dir="rtl">
          {message.split('\n').map((line, index) => {
            // Remove emojis from the line
            const cleanLine = line.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
            if (!cleanLine) return null;
            
            // Check if line starts with a number (step) or contains bullet points
            if (/^\d+\./.test(cleanLine) || cleanLine.startsWith('•')) {
              return (
                <div key={index} className="mb-2 font-medium">
                  {cleanLine}
                </div>
              );
            }
            // Regular text lines
            return (
              <div key={index} className="mb-1">
                {cleanLine}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

