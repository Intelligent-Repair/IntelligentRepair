"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
<<<<<<< HEAD
=======
import { CarFront, Send, Loader2, Pencil, Bot, Sparkles } from "lucide-react";
>>>>>>> rescue/ui-stable
import ImageUploader from "./ImageUploader";

interface Vehicle {
  id: string;
  manufacturer: string;
  model: string;
  year: number | null;
  license_plate: string;
}

function ConsultFormContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const vehicleId = searchParams.get("vehicle");
  const [draftId, setDraftId] = useState<string | null>(null);

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // CRITICAL: Reset all draft-related state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Clear description state
    setDescription("");
    
    // Clear images state
    setImageUrls([]);
    window.sessionStorage.removeItem("draft_images");
    
    console.log("[DRAFT] form state reset - description and images cleared");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("draft_images", JSON.stringify(imageUrls));
  }, [imageUrls]);

  // CRITICAL: ALWAYS generate a new draft_id on mount
  // Remove any "if exists, reuse" logic - every consultation must start fresh
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Clear all draft-related state to ensure fresh start
    window.sessionStorage.removeItem("draft_description");
    window.sessionStorage.removeItem("consult_questions_state");
    
    // ALWAYS generate a new UUID - never reuse existing
    const generateId = () => {
      if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
      }
      return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    };

    const newId = generateId();
      window.sessionStorage.setItem("draft_id", newId);
    setDraftId(newId);
    console.log("[DRAFT] new draft created in form:", newId);
  }, []);

  // טענת פרטי רכב
  useEffect(() => {
    if (!vehicleId) {
      setError("לא נבחר רכב");
      setLoading(false);
      return;
    }

    const fetchVehicle = async () => {
      try {
        setError(null);
        const res = await fetch(`/api/cars/get?car_id=${vehicleId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch vehicle");
        }
        const data = await res.json();
        setVehicle(data);
      } catch (err) {
        console.error("Error fetching vehicle:", err);
        setError("שגיאה בטעינת פרטי רכב");
      } finally {
        setLoading(false);
      }
    };

    fetchVehicle();
  }, [vehicleId]);

  const handleContinue = async () => {
    if (!vehicleId) return;
    if (!description.trim()) {
      setError("אנא תאר את התקלה לפני המשך");
      return;
    }
    if (!draftId) {
      setError("חסר מזהה טיוטה. טען מחדש ונסה שוב.");
      return;
    }
    if (!vehicle) {
      setError("שגיאה בטעינת פרטי רכב. נסה שוב.");
      return;
    }

    // Navigate directly to questions page - AI calls are handled there
    // No need to call /api/ai/consult here - questions/page.tsx handles all AI interactions
    setIsSubmitting(true);
    setError(null);

    const encodedDescription = encodeURIComponent(description.trim());
    router.push(
      `/user/consult/questions?vehicle=${vehicleId}&description=${encodedDescription}`
    );
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 bg-[#0f172a] relative overflow-hidden"
        dir="rtl"
      >
        {/* Animated Dot Background */}
        <div className="fixed inset-0 -z-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle, rgba(148, 163, 184, 0.15) 1px, transparent 1px)`,
              backgroundSize: "32px 32px",
              backgroundPosition: "0 0",
            }}
          >
            <motion.div
              className="absolute inset-0"
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                backgroundImage: `radial-gradient(circle, rgba(148, 163, 184, 0.2) 1px, transparent 1px)`,
                backgroundSize: "32px 32px",
                backgroundPosition: "0 0",
              }}
            />
          </div>
        </div>
        <div className="text-slate-200 text-lg">טוען פרטי רכב...</div>
      </div>
    );
  }

  if (error && !vehicle) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 bg-[#0f172a] relative overflow-hidden"
        dir="rtl"
      >
        {/* Animated Dot Background */}
        <div className="fixed inset-0 -z-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle, rgba(148, 163, 184, 0.15) 1px, transparent 1px)`,
              backgroundSize: "32px 32px",
              backgroundPosition: "0 0",
            }}
          >
            <motion.div
              className="absolute inset-0"
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                backgroundImage: `radial-gradient(circle, rgba(148, 163, 184, 0.2) 1px, transparent 1px)`,
                backgroundSize: "32px 32px",
                backgroundPosition: "0 0",
              }}
            />
          </div>
        </div>
        <div className="bg-[#1e293b] border border-slate-800 rounded-3xl shadow-2xl p-8 max-w-md">
          <div className="text-red-400 text-xl font-bold mb-4">שגיאה</div>
          <div className="text-slate-200 mb-6">{error}</div>
          <motion.button
            onClick={() => router.push("/user")}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full p-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-full"
          >
            חזרה לתפריט הראשי
          </motion.button>
        </div>
      </div>
    );
  }

  // Animation variants for staggerChildren
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  return (
    <div
      className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden"
      dir="rtl"
    >
      {/* Animated Dot Background */}
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(148, 163, 184, 0.15) 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
            backgroundPosition: "0 0",
          }}
        >
          <motion.div
            className="absolute inset-0"
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              backgroundImage: `radial-gradient(circle, rgba(148, 163, 184, 0.2) 1px, transparent 1px)`,
              backgroundSize: "32px 32px",
              backgroundPosition: "0 0",
            }}
          />
        </div>
      </div>
      {/* Atmospheric Glow behind card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/20 blur-[100px] rounded-full pointer-events-none -z-0" />
      
      <motion.div
        className="w-full max-w-xl md:max-w-2xl space-y-6 relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header Title - Centered */}
        <motion.h1
          variants={itemVariants}
          className="text-2xl md:text-3xl font-bold text-center mb-6 flex items-center justify-center gap-3"
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">
            ייעוץ עם העוזר האישי
          </span>
          {/* AI Visual Cluster */}
          <div className="relative">
            <Bot size={32} className="text-blue-400" />
            <Sparkles 
              size={16} 
              className="absolute -top-1 -right-2 text-yellow-300 animate-pulse" 
            />
          </div>
        </motion.h1>

        {/* Centered Vehicle Badge with Border Beam */}
        {vehicle && (
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            className="relative flex flex-col items-center justify-center p-4 rounded-xl bg-slate-800/80 border border-slate-700 shadow-lg hover:shadow-xl hover:shadow-slate-700/20 transition-shadow duration-300 overflow-hidden"
          >
            {/* Border Beam Effect */}
            <div className="absolute inset-0 rounded-xl">
              <motion.div
                className="absolute inset-0 rounded-xl"
                style={{
                  background: `linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.4), transparent)`,
                  backgroundSize: "200% 100%",
                }}
                animate={{
                  backgroundPosition: ["200% 0", "-200% 0"],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
              <div className="absolute inset-[1px] rounded-xl bg-slate-800/80" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-row items-center justify-center gap-3">
              {/* Glassmorphism Icon Container */}
              <div className="bg-white/10 backdrop-blur-md shadow-xl border border-white/20 p-3 rounded-2xl">
                <CarFront className="w-8 h-8 text-slate-200" />
              </div>
              <div className="text-center text-slate-200">
                <div className="font-bold text-lg">
                  {vehicle.manufacturer} {vehicle.model}
                </div>
                {vehicle.year && (
                  <div className="text-sm text-slate-400 mt-1">{vehicle.year}</div>
                )}
              </div>
              {/* Edit Icon (Visual only) */}
              <Pencil className="w-4 h-4 text-slate-400 opacity-50" />
            </div>
          </motion.div>
        )}

        {/* Form Container */}
        <motion.div
          variants={itemVariants}
          className="bg-[#1e293b]/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-blue-900/20 p-6 md:p-8"
        >
          {/* Description Input */}
          <div className="mb-6">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none min-h-[160px] text-[15px] leading-relaxed transition-all duration-300 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]"
              placeholder="תאר את התקלה..."
            />
          </div>

<<<<<<< HEAD
          <div className="mb-8">
=======
          {/* Image Upload Section */}
          <div className="mb-6">
>>>>>>> rescue/ui-stable
            <ImageUploader requestId={draftId} onImagesChange={setImageUrls} />
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400 mb-4 text-sm"
            >
              {error}
            </motion.div>
          )}

          {/* Submit Button */}
          <motion.button
            onClick={handleContinue}
<<<<<<< HEAD
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isSubmitting}
            className="w-full p-6 bg-gradient-to-r from-[#4A90E2] to-[#5c60ff] hover:from-[#5a9ef0] hover:to-[#6c70ff] text-white font-bold rounded-2xl transition-all duration-300 shadow-lg shadow-[#4A90E2]/30 hover:shadow-xl hover:shadow-[#4A90E2]/50 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "מתחיל ייעוץ AI..." : "המשך לשאלות אבחון (AI)"}
=======
            whileHover={{ 
              scale: 1.02,
              boxShadow: "0 0 20px rgba(37,99,235,0.5)",
            }}
            whileTap={{ scale: 0.95 }}
            disabled={isSubmitting}
            className="w-full p-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-full transition-all duration-300 shadow-lg shadow-blue-500/30 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                מתחיל ייעוץ AI...
              </>
            ) : (
              <>
                שלח
                <Send className="w-4 h-4" />
              </>
            )}
>>>>>>> rescue/ui-stable
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function ConsultFormPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
          <div className="text-white/70 text-lg">טוען טופס...</div>
        </div>
      }
    >
      <ConsultFormContent />
    </Suspense>
  );
}
