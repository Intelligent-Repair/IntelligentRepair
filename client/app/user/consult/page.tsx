"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import VehicleSelectPopup from "./VehicleSelectPopup";

export default function ConsultPage() {
  const router = useRouter();
  const [isPopupOpen, setIsPopupOpen] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserId(user.id);
        } else {
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

  const handleSelectVehicle = (vehicleId: string) => {
    console.log("[ConsultPage] Navigating to form with vehicleId:", vehicleId);
    router.push(`/user/consult/form?vehicle=${vehicleId}`);
  };

  const handleAddNew = () => {
    // Navigate to add new vehicle page
    router.push("/maintenance/add");
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

  return (
    <VehicleSelectPopup
      isOpen={isPopupOpen}
      onClose={() => router.push("/user")}
      onSelect={handleSelectVehicle}
      onAddNew={handleAddNew}
      userId={userId}
    />
  );
}
