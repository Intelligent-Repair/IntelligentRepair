"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/ffc53cfd-5750-4bfc-8fcf-eeaa1b241560.png";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "true";

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
      console.log(data); // Debug backend response

      if (!response.ok || !data.redirect || typeof data.redirect !== "string") {
        setError(data.error || data.message || "שגיאה בהתחברות");
        setLoading(false);
        return;
      }

      // Redirect using window.location.href
      window.location.href = data.redirect;
    } catch (err) {
      setError("שגיאה בחיבור לשרת");
      setLoading(false);
    }
  };

  return (
    <>
      {/* Logo */}
      <div className="flex justify-center mb-4 mt-2">
        <Image
          src={Logo}
          alt="IntelligentRepair Logo"
          className="w-[280px] drop-shadow-[0_0_12px_rgba(255,255,255,0.3)] animate-fadeIn"
          priority
        />
      </div>

      <h1 className="text-3xl font-semibold text-white text-center mb-8">
        התחברות למערכת
      </h1>

      {/* Success Message - shown after registration */}
      {justRegistered && (
        <div
          className="mb-6 p-4 rounded-xl bg-green-500/20 border border-green-500/50 text-green-200 text-sm text-center animate-in fade-in slide-in-from-top-2"
        >
          ההרשמה הושלמה בהצלחה! 🎉 כעת ניתן להתחבר למערכת
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200 text-sm animate-in fade-in slide-in-from-top-2"
        >
          {error}
        </div>
      )}



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

