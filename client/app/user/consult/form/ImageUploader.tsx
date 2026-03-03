"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image as ImageIcon, X, CheckCircle2, Upload as UploadIcon } from "lucide-react";

type UploadStatus = "uploading" | "uploaded" | "error";

type UploadedImage = {
  id: string;
  name: string;
  preview: string;
  url?: string;
  status: UploadStatus;
  error?: string;
};

export interface ImageUploaderProps {
  requestId: string | null;
  onImagesChange?: (urls: string[]) => void;
}

const MAX_IMAGES = 3;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png"];
const ACCEPT_ATTR = "image/*";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `img-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isAllowed(file: File) {
  const hasAllowedMime = ALLOWED_MIME_TYPES.includes(file.type);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const hasAllowedExtension = ALLOWED_EXTENSIONS.includes(ext);
  return hasAllowedMime || hasAllowedExtension;
}

export default function ImageUploader(props: ImageUploaderProps) {
  const { requestId, onImagesChange } = props;
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        previewUrlsRef.current.clear();
      }
    };
  }, []);
  

  useEffect(() => {
    if (!onImagesChange) return;
    const uploadedUrls = images
      .filter((img) => img.status === "uploaded")
      .map((img) => img.url || img.preview)
      .filter((url): url is string => typeof url === "string" && url.trim().length > 0);
    onImagesChange(uploadedUrls);
  }, [images, onImagesChange]);

  const canUploadMore = images.length < MAX_IMAGES;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (!requestId) {
      setFeedback("לא ניתן להעלות תמונות בלי מזהה טיוטה.");
      return;
    }

    if (!canUploadMore) {
      setFeedback(`ניתן להעלות עד ${MAX_IMAGES} תמונות בלבד.`);
      return;
    }

    const remaining = MAX_IMAGES - images.length;
    const selectedFiles = Array.from(files).slice(0, remaining);

    if (files.length > remaining) {
      setFeedback(`נבחרו יותר מ-${remaining} קבצים. נוספו רק ${remaining}.`);
    }

    selectedFiles.forEach((file) => {
      if (!isAllowed(file)) {
        setFeedback("סוג קובץ לא נתמך. רק JPG או PNG מותר.");
        return;
      }

      const tempId = createId();
      const previewUrl =
  typeof window !== "undefined"
    ? URL.createObjectURL(file)
    : "";
      previewUrlsRef.current.add(previewUrl);

      const pendingImage: UploadedImage = {
        id: tempId,
        name: file.name,
        preview: previewUrl,
        status: "uploading",
      };

      setImages((prev) => [...prev, pendingImage]);
      uploadImage(file, tempId);
    });
  };

  const uploadImage = async (file: File, tempId: string) => {
    if (!requestId) return;
    try {
      setFeedback(null);
      const formData = new FormData();
      formData.append("draft_id", requestId);
      formData.append("file", file);

      const response = await fetch("/api/drafts/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        // If backend returns no JSON we still keep the preview
      }

      const uploadedUrl =
        typeof data?.image_url === "string"
          ? data.image_url
          : typeof data?.url === "string"
          ? data.url
          : undefined;

      setImages((prev) =>
        prev.map((img) =>
          img.id === tempId
            ? {
                ...img,
                status: "uploaded",
                url: uploadedUrl || img.preview,
              }
            : img
        )
      );

      // Show success message
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000); // Hide after 3 seconds

      if (!uploadedUrl) {
        setFeedback("התמונה הועלתה, מחכים לכתובת תצוגה מהשרת.");
      } else {
        setFeedback(null); // Clear any previous feedback
      }
    } catch (err) {
      console.error("Error uploading image:", err);
      setFeedback("העלאת תמונה נכשלה. נסה שוב או בחר תמונה אחרת.");
      setImages((prev) =>
        prev.map((img) =>
          img.id === tempId
            ? { ...img, status: "error", error: "העלאה נכשלה" }
            : img
        )
      );
    }
  };

  const handleRemove = (id: string) => {
    setImages((prev) => {
      const next = prev.filter((img) => img.id !== id);
      const removed = prev.find((img) => img.id === id);
  
      if (removed && typeof window !== "undefined") {
        URL.revokeObjectURL(removed.preview);
        previewUrlsRef.current.delete(removed.preview);
      }
  
      return next;
    });
  };
  

  const triggerInput = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (!canUploadMore) {
      setFeedback(`ניתן להעלות עד ${MAX_IMAGES} תמונות בלבד.`);
      return;
    }
    ref.current?.click();
  };

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (canUploadMore && requestId) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!requestId) {
      setFeedback("לא ניתן להעלות תמונות בלי מזהה טיוטה.");
      return;
    }

    if (!canUploadMore) {
      setFeedback(`ניתן להעלות עד ${MAX_IMAGES} תמונות בלבד.`);
      return;
    }

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  };

  const disabledReason = !requestId
    ? "נדרש מזהה טיוטה כדי להעלות תמונות"
    : !canUploadMore
    ? "הגעת למגבלת 3 תמונות"
    : "";

  return (
    <div>
      {/* Horizontal Grid of Images */}
      {images.length > 0 && (
        <div className="flex flex-row flex-wrap gap-3 mb-4">
          {/* Image Previews */}
          <AnimatePresence>
            {images.map((img) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative group h-24 w-24"
              >
                <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 h-full w-full relative">
                  <img
                    src={img.url || img.preview}
                    alt={img.name || "תמונה שהועלתה"}
                    className="h-full w-full object-cover"
                  />
                  
                  {/* Upload Status Indicator */}
                  {img.status === "uploading" && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full"
                      />
                    </div>
                  )}
                  
                  {/* Success Badge */}
                  {img.status === "uploaded" && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute bottom-1 right-1 bg-green-500 rounded-full p-1 shadow-lg"
                    >
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                  
                  {/* Error Badge */}
                  {img.status === "error" && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute bottom-1 right-1 bg-red-500 rounded-full p-1 shadow-lg"
                    >
                      <X className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                  
                  {/* Remove Button - Top Corner */}
                  <button
                    type="button"
                    onClick={() => handleRemove(img.id)}
                    className="absolute top-1 right-1 bg-black/70 hover:bg-black/90 text-white rounded-full p-1 border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    aria-label="הסר תמונה"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modern Upload Buttons - Side by Side */}
      {canUploadMore && (
        <div className="flex flex-row gap-3">
          {/* Camera Button */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              // For camera, we can use the same file input but with capture attribute
              if (fileInputRef.current) {
                fileInputRef.current.setAttribute("capture", "environment");
                fileInputRef.current.click();
                // Reset after click
                setTimeout(() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute("capture");
                  }
                }, 100);
              }
            }}
            disabled={!requestId || !canUploadMore}
            className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            title={disabledReason || "צלם תמונה"}
          >
            <Camera className="w-5 h-5" />
            <span className="text-sm font-medium">צלם תמונה</span>
          </motion.button>

          {/* Gallery Button - Dropzone */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => triggerInput(fileInputRef)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            disabled={!requestId || !canUploadMore}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
              isDragOver
                ? "border-blue-500 bg-blue-500/10 text-blue-300"
                : "border-slate-600 hover:border-slate-400 text-slate-400 hover:text-slate-200 bg-transparent"
            }`}
            title={disabledReason || "מהגלריה"}
          >
            <ImageIcon className="w-5 h-5" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-medium">מהגלריה</span>
              <span className="text-xs opacity-60">או גרור לכאן</span>
            </div>
          </motion.button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          if (e.target) e.target.value = "";
        }}
      />

      {/* Success Message - Shows when image is uploaded */}
      <AnimatePresence>
        {showSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-3 flex items-center gap-2 text-sm text-green-200 bg-green-500/10 border border-green-500/30 rounded-xl p-3"
          >
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            <span>התמונה הועלתה בהצלחה!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Message (for errors or info) */}
      {feedback && !showSuccessMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-sm text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3"
        >
          {feedback}
        </motion.div>
      )}
      
      {/* Upload Count Info */}
      {images.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-xs text-slate-400 flex items-center gap-1.5"
        >
          <UploadIcon className="w-3.5 h-3.5" />
          <span>
            {images.filter(img => img.status === "uploaded").length} מתוך {images.length} תמונות הועלו
            {images.some(img => img.status === "uploading") && " • מעלה..."}
          </span>
        </motion.div>
      )}

      {/* Request ID Error */}
      {!requestId && (
        <div className="mt-3 text-sm text-red-200 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          נדרש מזהה פנייה תקף כדי להעלות תמונות. ודא שהגעת מהזרימה הנכונה.
        </div>
      )}
    </div>
  );
}


