"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface FreeTextInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Modern, attractive free text input component for users to provide custom answers
 * Premium design with smooth animations and proper RTL support
 */
export default function FreeTextInput({
  onSubmit,
  disabled = false,
  placeholder = "או כתוב תשובה משלך...",
}: FreeTextInputProps) {
  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedText = text.trim();
    if (trimmedText && !disabled) {
      onSubmit(trimmedText);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
      }}
      onSubmit={handleSubmit}
      className="relative w-full"
      dir="rtl"
    >
      <div className="relative flex items-center">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className={`w-full bg-white/10 backdrop-blur-lg border border-white/20 rounded-[24px] pl-4 pr-12 py-3.5 text-white placeholder:text-white/50 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#4A90E2]/50 focus:border-[#4A90E2]/60 shadow-lg transition-all duration-300 text-base leading-relaxed ${
            disabled ? "opacity-50 cursor-not-allowed" : "hover:border-white/30 hover:bg-white/12"
          }`}
          style={{
            minHeight: "48px",
            maxHeight: "120px",
          }}
          dir="rtl"
        />
        <motion.button
          type="submit"
          disabled={disabled || !text.trim()}
          whileHover={!disabled && text.trim() ? { scale: 1.1 } : {}}
          whileTap={!disabled && text.trim() ? { scale: 0.9 } : {}}
          className={`absolute left-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
            disabled || !text.trim()
              ? "bg-white/5 text-white/30 cursor-not-allowed"
              : "bg-gradient-to-r from-[#4A90E2] to-[#6A9CF2] text-white shadow-[0_4px_12px_rgba(74,144,226,0.4)] hover:shadow-[0_6px_16px_rgba(74,144,226,0.6)]"
          }`}
          style={{
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </motion.button>
      </div>
    </motion.form>
  );
}

