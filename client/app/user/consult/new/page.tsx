"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import VehicleSelectPopup from "../VehicleSelectPopup";

export default function NewConsultationPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current user from Supabase session
    const getUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserId(user.id);
        } else {
          // Redirect to login if not authenticated
          router.push("/auth/login");
        }
      } catch (err) {
        console.error("Error getting user:", err);
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    };

    getUser();
  }, [router]);

  const handleCardClick = () => {
    if (userId) {
      setIsModalOpen(true);
    }
  };

  const handleVehicleSelect = (vehicleId: string) => {
    console.log("Selected vehicle:", vehicleId);
    router.push(`/user/consult/form?vehicle=${vehicleId}`);
  };

  const handleAddNew = () => {
    console.log("Add new vehicle clicked from /user/consult/new");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-white/70">טוען...</div>
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  // Show main card and vehicle selection popup
  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <motion.button
          onClick={handleCardClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full p-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl text-white hover:bg-white/15 transition-all duration-300"
        >
          <h1 className="text-4xl font-bold mb-4">פתיחת פנייה חדשה</h1>
          <p className="text-white/70 text-lg">
            לחץ כדי לבחור רכב ולהתחיל פנייה חדשה
          </p>
        </motion.button>
      </motion.div>

      <VehicleSelectPopup
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleVehicleSelect}
        onAddNew={handleAddNew}
        userId={userId}
      />
    </div>
  );
}


