"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface TypingBubbleProps {
  text: string;
  onComplete?: () => void;
  speed?: number;
}

export default function TypingBubble({
  text,
  onComplete,
  speed = 30,
}: TypingBubbleProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, speed);

      return () => clearTimeout(timeout);
    } else if (currentIndex === text.length && onComplete) {
      // Small delay before calling onComplete
      const timeout = setTimeout(() => {
        onComplete();
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, speed, onComplete]);

  useEffect(() => {
    // Reset when text changes
    setDisplayedText("");
    setCurrentIndex(0);
  }, [text]);

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
      <div className="max-w-[80%] rounded-3xl rounded-tl-sm p-5 bg-white/10 backdrop-blur-md border border-white/15 shadow-[0_4px_16px_rgba(255,255,255,0.08)] text-white">
        <div className="text-base leading-relaxed whitespace-pre-wrap">
          {displayedText}
          {currentIndex < text.length && (
            <span className="inline-block w-2 h-4 bg-white/70 ml-1 animate-pulse" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

