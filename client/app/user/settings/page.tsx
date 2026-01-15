"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabaseClient";

type FontSize = "small" | "medium" | "large";

interface UISettings {
  fontSize: FontSize;
  visualEffects: {
    blur: boolean;
    shadows: boolean;
    nightMode: boolean;
  };
}

export default function UserSettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // UI Settings state
  const [settings, setSettings] = useState<UISettings>({
    fontSize: "medium",
    visualEffects: {
      blur: true,
      shadows: true,
      nightMode: false,
    },
  });

  useEffect(() => {
    setMounted(true);
    loadSettings();
    applySettings();
  }, []);

  useEffect(() => {
    if (mounted) {
      applySettings();
      saveSettings();
    }
  }, [settings, mounted]);

  const loadSettings = () => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem("ui_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings((prev) => ({ ...prev, ...parsed }));
        // Also sync theme if nightMode is loaded (after component mounts)
        if (parsed.visualEffects?.nightMode !== undefined) {
          // Use setTimeout to ensure theme is set after mount
          setTimeout(() => {
            setTheme(parsed.visualEffects.nightMode ? "dark" : "light");
          }, 0);
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    }
  };

  const saveSettings = () => {
    if (typeof window === "undefined") return;
    localStorage.setItem("ui_settings", JSON.stringify(settings));
  };

  const applySettings = () => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const body = document.body;

    // Font size - apply to body
    const fontSizeMap = {
      small: "14px",
      medium: "16px",
      large: "18px",
    };
    body.style.fontSize = fontSizeMap[settings.fontSize];

    // Visual effects
    if (!settings.visualEffects.blur) {
      body.classList.add("no-blur");
    } else {
      body.classList.remove("no-blur");
    }

    if (!settings.visualEffects.shadows) {
      body.classList.add("no-shadows");
      root.style.setProperty("--shadow-intensity", "0");
    } else {
      body.classList.remove("no-shadows");
      root.style.setProperty("--shadow-intensity", "1");
    }

    // Night mode - use next-themes for proper dark mode
    // Only update theme if it's different to avoid loops
    if (mounted) {
      const targetTheme = settings.visualEffects.nightMode ? "dark" : "light";
      if (theme !== targetTheme) {
        setTheme(targetTheme);
      }
    }
  };

  const handleFontSizeChange = (size: FontSize) => {
    setSettings((prev) => ({ ...prev, fontSize: size }));
  };

  const handleVisualEffectChange = (effect: keyof UISettings["visualEffects"], value: boolean) => {
    setSettings((prev) => {
      const newSettings = {
        ...prev,
        visualEffects: { ...prev.visualEffects, [effect]: value },
      };
      
      // If nightMode changed, update theme
      if (effect === "nightMode" && mounted) {
        setTheme(value ? "dark" : "light");
      }
      
      return newSettings;
    });
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword || !deleteConfirm) {
      setError("אנא הזן סיסמה ואשר מחיקה");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/delete-account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: deletePassword,
          confirmDelete: deleteConfirm,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "שגיאה במחיקת החשבון");
      }

      // Logout and redirect
      await supabase.auth.signOut();
      router.push("/");
    } catch (err) {
      console.error("Error deleting account:", err);
      setError(err instanceof Error ? err.message : "שגיאה במחיקת החשבון");
    } finally {
      setLoading(false);
    }
  };

  const resetSettings = () => {
    const defaultSettings: UISettings = {
      fontSize: "medium",
      visualEffects: {
        blur: true,
        shadows: true,
        nightMode: false,
      },
    };
    setSettings(defaultSettings);
    setTheme("light");
    setSuccess("ההגדרות אופסו לברירת המחדל");
    setTimeout(() => setSuccess(null), 3000);
  };

  // Sync nightMode with theme on mount
  useEffect(() => {
    if (mounted && theme) {
      const isDark = theme === "dark";
      setSettings((prev) => {
        // Only update if different to avoid infinite loop
        if (prev.visualEffects.nightMode !== isDark) {
          return {
            ...prev,
            visualEffects: {
              ...prev.visualEffects,
              nightMode: isDark,
            },
          };
        }
        return prev;
      });
    }
  }, [theme, mounted]);

  return (
    <div className="bg-transparent text-white">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl text-white w-full max-w-4xl mx-auto mt-8">
        <h1 className="text-3xl font-bold mb-4 text-white">הגדרות</h1>
        <p className="text-white/70 text-lg mb-8">התאם אישית את חוויית השימוש שלך</p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-300">
            {success}
          </div>
        )}

        {/* Font Size */}
        <div className="mb-8 pb-8 border-b border-white/20">
          <h2 className="text-xl font-bold mb-4 text-white">גודל גופן</h2>
          <div className="flex gap-4">
            {(["small", "medium", "large"] as FontSize[]).map((size) => (
              <button
                key={size}
                onClick={() => handleFontSizeChange(size)}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  settings.fontSize === size
                    ? "bg-[#4A90E2] text-white"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                {size === "small" ? "קטן" : size === "medium" ? "בינוני" : "גדול"}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Effects */}
        <div className="mb-8 pb-8 border-b border-white/20">
          <h2 className="text-xl font-bold mb-4 text-white">אפקטים ויזואליים</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.visualEffects.blur}
                onChange={(e) => handleVisualEffectChange("blur", e.target.checked)}
                className="w-5 h-5 rounded accent-[#4A90E2] cursor-pointer"
              />
              <span className="text-white/90">אפקט טשטוש (Blur)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.visualEffects.shadows}
                onChange={(e) => handleVisualEffectChange("shadows", e.target.checked)}
                className="w-5 h-5 rounded accent-[#4A90E2] cursor-pointer"
              />
              <span className="text-white/90">צללים</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.visualEffects.nightMode}
                onChange={(e) => handleVisualEffectChange("nightMode", e.target.checked)}
                className="w-5 h-5 rounded accent-[#4A90E2] cursor-pointer"
              />
              <span className="text-white/90">Night Mode</span>
            </label>
          </div>
        </div>

        {/* Reset Settings */}
        <div className="mb-8 pb-8 border-b border-white/20">
          <button
            onClick={resetSettings}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
          >
            איפוס הגדרות לברירת מחדל
          </button>
        </div>

        {/* Delete Account */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-red-400">מחיקת חשבון</h2>
          <p className="text-white/70 mb-4">
            מחיקת החשבון היא פעולה בלתי הפיכה. כל הנתונים שלך יימחקו לצמיתות.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium rounded-xl transition-colors border border-red-500/50"
            >
              מחק חשבון
            </button>
          ) : (
            <div className="space-y-4 p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
              <div>
                <label className="block text-sm font-medium mb-2 text-white/90">
                  הזן סיסמה לאימות *
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-3 bg-black/20 border border-red-500/50 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="סיסמה"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.checked)}
                  className="w-5 h-5 rounded accent-red-500 cursor-pointer"
                />
                <span className="text-white/90">
                  אני מבין שמחיקת החשבון היא בלתי הפיכה
                </span>
              </label>

              <div className="flex gap-4">
                <button
                  onClick={handleDeleteAccount}
                  disabled={loading || !deletePassword || !deleteConfirm}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "מוחק..." : "מחק חשבון לצמיתות"}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword("");
                    setDeleteConfirm(false);
                    setError(null);
                  }}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
