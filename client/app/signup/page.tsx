// client/app/signup/page.tsx
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// קוד זה הוא עיצוב בלבד. הלוגיקה של Supabase תתווסף לאחר תיקון ה-Export.
export default function SignupPage() {
    const router = useRouter();
    // נתונים סטטיים לטופס, רק לצורך הצגה
    const [formData, setFormData] = useState({ email: '', password: '' }); 
    const [message, setMessage] = useState<string | null>(null);

    // פונקציות דמה לצורך הצגת הטופס
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };
    
    const handleSignUp = (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('בדיקת עיצוב: הטופס מוכן לחיבור ל-Supabase.');
        //router.push('/'); // הניתוב האמיתי יקרה כאן
    };


    return (
        // מעטפת רקע כהה ומרכוז (בדומה לעמוד הבית)
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
            
            {/* אפקטי האור והטשטוש - חיוני לשמירה על המראה הדומה לדף הבית */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
                <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
                <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-indigo-600/20 blur-[180px]" />
            </div>

            {/* מיקום מרכזי לטופס */}
            <main
                dir="rtl"
                className="relative mx-auto flex h-screen w-full max-w-6xl items-center justify-center p-6"
            >
                {/* כרטיס הטופס המעוצב */}
                <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_rgba(5,10,30,0.5)] backdrop-blur-2xl transition duration-500 hover:border-sky-500/30">
                    
                    {/* כותרת עליונה */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white">הרשמת משתמש</h1>
                        <p className="text-sm text-slate-400 mt-1">
                            צרו חשבון חדש כדי להתחיל באבחון
                        </p>
                    </div>

                    {/* טופס הרשמה */}
                    <form onSubmit={handleSignUp} className="space-y-4">
                        
                        <input 
                            type="email" 
                            name="email"
                            placeholder="כתובת אימייל" 
                            value={formData.email} 
                            onChange={handleInputChange} 
                            required 
                            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-right"
                            dir="rtl"
                        />
                        <input 
                            type="password" 
                            name="password"
                            placeholder="סיסמה (לפחות 6 תווים)" 
                            value={formData.password} 
                            onChange={handleInputChange} 
                            required 
                            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-right"
                            dir="rtl"
                        />
                        
                        <button 
                            type="submit" 
                            className="w-full mt-4 rounded-full bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-500 px-12 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/40 transition hover:-translate-y-0.5 hover:shadow-cyan-500/60"
                        >
                            הירשם
                        </button>
                    </form>
                    
                    {/* הודעות ושגיאות */}
                    {message && <p className={`mt-4 text-center text-sm text-green-400`}>{message}</p>}
                    
                    {/* קישור להתחברות */}
                    <p className="mt-6 text-center text-sm text-slate-400">
                        יש לך כבר חשבון? 
                        <a href="/login" className="font-medium text-sky-400 hover:text-sky-300 transition mr-1">
                            התחבר עכשיו
                        </a>
                    </p>

                </div>
            </main>
        </div>
    );
}