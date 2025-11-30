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
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  // Driver fields
  const [idNumber, setIdNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Garage fields
  const [garageName, setGarageName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [garagePhone, setGaragePhone] = useState("");

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (confirmPassword && value !== confirmPassword) {
      setPasswordMismatch(true);
    } else {
      setPasswordMismatch(false);
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (password && value !== password) {
      setPasswordMismatch(true);
    } else {
      setPasswordMismatch(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPasswordMismatch(false);

    // Validate password match
    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      setError("הסיסמאות אינן תואמות");
      return;
    }

    setIsLoading(true);

    try {
      const payload: any = {
        role: userType,
        email,
        password,
      };

      if (userType === "driver") {
        payload.id_number = idNumber;
        payload.first_name = firstName;
        payload.last_name = lastName;
        payload.phone = phone;
      } else {
        payload.garage_name = garageName;
        payload.license_number = licenseNumber;
        payload.phone = garagePhone;
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "שגיאה בהרשמה");
        setIsLoading(false);
        return;
      }

      // Redirect based on role
      if (data.role === "driver") {
        router.push("/user");
      } else if (data.role === "garage") {
        router.push("/garage");
      }
    } catch (err) {
      setError("שגיאת רשת. נסה שוב מאוחר יותר.");
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
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
        הרשמה למערכת
      </h1>

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

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200 text-sm text-center animate-shake">
          {error}
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
        {userType === "driver" ? (
          <>
            <div>
              <label
                htmlFor="idNumber"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                תעודת זהות
              </label>
              <input
                id="idNumber"
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                required
                className="input-glow w-full rounded-xl bg-white/10 border border-white/20 text-white text-right placeholder:text-slate-300 placeholder:text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition"
                placeholder="הכנס תעודת זהות"
              />
            </div>

            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                שם פרטי
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="input-glow w-full rounded-xl bg-white/10 border border-white/20 text-white text-right placeholder:text-slate-300 placeholder:text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition"
                placeholder="הכנס שם פרטי"
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                שם משפחה
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="input-glow w-full rounded-xl bg-white/10 border border-white/20 text-white text-right placeholder:text-slate-300 placeholder:text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition"
                placeholder="הכנס שם משפחה"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                טלפון
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="input-glow w-full rounded-xl bg-white/10 border border-white/20 text-white text-right placeholder:text-slate-300 placeholder:text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition"
                placeholder="הכנס מספר טלפון"
              />
            </div>

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
                className="input-glow w-full rounded-xl bg-white/10 border border-white/20 text-white text-right placeholder:text-slate-300 placeholder:text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition"
                placeholder="הכנס כתובת מייל"
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
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
                minLength={6}
                className={`input-glow w-full rounded-xl bg-white/10 border ${
                  passwordMismatch
                    ? "border-red-500/50 animate-shake"
                    : "border-white/20"
                } text-white text-right placeholder:text-slate-300 placeholder:text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition`}
                placeholder="הכנס סיסמה (לפחות 6 תווים)"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                אישור סיסמה
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                required
                className={`input-glow w-full rounded-xl bg-white/10 border ${
                  passwordMismatch
                    ? "border-red-500/50 animate-shake"
                    : "border-white/20"
                } text-white text-right placeholder:text-slate-300 placeholder:text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition`}
                placeholder="אשר סיסמה"
              />
              {passwordMismatch && (
                <p className="mt-1 text-sm text-red-400 text-right">
                  הסיסמאות אינן תואמות
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div>
              <label
                htmlFor="garageName"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                שם מוסך
              </label>
              <input
                id="garageName"
                type="text"
                value={garageName}
                onChange={(e) => setGarageName(e.target.value)}
                required
                className="input-glow w-full rounded-xl bg-white/10 border border-white/20 text-white text-right placeholder:text-slate-300 placeholder:text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition"
                placeholder="הכנס שם מוסך"
              />
            </div>

            <div>
              <label
                htmlFor="licenseNumber"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                מספר רישיון מוסך
              </label>
              <input
                id="licenseNumber"
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                required
                className="input-glow w-full rounded-xl bg-white/10 border border-white/20 text-white text-right placeholder:text-slate-300 placeholder:text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition"
                placeholder="הכנס מספר רישיון מוסך"
              />
            </div>

            <div>
              <label
                htmlFor="garagePhone"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                טלפון
              </label>
              <input
                id="garagePhone"
                type="tel"
                value={garagePhone}
                onChange={(e) => setGaragePhone(e.target.value)}
                required
                className="input-glow w-full rounded-xl bg-white/10 border border-white/20 text-white text-right placeholder:text-slate-300 placeholder:text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition"
                placeholder="הכנס מספר טלפון"
              />
            </div>

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
                className="input-glow w-full rounded-xl bg-white/10 border border-white/20 text-white text-right placeholder:text-slate-300 placeholder:text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition"
                placeholder="הכנס כתובת מייל"
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
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
                minLength={6}
                className={`input-glow w-full rounded-xl bg-white/10 border ${
                  passwordMismatch
                    ? "border-red-500/50 animate-shake"
                    : "border-white/20"
                } text-white text-right placeholder:text-slate-300 placeholder:text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition`}
                placeholder="הכנס סיסמה (לפחות 6 תווים)"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                אישור סיסמה
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                required
                className={`input-glow w-full rounded-xl bg-white/10 border ${
                  passwordMismatch
                    ? "border-red-500/50 animate-shake"
                    : "border-white/20"
                } text-white text-right placeholder:text-slate-300 placeholder:text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition`}
                placeholder="אשר סיסמה"
              />
              {passwordMismatch && (
                <p className="mt-1 text-sm text-red-400 text-right">
                  הסיסמאות אינן תואמות
                </p>
              )}
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-500 px-6 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-sky-500/40 transition hover:-translate-y-0.5 hover:shadow-sky-500/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-slate-950"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>מתחבר...</span>
            </>
          ) : (
            "הרשמה"
          )}
        </button>
      </form>

      {/* Login Link */}
      <div className="mt-6 text-center">
        <Link
          href="/auth/login"
          className="text-sm text-slate-300 hover:text-sky-300 transition"
        >
          כבר רשום? לחץ להתחברות
        </Link>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          10%,
          30%,
          50%,
          70%,
          90% {
            transform: translateX(-5px);
          }
          20%,
          40%,
          60%,
          80% {
            transform: translateX(5px);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .input-glow:focus {
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1),
            0 0 20px rgba(56, 189, 248, 0.2);
        }
      `}</style>
    </div>
  );
}
