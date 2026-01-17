"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Camera } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

interface Car {
  id: string;
  manufacturer: string;
  model: string;
  year: number | null;
  license_plate: string;
}

interface RequestFormProps {
  carId: string;
  userId: string;
}

export default function RequestForm({ carId, userId }: RequestFormProps) {
  const router = useRouter();
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (carId) {
      fetchCarDetails();
    }
  }, [carId]);

  const fetchCarDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cars/get?car_id=${carId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch car details");
      }

      const data = await response.json();
      setCar(data);
    } catch (err) {
      setError("שגיאה בטעינת פרטי הרכב");
      console.error("Error fetching car:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setMediaFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (mediaFiles.length === 0) return [];

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of mediaFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error: uploadError } = await supabase.storage
          .from("request-media")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("request-media")
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      }
    } catch (err) {
      console.error("Error uploading files:", err);
    } finally {
      setUploading(false);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      setError("אנא הזן תיאור התקלה");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Upload files first
      const uploadedUrls = await uploadFiles();
      const allMediaUrls = [...mediaUrls, ...uploadedUrls];

      // Submit request
      const response = await fetch("/api/requests/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          car_id: carId,
          description,
          media_urls: allMediaUrls,
          user_id: userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create request");
      }

      const data = await response.json();

      // Redirect to AI consultation page
      router.push(`/user/consult/ai?request_id=${data.request_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשליחת הבקשה");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-white/70">טוען פרטי רכב...</div>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="text-center py-12">
        <div className="text-red-400">לא נמצאו פרטי רכב</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
      {/* Car Info Box */}
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">פרטי הרכב</h3>
        <div className="grid grid-cols-2 gap-4 text-white">
          <div>
            <div className="text-sm text-white/70 mb-1">יצרן</div>
            <div className="font-semibold">{car.manufacturer}</div>
          </div>
          <div>
            <div className="text-sm text-white/70 mb-1">דגם</div>
            <div className="font-semibold">{car.model}</div>
          </div>
          <div>
            <div className="text-sm text-white/70 mb-1">שנה</div>
            <div className="font-semibold">{car.year || "לא צוין"}</div>
          </div>
          <div>
            <div className="text-sm text-white/70 mb-1">מספר רישוי</div>
            <div className="font-semibold" dir="ltr">{car.license_plate}</div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-white font-medium mb-2">
          תיאור התקלה
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
          rows={6}
          placeholder="תאר את התקלה שאתה חווה..."
          required
        />
      </div>

      {/* Image Uploader */}
      <div>
        <label className="block text-white font-medium mb-2">
          הוסף תמונות (אופציונלי)
        </label>
        <div className="space-y-4">
          {/* Upload Buttons */}
          <div className="flex gap-4">
            <label className="flex-1 p-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white cursor-pointer transition-colors flex items-center justify-center gap-2">
              <Upload className="w-5 h-5" />
              <span>בחר מהגלריה</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            <label className="flex-1 p-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white cursor-pointer transition-colors flex items-center justify-center gap-2">
              <Camera className="w-5 h-5" />
              <span>צלם תמונה</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          {/* Preview Images */}
          {mediaFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {mediaFiles.map((file, index) => (
                <div key={index} className="relative group">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover rounded-xl border border-white/20"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="absolute top-2 left-2 p-1 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitting || uploading}
        className="w-full p-4 bg-gradient-to-r from-[#4A90E2] to-[#5c60ff] hover:from-[#5a9ef0] hover:to-[#6c70ff] text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-[#4A90E2]/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting || uploading ? "מעבד..." : "המשך לאבחון AI"}
      </button>
    </form>
  );
}

