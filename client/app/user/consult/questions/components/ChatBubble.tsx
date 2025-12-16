"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface ChatBubbleProps {
  message?: string;
  images?: string[];
  isUser: boolean;
  delay?: number;
  typewriter?: boolean; // Enable typewriter effect for AI messages
  typewriterSpeed?: number; // Speed in ms per character
}

export default function ChatBubble({
  message,
  images,
  isUser,
  delay = 0,
  typewriter = false,
  typewriterSpeed = 20,
}: ChatBubbleProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const safeMessage = message ?? "";

  // Typewriter effect for AI messages
  useEffect(() => {
    if (!typewriter || isUser) {
      setDisplayedText(safeMessage);
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    setDisplayedText("");
    setCurrentIndex(0);

    if (safeMessage.length === 0) {
      setIsTyping(false);
      return;
    }

    let intervalId: NodeJS.Timeout | null = null;
    
    intervalId = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev < safeMessage.length) {
          setDisplayedText(safeMessage.slice(0, prev + 1));
          return prev + 1;
        } else {
          setIsTyping(false);
          if (intervalId) {
            clearInterval(intervalId);
          }
          return prev;
        }
      });
    }, typewriterSpeed);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      setIsTyping(false);
    };
  }, [safeMessage, typewriter, isUser, typewriterSpeed]);

  // For user messages or non-typewriter, show full message immediately
  const displayText = typewriter && !isUser ? displayedText : safeMessage;
  const hasImages = Array.isArray(images) && images.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ 
        type: "spring",
        stiffness: 300,
        damping: 25,
        delay,
      }}
      className={`flex w-full mb-4 ${isUser ? "justify-start" : "justify-end"}`}
      dir="rtl"
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] p-4 sm:p-5 break-words ${
          isUser
            ? "bg-gradient-to-br from-[#4A90E2] to-[#6A9CF2] text-white rounded-3xl rounded-tl-sm shadow-[0_4px_20px_rgba(74,144,226,0.35)]"
            : "bg-white/10 backdrop-blur-md border border-white/15 text-white rounded-3xl rounded-tr-sm shadow-[0_4px_16px_rgba(255,255,255,0.08)]"
        }`}
        style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
      >
        {displayText && (
          <div className="text-base leading-relaxed whitespace-pre-wrap break-words" dir="rtl">
            {displayText}
            {isTyping && (
              <span className="inline-block w-2 h-4 bg-white/70 mr-1 animate-pulse" />
            )}
          </div>
        )}
        {isUser && hasImages && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {images!.slice(0, 3).map((url) => (
              <div
                key={url}
                className="overflow-hidden rounded-xl border border-white/15 bg-black/10"
              >
                <img src={url} alt="תמונה שנשלחה" className="w-full h-24 object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

