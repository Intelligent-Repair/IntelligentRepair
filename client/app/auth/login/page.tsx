"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type UserType = "driver" | "garage";

export default function LoginPage() {
  const router = useRouter();
  const [userType, setUserType] = useState<UserType>("driver");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || "שגיאה בהתחברות");
        setLoading(false);
        return;
      }

      // Redirect based on role
      if (data.role === "driver") {
        router.push("/user");
      } else if (data.role === "garage") {
        router.push("/garage");
      } else {
        setError("סוג משתמש לא מזוהה");
        setLoading(false);
      }
    } catch (err) {
      setError("שגיאה בחיבור לשרת");
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-3xl font-semibold text-white text-center mb-8">
        התחברות למערכת
      </h1>

      {/* Error Message */}
      {error && (
        <div
          className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200 text-sm animate-in fade-in slide-in-from-top-2"
        >
          {error}
        </div>
      )}

      {/* User Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          בחירת סוג משתמש
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="userType"
              value="driver"
              checked={userType === "driver"}
              onChange={(e) => setUserType(e.target.value as UserType)}
              className="w-4 h-4 text-sky-500 bg-white/10 border-white/20 focus:ring-sky-500 focus:ring-2"
            />
            <span className="text-white">משתמש פרטי</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="userType"
              value="garage"
              checked={userType === "garage"}
              onChange={(e) => setUserType(e.target.value as UserType)}
              className="w-4 h-4 text-sky-500 bg-white/10 border-white/20 focus:ring-sky-500 focus:ring-2"
            />
            <span className="text-white">מוסך</span>
          </label>
        </div>
      </div>

      {/* Login Form */}
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            מייל
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="הכנס מייל"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            סיסמה
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="w-full rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="הכנס סיסמה"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-500 px-6 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-sky-500/40 transition hover:-translate-y-0.5 hover:shadow-sky-500/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {loading ? "מתחבר..." : "התחברות"}
        </button>
      </form>

      {/* Registration Link */}
      <div className="mt-6 text-center">
        <Link
          href="/auth/register"
          className="text-sm text-slate-300 hover:text-sky-300 transition"
        >
          עדיין לא רשום? לחץ להרשמה
        </Link>
      </div>
    </>
  );
}

