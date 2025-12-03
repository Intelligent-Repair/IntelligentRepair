'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Car, Calendar, Hash, Factory, ArrowRight, Save } from 'lucide-react';

export default function AddVehiclePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        manufacturer: '',
        model: '',
        year: new Date().getFullYear(),
        license_plate: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('משתמש לא מחובר');

            const { error } = await supabase
                .from('vehicles')
                .insert([
                    {
                        user_id: user.id,
                        manufacturer: formData.manufacturer,
                        model: formData.model,
                        year: Number(formData.year),
                        license_plate: formData.license_plate,
                    }
                ]);

            if (error) throw error;

            alert('הרכב נוסף בהצלחה! 🚗');
            router.push('/maintenance');
            router.refresh();

        } catch (error) {
            // בדיקה בטוחה: האם השגיאה היא באמת מסוג "שגיאה"?
            const errorMessage = error instanceof Error ? error.message : 'שגיאה לא ידועה';
            alert('שגיאה בשמירה: ' + errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div dir="rtl" className="min-h-screen p-6 text-white flex items-center justify-center">
            <div className="w-full max-w-lg">
                <Link href="/maintenance" className="inline-flex items-center text-blue-300 hover:text-white mb-6 transition-colors">
                    <ArrowRight className="w-5 h-5 ml-2" />
                    חזרה למוסך שלי
                </Link>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                    <h1 className="text-3xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-l from-blue-400 to-white">
                        הוספת רכב חדש
                    </h1>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400 flex items-center gap-2"><Factory className="w-4 h-4" /> יצרן</label>
                            <input type="text" required className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                                value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} placeholder="למשל: טויוטה" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400 flex items-center gap-2"><Car className="w-4 h-4 scale-x-[-1]" /> דגם</label>
                            <input type="text" required className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                                value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} placeholder="למשל: קורולה" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400 flex items-center gap-2"><Calendar className="w-4 h-4" /> שנה</label>
                                <input type="number" required className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                                    value={formData.year} onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400 flex items-center gap-2"><Hash className="w-4 h-4" /> לוחית רישוי</label>
                                <input type="text" required className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-center font-mono tracking-widest"
                                    value={formData.license_plate} onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })} />
                            </div>
                        </div>

                        <button type="submit" disabled={loading} className="w-full mt-8 bg-blue-600 hover:bg-blue-500 text-white font-bold p-4 rounded-xl transition-all flex items-center justify-center gap-2">
                            {loading ? 'שומר...' : 'שמור רכב'} <Save className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}