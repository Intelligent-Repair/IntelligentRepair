'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Car, Calendar, Hash, Factory, ArrowRight, Save, AlertCircle } from 'lucide-react';

export default function AddVehiclePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // רשימות לבחירה (Dropdowns)
    const [manufacturers, setManufacturers] = useState<string[]>([]);
    const [models, setModels] = useState<string[]>([]);
    const [years, setYears] = useState<number[]>([]);

    // הבחירות של המשתמש
    const [selectedManufacturer, setSelectedManufacturer] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [licensePlate, setLicensePlate] = useState('');

    // --- טעינת יצרנים בטעינת הדף ---
    useEffect(() => {
        const fetchManufacturers = async () => {
            console.log("מתחיל טעינת יצרנים..."); // בדיקה

            const { data, error } = await supabase
                .from('vehicle_catalog')
                .select('manufacturer');

            if (error) {
                console.error("שגיאה בשליפת יצרנים:", error.message);
                return;
            }

            if (data) {
                console.log("מספר רשומות שנמצאו:", data.length); // בדיקה כמה שורות חזרו
                // שימוש ב-Set כדי להסיר כפילויות
                const uniqueManufacturers = Array.from(new Set(data.map(item => item.manufacturer)))
                    .filter(item => item !== null && item !== "") // סינון ערכים ריקים
                    .sort();

                console.log("יצרנים ייחודיים:", uniqueManufacturers); // בדיקה של הרשימה הסופית
                setManufacturers(uniqueManufacturers);
            }
        };

        fetchManufacturers();
    }, []);

    // --- טעינת דגמים כשיש יצרן ---
    useEffect(() => {
        if (!selectedManufacturer) {
            setModels([]);
            return;
        }

        const fetchModels = async () => {
            const { data, error } = await supabase
                .from('vehicle_catalog')
                .select('model')
                .eq('manufacturer', selectedManufacturer);

            if (error) console.error(error);

            if (data) {
                const uniqueModels = Array.from(new Set(data.map(item => item.model))).sort();
                setModels(uniqueModels);
            }
        };
        fetchModels();
        setSelectedModel('');
        setSelectedYear('');
    }, [selectedManufacturer]);

    // --- טעינת שנים כשיש דגם ---
    useEffect(() => {
        if (!selectedModel) {
            setYears([]);
            return;
        }

        const fetchYears = async () => {
            const { data, error } = await supabase
                .from('vehicle_catalog')
                .select('year')
                .eq('manufacturer', selectedManufacturer)
                .eq('model', selectedModel);

            if (error) console.error(error);

            if (data) {
                const uniqueYears = Array.from(new Set(data.map(item => item.year))).sort((a, b) => b - a);
                setYears(uniqueYears);
            }
        };
        fetchYears();
        setSelectedYear('');
    }, [selectedModel]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('משתמש לא מחובר, אנא התחבר מחדש');

            // מציאת ה-ID של הרכב מהקטלוג
            const { data: catalogItem, error: catalogError } = await supabase
                .from('vehicle_catalog')
                .select('id')
                .eq('manufacturer', selectedManufacturer)
                .eq('model', selectedModel)
                .eq('year', parseInt(selectedYear))
                .single(); // מחזיר שורה אחת בלבד

            if (catalogError || !catalogItem) {
                console.error("Catalog Error:", catalogError);
                throw new Error('לא נמצא רכב מתאים בקטלוג או שיש כפילות בנתונים');
            }

            // שמירה בטבלת people_cars
            const { error: insertError } = await supabase
                .from('people_cars')
                .insert([
                    {
                        user_id: user.id,
                        vehicle_catalog_id: catalogItem.id,
                        license_plate: licensePlate,
                    }
                ]);

            if (insertError) throw insertError;

            alert('הרכב נוסף בהצלחה! 🚗');
            router.push('/maintenance');
            router.refresh();

        } catch (error) {
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

                        {/* בחירת יצרן */}
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400 flex items-center gap-2"><Factory className="w-4 h-4" /> יצרן</label>
                            <select
                                required
                                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-blue-500 outline-none appearance-none"
                                value={selectedManufacturer}
                                onChange={(e) => setSelectedManufacturer(e.target.value)}
                            >
                                <option value="" className="text-gray-500 bg-gray-900">בחר יצרן...</option>
                                {manufacturers.length === 0 && (
                                    <option disabled className="bg-gray-900">טוען רשימה...</option>
                                )}
                                {manufacturers.map((m, idx) => (
                                    <option key={idx} value={m} className="text-white bg-gray-900">{m}</option>
                                ))}
                            </select>
                        </div>

                        {/* בחירת דגם */}
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400 flex items-center gap-2"><Car className="w-4 h-4 scale-x-[-1]" /> דגם</label>
                            <select
                                required
                                disabled={!selectedManufacturer}
                                className={`w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-blue-500 outline-none appearance-none ${!selectedManufacturer ? 'opacity-50 cursor-not-allowed' : ''}`}
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                            >
                                <option value="" className="text-gray-500 bg-gray-900">
                                    {selectedManufacturer ? 'בחר דגם...' : 'קודם בחר יצרן'}
                                </option>
                                {models.map((m, idx) => (
                                    <option key={idx} value={m} className="text-white bg-gray-900">{m}</option>
                                ))}
                            </select>
                        </div>

                        {/* בחירת שנה */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400 flex items-center gap-2"><Calendar className="w-4 h-4" /> שנה</label>
                                <select
                                    required
                                    disabled={!selectedModel}
                                    className={`w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-blue-500 outline-none appearance-none ${!selectedModel ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                >
                                    <option value="" className="text-gray-500 bg-gray-900">בחר...</option>
                                    {years.map((y, idx) => (
                                        <option key={idx} value={y} className="text-white bg-gray-900">{y}</option>
                                    ))}
                                </select>
                            </div>

                            {/* לוחית רישוי */}
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400 flex items-center gap-2"><Hash className="w-4 h-4" /> לוחית רישוי</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-center font-mono tracking-widest focus:border-blue-500 outline-none"
                                    value={licensePlate}
                                    onChange={(e) => setLicensePlate(e.target.value)}
                                    placeholder="12-345-67"
                                />
                            </div>
                        </div>

                        {/* סיכום */}
                        {selectedManufacturer && selectedModel && selectedYear && (
                            <div className="text-center text-sm text-green-400 bg-green-900/20 p-2 rounded-lg border border-green-500/20">
                                נבחר: {selectedManufacturer} {selectedModel} ({selectedYear})
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="w-full mt-8 bg-blue-600 hover:bg-blue-500 text-white font-bold p-4 rounded-xl transition-all flex items-center justify-center gap-2">
                            {loading ? 'שומר נתונים...' : 'שמור רכב'} <Save className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}