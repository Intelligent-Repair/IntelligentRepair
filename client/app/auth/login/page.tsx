"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/ffc53cfd-5750-4bfc-8fcf-eeaa1b241560.png";

// Separate component for the success message that uses useSearchParams
function RegistrationSuccessMessage() {
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "true";

  if (!justRegistered) return null;

  return (
    <div className="mb-6 p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-sm text-center">
      ההרשמה הושלמה בהצלחה! 🎉 כעת ניתן להתחבר למערכת
    </div>
  );
}

export default function LoginPage() {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.redirect || typeof data.redirect !== "string") {
        setError(data.error || data.message || "שגיאה בהתחברות");
        setLoading(false);
        return;
      }

      window.location.href = data.redirect;
    } catch (err) {
      setError("שגיאה בחיבור לשרת");
      setLoading(false);
    }
  };

  const inputClasses = "input-glow w-full rounded-xl bg-white/5 border border-white/10 text-white text-right px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="animate-fade-in max-w-md mx-auto" dir="rtl">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <Image
          src={Logo}
          alt="IntelligentRepair Logo"
          className="w-[260px] drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]"
          priority
        />
      </div>

      <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-8">
        התחברות למערכת
      </h1>

      {/* Success Message */}
      <Suspense fallback={null}>
        <RegistrationSuccessMessage />
      </Suspense>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200 text-sm text-center animate-shake">
          {error}
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
            אימייל
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            placeholder="example@mail.com"
            className={inputClasses}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
            סיסמה
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className={inputClasses}
          />
        </div>

        {/* Forgot Password Link */}
        <div className="flex justify-start">
          <Link
            href="#"
            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            שכחת סיסמה?
          </Link>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3.5 text-lg font-bold text-slate-900 shadow-lg shadow-cyan-500/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>מתחבר...</span>
            </>
          ) : (
            "התחברות"
          )}
        </button>
      </form>

      {/* Registration Link */}
      <div className="mt-8 text-center">
        <Link
          href="/auth/register"
          className="text-sm text-slate-400 hover:text-cyan-400 transition-colors"
        >
          עדיין לא רשום? <span className="text-cyan-400 font-medium">לחץ להרשמה</span>
        </Link>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        .input-glow:focus {
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1), 0 0 20px rgba(6, 182, 212, 0.15);
        }
      `}</style>
    </div>
  );
}
