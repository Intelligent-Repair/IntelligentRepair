// client/app/garage/profile/page.tsx
'use client';

import { useState, useEffect } from 'react';
// ייבוא כל האייקונים הדרושים (כדי למנוע ReferenceError)
import { User, Mail, Phone, MapPin, Loader2, Save, Clock } from 'lucide-react'; 

// --- נתוני דמה להתחלה ---
const mockGarageProfile = {
    name: 'מוסך רואי - IntelligentRepair',
    email: 'garage.roee@example.com',
    phone: '03-1234567',
    address: 'דרך מנחם בגין 144, תל אביב',
    is_loading: false,
};

// --- מבנה נתוני שעות הפעילות ההתחלתיות ---
const initialOperatingHours = [
    { day: 'ראשון', open: '08:00', close: '17:00', isClosed: false },
    { day: 'שני', open: '08:00', close: '17:00', isClosed: false },
    { day: 'שלישי', open: '08:00', close: '17:00', isClosed: false },
    { day: 'רביעי', open: '08:00', close: '17:00', isClosed: false },
    { day: 'חמישי', open: '08:00', close: '17:00', isClosed: false },
    { day: 'שישי', open: '08:00', close: '13:00', isClosed: false },
    { day: 'שבת', open: '00:00', close: '00:00', isClosed: true },
];

