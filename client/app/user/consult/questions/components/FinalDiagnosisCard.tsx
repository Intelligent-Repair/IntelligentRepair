"use client";

import React from "react";
import { motion } from "framer-motion";

interface FinalDiagnosisCardProps {
  diagnosis: {
    diagnosis: string[];
    self_checks: string[];
    warnings: string[];
    disclaimer: string;
    recommendations?: string[] | null;
    safety_notice?: string | null;
  };
}

/**
 * Premium glass panel final diagnosis card
 * Displays diagnosis, self-checks, warnings, and disclaimer in a luxury automotive aesthetic
 */
export default function FinalDiagnosisCard({ diagnosis }: FinalDiagnosisCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        type: "spring",
        stiffness: 200,
        damping: 25,
        duration: 0.5 
      }}
      className="flex justify-start mb-4"
      dir="rtl"
    >
      {/* Glass panel with backdrop blur */}
      <div className="max-w-[90%] rounded-3xl p-6 bg-white/10 backdrop-blur-lg border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] text-white">
        {/* Diagnosis Section */}
        {diagnosis.diagnosis && diagnosis.diagnosis.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              סיבות אפשריות
            </h3>
            <ul className="space-y-3">
              {diagnosis.diagnosis.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-[#4A90E2] font-bold mt-1 flex-shrink-0">{index + 1}.</span>
                  <span className="text-white/90 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Self-Checks Section */}
        {diagnosis.self_checks && diagnosis.self_checks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">🔧</span>
              המלצות לבדיקה עצמית
            </h3>
            <ul className="space-y-3">
              {diagnosis.self_checks.map((check, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-[#4A90E2] font-bold mt-1 flex-shrink-0">{index + 1}.</span>
                  <span className="text-white/90 leading-relaxed">{check}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Warnings Section */}
        {diagnosis.warnings && diagnosis.warnings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              אזהרות בטיחות
            </h3>
            <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-2xl p-4">
              <ul className="space-y-2">
                {diagnosis.warnings.map((warning, index) => (
                  <li key={index} className="text-red-200/90 leading-relaxed">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}

        {/* Recommendations Section */}
        {diagnosis.recommendations && diagnosis.recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-6"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">💡</span>
              המלצות לפעולה
            </h3>
            <ul className="space-y-3">
              {diagnosis.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-[#4A90E2] font-bold mt-1 flex-shrink-0">{index + 1}.</span>
                  <span className="text-white/90 leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Safety Notice Section */}
        {diagnosis.safety_notice && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            className="mb-6 bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/30 rounded-2xl p-4"
          >
            <h3 className="text-lg font-bold text-yellow-200 mb-2 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              הודעה חשובה
            </h3>
            <p className="text-yellow-100/90 leading-relaxed">{diagnosis.safety_notice}</p>
          </motion.div>
        )}

        {/* Disclaimer Section */}
        {diagnosis.disclaimer && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="pt-4 border-t border-white/10"
          >
            <p className="text-white/70 text-sm leading-relaxed italic">
              {diagnosis.disclaimer}
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

