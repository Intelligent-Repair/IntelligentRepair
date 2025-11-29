// client/app/login/page.tsx
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
// הסרנו את import { createBrowserClient } } כדי למנוע שגיאות בנייה זמנית

// הגדרת משתני נתונים בסיסיים לשמירה על שלמות הקוד
type FormData = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({ email: '', password: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // פונקציות דמה (Placeholder) כדי שהקוד ירוץ
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('בדיקת עיצוב: הטופס מוכן לחיבור ל-Supabase.');
    //router.push('/dashboard'); // השורה שתחבר אתכם לדשבורד לאחר הוספת הלוגיקה
  };


  return (
    // 1. מעטפת הרקע: הועתקה ישירות מדף הבית
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
      
      {/* 2. אפקטי האור והטשטוש: הועתקו ישירות מדף הבית */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
        <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
        <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-indigo-600/20 blur-[180px]" />
      </div>

      {/* 3. מיקום מרכזי לטופס הלוגין */}
      <main
        dir="rtl"
        className="relative mx-auto flex h-screen w-full max-w-6xl items-center justify-center p-6"
      >
        {/* כרטיס הטופס המעוצב (בדומה לאובייקטים המעוצבים בדף הבית) */}
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_rgba(5,10,30,0.5)] backdrop-blur-2xl transition duration-500 hover:border-sky-500/30">
          
          {/* לוגו וכותרת עליונה */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white">התחברות למערכת</h1>
            <p className="text-sm text-slate-400 mt-1">
                הכניסו את פרטי המשתמש כדי להתחיל
            </p>
          </div>

          {/* טופס ההתחברות */}
          <form onSubmit={handleLogin} className="space-y-4">
            
            <input 
              type="email" 
              name="email"
              placeholder="כתובת אימייל" 
              value={formData.email} 
              onChange={handleInputChange} 
              required 
              disabled={isLoading}
              className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 text-right transition"
              dir="rtl"
            />
            <input 
              type="password" 
              name="password"
              placeholder="סיסמה" 
              value={formData.password} 
              onChange={handleInputChange} 
              required 
              disabled={isLoading}
              className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 text-right transition"
              dir="rtl"
            />
            
            <button 
              type="submit" 
              disabled={isLoading}
              // כפתור מעוצב כמו כפתור ה'הרשמה' הצבעוני בדף הבית
              className="w-full mt-4 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-600 px-12 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-sky-500/40 transition hover:-translate-y-0.5 hover:shadow-sky-500/60 disabled:shadow-none disabled:bg-gray-700 disabled:text-gray-400"
            >
              {isLoading ? 'מתחבר...' : 'התחבר'}
            </button>
          </form>
          
          {/* הודעות ושגיאות */}
          {message && <p className={`mt-4 text-center text-sm ${message.includes('שגיאה') ? 'text-red-500' : 'text-green-400'}`}>{message}</p>}
          
          {/* קישור להרשמה */}
          <p className="mt-6 text-center text-sm text-slate-400">
            אין לך חשבון? 
            <a href="/signup" className="font-medium text-cyan-400 hover:text-cyan-300 transition mr-1">
                הירשם עכשיו
            </a>
          </p>

        </div>
      </main>
    </div>
  );
}