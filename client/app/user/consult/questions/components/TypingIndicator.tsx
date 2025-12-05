"use client";

import React from "react";
import { motion } from "framer-motion";

/**
 * iMessage-style typing indicator with 3 animated dots
 * Matches incoming message bubble style with pulsing opacity + movement
 * Used to show AI is "typing" a response
 */
export default function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ 
        type: "spring",
        stiffness: 300,
        damping: 25,
      }}
      className="flex justify-start mb-4"
      dir="rtl"
    >
      {/* Bubble matches incoming message style */}
      <div className="max-w-[80px] rounded-3xl rounded-tl-sm p-4 bg-white/10 backdrop-blur-md border border-white/15 shadow-[0_4px_16px_rgba(255,255,255,0.08)]">
        <div className="flex gap-1.5 items-center justify-center">
          {/* First dot - pulsing opacity + movement */}
          <motion.div
            className="w-2.5 h-2.5 bg-white/80 rounded-full"
            animate={{
              y: [0, -6, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: 0,
              ease: "easeInOut",
            }}
          />
          {/* Second dot */}
          <motion.div
            className="w-2.5 h-2.5 bg-white/80 rounded-full"
            animate={{
              y: [0, -6, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: 0.2,
              ease: "easeInOut",
            }}
          />
          {/* Third dot */}
          <motion.div
            className="w-2.5 h-2.5 bg-white/80 rounded-full"
            animate={{
              y: [0, -6, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: 0.4,
              ease: "easeInOut",
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