// *** שם הפונקציה שונה ל-GarageProfilePage כדי להתאים לשם התיקייה ***
export default function GarageProfilePage() {
    const [profile, setProfile] = useState(mockGarageProfile); 
    const [operatingHours, setOperatingHours] = useState(initialOperatingHours);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const loadProfile = async () => {
        setProfile(prev => ({ ...prev, is_loading: true }));
        setStatusMessage(null);
        await new Promise(resolve => setTimeout(resolve, 800)); 
        setProfile({ ...mockGarageProfile, is_loading: false });
    };

    useEffect(() => {
        loadProfile();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handleHoursChange = (index: number, field: 'open' | 'close', value: string) => {
        const newHours = [...operatingHours];
        newHours[index] = { ...newHours[index], [field]: value };
        setOperatingHours(newHours);
    };

    const handleToggleClosed = (index: number, checked: boolean) => {
        const newHours = [...operatingHours];
        newHours[index] = { ...newHours[index], isClosed: checked };
        setOperatingHours(newHours);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setStatusMessage(null);

        // --- לוגיקת שמירה ל-Supabase כאן (profile + operatingHours) ---
        console.log("Saving Profile:", profile);
        console.log("Saving Hours:", operatingHours); 
        await new Promise(resolve => setTimeout(resolve, 1500)); 
        
        setIsSaving(false);
        setStatusMessage('הפרטים נשמרו בהצלחה! 💪');
        setTimeout(() => setStatusMessage(null), 3000);
    };

    if (profile.is_loading) {
        return (
            <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
                <Loader2 className="w-10 h-10 animate-spin text-sky-400"/>
                <p className="mr-4 text-xl">טוען פרופיל מוסך...</p>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
             {/* אפקטי האור והטשטוש */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
                <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
            </div>

            <main dir="rtl" className="relative mx-auto w-full max-w-4xl px-6 pb-16 pt-8 sm:px-10 lg:px-12">
                
                <h1 className="text-4xl font-extrabold text-white mb-8 border-b border-white/10 pb-4 flex items-center gap-3">
                    <User className="w-8 h-8 text-cyan-300"/> ניהול פרופיל והגדרות מוסך
                </h1>

                {statusMessage && (
                    <div className="p-4 mb-4 rounded-xl bg-green-900/40 text-green-300 text-center font-medium">
                        {statusMessage}
                    </div>
                )}
                
                <form onSubmit={handleUpdate} className="rounded-xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-md space-y-6">
                    
                    {/* --- סעיף 1: פרטי המוסך הבסיסיים --- */}
                    <h2 className="text-2xl font-bold text-sky-300 border-b border-white/20 pb-2 mb-6">פרטי קשר וכתובת</h2>
                    
                    {/* שם המוסך */}
                    <div>
                        <label className="text-sm text-slate-400 block mb-1 flex items-center gap-2">שם המוסך</label>
                        <input type="text" name="name" value={profile.name} onChange={handleChange} required className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-right" dir="rtl" />
                    </div>
                    
                    {/* אימייל (קריאה בלבד) */}
                    <div>
                        <label className="text-sm text-slate-400 block mb-1 flex items-center gap-2"><Mail className="w-4 h-4"/> כתובת אימייל (שם משתמש)</label>
                        <input type="email" value={profile.email} disabled className="w-full p-3 bg-zinc-900 border border-zinc-700 rounded-lg text-slate-500 cursor-not-allowed text-right" dir="rtl" />
                    </div>
                    
                    {/* טלפון */}
                    <div>
                        <label className="text-sm text-slate-400 block mb-1 flex items-center gap-2"><Phone className="w-4 h-4"/> מספר טלפון ליצירת קשר</label>
                        <input 
                            type="tel" 
                            name="phone"
                            value={profile.phone}
                            onChange={handleChange}
                            required
                            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-right"
                            dir="rtl"
                        />
                    </div>

                    {/* כתובת */}
                    <div>
                        <label className="text-sm text-slate-400 block mb-1 flex items-center gap-2"><MapPin className="w-4 h-4"/> כתובת מלאה</label>
                        <input type="text" name="address" value={profile.address} onChange={handleChange} required className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-right" dir="rtl" />
                    </div>
                    
                    {/* --- סעיף 2: שעות פעילות (החדש) --- */}
                    <h2 className="text-2xl font-bold text-sky-300 border-b border-white/20 pb-2 mb-6 pt-8 flex items-center gap-2">
                        <Clock className="w-6 h-6"/> שעות פעילות המוסך
                    </h2>

                    <div className="space-y-4">
                        {operatingHours.map((hour, index) => (
                            <div key={hour.day} className="flex items-center bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50">
                                
                                {/* שם היום */}
                                <div className="w-1/4 font-semibold text-white/90">
                                    {hour.day}
                                </div>
                                
                                {/* שעת פתיחה */}
                                <div className="w-1/4 mx-2">
                                    <input
                                        type="time"
                                        value={hour.open}
                                        disabled={hour.isClosed}
                                        onChange={(e) => handleHoursChange(index, 'open', e.target.value)}
                                        className={`w-full p-2 rounded-lg text-center ${hour.isClosed ? 'bg-zinc-900 text-slate-500 cursor-not-allowed' : 'bg-zinc-700 text-white border-none focus:ring-1 focus:ring-cyan-500'}`}
                                    />
                                </div>
                                
                                {/* מקף מפריד */}
                                <span className={`text-center w-1/12 font-bold ${hour.isClosed ? 'text-slate-500' : 'text-white'}`}>-</span>
                                
                                {/* שעת סגירה */}
                                <div className="w-1/4 mx-2">
                                    <input
                                        type="time"
                                        value={hour.close}
                                        disabled={hour.isClosed}
                                        onChange={(e) => handleHoursChange(index, 'close', e.target.value)}
                                        className={`w-full p-2 rounded-lg text-center ${hour.isClosed ? 'bg-zinc-900 text-slate-500 cursor-not-allowed' : 'bg-zinc-700 text-white border-none focus:ring-1 focus:ring-cyan-500'}`}
                                    />
                                </div>
                                
                                {/* צ'קבוקס "סגור" */}
                                <div className="w-1/4 flex justify-end items-center mr-2">
                                    <label className="inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={hour.isClosed}
                                            onChange={(e) => handleToggleClosed(index, e.target.checked)}
                                            className="form-checkbox h-5 w-5 text-cyan-600 bg-zinc-700 border-zinc-600 rounded focus:ring-cyan-500 transition duration-150 ease-in-out"
                                        />
                                        <span className={`mr-2 text-sm font-medium ${hour.isClosed ? 'text-cyan-400' : 'text-slate-400'}`}>סגור</span>
                                    </label>
                                </div>

                            </div>
                        ))}
                    </div>

                    {/* כפתור שמירה */}
                    <button 
                        type="submit" 
                        disabled={isSaving}
                        className="w-full mt-8 rounded-full bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-500 px-12 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/40 transition hover:-translate-y-0.5 hover:shadow-cyan-500/60 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin"/> שומר פרטים...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5"/> שמירת שינויים
                            </>
                        )}
                    </button>
                </form>

            </main>
        </div>
    );
}