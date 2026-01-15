'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Car, Calendar, Factory, ArrowRight, Save, Sparkles } from 'lucide-react';

export default function AddVehiclePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const [manufacturers, setManufacturers] = useState<string[]>([]);
    const [models, setModels] = useState<string[]>([]);
    const [years, setYears] = useState<number[]>([]);

    const [selectedManufacturer, setSelectedManufacturer] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [licensePlate, setLicensePlate] = useState('');

    useEffect(() => {
        const fetchManufacturers = async () => {
            const { data, error } = await supabase
                .from('vehicle_catalog')
                .select('manufacturer');

            if (error) {
                console.error("שגיאה בשליפת יצרנים:", error.message);
                return;
            }

            if (data) {
                const uniqueManufacturers = Array.from(new Set(data.map(item => item.manufacturer)))
                    .filter(item => item !== null && item !== "")
                    .sort();
                setManufacturers(uniqueManufacturers);
            }
        };

        fetchManufacturers();
    }, []);

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
        setLicensePlate('');
    }, [selectedManufacturer]);

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
        setLicensePlate('');
    }, [selectedModel]);

    useEffect(() => {
        if (selectedYear) {
            setLicensePlate('');
        }
    }, [selectedYear]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const minDigits = 7;
        if (licensePlate.length < minDigits) {
            alert(`לוחית רישוי חייבת להכיל לפחות ${minDigits} ספרות`);
            return;
        }

        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error('משתמש לא מחובר, אנא התחבר מחדש');

            const { data: catalogItem, error: catalogError } = await supabase
                .from('vehicle_catalog')
                .select('id')
                .eq('manufacturer', selectedManufacturer)
                .eq('model', selectedModel)
                .eq('year', parseInt(selectedYear))
                .single();

            if (catalogError || !catalogItem) {
                throw new Error('לא נמצא רכב מתאים בקטלוג');
            }

            const { error: insertError } = await supabase
                .from('people_cars')
                .insert([
                    {
                        user_id: user.id,
                        vehicle_catalog_id: catalogItem.id,
                        license_plate: licensePlate,
                    }
                ])
                .select();

            if (insertError) {
                if (insertError.message?.includes('license_plate') || insertError.code === '23505') {
                    alert('לוחית הרישוי כבר קיימת במערכת');
                    return;
                }
                throw new Error(insertError.message || 'שגיאה בהוספת הרכב');
            }

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

    // Glass Input Wrapper with icon inside
    const GlassSelect = ({
        icon: Icon,
        label,
        value,
        onChange,
        disabled,
        children
    }: {
        icon: any;
        label: string;
        value: string;
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
        disabled?: boolean;
        children: React.ReactNode;
    }) => (
        <div className="space-y-2">
            <label className="text-sm text-slate-500 font-medium">{label}</label>
            <div className="relative group">
                <Icon
                    size={18}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors pointer-events-none z-10"
                />
                <select
                    required
                    disabled={disabled}
                    value={value}
                    onChange={onChange}
                    className={`
                        w-full pr-12 pl-4 py-4 rounded-xl
                        bg-white/5 backdrop-blur-sm border-0 border-b-2 border-transparent
                        text-white appearance-none cursor-pointer
                        focus:bg-white/10 focus:border-cyan-400 focus:ring-0
                        disabled:opacity-30 disabled:cursor-not-allowed
                        outline-none transition-all duration-300
                    `}
                >
                    {children}
                </select>
            </div>
        </div>
    );

    return (
        <div dir="rtl" className="min-h-screen bg-[#0a0f1a] relative overflow-hidden">

            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-600/8 rounded-full blur-[150px]" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-lg mx-auto p-6 pt-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full"
                >
                    {/* Back Link */}
                    <Link
                        href="/maintenance"
                        className="inline-flex items-center text-slate-500 hover:text-white mb-8 transition-colors group"
                    >
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                        חזרה למוסך שלי
                    </Link>

                    {/* Glassmorphism Card */}
                    <div className="bg-white/[0.03] backdrop-blur-xl border-t border-white/10 border-x border-b border-white/5 rounded-3xl p-8 shadow-2xl">

                        {/* Header */}
                        <div className="text-center mb-10">
                            <div className="inline-flex items-center justify-center gap-3 mb-4">
                                <div className="p-4 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg shadow-cyan-500/30">
                                    <Car size={32} className="text-white" />
                                </div>
                            </div>
                            <h1 className="text-3xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                                הוספת רכב חדש
                            </h1>
                            <p className="text-slate-500 text-sm mt-2">צור זהות דיגיטלית לרכב שלך</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">

                            {/* יצרן */}
                            <GlassSelect
                                icon={Factory}
                                label="יצרן"
                                value={selectedManufacturer}
                                onChange={(e) => setSelectedManufacturer(e.target.value)}
                            >
                                <option value="" className="bg-slate-900">בחר יצרן...</option>
                                {manufacturers.length === 0 && (
                                    <option disabled className="bg-slate-900">טוען רשימה...</option>
                                )}
                                {manufacturers.map((m, idx) => (
                                    <option key={idx} value={m} className="bg-slate-900">{m}</option>
                                ))}
                            </GlassSelect>

                            {/* דגם */}
                            <GlassSelect
                                icon={Car}
                                label="דגם"
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                disabled={!selectedManufacturer}
                            >
                                <option value="" className="bg-slate-900">
                                    {selectedManufacturer ? 'בחר דגם...' : 'קודם בחר יצרן'}
                                </option>
                                {models.map((m, idx) => (
                                    <option key={idx} value={m} className="bg-slate-900">{m}</option>
                                ))}
                            </GlassSelect>

                            {/* שנה */}
                            <GlassSelect
                                icon={Calendar}
                                label="שנת ייצור"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                disabled={!selectedModel}
                            >
                                <option value="" className="bg-slate-900">בחר שנה...</option>
                                {years.map((y, idx) => (
                                    <option key={idx} value={y} className="bg-slate-900">{y}</option>
                                ))}
                            </GlassSelect>

                            {/* License Plate - Israeli Style Input */}
                            <div className="space-y-2">
                                <label className="text-sm text-slate-500 font-medium">לוחית רישוי</label>
                                <div className="flex items-stretch rounded-lg overflow-hidden shadow-lg">
                                    {/* Blue IL Strip - Static */}
                                    <div className="bg-[#003399] w-10 flex flex-col items-center justify-center shrink-0">
                                        <span className="text-[10px] text-white font-bold leading-none">🇮🇱</span>
                                        <span className="text-[11px] text-white font-bold leading-none mt-0.5">IL</span>
                                    </div>
                                    {/* Yellow Input Area */}
                                    <input
                                        type="text"
                                        required
                                        value={licensePlate}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, '');
                                            let max = 8;
                                            if (selectedYear && Number(selectedYear) <= 2016) {
                                                max = 7;
                                            }
                                            if (value.length <= max) {
                                                setLicensePlate(value);
                                            }
                                        }}
                                        placeholder="1234567"
                                        className="
                                            flex-1 px-4 py-3.5 bg-[#FFCC00]
                                            text-black text-center font-mono font-black text-2xl tracking-[0.15em]
                                            placeholder:text-yellow-700/40 placeholder:font-normal placeholder:text-base placeholder:tracking-normal
                                            outline-none border-0
                                            focus:ring-0
                                        "
                                        style={{
                                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.12), inset 0 -1px 3px rgba(255,255,255,0.3)'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Summary Badge */}
                            {selectedManufacturer && selectedModel && selectedYear && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center text-sm bg-cyan-500/10 text-cyan-300 p-4 rounded-xl border border-cyan-500/20 flex items-center justify-center gap-2"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    {selectedManufacturer} {selectedModel} ({selectedYear})
                                </motion.div>
                            )}

                            {/* Submit Button - Gradient with Glow & Hover Lift */}
                            <motion.button
                                type="submit"
                                disabled={loading}
                                whileHover={{ y: -2, scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                className="
                                    w-full mt-4 p-4 rounded-xl font-bold text-white
                                    bg-gradient-to-r from-blue-500 to-cyan-400
                                    hover:from-blue-400 hover:to-cyan-300
                                    shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50
                                    transition-all duration-300
                                    flex items-center justify-center gap-3
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                "
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        שומר נתונים...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        שמור רכב חדש
                                    </>
                                )}
                            </motion.button>
                        </form>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}