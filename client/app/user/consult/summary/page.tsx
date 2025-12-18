"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";

// Flexible diagnosis shape to support both legacy and new formats
interface StoredDiagnosis {
  // New schema (from /api/ai/questions)
  type?: string;
  summary?: string;
  results?: {
    issue: string;
    probability?: number;
    explanation?: string;
    self_checks?: string[];
    do_not?: string[];
  }[];
  recommendations?: string[];
  disclaimer?: string;
  confidence?: number;

  // Legacy fields (backward compatibility)
  diagnosis?: string[];
  self_checks?: string[];
  warnings?: string[];
}

interface SummaryViewModel {
  summary: string | null;
  topCauses: string[];
  diyChecks: string[];
  warnings: string[];
  disclaimer: string | null;
}

export default function SummaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewModel, setViewModel] = useState<SummaryViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Try to get data from sessionStorage first (main path)
    const storedDiagnosis = sessionStorage.getItem("consult_diagnosis");

    const buildViewModel = (raw: StoredDiagnosis | null): SummaryViewModel | null => {
      if (!raw) return null;

      // New schema: summary + results
      if (raw.results && raw.results.length > 0) {
        const sorted = [...raw.results].sort(
          (a, b) => (b.probability ?? 0) - (a.probability ?? 0)
        );
        const top = sorted[0];

        const summary =
          (raw.summary && raw.summary.trim()) ||
          (top?.issue ? `האבחנה הסבירה ביותר: ${top.issue}` : null);

        const topCauses = sorted.map((r) => r.issue);

        const diyChecks =
          (top?.self_checks && top.self_checks.length > 0
            ? top.self_checks
            : raw.recommendations) || [];

        const warnings = top?.do_not && top.do_not.length > 0 ? top.do_not : [];

        return {
          summary,
          topCauses,
          diyChecks,
          warnings,
          disclaimer: raw.disclaimer || null,
        };
      }

      // Legacy schema: diagnosis/self_checks/warnings
      const legacySummary =
        raw.diagnosis && raw.diagnosis.length > 0
          ? `האבחנה הסבירה ביותר: ${raw.diagnosis[0]}`
          : null;

      return {
        summary: legacySummary,
        topCauses: raw.diagnosis || [],
        diyChecks: raw.self_checks || [],
        warnings: raw.warnings || [],
        disclaimer: raw.disclaimer || null,
      };
    };

    let hasAnyData = false;

    if (storedDiagnosis) {
      try {
        const parsedDiagnosis = JSON.parse(storedDiagnosis) as StoredDiagnosis;
        const vm = buildViewModel(parsedDiagnosis);
        if (vm) {
          setViewModel(vm);
          hasAnyData = true;
        }
      } catch (e) {
        console.error("Failed to parse stored diagnosis:", e);
      }
    }

    // Fallback: try URL param (for backwards compatibility / deep-link)
    if (!hasAnyData) {
      const diagnosisParam = searchParams.get("diagnosis");
      if (diagnosisParam) {
        try {
          const decoded = decodeURIComponent(diagnosisParam);
          const parsedDiagnosis = JSON.parse(decoded) as StoredDiagnosis;
          const vm = buildViewModel(parsedDiagnosis);
          if (vm) {
            setViewModel(vm);
            hasAnyData = true;
          }
        } catch (e) {
          console.error("Failed to parse diagnosis from URL:", e);
        }
      }
    }

    setLoading(false);

    if (!hasAnyData) {
      setError("לא נמצאו נתוני אבחון. אנא חזור ונסה שוב.");
    }
  }, [searchParams]);

  const handleContactGarage = () => {
    // TODO: Implement contact garage flow
    alert("יצירת קשר עם מוסך - יושלם בשלב הבא");
  };

  const handleCloseRequest = () => {
    // Clear sessionStorage
    sessionStorage.removeItem("consult_diagnosis");
    router.push("/user");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="text-white/70 text-lg">טוען סיכום אבחון...</div>
      </div>
    );
  }

  if (error || !viewModel) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white/10 backdrop-blur-xl border border-red-500/30 rounded-3xl shadow-2xl p-8 max-w-md">
          <div className="text-red-400 text-xl font-bold mb-4">שגיאה</div>
          <div className="text-white/70 mb-6">{error || "לא נמצאו נתוני אבחון"}</div>
          <motion.button
            onClick={() => router.push("/user/consult/new")}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full p-4 bg-gradient-to-r from-[#4A90E2] to-[#5c60ff] text-white font-bold rounded-xl"
          >
            חזור להתחלה
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6 bg-gradient-to-br from-[#0a1120] via-[#0f1a2e] to-[#0a1120]" dir="rtl">
      <div className="w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 md:p-10"
        >
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              סיכום אבחון
            </h1>
            <div className="h-1 w-16 bg-gradient-to-r from-[#4A90E2] to-transparent rounded-full"></div>
          </div>

          {/* Section 1: Final Diagnosis Summary */}
          {viewModel.summary && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">📋</span>
                אבחנה סופית
              </h2>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <p className="text-white/90 leading-relaxed text-lg">
                  {viewModel.summary}
                </p>
              </div>
            </motion.div>
          )}

          {/* Section 2: Top Causes (ranked issues) */}
          {viewModel.topCauses.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">🔍</span>
                גורמים סבירים
              </h2>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <ul className="space-y-3">
                  {viewModel.topCauses.map((cause, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="text-[#4A90E2] font-bold mt-1">{index + 1}.</span>
                      <span className="text-white/90 leading-relaxed flex-1">{cause}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* Section 3: Self-Check Recommendations (DIY) */}
          {viewModel.diyChecks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">🔧</span>
                המלצות לבדיקה עצמית
              </h2>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <ul className="space-y-3">
                  {viewModel.diyChecks.map((check, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="text-[#4A90E2] font-bold mt-1">{index + 1}.</span>
                      <span className="text-white/90 leading-relaxed flex-1">{check}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* Section 4: Warnings / Safety Notice */}
          {viewModel.warnings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                אזהרות חשובות
              </h2>
              <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/30 rounded-2xl p-6">
                <ul className="space-y-3">
                  {viewModel.warnings.map((warning, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="text-red-400 font-bold mt-1">•</span>
                      <span className="text-white/90 leading-relaxed flex-1">{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* Disclaimer */}
          {viewModel.disclaimer && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mb-8"
            >
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <p className="text-white/70 leading-relaxed text-sm italic">
                  {viewModel.disclaimer}
                </p>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col gap-4 mt-8"
          >
            <motion.button
              onClick={handleContactGarage}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full p-6 bg-gradient-to-r from-[#4A90E2] to-[#5c60ff] hover:from-[#5a9ef0] hover:to-[#6c70ff] text-white font-bold rounded-2xl transition-all duration-300 shadow-lg shadow-[#4A90E2]/30 hover:shadow-xl hover:shadow-[#4A90E2]/50 text-lg"
            >
              צור קשר עם מוסך
            </motion.button>
            <motion.button
              onClick={handleCloseRequest}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full p-6 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 text-white font-bold rounded-2xl transition-all duration-300 text-lg"
            >
              סגור פנייה
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

