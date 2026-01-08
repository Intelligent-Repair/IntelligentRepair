"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type UserProfile = {
  id: string;
  national_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  email: string;
  role: string;
  created_at: string;
};

export default function UserProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    national_id: "",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
  });

  // Password change fields
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/user/profile");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "שגיאה בטעינת הפרופיל");
      }

      setProfile(data.user);
      setFormData({
        national_id: data.user.national_id || "",
        first_name: data.user.first_name || "",
        last_name: data.user.last_name || "",
        phone: data.user.phone || "",
        email: data.user.email || "",
      });
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err instanceof Error ? err.message : "שגיאה בטעינת הפרופיל");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "שגיאה בעדכון הפרופיל");
      }

      setProfile(data.user);
      setSuccess("הפרופיל עודכן בהצלחה!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err instanceof Error ? err.message : "שגיאה בעדכון הפרופיל");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError("הסיסמאות החדשות אינן תואמות");
      setSaving(false);
      return;
    }

    if (passwordData.new_password.length < 6) {
      setError("הסיסמה החדשה חייבת להכיל לפחות 6 תווים");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/user/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "שגיאה בהחלפת הסיסמה");
      }

      setSuccess("הסיסמה הוחלפה בהצלחה!");
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setShowPasswordSection(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error changing password:", err);
      setError(err instanceof Error ? err.message : "שגיאה בהחלפת הסיסמה");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-transparent text-white">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl text-white w-full max-w-4xl mx-auto mt-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-white/70 text-lg">טוען פרטים...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent text-white">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl text-white w-full max-w-4xl mx-auto mt-8">
        <h1 className="text-3xl font-bold mb-4 text-white">פרטים אישיים</h1>
        <p className="text-white/70 text-lg mb-8">עדכון וניהול המידע האישי שלכם</p>

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

        {/* Profile Form */}
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium mb-2 text-white/90">
                שם פרטי *
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-black/20 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
                placeholder="הכנס שם פרטי"
              />
            </div>

            <div>
              <label htmlFor="last_name" className="block text-sm font-medium mb-2 text-white/90">
                שם משפחה *
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-black/20 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
                placeholder="הכנס שם משפחה"
              />
            </div>

            <div>
              <label htmlFor="national_id" className="block text-sm font-medium mb-2 text-white/90">
                תעודת זהות
              </label>
              <input
                type="text"
                id="national_id"
                name="national_id"
                value={formData.national_id}
                onChange={handleInputChange}
                maxLength={9}
                className="w-full px-4 py-3 bg-black/20 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
                placeholder="ת.ז. (9 ספרות)"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium mb-2 text-white/90">
                טלפון *
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-black/20 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
                placeholder="מספר טלפון"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-white/90">
                אימייל *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-black/20 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
                placeholder="כתובת אימייל"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-[#4A90E2] hover:bg-[#357ABD] text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "שומר..." : "שמור שינויים"}
            </button>
          </div>
        </form>

        {/* Password Change Section */}
        <div className="mt-12 pt-8 border-t border-white/20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">החלפת סיסמה</h2>
            <button
              type="button"
              onClick={() => {
                setShowPasswordSection(!showPasswordSection);
                setPasswordData({
                  current_password: "",
                  new_password: "",
                  confirm_password: "",
                });
                setError(null);
              }}
              className="px-4 py-2 text-[#4A90E2] hover:text-[#357ABD] font-medium transition-colors"
            >
              {showPasswordSection ? "ביטול" : "החלף סיסמה"}
            </button>
          </div>

          {showPasswordSection && (
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div>
                <label
                  htmlFor="current_password"
                  className="block text-sm font-medium mb-2 text-white/90"
                >
                  סיסמה נוכחית *
                </label>
                <input
                  type="password"
                  id="current_password"
                  name="current_password"
                  value={passwordData.current_password}
                  onChange={handlePasswordChange}
                  required
                  className="w-full px-4 py-3 bg-black/20 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
                  placeholder="הכנס סיסמה נוכחית"
                />
              </div>

              <div>
                <label
                  htmlFor="new_password"
                  className="block text-sm font-medium mb-2 text-white/90"
                >
                  סיסמה חדשה *
                </label>
                <input
                  type="password"
                  id="new_password"
                  name="new_password"
                  value={passwordData.new_password}
                  onChange={handlePasswordChange}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-black/20 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
                  placeholder="סיסמה חדשה (לפחות 6 תווים)"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm_password"
                  className="block text-sm font-medium mb-2 text-white/90"
                >
                  אימות סיסמה חדשה *
                </label>
                <input
                  type="password"
                  id="confirm_password"
                  name="confirm_password"
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-black/20 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:border-transparent"
                  placeholder="הכנס שוב את הסיסמה החדשה"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-[#4A90E2] hover:bg-[#357ABD] text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "מעדכן..." : "החלף סיסמה"}
              </button>
            </form>
          )}
        </div>

        {/* Account Info */}
        {profile && (
          <div className="mt-8 pt-8 border-t border-white/20">
            <h3 className="text-xl font-bold mb-4 text-white">מידע על החשבון</h3>
            <div className="space-y-2 text-white/70">
              <p>
                <span className="font-medium">תאריך הרשמה:</span>{" "}
                {new Date(profile.created_at).toLocaleDateString("he-IL")}
              </p>
              <p>
                <span className="font-medium">סוג משתמש:</span>{" "}
                {profile.role === "driver" ? "נהג" : "מוסך"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
