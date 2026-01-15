// client/app/garage/profile/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, MapPin, Loader2, Save, Clock, ArrowRight } from 'lucide-react';

export default function GarageProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        street: '',
        number: '',
        is_loading: true,
    });
    const [operatingHours, setOperatingHours] = useState<Array<{ day: string; open: string; close: string; isClosed: boolean }>>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadProfile = async () => {
        setProfile(prev => ({ ...prev, is_loading: true }));
        setStatusMessage(null);
        setError(null);

        try {
            const res = await fetch('/api/garage/profile');
            const data = await res.json();

            if (!res.ok || data.error) {
                const errorMessage = data.error || `שגיאה בטעינת הפרופיל (${res.status})`;
                setError(errorMessage);
                setProfile(prev => ({ ...prev, is_loading: false }));
                setOperatingHours([
                    { day: 'ראשון', open: '08:00', close: '17:00', isClosed: false },
                    { day: 'שני', open: '08:00', close: '17:00', isClosed: false },
                    { day: 'שלישי', open: '08:00', close: '17:00', isClosed: false },
                    { day: 'רביעי', open: '08:00', close: '17:00', isClosed: false },
                    { day: 'חמישי', open: '08:00', close: '17:00', isClosed: false },
                    { day: 'שישי', open: '08:00', close: '13:00', isClosed: false },
                    { day: 'שבת', open: '00:00', close: '00:00', isClosed: true },
                ]);
            } else {
                const addressParts = [data.profile.city, data.profile.street, data.profile.number].filter(Boolean);
                setProfile({
                    name: data.profile.name || '',
                    email: data.profile.email || '',
                    phone: data.profile.phone || '',
                    address: data.profile.address || addressParts.join(", ") || '',
                    city: data.profile.city || '',
                    street: data.profile.street || '',
                    number: data.profile.number || '',
                    is_loading: false,
                });
                if (data.operatingHours && data.operatingHours.length > 0) {
                    setOperatingHours(data.operatingHours);
                } else {
                    setOperatingHours([
                        { day: 'ראשון', open: '08:00', close: '17:00', isClosed: false },
                        { day: 'שני', open: '08:00', close: '17:00', isClosed: false },
                        { day: 'שלישי', open: '08:00', close: '17:00', isClosed: false },
                        { day: 'רביעי', open: '08:00', close: '17:00', isClosed: false },
                        { day: 'חמישי', open: '08:00', close: '17:00', isClosed: false },
                        { day: 'שישי', open: '08:00', close: '13:00', isClosed: false },
                        { day: 'שבת', open: '00:00', close: '00:00', isClosed: true },
                    ]);
                }
            }
        } catch (err) {
            console.error('Error loading profile:', err);
            setError('שגיאה בטעינת הפרופיל');
            setProfile(prev => ({ ...prev, is_loading: false }));
        }
    };

    useEffect(() => {
        loadProfile();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProfile({ ...profile, [name]: value });
    };

    const handleHoursChange = (index: number, field: 'open' | 'close', value: string) => {
        const newHours = [...operatingHours];
        newHours[index] = { ...newHours[index], [field]: value };
        setOperatingHours(newHours);
    };

    const handleToggleClosed = (index: number, isClosed: boolean) => {
        const newHours = [...operatingHours];
        newHours[index] = { ...newHours[index], isClosed };
        setOperatingHours(newHours);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setStatusMessage(null);
        setError(null);

        try {
            const res = await fetch('/api/garage/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profile: {
                        name: profile.name,
                        phone: profile.phone,
                        city: profile.city,
                        street: profile.street,
                        number: profile.number,
                    },
                    operatingHours: operatingHours,
                }),
            });

            const data = await res.json();

            if (data.error) {
                setError(data.error);
            } else {
                setStatusMessage('הפרטים נשמרו בהצלחה! 💪');
                setTimeout(() => {
                    router.push('/garage');
                }, 1500);
            }
        } catch (err) {
            console.error('Error saving profile:', err);
            setError('שגיאה בשמירת הפרופיל');
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (operatingHours.length === 0 && !profile.is_loading) {
            setOperatingHours([
                { day: 'ראשון', open: '08:00', close: '17:00', isClosed: false },
                { day: 'שני', open: '08:00', close: '17:00', isClosed: false },
                { day: 'שלישי', open: '08:00', close: '17:00', isClosed: false },
                { day: 'רביעי', open: '08:00', close: '17:00', isClosed: false },
                { day: 'חמישי', open: '08:00', close: '17:00', isClosed: false },
                { day: 'שישי', open: '08:00', close: '13:00', isClosed: false },
                { day: 'שבת', open: '00:00', close: '00:00', isClosed: true },
            ]);
        }
    }, [operatingHours.length, profile.is_loading]);

    if (profile.is_loading) {
        return (
            <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
                <Loader2 className="w-10 h-10 animate-spin text-sky-400" />
                <p className="mr-4 text-xl">טוען פרופיל מוסך...</p>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
            {/* Background Effects */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
                <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
            </div>

            <main dir="rtl" className="relative mx-auto w-full max-w-4xl px-6 pb-24 pt-8 sm:px-10 lg:px-12">

                {/* Back Button */}
                <button
                    onClick={() => router.push('/garage')}
                    className="mb-6 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200 text-white/70 hover:text-white flex items-center gap-2"
                    title="חזרה לדף הבית"
                >
                    <ArrowRight size={20} />
                    <span className="text-sm">חזרה לדף הראשי</span>
                </button>

                {/* Page Title */}
                <h1 className="text-4xl font-extrabold text-white mb-8 border-b border-white/10 pb-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                        <User className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                    </div>
                    ניהול פרופיל והגדרות מוסך
                </h1>

                {/* Status Messages */}
                {statusMessage && (
                    <div className="p-4 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-center font-medium backdrop-blur-sm">
                        {statusMessage}
                    </div>
                )}

                {error && (
                    <div className="p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-center font-medium backdrop-blur-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleUpdate} className="space-y-8">

                    {/* ===== CARD 1: Contact & Address ===== */}
                    <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] p-8">

                        {/* Section Header */}
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent flex items-center gap-3 mb-8">
                            <div className="p-2 rounded-lg bg-cyan-500/10">
                                <User className="w-6 h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                            </div>
                            פרטי קשר וכתובת
                        </h2>

                        {/* Grid Layout */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                            {/* Garage Name - Full Width */}
                            <div className="md:col-span-2 lg:col-span-3">
                                <label className="text-sm text-white/50 block mb-2">שם המוסך</label>
                                <div className="relative">
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        name="name"
                                        value={profile.name}
                                        onChange={handleChange}
                                        required
                                        className="w-full pr-11 pl-4 py-3 bg-white/5 border-b border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 transition-colors"
                                        dir="rtl"
                                        placeholder="הזן את שם המוסך"
                                    />
                                </div>
                            </div>

                            {/* Email - Read Only */}
                            <div className="md:col-span-1">
                                <label className="text-sm text-white/50 block mb-2 flex items-center gap-2">
                                    <Mail className="w-4 h-4" /> כתובת אימייל
                                </label>
                                <div className="relative">
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="email"
                                        value={profile.email}
                                        disabled
                                        className="w-full pr-11 pl-4 py-3 bg-white/[0.02] border-b border-white/5 rounded-lg text-white/40 cursor-not-allowed"
                                        dir="rtl"
                                    />
                                </div>
                            </div>

                            {/* Phone */}
                            <div className="md:col-span-1">
                                <label className="text-sm text-white/50 block mb-2 flex items-center gap-2">
                                    <Phone className="w-4 h-4" /> מספר טלפון
                                </label>
                                <div className="relative">
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={profile.phone}
                                        onChange={handleChange}
                                        required
                                        className="w-full pr-11 pl-4 py-3 bg-white/5 border-b border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 transition-colors"
                                        dir="rtl"
                                        placeholder="050-0000000"
                                    />
                                </div>
                            </div>

                            {/* Spacer for alignment on lg */}
                            <div className="hidden lg:block" />

                            {/* City */}
                            <div>
                                <label className="text-sm text-white/50 block mb-2 flex items-center gap-2">
                                    <MapPin className="w-4 h-4" /> עיר
                                </label>
                                <div className="relative">
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        name="city"
                                        value={profile.city}
                                        onChange={handleChange}
                                        required
                                        className="w-full pr-11 pl-4 py-3 bg-white/5 border-b border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 transition-colors"
                                        dir="rtl"
                                        placeholder="תל אביב"
                                    />
                                </div>
                            </div>

                            {/* Street */}
                            <div>
                                <label className="text-sm text-white/50 block mb-2">רחוב</label>
                                <input
                                    type="text"
                                    name="street"
                                    value={profile.street}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 bg-white/5 border-b border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 transition-colors"
                                    dir="rtl"
                                    placeholder="רחוב הרצל"
                                />
                            </div>

                            {/* Number */}
                            <div>
                                <label className="text-sm text-white/50 block mb-2">מספר</label>
                                <input
                                    type="text"
                                    name="number"
                                    value={profile.number}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 bg-white/5 border-b border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 transition-colors"
                                    dir="rtl"
                                    placeholder="12"
                                />
                            </div>

                        </div>
                    </div>

                    {/* ===== CARD 2: Opening Hours ===== */}
                    <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] p-8">

                        {/* Section Header */}
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent flex items-center gap-3 mb-8">
                            <div className="p-2 rounded-lg bg-cyan-500/10">
                                <Clock className="w-6 h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                            </div>
                            שעות פעילות המוסך
                        </h2>

                        {/* Hours List */}
                        <div className="space-y-3">
                            {operatingHours.map((hour, index) => (
                                <div
                                    key={hour.day}
                                    className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-all duration-200"
                                >
                                    {/* Day Name */}
                                    <div className="w-20 font-bold text-white/90">
                                        {hour.day}
                                    </div>

                                    {/* Time Inputs */}
                                    <div className={`flex items-center gap-3 flex-1 justify-center ${hour.isClosed ? 'opacity-40' : ''}`}>
                                        <input
                                            type="time"
                                            value={hour.open}
                                            disabled={hour.isClosed}
                                            onChange={(e) => handleHoursChange(index, 'open', e.target.value)}
                                            className="w-24 py-2 px-3 rounded-full bg-black/20 text-white text-center text-sm border-none focus:outline-none focus:ring-2 focus:ring-cyan-400/50 disabled:cursor-not-allowed"
                                        />
                                        <span className="text-white/50 font-medium">—</span>
                                        <input
                                            type="time"
                                            value={hour.close}
                                            disabled={hour.isClosed}
                                            onChange={(e) => handleHoursChange(index, 'close', e.target.value)}
                                            className="w-24 py-2 px-3 rounded-full bg-black/20 text-white text-center text-sm border-none focus:outline-none focus:ring-2 focus:ring-cyan-400/50 disabled:cursor-not-allowed"
                                        />
                                    </div>

                                    {/* Toggle Switch */}
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-medium ${hour.isClosed ? 'text-white/40' : 'text-emerald-400'}`}>
                                            {hour.isClosed ? 'סגור' : 'פתוח'}
                                        </span>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={!hour.isClosed}
                                            onClick={() => handleToggleClosed(index, !hour.isClosed)}
                                            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${hour.isClosed ? 'bg-slate-600' : 'bg-emerald-500'
                                                }`}
                                        >
                                            <span
                                                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${hour.isClosed ? 'right-0.5' : 'right-6'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ===== Save Button ===== */}
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-12 py-4 text-lg font-bold text-slate-950 shadow-lg shadow-cyan-500/40 hover:shadow-cyan-500/60 transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-6 h-6 animate-spin" />
                                שומר פרטים...
                            </>
                        ) : (
                            <>
                                <Save className="w-6 h-6" />
                                שמירת שינויים
                            </>
                        )}
                    </button>

                </form>

            </main>
        </div>
    );
}