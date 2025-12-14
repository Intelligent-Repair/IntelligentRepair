"use client";

import React, { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Vehicle {
  id: string;
  manufacturer: string;
  model: string;
  year: number | null;
  license_plate: string;
}

interface VehicleSelectPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (vehicleId: string) => void;
  onAddNew: () => void;
  userId: string;
}

export default function VehicleSelectPopup({
  isOpen,
  onClose,
  onSelect,
  onAddNew,
  userId,
}: VehicleSelectPopupProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      fetchVehicles();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/cars/list?user_id=${userId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch vehicles");
      }

      const data = await response.json();
      setVehicles(data);
    } catch (err) {
      setError("שגיאה בטעינת הרכבים");
      console.error("Error fetching vehicles:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (vehicleId: string) => {
    console.log("[VehicleSelectPopup] Vehicle selected:", vehicleId);
    onSelect(vehicleId);
  
    // ❗ חשוב: לא לסגור פה את המודאל
    // router.push יגרום ל-unmount אוטומטי
  };
  
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        dir="rtl"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">בחר רכב</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="סגור"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="text-white/70">טוען רכבים...</div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="text-red-400 mb-4">{error}</div>
                <button
                  onClick={fetchVehicles}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                >
                  נסה שוב
                </button>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-white/90 text-xl mb-2 font-semibold">
                  אוי לא... נראה שלא הוספת שום רכב עדיין
                </div>
                <div className="text-white/70 text-lg mb-8">
                  כדי להמשיך לחץ על 'הוסף רכב חדש'
                </div>
                <motion.button
                  onClick={onAddNew}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 rounded-xl text-white transition-all duration-300 hover:shadow-lg hover:shadow-white/10 flex items-center justify-center gap-2 mx-auto"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium text-lg">הוסף רכב חדש</span>
                </motion.button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vehicles.map((vehicle) => (
                  <motion.button
                    key={vehicle.id}
                    onClick={() => handleSelect(vehicle.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="p-6 bg-white/10 backdrop-blur-xl border border-white/20 hover:border-white/30 rounded-3xl text-right transition-all duration-300 hover:shadow-xl hover:shadow-white/10 hover:bg-white/15 group"
                  >
                    <div className="text-white">
                      <div className="font-bold text-xl mb-2 group-hover:text-white">
                        {vehicle.manufacturer} {vehicle.model}
                      </div>
                      <div className="text-sm text-white/70 space-y-1">
                        <div>שנה: {vehicle.year || "לא צוין"}</div>
                        <div className="font-medium">מספר רישוי: {vehicle.license_plate}</div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Add New Vehicle Card - Always visible if vehicles exist */}
            {vehicles.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <motion.button
                  onClick={onAddNew}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full px-6 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 hover:border-white/30 rounded-xl text-white transition-all duration-300 hover:shadow-lg hover:shadow-white/10 flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">הוסף רכב חדש</span>
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
