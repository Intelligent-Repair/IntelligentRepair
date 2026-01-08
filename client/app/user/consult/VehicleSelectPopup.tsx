"use client";

import React, { useEffect, useState } from "react";
import { X, Plus, CarFront, ChevronLeft } from "lucide-react";
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
          className="relative bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-2xl shadow-black/50 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between relative">
            <div className="flex-1 text-center">
              <h2 className="text-2xl font-bold text-white mb-1">בחר רכב</h2>
              <p className="text-sm text-slate-400">איזה רכב נבדוק היום?</p>
            </div>
            <button
              onClick={onClose}
              className="absolute left-6 bg-white/5 hover:bg-white/10 rounded-full p-2 transition-colors"
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
                  className="px-8 py-4 border-2 border-dashed border-slate-600 hover:border-blue-400 text-slate-400 hover:text-blue-300 bg-transparent hover:bg-blue-500/5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 mx-auto"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-current flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-lg">הוסף רכב חדש</span>
                </motion.button>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicles.map((vehicle, index) => (
                  <motion.button
                    key={vehicle.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                    onClick={() => handleSelect(vehicle.id)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full p-4 bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700 hover:border-blue-500/50 rounded-xl transition-all duration-300 flex flex-row items-center justify-between gap-4 group"
                  >
                    {/* Car Icon - Right side (RTL) */}
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                      <CarFront className="w-6 h-6 text-white" />
                    </div>

                    {/* Vehicle Info - Center */}
                    <div className="flex-1 text-right">
                      <div className="font-bold text-lg text-white mb-1">
                        {vehicle.manufacturer} {vehicle.model}
                      </div>
                      <div className="text-sm text-slate-400">
                        {vehicle.year || "לא צוין"} | {vehicle.license_plate}
                      </div>
                    </div>

                    {/* Action Indicator - Left side (RTL) */}
                    <ChevronLeft className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                  </motion.button>
                ))}
              </div>
            )}

            {/* Add New Vehicle Card - Always visible if vehicles exist */}
            {vehicles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: vehicles.length * 0.1 + 0.2 }}
                className="mt-6 pt-6 border-t border-white/10"
              >
                <motion.button
                  onClick={onAddNew}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full px-6 py-4 border-2 border-dashed border-slate-600 hover:border-blue-400 text-slate-400 hover:text-blue-300 bg-transparent hover:bg-blue-500/5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-current flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="font-medium">הוסף רכב חדש</span>
                </motion.button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
