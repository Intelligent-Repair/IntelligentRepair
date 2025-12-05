"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Car {
  id: string;
  manufacturer: string;
  model: string;
  year: number | null;
  license_plate: string;
}

interface CarSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCar: (carId: string) => void;
  userId: string;
}

export default function CarSelectionModal({
  isOpen,
  onClose,
  onSelectCar,
  userId,
}: CarSelectionModalProps) {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      fetchCars();
    }
  }, [isOpen, userId]);

  const fetchCars = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/cars/list?user_id=${userId}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch cars");
      }

      const data = await response.json();
      setCars(data);
    } catch (err) {
      setError("שגיאה בטעינת הרכבים");
      console.error("Error fetching cars:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCar = (carId: string) => {
    console.log("[CarSelectionModal] Vehicle selected:", carId);
    onSelectCar(carId);
    onClose();
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
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">בחר רכב</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
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
                  onClick={fetchCars}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                >
                  נסה שוב
                </button>
              </div>
            ) : cars.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-white/70 mb-6 text-lg">
                  נראה שלא הוספת את הרכב שלך
                </div>
                <button
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors border border-white/20"
                  disabled
                >
                  + הוסף רכב חדש
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {cars.map((car) => (
                  <motion.button
                    key={car.id}
                    onClick={() => handleSelectCar(car.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-right transition-all duration-300 hover:border-white/20"
                  >
                    <div className="text-white">
                      <div className="font-bold text-lg mb-1">
                        {car.manufacturer} {car.model}
                      </div>
                      <div className="text-sm text-white/70 space-y-1">
                        <div>שנה: {car.year || "לא צוין"}</div>
                        <div>מספר רישוי: {car.license_plate}</div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Add Car Button - Always visible */}
            {!loading && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <button
                  className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors border border-white/20 flex items-center justify-center gap-2"
                  disabled
                >
                  <span>+ הוסף רכב חדש</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}


