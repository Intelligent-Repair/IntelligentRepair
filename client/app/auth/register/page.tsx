"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/ffc53cfd-5750-4bfc-8fcf-eeaa1b241560.png";
import { User, Wrench } from "lucide-react";

type UserType = "driver" | "garage";

export default function RegisterPage() {
  const router = useRouter();
  const [userType, setUserType] = useState<UserType>("driver");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const [phoneError, setPhoneError] = useState("");
  const [idError, setIdError] = useState("");

  // Driver fields
  const [idNumber, setIdNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Garage fields
  const [garageName, setGarageName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [garagePhone, setGaragePhone] = useState("");
  const [garageCity, setGarageCity] = useState("");
  const [garageStreet, setGarageStreet] = useState("");
  const [garageNumber, setGarageNumber] = useState("");
  const [garageOwnerNationalId, setGarageOwnerNationalId] = useState("");

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordMismatch(confirmPassword ? value !== confirmPassword : false);
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setPasswordMismatch(password ? value !== password : false);
  };

  const validatePhone = (phoneNumber: string): boolean => {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    return /^05\d{8}$/.test(cleanPhone);
  };

  const validateNationalId = (id: string): boolean => {
    return id.replace(/\D/g, "").length === 9;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPasswordMismatch(false);
    setPhoneError("");
    setIdError("");

    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      setError("הסיסמאות אינן תואמות");
      return;
    }

    const currentPhone = userType === "driver" ? phone : garagePhone;
    const currentId = userType === "driver" ? idNumber : garageOwnerNationalId;

    if (!validatePhone(currentPhone)) {
      setPhoneError("פורמט: 05XXXXXXXX (10 ספרות)");
      setError("מספר טלפון לא תקין");
      return;
    }

    if (!validateNationalId(currentId)) {
      setIdError("נדרשות 9 ספרות");
      setError("תעודת זהות לא תקינה");
      return;
    }

    setIsLoading(true);

    try {
      const payload: any = { role: userType, email, password };

      if (userType === "driver") {
        payload.national_id = idNumber;
        payload.first_name = firstName;
        payload.last_name = lastName;
        payload.phone = phone;
        payload.city = city;
      } else {
        payload.garage_name = garageName;
        payload.license_number = licenseNumber;
        payload.phone = garagePhone;
        payload.city = garageCity;
        payload.street = garageStreet;
        payload.number = garageNumber;
        payload.national_id = garageOwnerNationalId;
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || data.error || "שגיאה בהרשמה");
        setIsLoading(false);
        return;
      }

      router.push("/auth/login?registered=true");
    } catch (err) {
      setError("שגיאת רשת. נסה שוב מאוחר יותר.");
      setIsLoading(false);
    }
  };

  const inputBase = "input-glow w-full rounded-xl bg-white/5 border text-white text-right px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-200";
  const inputNormal = `${inputBase} border-white/10`;
  const inputError = `${inputBase} border-red-500/50 animate-shake`;

  return (
    <div className="animate-fade-in">
      {/* Logo */}
      <div className="flex justify-center mb-4">
        <Image
          src={Logo}
          alt="IntelligentRepair Logo"
          className="w-[220px] md:w-[280px] drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]"
          priority
        />
      </div>

      <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-6">
        הרשמה למערכת
      </h1>

      {/* Segmented Control */}
      <div className="mb-6">
        <div className="flex rounded-xl bg-slate-900/60 border border-white/10 p-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setUserType("driver")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all duration-300 ${userType === "driver"
              ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 shadow-lg shadow-cyan-500/30"
              : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
          >
            <User className="w-4 h-4" />
            <span>משתמש פרטי</span>
          </button>
          <button
            type="button"
            onClick={() => setUserType("garage")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all duration-300 ${userType === "garage"
              ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 shadow-lg shadow-cyan-500/30"
              : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
          >
            <Wrench className="w-4 h-4" />
            <span>מוסך</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200 text-sm text-center animate-shake">
          {error}
        </div>
      )}

      {/* Registration Form - 2 Column Grid */}
      <form onSubmit={handleSubmit} dir="rtl">
        {userType === "driver" ? (
          <div className="space-y-6">
            {/* Group 1: Basic Info */}
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                פרטים אישיים
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-slate-300 mb-1.5">
                    שם פרטי <span className="text-red-400">*</span>
                  </label>
                  <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputNormal} />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-slate-300 mb-1.5">
                    שם משפחה <span className="text-red-400">*</span>
                  </label>
                  <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputNormal} />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="idNumber" className="block text-sm font-medium text-slate-300 mb-1.5">
                    תעודת זהות <span className="text-red-400">*</span>
                  </label>
                  <input id="idNumber" type="text" value={idNumber} onChange={(e) => { setIdNumber(e.target.value); setIdError(""); }} required maxLength={9} placeholder="9 ספרות" className={idError ? inputError : inputNormal} />
                  {idError && <p className="mt-1 text-xs text-red-400">{idError}</p>}
                </div>
              </div>
            </div>

            {/* Group 2: Location & Contact */}
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                פרטי קשר ומיקום
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-slate-300 mb-1.5">
                    עיר מגורים <span className="text-red-400">*</span>
                  </label>
                  <input id="city" type="text" value={city} onChange={(e) => setCity(e.target.value)} required className={inputNormal} />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-1.5">
                    טלפון <span className="text-red-400">*</span>
                  </label>
                  <input id="phone" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }} required maxLength={10} placeholder="05X-XXXXXXX" className={phoneError ? inputError : inputNormal} />
                  {phoneError && <p className="mt-1 text-xs text-red-400">{phoneError}</p>}
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                    אימייל <span className="text-red-400">*</span>
                  </label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="example@mail.com" className={inputNormal} />
                </div>
              </div>
            </div>

            {/* Group 3: Security */}
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                אבטחה
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                    סיסמה <span className="text-red-400">*</span>
                  </label>
                  <input id="password" type="password" value={password} onChange={(e) => handlePasswordChange(e.target.value)} required minLength={6} placeholder="לפחות 6 תווים" className={passwordMismatch ? inputError : inputNormal} />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1.5">
                    אישור סיסמה <span className="text-red-400">*</span>
                  </label>
                  <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => handleConfirmPasswordChange(e.target.value)} required className={passwordMismatch ? inputError : inputNormal} />
                </div>
                {passwordMismatch && <p className="md:col-span-2 text-xs text-red-400">הסיסמאות אינן תואמות</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Garage: Group 1 - Business Info */}
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                פרטי המוסך
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label htmlFor="garageName" className="block text-sm font-medium text-slate-300 mb-1.5">
                    שם המוסך <span className="text-red-400">*</span>
                  </label>
                  <input id="garageName" type="text" value={garageName} onChange={(e) => setGarageName(e.target.value)} required className={inputNormal} />
                </div>
                <div>
                  <label htmlFor="licenseNumber" className="block text-sm font-medium text-slate-300 mb-1.5">
                    מספר רישיון מוסך <span className="text-red-400">*</span>
                  </label>
                  <input id="licenseNumber" type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required className={inputNormal} />
                </div>
                <div>
                  <label htmlFor="garageOwnerNationalId" className="block text-sm font-medium text-slate-300 mb-1.5">
                    ת.ז. בעל המוסך <span className="text-red-400">*</span>
                  </label>
                  <input id="garageOwnerNationalId" type="text" value={garageOwnerNationalId} onChange={(e) => { setGarageOwnerNationalId(e.target.value); setIdError(""); }} required maxLength={9} placeholder="9 ספרות" className={idError ? inputError : inputNormal} />
                  {idError && <p className="mt-1 text-xs text-red-400">{idError}</p>}
                </div>
              </div>
            </div>

            {/* Garage: Group 2 - Address & Contact */}
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                כתובת ופרטי קשר
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="garageCity" className="block text-sm font-medium text-slate-300 mb-1.5">
                    עיר <span className="text-red-400">*</span>
                  </label>
                  <input id="garageCity" type="text" value={garageCity} onChange={(e) => setGarageCity(e.target.value)} required className={inputNormal} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label htmlFor="garageStreet" className="block text-sm font-medium text-slate-300 mb-1.5">
                      רחוב
                    </label>
                    <input id="garageStreet" type="text" value={garageStreet} onChange={(e) => setGarageStreet(e.target.value)} className={inputNormal} />
                  </div>
                  <div>
                    <label htmlFor="garageNumber" className="block text-sm font-medium text-slate-300 mb-1.5">
                      מס'
                    </label>
                    <input id="garageNumber" type="text" value={garageNumber} onChange={(e) => setGarageNumber(e.target.value)} className={inputNormal} />
                  </div>
                </div>
                <div>
                  <label htmlFor="garagePhone" className="block text-sm font-medium text-slate-300 mb-1.5">
                    טלפון <span className="text-red-400">*</span>
                  </label>
                  <input id="garagePhone" type="tel" value={garagePhone} onChange={(e) => { setGaragePhone(e.target.value); setPhoneError(""); }} required maxLength={10} placeholder="05X-XXXXXXX" className={phoneError ? inputError : inputNormal} />
                  {phoneError && <p className="mt-1 text-xs text-red-400">{phoneError}</p>}
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                    אימייל <span className="text-red-400">*</span>
                  </label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="example@mail.com" className={inputNormal} />
                </div>
              </div>
            </div>

            {/* Garage: Group 3 - Security */}
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                אבטחה
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                    סיסמה <span className="text-red-400">*</span>
                  </label>
                  <input id="password" type="password" value={password} onChange={(e) => handlePasswordChange(e.target.value)} required minLength={6} placeholder="לפחות 6 תווים" className={passwordMismatch ? inputError : inputNormal} />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1.5">
                    אישור סיסמה <span className="text-red-400">*</span>
                  </label>
                  <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => handleConfirmPasswordChange(e.target.value)} required className={passwordMismatch ? inputError : inputNormal} />
                </div>
                {passwordMismatch && <p className="md:col-span-2 text-xs text-red-400">הסיסמאות אינן תואמות</p>}
              </div>
            </div>
          </div>
        )}

        {/* Submit Button - Full Width */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-8 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3.5 text-lg font-bold text-slate-900 shadow-lg shadow-cyan-500/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>נרשם...</span>
            </>
          ) : (
            "הרשמה"
          )}
        </button>
      </form>

      {/* Login Link */}
      <div className="mt-6 text-center">
        <Link href="/auth/login" className="text-sm text-slate-400 hover:text-cyan-400 transition-colors">
          כבר רשום? <span className="text-cyan-400 font-medium">לחץ להתחברות</span>
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
