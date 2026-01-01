"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CarFront, ArrowRight } from "lucide-react";

// Components
import ChatBubble from "./components/ChatBubble";
import TypingIndicator from "./components/TypingIndicator";
import MultiChoiceButtons from "./components/MultiChoiceButtons";
import FreeTextInput from "./components/FreeTextInput";
import FinalDiagnosisCard from "./components/FinalDiagnosisCard";
import InstructionBubble from "./components/InstructionBubble";

// The New Hybrid Hook
import { useHybridFlow } from "./hooks/useHybridFlow";

// Services
import { supabase } from "@/lib/supabaseClient";

interface Vehicle {
  id: string;
  manufacturer: string;
  model: string;
  year: number | null;
  license_plate: string;
}

const DRAFT_IMAGES_KEY = "draft_images";

export default function QuestionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL Params
  const vehicleId = searchParams.get("vehicle");
  const descriptionParam = searchParams.get("description");
  const description = descriptionParam ? decodeURIComponent(descriptionParam) : "";

  // Hybrid Flow State
  const { state, initFlow, sendMessage } = useHybridFlow();

  // Local UI State
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const draftImagesRef = useRef<string[]>([]);

  // 🔴 FIX: שימוש ב-Ref כדי למנוע אתחול כפול ב-React Strict Mode
  const hasInitialized = useRef(false);

  // 1. Load User & Vehicle
  useEffect(() => {
    const loadData = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) setUser({ id: authUser.id });

      if (vehicleId) {
        try {
          const res = await fetch(`/api/cars/get?car_id=${vehicleId}`);
          if (res.ok) setVehicle(await res.json());
        } catch (e) {
          console.error("Failed to load vehicle", e);
        }
      }
    };
    loadData();
  }, [vehicleId]);

  // 2. Initialize Chat (Fixed Logic)
  useEffect(() => {
    // 🔴 בדיקה: אם הרף כבר true, עצור מיד (מונע ריצה שנייה)
    if (hasInitialized.current) return;
    // אם אין עדיין נתונים, המתן
    if (!vehicle || !description) return;

    // 🔴 סימון מיידי שהאתחול בוצע
    hasInitialized.current = true;
    console.log("[QuestionsPage] Initializing flow with:", description);

    // טעינת תמונות
    const storedImages = window.sessionStorage.getItem(DRAFT_IMAGES_KEY);
    if (storedImages) {
      try {
        draftImagesRef.current = JSON.parse(storedImages);
      } catch (e) { console.error("Error loading images", e); }
    }

    // הפעלת הצ'אט
    initFlow(description, draftImagesRef.current, {
      manufacturer: vehicle.manufacturer,
      model: vehicle.model,
      year: vehicle.year
    });

  }, [vehicle, description, initFlow]);

  // 3. Auto Scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, state.status]);

  // 4. Handle Final Save
  const handleSaveRequest = async (navigatePath: string) => {
    if (isFinalizing || !user || !vehicle) return;
    setIsFinalizing(true);

    try {
      const reportMsg = state.messages.find(m => m.type === "mechanic_report");
      const reportData = reportMsg?.meta?.diagnosis || {};
      const draftId = window.sessionStorage.getItem("draft_id");

      // DEBUG: Log what's in reportData
      console.log("[handleSaveRequest] reportMsg:", reportMsg);
      console.log("[handleSaveRequest] reportData:", reportData);
      console.log("[handleSaveRequest] conversationSummaries:", reportData.conversationSummaries);

      const res = await fetch("/api/requests/from-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft_id: draftId,
          user_id: user.id,
          car_id: vehicle.id,
          ai_diagnosis: reportMsg?.text || "אבחון הושלם",
          ai_confidence: 1.0,
          // Derive Q&A from actual message history
          ai_questions: state.messages
            .filter(m => m.sender === "ai" && m.type !== "mechanic_report")
            .map(m => m.text),
          ai_answers: state.messages
            .filter(m => m.sender === "user")
            .map(m => m.text),
          ai_recommendations: reportData.recommendations,
          image_urls: draftImagesRef.current,
          // NEW: Set status based on navigation path
          status: navigatePath === "HOME" ? "closed" : "open",
          // NEW: Include mechanic summary for the request
          ai_mechanic_summary: reportData.conversationSummaries?.mechanic || null,
        }),
      });

      const data = await res.json();

      if (data.request_id) {
        window.sessionStorage.removeItem(DRAFT_IMAGES_KEY);
        window.sessionStorage.removeItem("draft_id");
        // Navigate based on path type
        if (navigatePath === "HOME") {
          router.push("/user");
        } else if (navigatePath === "MECHANIC") {
          // Go to garage selection page with the request ID
          router.push(`/user/garages?requestId=${data.request_id}`);
        } else {
          router.push("/user");
        }
      } else {
        alert("שגיאה בשמירת הפנייה.");
      }
    } catch (e) {
      console.error("Save error:", e);
      alert("אירעה שגיאה. נסה שוב.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const isProcessing = state.status === "PROCESSING";
  const isFinished = state.status === "FINISHED";

  return (
    <div
      className="h-[100dvh] flex flex-col bg-gradient-to-br from-[#0a0f1c] via-[#0d1424] to-[#0a0f1c] overflow-hidden"
      dir="rtl"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20% 50%, rgba(74, 144, 226, 0.03) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(106, 156, 242, 0.02) 0%, transparent 50%),
          url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")
        `,
        boxShadow: "inset 0 0 200px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-center pointer-events-none">
        {vehicle && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-fit max-w-2xl rounded-full bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl px-6 py-2 flex items-center gap-3 pointer-events-auto"
          >
            <div className="p-2 bg-blue-500/20 rounded-full text-blue-400">
              <CarFront size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-none">
                {vehicle.manufacturer} {vehicle.model}
              </h1>
              <span className="text-xs text-slate-400">
                {vehicle.year} • {vehicle.license_plate}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Chat */}
      <div className="flex-1 overflow-y-auto p-4 pt-24 pb-32 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-2">

          <AnimatePresence mode="popLayout">
            {state.messages.map((msg) => {

              // 🔴 FIX APPLIED: Data Transformation for Mechanic Report
              if (msg.type === "mechanic_report") {
                const diagnosisData = msg.meta?.diagnosis || {};
                const rawDiagnosis = diagnosisData.results || msg.meta?.diagnosis?.diagnosis || [];
                const safetyNotice = diagnosisData.disclaimer || msg.meta?.diagnosis?.safety_notice;

                // Transform string[] or result objects to DiagnosisResult[]
                const structuredResults = Array.isArray(rawDiagnosis)
                  ? rawDiagnosis.map((item: any, idx: number) => {
                    if (typeof item === 'string') {
                      return {
                        issue: item,
                        probability: idx === 0 ? 0.9 : 0.7,
                        explanation: idx === 0
                          ? "זוהה כתרחיש הסביר ביותר ע\"פ הבדיקות שביצענו."
                          : "אפשרות נוספת שיש לקחת בחשבון."
                      };
                    }
                    return item; // Already structured
                  })
                  : [];

                return (
                  <FinalDiagnosisCard
                    key={msg.id}
                    title={diagnosisData.title || msg.meta?.title}
                    summary={diagnosisData.summary || msg.text}
                    results={structuredResults}
                    confidence={diagnosisData.confidence || 1}
                    confidenceLevel={diagnosisData.confidenceLevel}
                    status={diagnosisData.status}
                    reasoning={diagnosisData.reasoning}
                    selfFix={diagnosisData.selfFix}
                    nextSteps={diagnosisData.nextSteps}
                    recommendations={diagnosisData.recommendations || msg.meta?.diagnosis?.recommendations || []}
                    disclaimer={safetyNotice || "האבחון הינו המלצה בלבד ואינו מהווה תחליף לבדיקת מוסך."}
                    severity={diagnosisData.severity}
                    showTowButton={diagnosisData.showTowButton}
                    towConditions={diagnosisData.towConditions}
                    mechanicReport={diagnosisData.mechanicReport}
                    conversationSummaries={diagnosisData.conversationSummaries}
                    onOpenMechanicRequest={() => handleSaveRequest("MECHANIC")}
                  />
                );
              }

              // 📋 Instruction Messages - use InstructionBubble with steps
              if (msg.type === "instruction" || msg.isInstruction) {
                const instructionMeta = msg.meta || {};
                return (
                  <InstructionBubble
                    key={msg.id}
                    title={instructionMeta.name || "הוראות בדיקה"}
                    message={msg.text}
                    steps={instructionMeta.steps || []}
                    actionType={instructionMeta.actionType || "inspect"}
                    isCritical={instructionMeta.actionType === "critical" || instructionMeta.isCritical}
                  />
                );
              }

              return (
                <ChatBubble
                  key={msg.id}
                  message={msg.text}
                  images={msg.images}
                  isUser={msg.sender === "user"}
                  type={msg.type}
                  meta={msg.meta}
                />
              );
            })}
          </AnimatePresence>

          {isProcessing && (
            <div className="flex justify-start w-full px-4">
              <TypingIndicator />
            </div>
          )}

          {isFinished && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-3 mt-6"
            >
              <button
                onClick={() => handleSaveRequest("HOME")}
                disabled={isFinalizing}
                className="w-full p-4 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 transition-all"
              >
                סיום וחזרה לתפריט הראשי
              </button>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area */}
      {!isFinished && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0f1c] via-[#0d1424]/95 to-transparent z-50" dir="rtl">
          <div className="max-w-4xl mx-auto w-full flex flex-col gap-3">

            {state.currentOptions.length > 0 && !isProcessing && (
              <MultiChoiceButtons
                options={state.currentOptions}
                onSelect={(opt) => sendMessage(opt)}
                disabled={isProcessing}
              />
            )}

            <FreeTextInput
              onSubmit={(text) => sendMessage(text)}
              disabled={isProcessing}
              placeholder={
                state.currentOptions.length > 0
                  ? "או הקלד תשובה משלך..."
                  : "כתוב תשובה..."
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}