"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
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
      const previewUrl = URL.createObjectURL(file);
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

      if (!uploadedUrl) {
        setFeedback("התמונה הועלתה, מחכים לכתובת תצוגה מהשרת.");
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
      if (removed) {
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

  const disabledReason = !requestId
    ? "נדרש מזהה טיוטה כדי להעלות תמונות"
    : !canUploadMore
    ? "הגעת למגבלת 3 תמונות"
    : "";

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-white font-bold text-lg">הוספת תמונות</div>
          <p className="text-white/60 text-sm">
            עד {MAX_IMAGES} תמונות | JPG או PNG | העלאה מיידית
          </p>
        </div>
        <div className="text-white/50 text-sm">
          {images.length}/{MAX_IMAGES}
        </div>
      </div>

      <div className="mb-4">
        <motion.button
          type="button"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => triggerInput(fileInputRef)}
          disabled={!requestId || !canUploadMore}
          className="flex items-center justify-center gap-2 w-full p-3 rounded-xl border border-white/15 bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          title={disabledReason || "בחירת תמונות"}
        >
          📎 הוספת תמונה
        </motion.button>
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
      </div>

      {feedback && (
        <div className="text-sm text-yellow-200 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-3">
          {feedback}
        </div>
      )}

      {images.length === 0 ? (
        <div className="border border-dashed border-white/15 rounded-xl p-4 text-white/60 text-sm text-center">
          ניתן לצלם או לבחור תמונות לתיאור התקלה. ההעלאה מתבצעת מיד.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <AnimatePresence>
            {images.map((img) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative group"
              >
                <div className="overflow-hidden rounded-xl border border-white/15 bg-black/20">
                  <img
                    src={img.url || img.preview}
                    alt={img.name || "תמונה שהועלתה"}
                    className="h-32 w-full object-cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleRemove(img.id)}
                      className="bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 border border-white/20"
                      aria-label="הסר תמונה"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-white/70 text-xs truncate">{img.name}</span>
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full border ${
                      img.status === "uploaded"
                        ? "text-green-200 border-green-400/40 bg-green-500/10"
                        : img.status === "uploading"
                        ? "text-blue-200 border-blue-400/40 bg-blue-500/10"
                        : "text-red-200 border-red-400/40 bg-red-500/10"
                    }`}
                  >
                    {img.status === "uploaded"
                      ? "הועלה"
                      : img.status === "uploading"
                      ? "מעלה..."
                      : "שגיאה"}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {!requestId && (
        <div className="mt-4 text-sm text-red-200 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          נדרש מזהה פנייה תקף כדי להעלות תמונות. ודא שהגעת מהזרימה הנכונה.
        </div>
      )}
    </div>
  );
}


