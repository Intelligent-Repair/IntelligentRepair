"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
<<<<<<< HEAD
import { X } from "lucide-react";
=======
import { X, AlertCircle } from "lucide-react";


>>>>>>> rescue/ui-stable

interface WarningBannerProps {
  message: string;
  type: "danger" | "caution";
  onClose?: () => void;
}

export default function WarningBanner({ message, type, onClose }: WarningBannerProps) {
  const isDanger = type === "danger";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25,
        }}
<<<<<<< HEAD
        className={`mb-4 rounded-2xl p-5 shadow-lg ${
          isDanger
            ? "bg-gradient-to-r from-red-500/20 to-red-600/20 backdrop-blur-xl border-2 border-red-500/50"
            : "bg-gradient-to-r from-orange-500/20 to-orange-600/20 backdrop-blur-xl border-2 border-orange-500/50"
        }`}
=======
        className={`mb-4 rounded-2xl p-5 shadow-lg ${isDanger
          ? "bg-gradient-to-r from-red-500/20 to-red-600/20 backdrop-blur-xl border-2 border-red-500/50"
          : "bg-gradient-to-r from-orange-500/20 to-orange-600/20 backdrop-blur-xl border-2 border-orange-500/50"
          }`}
>>>>>>> rescue/ui-stable
        dir="rtl"
      >
        <div className="flex items-start gap-4">
          <div
<<<<<<< HEAD
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-2xl ${
              isDanger ? "bg-red-500/30 text-red-300" : "bg-orange-500/30 text-orange-300"
            }`}
          >
            {isDanger ? "🔴" : "🟠"}
          </div>
          <div className="flex-1">
            <h3
              className={`font-bold text-lg mb-2 ${
                isDanger ? "text-red-200" : "text-orange-200"
              }`}
            >
              {isDanger ? "אזהרת בטיחות קריטית" : "הודעת זהירות"}
            </h3>
            <p
              className={`leading-relaxed ${
                isDanger ? "text-red-100" : "text-orange-100"
              }`}
=======
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isDanger ? "bg-red-500/30 text-red-300" : "bg-orange-500/30 text-orange-300"
              }`}
          >
            <AlertCircle size={24} />
          </div>
          <div className="flex-1">
            <h3
              className={`font-bold text-lg mb-2 ${isDanger ? "text-red-200" : "text-orange-200"
                }`}
            >
              {isDanger ? "שים לב ! אזהרת בטיחות קריטית !" : "שים לב !"}
            </h3>
            <p
              className={`leading-relaxed ${isDanger ? "text-red-100" : "text-orange-100"
                }`}
>>>>>>> rescue/ui-stable
            >
              {message}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
<<<<<<< HEAD
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isDanger
                  ? "hover:bg-red-500/30 text-red-300"
                  : "hover:bg-orange-500/30 text-orange-300"
              }`}
=======
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isDanger
                ? "hover:bg-red-500/30 text-red-300"
                : "hover:bg-orange-500/30 text-orange-300"
                }`}
>>>>>>> rescue/ui-stable
              aria-label="סגור"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

