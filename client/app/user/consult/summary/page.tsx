"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface DiagnosisData {
  diagnosis: string[];
  self_checks: string[];
  warnings: string[];
  disclaimer: string;
}

interface QuestionsData {
  explanation?: string;
  top_causes?: string[];
  safety_notice?: string;
}

export default function SummaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [questionsData, setQuestionsData] = useState<QuestionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Try to get data from sessionStorage first
    const storedDiagnosis = sessionStorage.getItem("consult_diagnosis");
    const storedQuestionsData = sessionStorage.getItem("consult_questions_data");

    if (storedDiagnosis) {
      try {
        const parsedDiagnosis = JSON.parse(storedDiagnosis);
        setDiagnosis(parsedDiagnosis);
      } catch (e) {
        console.error("Failed to parse stored diagnosis:", e);
      }
    }

    if (storedQuestionsData) {
      try {
        const parsedQuestionsData = JSON.parse(storedQuestionsData);
        setQuestionsData(parsedQuestionsData);
      } catch (e) {
        console.error("Failed to parse stored questions data:", e);
      }
    }

    // If no stored data, try URL params (fallback)
    let diagnosisParam: string | null = null;
    if (!storedDiagnosis && !storedQuestionsData) {
      diagnosisParam = searchParams.get("diagnosis");
      const questionsParam = searchParams.get("questions");
      
      if (diagnosisParam) {
        try {
          const decoded = decodeURIComponent(diagnosisParam);
          setDiagnosis(JSON.parse(decoded));
        } catch (e) {
          console.error("Failed to parse diagnosis from URL:", e);
        }
      }

      if (questionsParam) {
        try {
          const decoded = decodeURIComponent(questionsParam);
          setQuestionsData(JSON.parse(decoded));
        } catch (e) {
          console.error("Failed to parse questions data from URL:", e);
        }
      }
    }

    setLoading(false);

    // If no data at all, show error
    if (!storedDiagnosis && !diagnosisParam) {
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
    sessionStorage.removeItem("consult_questions_data");
    router.push("/user");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="text-white/70 text-lg">טוען סיכום אבחון...</div>
      </div>
    );
  }

  if (error || !diagnosis) {
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

          {/* Section 1: Final Diagnosis Explanation */}
          {questionsData?.explanation && (
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
                  {questionsData.explanation}
                </p>
              </div>
            </motion.div>
          )}

          {/* Section 2: Top Causes */}
          {questionsData?.top_causes && questionsData.top_causes.length > 0 && (
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
                  {questionsData.top_causes.map((cause, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="text-[#4A90E2] font-bold mt-1">{index + 1}.</span>
                      <span className="text-white/90 leading-relaxed flex-1">{cause}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* Section 3: Self-Check Recommendations */}
          {diagnosis.self_checks && diagnosis.self_checks.length > 0 && (
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
                  {diagnosis.self_checks.map((check, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="text-[#4A90E2] font-bold mt-1">{index + 1}.</span>
                      <span className="text-white/90 leading-relaxed flex-1">{check}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* Section 4: Safety Notice */}
          {questionsData?.safety_notice && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                הערת בטיחות
              </h2>
              <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/30 rounded-2xl p-6">
                <p className="text-white/90 leading-relaxed text-lg">
                  {questionsData.safety_notice}
                </p>
              </div>
            </motion.div>
          )}

          {/* Additional Diagnosis Details */}
          {diagnosis.diagnosis && diagnosis.diagnosis.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-8"
            >
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">🔬</span>
                סיבות אפשריות נוספות
              </h2>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <ul className="space-y-3">
                  {diagnosis.diagnosis.map((cause, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="text-[#4A90E2] font-bold mt-1">{index + 1}.</span>
                      <span className="text-white/90 leading-relaxed flex-1">{cause}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* Warnings */}
          {diagnosis.warnings && diagnosis.warnings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mb-8"
            >
              <h2 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                אזהרות חשובות
              </h2>
              <div className="bg-yellow-500/10 backdrop-blur-xl border border-yellow-500/30 rounded-2xl p-6">
                <ul className="space-y-3">
                  {diagnosis.warnings.map((warning, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="text-yellow-400 font-bold mt-1">•</span>
                      <span className="text-white/90 leading-relaxed flex-1">{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* Disclaimer */}
          {diagnosis.disclaimer && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mb-8"
            >
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <p className="text-white/70 leading-relaxed text-sm italic">
                  {diagnosis.disclaimer}
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

