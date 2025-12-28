"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
        className="min-h-screen flex items-center justify-center p-6"
        dir="rtl"
      >
        <div className="text-white/70 text-lg">טוען פרטי רכב...</div>
      </div>
    );
  }

  if (error && !vehicle) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        dir="rtl"
      >
        <div className="bg-white/10 backdrop-blur-xl border border-red-500/30 rounded-3xl shadow-2xl p-8 max-w-md">
          <div className="text-red-400 text-xl font-bold mb-4">שגיאה</div>
          <div className="text-white/70 mb-6">{error}</div>
          <motion.button
            onClick={() => router.push("/user")}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full p-4 bg-gradient-to-r from-[#4A90E2] to-[#5c60ff] text-white font-bold rounded-xl"
          >
            חזרה לתפריט הראשי
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      dir="rtl"
    >
      <div className="w-full max-w-4xl space-y-6">
        {/* כרטיס פרטי רכב */}
        {vehicle && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8"
          >
            <h3 className="text-xl font-bold text-white mb-4">פרטי הרכב</h3>
            <div className="grid grid-cols-2 gap-4 text-white">
              <div>
                <div className="text-sm text-white/70 mb-1">יצרן</div>
                <div className="font-bold text-lg">
                  {vehicle.manufacturer}
                </div>
              </div>
              <div>
                <div className="text-sm text-white/70 mb-1">דגם</div>
                <div className="font-bold text-lg">{vehicle.model}</div>
              </div>
              <div>
                <div className="text-sm text-white/70 mb-1">שנה</div>
                <div className="font-bold">{vehicle.year || "לא צוין"}</div>
              </div>
              <div>
                <div className="text-sm text-white/70 mb-1">מספר רישוי</div>
                <div className="font-bold">{vehicle.license_plate}</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* טופס תיאור תקלה */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8"
        >
          <h1 className="text-3xl font-bold text-white mb-6">פתיחת פנייה חדשה</h1>

          <div className="mb-6">
            <label className="block text-white font-bold mb-3 text-xl">
              תיאור התקלה
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 resize-none min-h-[200px] text-lg transition-all duration-300"
              placeholder="תאר את התקלה שאתה חווה בפירוט..."
            />
          </div>

          <div className="mb-8">
            <ImageUploader requestId={draftId} onImagesChange={setImageUrls} />
          </div>

          {error && (
            <div className="text-red-400 mb-4 text-sm">{error}</div>
          )}

          <motion.button
            onClick={handleContinue}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isSubmitting}
            className="w-full p-6 bg-gradient-to-r from-[#4A90E2] to-[#5c60ff] hover:from-[#5a9ef0] hover:to-[#6c70ff] text-white font-bold rounded-2xl transition-all duration-300 shadow-lg shadow-[#4A90E2]/30 hover:shadow-xl hover:shadow-[#4A90E2]/50 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "מתחיל ייעוץ AI..." : "המשך לשאלות אבחון (AI)"}
          </motion.button>
        </motion.div>
      </div>
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
