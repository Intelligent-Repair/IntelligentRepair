"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/ffc53cfd-5750-4bfc-8fcf-eeaa1b241560.png";

type UserType = "driver" | "garage";

export default function RegisterPage() {
  const router = useRouter();
  const [userType, setUserType] = useState<UserType>("driver");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // שדות משותפים
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");

  // שדות נהג (User)
  const [first_name, setFirstName] = useState("");
  const [last_name, setLastName] = useState("");
  const [idNumber, setIdNumber] = useState("");

  // שדות מוסך (Garage)
  const [garageName, setGarageName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }

    setIsLoading(true);

    try {
      // יצירת מחרוזת כתובת אחת מהשדות המפוצלים עבור המוסך
      const fullAddress = userType === "garage" ? `${street} ${houseNumber}, ${city}` : "";

      const payload = {
        role: userType,
        email,
        password,
        phone,
        first_name: userType === "driver" ? first_name : null,
        last_name: userType === "driver" ? last_name : null,
        id_number: userType === "driver" ? idNumber : null,
        garage_name: userType === "garage" ? garageName : null,
        license_number: userType === "garage" ? licenseNumber : null,
        address: fullAddress,
      };

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || data.message || "שגיאה בהרשמה");
      } else {
        router.push(data.role === "driver" ? "/user" : "/garage");
      }
    } catch (err) {
      setError("שגיאת שרת. וודא שהטרמינל פועל והמפתחות תקינים.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-md mx-auto p-6 bg-slate-900 rounded-3xl border border-white/10 shadow-2xl my-10" dir="rtl">
      {/* לוגו */}
      <div className="flex justify-center mb-6">
        <Image src={Logo} alt="Logo" className="w-[220px] drop-shadow-[0_0_8px_rgba(56,189,248,0.3)]" priority />
      </div>

      <h1 className="text-2xl font-bold text-white text-center mb-6">הרשמה למערכת</h1>

      {/* בחירת סוג משתמש */}
      <div className="flex justify-center gap-4 mb-8 bg-white/5 p-1.5 rounded-2xl">
        <button
          type="button"
          onClick={() => setUserType("driver")}
          className={`flex-1 py-2.5 rounded-xl transition-all duration-200 ${userType === "driver" ? "bg-sky-500 text-slate-900 font-bold shadow-lg shadow-sky-500/20" : "text-slate-400 hover:text-white"}`}
        >
          משתמש פרטי
        </button>
        <button
          type="button"
          onClick={() => setUserType("garage")}
          className={`flex-1 py-2.5 rounded-xl transition-all duration-200 ${userType === "garage" ? "bg-sky-500 text-slate-900 font-bold shadow-lg shadow-sky-500/20" : "text-slate-400 hover:text-white"}`}
        >
          מוסך
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-200 p-3 rounded-xl text-sm text-center border border-red-500/50 mb-6 animate-pulse">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* שדות משתנים לפי סוג המשתמש */}
        {userType === "driver" ? (
          <>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="שם פרטי"
                  value={first_name}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-right focus:border-sky-500 outline-none transition-colors"
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="שם משפחה"
                  value={last_name}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-right focus:border-sky-500 outline-none transition-colors"
                />
              </div>
            </div>
            <input
              type="text"
              placeholder="מספר תעודת זהות"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              required
              className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-right focus:border-sky-500 outline-none transition-colors"
            />
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="שם המוסך"
              value={garageName}
              onChange={(e) => setGarageName(e.target.value)}
              required
              className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-right focus:border-sky-500 outline-none transition-colors"
            />
            <input
              type="text"
              placeholder="מספר רישיון מוסך"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              required
              className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-right focus:border-sky-500 outline-none transition-colors"
            />
            
            {/* שדות כתובת למוסך */}
            <div className="p-4 border border-sky-500/30 rounded-2xl bg-sky-500/5 space-y-3">
              <p className="text-sky-400 text-xs font-bold pr-1">כתובת המוסך למטרות ניווט</p>
              <input
                type="text"
                placeholder="עיר"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-right focus:border-sky-400 outline-none"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="מס' בית"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  required
                  className="w-1/3 p-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-right focus:border-sky-400 outline-none"
                />
                <input
                  type="text"
                  placeholder="רחוב"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  required
                  className="w-2/3 p-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-right focus:border-sky-400 outline-none"
                />
              </div>
            </div>
          </>
        )}

        {/* שדות משותפים לכולם */}
        <input
          type="tel"
          placeholder="טלפון ליצירת קשר"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-right focus:border-sky-500 outline-none transition-colors"
        />
        <input
          type="email"
          placeholder="כתובת אימייל"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-right focus:border-sky-500 outline-none transition-colors"
        />
        <input
          type="password"
          placeholder="בחר סיסמה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-right focus:border-sky-500 outline-none transition-colors"
        />
        <input
          type="password"
          placeholder="אישור סיסמה"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className={`w-full p-3 rounded-xl bg-white/5 border text-white text-right outline-none transition-colors ${confirmPassword && password !== confirmPassword ? 'border-red-500/50' : 'border-white/10 focus:border-sky-500'}`}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold py-4 rounded-2xl transition-all duration-200 mt-4 shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "שולח נתונים..." : "צור חשבון חדש"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/auth/login" className="text-sm text-slate-400 hover:text-sky-400 transition-colors">
          כבר יש לך חשבון? התחבר כאן
        </Link>
      </div>
    </div>
  );
}