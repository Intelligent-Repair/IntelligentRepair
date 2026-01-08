"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Wrench } from "lucide-react";


interface ChatBubbleProps {
  message?: string;
  images?: string[];
  isUser: boolean;
  delay?: number;
  typewriter?: boolean; // Enable typewriter effect for AI messages
  typewriterSpeed?: number; // Speed in ms per character
  type?: string;
  meta?: any; // מידע נוסף (כותרת אזהרה, דוח מוסך וכו')
}

export default function ChatBubble({
  message,
  images,
  isUser,
  delay = 0,
  typewriter = false,
  typewriterSpeed = 20,
  type = "text",
  meta
}: ChatBubbleProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const safeMessage = message ?? "";
  const hasImages = Array.isArray(images) && images.length > 0;

  // Typewriter effect for AI messages (only for regular text messages)
  useEffect(() => {
    if (!typewriter || isUser || type !== "text") {
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
  }, [safeMessage, typewriter, isUser, typewriterSpeed, type]);

  // For user messages or non-typewriter, show full message immediately
  const displayText = typewriter && !isUser && type === "text" ? displayedText : safeMessage;

  // --- עיצוב מיוחד לאזהרת בטיחות ---
  if (type === "safety_alert") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25,
          delay,
        }}
        className="w-full mb-6 flex justify-center"
        dir="rtl"
      >
        <div className="max-w-[90%] bg-red-500/10 border border-red-500 rounded-2xl p-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <div className="flex items-center gap-3 mb-2 text-red-400 flex-row-reverse justify-end">
            <AlertTriangle size={24} />
            <span className="font-bold text-lg">{meta?.title || "אזהרת בטיחות"}</span>
          </div>
          <p className="text-white/90 text-lg leading-relaxed font-medium">
            {safeMessage}
          </p>
        </div>
      </motion.div>
    );
  }

  // --- עיצוב מיוחד להוראת בטיחות (Safety Instruction) ---
  if (type === "safety_instruction") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25,
          delay,
        }}
        className="w-full mb-6 flex justify-center"
        dir="rtl"
      >
        <div className="max-w-[90%] bg-amber-500/10 border border-amber-500 rounded-2xl p-6 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
          <div className="flex items-center gap-3 mb-2 text-amber-400 flex-row-reverse justify-end">
            <AlertTriangle size={24} />
            <span className="font-bold text-lg">{meta?.title || "הוראה דחופה"}</span>
          </div>
          <p className="text-white/90 text-lg leading-relaxed font-medium">
            {safeMessage}
          </p>
        </div>
      </motion.div>
    );
  }

  // --- עיצוב מיוחד לדוח מוסך (Mechanic Report) ---
  if (type === "mechanic_report") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25,
          delay,
        }}
        className="w-full mb-4 flex justify-start"
        dir="rtl"
      >
        <div className="max-w-[85%] sm:max-w-[75%] bg-blue-500/10 border border-blue-500/30 rounded-[20px] rounded-br-sm p-5">
          <div className="flex items-center gap-2 mb-3 text-blue-400 flex-row-reverse justify-end">
            <Wrench size={18} />
            <span className="font-bold text-sm">דוח אבחון</span>
          </div>
          <div className="text-white/90 whitespace-pre-wrap leading-relaxed mb-3">
            {safeMessage}
          </div>
          {meta && (
            <div className="mt-3 pt-3 border-t border-blue-500/20 text-sm text-white/70">
              <p className="mb-1">פרטים נוספים זמינים בדוח המלא</p>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // --- עיצוב מיוחד להוראות (Instruction) ---
  if (type === "instruction") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25,
          delay,
        }}
        className="w-full mb-4 flex justify-start"
        dir="rtl"
      >
        <div className="max-w-[85%] sm:max-w-[75%] bg-orange-500/10 border border-orange-500/30 rounded-[20px] rounded-br-sm p-5">
          <div className="flex items-center gap-2 mb-2 text-orange-400 flex-row-reverse justify-end">
            <Wrench size={18} />
            <span className="font-bold text-sm">הוראות בדיקה</span>
          </div>
          <div className="text-white/90 whitespace-pre-wrap leading-relaxed">
            {safeMessage}
          </div>
        </div>
      </motion.div>
    );
  }

  // --- עיצוב רגיל (הודעות משתמש / AI) ---
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
      className={`flex w-full mb-4 ${isUser ? "justify-end" : "justify-start"}`}
      dir="rtl"
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] p-4 break-words ${isUser
          ? "bg-gradient-to-br from-[#4A90E2] to-[#6A9CF2] text-white rounded-[20px] rounded-bl-sm shadow-[0_4px_20px_rgba(74,144,226,0.35)]"
          : "bg-white/10 backdrop-blur-md border border-white/15 text-white rounded-[20px] rounded-br-sm shadow-[0_4px_16px_rgba(255,255,255,0.08)]"
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

        {/* 🔧 FIX: Show images for any sender, not just user */}
        {hasImages && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {images!.slice(0, 3).map((url, idx) => (
              <div key={`${url}-${idx}`} className="overflow-hidden rounded-xl border border-white/15 bg-black/10">
                <img src={url} alt="תמונה" className="w-full h-24 object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

