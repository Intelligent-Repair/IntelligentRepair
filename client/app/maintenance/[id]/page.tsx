'use client';

import { Trash, Lightbulb, Check, Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Wrench, Bell, Save, Droplets, Wind, Thermometer } from 'lucide-react';

// Interfaces
interface CatalogData {
    manufacturer: string;
    model: string;
    year: number;
}

interface RawVehicleData {
    id: string;
    license_plate: string;
    test_date: string | null;
    service_date: string | null;
    remind_oil_water: boolean;
    remind_tires: boolean;
    remind_winter: boolean;
    vehicle_catalog: CatalogData | CatalogData[] | null;
}

interface Vehicle {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    license_plate: string;
    test_date: string | null;
    service_date: string | null;
    remind_oil_water: boolean;
    remind_tires: boolean;
    remind_winter: boolean;
}

interface RemindersSnapshot {
    remind_oil_water: boolean;
    remind_tires: boolean;
    remind_winter: boolean;
}

interface Manual {
    tire_pressure_front: string;
    tire_pressure_rear: string;
    tire_instructions: string;
    oil_type: string;
    oil_instructions: string;
    coolant_type: string;
}

// ============ COMPONENTS ============

// Israeli License Plate Component - Realistic Style
// Supports both 8-digit (XXX-XX-XXX) and 7-digit (XX-XXX-XX) formats
const LicensePlate = ({ number }: { number: string }) => {
    // Format the license plate number with dots
    const formatPlateNumber = (num: string) => {
        const digits = num.replace(/\D/g, ''); // Remove non-digits
        if (digits.length === 8) {
            // New format: XXX·XX·XXX
            return `${digits.slice(0, 3)}·${digits.slice(3, 5)}·${digits.slice(5, 8)}`;
        } else if (digits.length === 7) {
            // Old format: XX·XXX·XX
            return `${digits.slice(0, 2)}·${digits.slice(2, 5)}·${digits.slice(5, 7)}`;
        }
        return num; // Return as-is if different length
    };

    return (
        <div
            className="flex items-stretch overflow-hidden w-fit"
            style={{
                borderRadius: '6px',
                border: '3px solid #1a1a1a',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
            }}
        >
            {/* Blue IL Section - Israeli Standard */}
            <div
                className="flex flex-col items-center justify-center px-2.5 py-1.5"
                style={{
                    background: 'linear-gradient(180deg, #0047AB 0%, #003399 100%)',
                    minWidth: '42px'
                }}
            >
                {/* Israeli Flag with Star of David */}
                <div className="flex flex-col items-center mb-0.5">
                    <div
                        className="w-6 h-4 flex items-center justify-center relative"
                        style={{
                            background: 'white',
                            border: '1px solid rgba(0,0,0,0.1)'
                        }}
                    >
                        {/* Blue stripes */}
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#0038b8]" />
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0038b8]" />
                        {/* Star of David */}
                        <span className="text-[8px] text-[#0038b8] leading-none">✡</span>
                    </div>
                </div>
                {/* IL text */}
                <span className="text-[11px] text-white font-black leading-none tracking-wider">IL</span>
                {/* Hebrew & Arabic */}
                <span className="text-[6px] text-white/90 leading-none mt-0.5">ישראל</span>
                <span className="text-[5px] text-white/80 leading-none" style={{ fontFamily: 'Arial' }}>إسرائيل</span>
            </div>

            {/* Yellow Plate Area */}
            <div
                className="flex items-center justify-center px-4 py-2"
                style={{
                    background: 'linear-gradient(180deg, #FFD700 0%, #FFCC00 50%, #FFB800 100%)',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.1)'
                }}
            >
                <span
                    className="font-black text-xl tracking-[0.08em]"
                    style={{
                        fontFamily: '"Arial Black", "Helvetica Neue", sans-serif',
                        color: '#1a1a1a',
                        textShadow: '0 1px 0 rgba(255,255,255,0.3)'
                    }}
                >
                    {formatPlateNumber(number)}
                </span>
            </div>
        </div>
    );
};

// Car Silhouette SVG (Top-Down View)
const CarSilhouette = () => (
    <svg viewBox="0 0 100 180" className="w-20 h-32 text-emerald-400/20" fill="currentColor">
        {/* Car body outline */}
        <path d="M25 30 Q25 20 35 15 L65 15 Q75 20 75 30 L75 150 Q75 165 65 170 L35 170 Q25 165 25 150 Z"
            stroke="currentColor" strokeWidth="2" fill="none" className="text-emerald-500/30" />
        {/* Windshield */}
        <path d="M30 35 L70 35 L65 55 L35 55 Z" className="text-emerald-400/10" />
        {/* Rear window */}
        <path d="M35 130 L65 130 L70 145 L30 145 Z" className="text-emerald-400/10" />
        {/* Front wheels */}
        <ellipse cx="20" cy="50" rx="8" ry="15" className="text-emerald-500/40" />
        <ellipse cx="80" cy="50" rx="8" ry="15" className="text-emerald-500/40" />
        {/* Rear wheels */}
        <ellipse cx="20" cy="135" rx="8" ry="15" className="text-emerald-500/40" />
        <ellipse cx="80" cy="135" rx="8" ry="15" className="text-emerald-500/40" />
    </svg>
);

// Oil Can Icon
const OilCanIcon = () => (
    <svg viewBox="0 0 24 24" className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M19 9l-7-4-7 4v10l7 4 7-4V9z" />
        <path d="M12 5v18" strokeDasharray="2 2" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <path d="M8 3h8l-2 2H10L8 3z" fill="currentColor" />
    </svg>
);

// ============ MAIN COMPONENT ============

export default function VehicleDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'technical' | 'reminders'>('technical');
    const [loading, setLoading] = useState(true);
    const [loadingManual, setLoadingManual] = useState(false);

    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [manual, setManual] = useState<Manual | null>(null);
    const [manualError, setManualError] = useState(false);
    const [initialReminders, setInitialReminders] = useState<RemindersSnapshot | null>(null);

    // Data loading
    useEffect(() => {
        const loadData = async () => {
            try {
                if (!id) return;

                const { data, error: vehicleError } = await supabase
                    .from("people_cars")
                    .select(`
                        *,
                        vehicle_catalog (
                            manufacturer,
                            model,
                            year
                        )
                    `)
                    .eq("id", id)
                    .single();

                if (vehicleError) throw vehicleError;

                if (data) {
                    const rawData = data as unknown as RawVehicleData;
                    const catalog = Array.isArray(rawData.vehicle_catalog)
                        ? rawData.vehicle_catalog[0]
                        : rawData.vehicle_catalog;

                    const formattedVehicle: Vehicle = {
                        id: rawData.id,
                        license_plate: rawData.license_plate,
                        test_date: rawData.test_date,
                        service_date: rawData.service_date,
                        remind_oil_water: rawData.remind_oil_water,
                        remind_tires: rawData.remind_tires,
                        remind_winter: rawData.remind_winter,
                        manufacturer: catalog?.manufacturer || "לא ידוע",
                        model: catalog?.model || "",
                        year: catalog?.year || 0,
                    };

                    setVehicle(formattedVehicle);
                    setInitialReminders({
                        remind_oil_water: formattedVehicle.remind_oil_water,
                        remind_tires: formattedVehicle.remind_tires,
                        remind_winter: formattedVehicle.remind_winter,
                    });

                    if (catalog?.model) {
                        await loadManualWithRetry(catalog.manufacturer, catalog.model, catalog.year);
                    }
                }
            } catch (error) {
                console.error("Error loading vehicle details:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [id]);

    const loadManualWithRetry = async (manufacturer: string, model: string, year: number, maxRetries = 3) => {
        setLoadingManual(true);
        setManualError(false);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const res = await fetch("/api/manuals/ensure", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ manufacturer, model, year }),
                });

                if (!res.ok) {
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                        continue;
                    }
                    throw new Error("שליפת ספר רכב נכשלה");
                }

                const json = await res.json();
                if (json.manual) {
                    setManual(json.manual);
                    setManualError(false);
                    setLoadingManual(false);
                    return;
                } else {
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
                        continue;
                    }
                }
            } catch (error) {
                if (attempt === maxRetries) {
                    setManualError(true);
                }
            }
        }
        setLoadingManual(false);
    };

    const retryLoadManual = () => {
        if (vehicle) {
            loadManualWithRetry(vehicle.manufacturer, vehicle.model, vehicle.year);
        }
    };

    const saveReminders = async () => {
        if (!vehicle) return;

        try {
            const nowIso = new Date().toISOString();
            const testDate = vehicle.test_date && vehicle.test_date.trim() !== "" ? vehicle.test_date : null;
            const serviceDate = vehicle.service_date && vehicle.service_date.trim() !== "" ? vehicle.service_date : null;
            const updates: Record<string, any> = {
                test_date: testDate,
                service_date: serviceDate,
                remind_oil_water: vehicle.remind_oil_water,
                remind_tires: vehicle.remind_tires,
                remind_winter: vehicle.remind_winter,
            };

            if (vehicle.remind_oil_water && initialReminders?.remind_oil_water === false) {
                updates.oil_water_started_at = nowIso;
                updates.oil_water_last_sent_at = null;
            }
            if (vehicle.remind_tires && initialReminders?.remind_tires === false) {
                updates.tires_started_at = nowIso;
                updates.tires_last_sent_at = null;
            }
            if (vehicle.remind_winter && initialReminders?.remind_winter === false) {
                updates.winter_last_sent_at = null;
            }

            const { error } = await supabase
                .from('people_cars')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
            setInitialReminders({
                remind_oil_water: vehicle.remind_oil_water,
                remind_tires: vehicle.remind_tires,
                remind_winter: vehicle.remind_winter,
            });
            alert('ההגדרות נשמרו בהצלחה! ✅');

        } catch (error) {
            console.error('saveReminders error:', error);
            alert('שגיאה בשמירה');
        }
    };

    const deleteVehicle = async () => {
        if (!confirm('האם אתה בטוח שברצונך למחוק את הרכב?')) return;

        try {
            const { error } = await supabase
                .from('people_cars')
                .delete()
                .eq('id', id);

            if (error) throw error;
            alert('הרכב נמחק בהצלחה.');
            window.location.href = '/maintenance';
        } catch (error) {
            console.error('שגיאה במחיקת רכב:', error);
            alert('שגיאה במחיקה');
        }
    };

    if (loading) return (
        <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#0a1628] via-[#0f1d32] to-[#0a1020]">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 shadow-2xl max-w-md w-full">
                {/* Platform Logo */}
                <div className="flex justify-center mb-8">
                    <img
                        src="/ffc53cfd-5750-4bfc-8fcf-eeaa1b241560.png"
                        alt="IntelligentRepair Logo"
                        className="w-36 h-36 object-contain animate-pulse"
                    />
                </div>
                <h2 className="text-xl font-bold text-white text-center mb-4">טוען את נתוני הרכב...</h2>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 via-blue-400 to-cyan-500 rounded-full animate-loading-bar"></div>
                </div>
            </div>
        </div>
    );

    if (!vehicle) return <div className="text-white text-center mt-20">רכב לא נמצא במערכת</div>;

    return (
        <div dir="rtl" className="min-h-screen p-6 text-white pb-24 bg-gradient-to-br from-[#0a1628] via-[#0f1d32] to-[#0a1020]">

            <Link href="/maintenance" className="inline-flex items-center text-cyan-400 hover:text-white mb-6 transition-colors">
                <ArrowRight className="w-5 h-5 ml-2" />
                חזרה לרשימה
            </Link>

            {/* ============ HERO HEADER ============ */}
            <header className="mb-8 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Vehicle Name & Year */}
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black text-white mb-2">
                            {vehicle.manufacturer} {vehicle.model}
                        </h1>
                        <div className="flex items-center gap-4">
                            <span className="bg-white/10 px-3 py-1 rounded-lg text-sm text-white/70">{vehicle.year}</span>
                        </div>
                    </div>
                    {/* License Plate */}
                    <LicensePlate number={vehicle.license_plate} />
                </div>

                {/* Segmented Control Tabs */}
                <div className="mt-6 flex justify-center">
                    <div className="inline-flex bg-black/30 backdrop-blur-sm rounded-full p-1 border border-white/10">
                        <button
                            onClick={() => setActiveTab('technical')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all duration-300 ${activeTab === 'technical'
                                ? 'bg-gradient-to-r from-cyan-500/80 to-blue-500/80 text-white shadow-lg shadow-cyan-500/30'
                                : 'text-white/50 hover:text-white/80'
                                }`}
                        >
                            <Wrench className="w-4 h-4" />
                            מידע טכני
                        </button>
                        <button
                            onClick={() => setActiveTab('reminders')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all duration-300 ${activeTab === 'reminders'
                                ? 'bg-gradient-to-r from-cyan-500/80 to-blue-500/80 text-white shadow-lg shadow-cyan-500/30'
                                : 'text-white/50 hover:text-white/80'
                                }`}
                        >
                            <Bell className="w-4 h-4" />
                            הגדרות
                        </button>
                    </div>
                </div>
            </header>

            {/* ============ CONTENT ============ */}
            <div className="max-w-4xl mx-auto">

                {/* TAB 1: Technical Info */}
                {activeTab === 'technical' && (
                    <div className="grid gap-6">
                        {loadingManual ? (
                            <div className="p-10 text-center bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-white/70">טוען מידע טכני...</p>
                                </div>
                            </div>
                        ) : !manual ? (
                            <div className="p-10 text-center bg-white/5 backdrop-blur-md rounded-2xl border border-dashed border-white/20">
                                <p className="text-white/50 mb-4">לא נמצא ספר רכב לדגם זה.</p>
                                <button
                                    onClick={retryLoadManual}
                                    className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-colors"
                                >
                                    נסה שוב
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* ===== TIRE PRESSURE - VISUAL COCKPIT ===== */}
                                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 overflow-hidden">
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-cyan-300">
                                        <Wind className="w-5 h-5" /> לחץ אוויר בצמיגים
                                    </h3>

                                    {/* Visual Car Diagram */}
                                    <div className="relative flex items-center justify-center py-6">
                                        {/* Front Pressure - Left */}
                                        <div className="absolute left-4 md:left-12 top-4 text-center">
                                            <span className="block text-xs text-white/50 mb-1">קדמי</span>
                                            <div className="flex items-center gap-1 justify-center">
                                                <Check className="w-4 h-4 text-emerald-400" />
                                                <span className="text-3xl md:text-4xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">
                                                    {manual.tire_pressure_front || '--'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Car Silhouette */}
                                        <CarSilhouette />

                                        {/* Rear Pressure - Right */}
                                        <div className="absolute right-4 md:right-12 bottom-4 text-center">
                                            <span className="block text-xs text-white/50 mb-1">אחורי</span>
                                            <div className="flex items-center gap-1 justify-center">
                                                <Check className="w-4 h-4 text-emerald-400" />
                                                <span className="text-3xl md:text-4xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">
                                                    {manual.tire_pressure_rear || '--'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Connecting Lines (subtle) */}
                                        <div className="absolute left-1/4 top-1/4 w-8 h-px bg-gradient-to-r from-cyan-500/50 to-transparent"></div>
                                        <div className="absolute right-1/4 bottom-1/4 w-8 h-px bg-gradient-to-l from-cyan-500/50 to-transparent"></div>
                                    </div>

                                    {/* Pro Tip - Insight Strip */}
                                    <div className="mt-4 flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                                        <Lightbulb className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                                        <p className="text-sm text-yellow-200/90">
                                            {manual.tire_instructions || 'מלא אוויר כשהצמיגים קרים למדידה מדויקת.'}
                                        </p>
                                    </div>
                                </div>

                                {/* ===== FLUIDS & OILS - GRID LAYOUT ===== */}
                                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-emerald-300">
                                        <Droplets className="w-5 h-5" /> נוזלים ושמנים
                                    </h3>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        {/* Card 1: Engine Oil */}
                                        <div className="bg-white/5 rounded-xl p-5 border border-white/5 transition-transform duration-200 hover:scale-105">
                                            <div className="flex items-start gap-4">
                                                <div className="p-3 bg-amber-500/10 rounded-xl">
                                                    <OilCanIcon />
                                                </div>
                                                <div className="flex-1">
                                                    <span className="text-xs text-white/50 block mb-2">שמן מנוע מומלץ</span>
                                                    <div className="inline-block px-4 py-2 bg-black/30 border border-amber-500/30 rounded-lg">
                                                        <span className="text-xl font-mono font-bold text-amber-300">
                                                            {manual.oil_type || 'לא צוין'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-white/40 mt-2 leading-relaxed">
                                                        {manual.oil_instructions || 'החלף בהתאם להמלצות היצרן.'}
                                                    </p>
                                                    {/* Oil Life Progress Bar */}
                                                    <div className="mt-4">
                                                        <div className="flex justify-between text-[10px] text-white/40 mb-1">
                                                            <span>Oil Life</span>
                                                            <span>70%</span>
                                                        </div>
                                                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                            <div className="h-full w-[70%] bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card 2: Coolant */}
                                        <div className="bg-white/5 rounded-xl p-5 border border-white/5 transition-transform duration-200 hover:scale-105">
                                            <div className="flex items-start gap-4">
                                                <div className="p-3 bg-blue-500/10 rounded-xl">
                                                    <Thermometer className="w-10 h-10 text-blue-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-xs text-white/50 block mb-2">נוזל קירור</span>
                                                    <div className="inline-block px-3 py-2 bg-black/30 border border-blue-500/30 rounded-lg max-w-full">
                                                        <span className="text-sm font-mono font-bold text-blue-300 break-words">
                                                            {manual.coolant_type || 'לא צוין'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-white/40 mt-3">
                                                        בדוק רמה בעת שהמנוע קר.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* TAB 2: Reminders */}
                {activeTab === 'reminders' && (
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-6">

                        {/* Date Inputs - Glass Cards */}
                        <div className="grid md:grid-cols-2 gap-4">
                            {/* Next Test Date */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 focus-within:border-cyan-500/50 focus-within:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all">
                                <div className="p-3 bg-cyan-500/10 rounded-xl">
                                    <Calendar className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-white/50 mb-1">תאריך טסט הבא</label>
                                    <input
                                        type="date"
                                        className="w-full bg-transparent border-none text-xl font-bold text-white focus:outline-none"
                                        value={vehicle.test_date || ''}
                                        onChange={(e) => setVehicle({ ...vehicle, test_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Next Service Date */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 focus-within:border-cyan-500/50 focus-within:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all">
                                <div className="p-3 bg-emerald-500/10 rounded-xl">
                                    <Wrench className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-white/50 mb-1">תאריך טיפול הבא</label>
                                    <input
                                        type="date"
                                        className="w-full bg-transparent border-none text-xl font-bold text-white focus:outline-none"
                                        value={vehicle.service_date || ''}
                                        onChange={(e) => setVehicle({ ...vehicle, service_date: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Active Reminders Section */}
                        <div className="pt-4 border-t border-white/10">
                            <h3 className="font-bold text-white/90 mb-4 flex items-center gap-2">
                                <Bell className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
                                תזכורות פעילות
                            </h3>

                            <div className="space-y-3">
                                {/* Reminder 1: Oil & Water */}
                                <div
                                    className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.08] transition-all"
                                    onClick={() => setVehicle({ ...vehicle, remind_oil_water: !vehicle.remind_oil_water })}
                                >
                                    <span className="flex items-center gap-3">
                                        <Droplets className="w-5 h-5 text-blue-400 drop-shadow-[0_0_6px_rgba(96,165,250,0.5)]" />
                                        <span className="text-white/90">בדיקת שמן ומים (כל שבועיים)</span>
                                    </span>
                                    {/* Toggle Switch */}
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={vehicle.remind_oil_water}
                                        className={`relative w-12 h-6 rounded-full transition-all duration-300 ${vehicle.remind_oil_water
                                            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                                            : 'bg-slate-600'
                                            }`}
                                    >
                                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${vehicle.remind_oil_water ? 'right-0.5' : 'left-0.5'
                                            }`} />
                                    </button>
                                </div>

                                {/* Reminder 2: Tire Pressure */}
                                <div
                                    className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.08] transition-all"
                                    onClick={() => setVehicle({ ...vehicle, remind_tires: !vehicle.remind_tires })}
                                >
                                    <span className="flex items-center gap-3">
                                        <Wind className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                                        <span className="text-white/90">בדיקת לחץ אוויר (כל שבועיים)</span>
                                    </span>
                                    {/* Toggle Switch */}
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={vehicle.remind_tires}
                                        className={`relative w-12 h-6 rounded-full transition-all duration-300 ${vehicle.remind_tires
                                            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                                            : 'bg-slate-600'
                                            }`}
                                    >
                                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${vehicle.remind_tires ? 'right-0.5' : 'left-0.5'
                                            }`} />
                                    </button>
                                </div>

                                {/* Reminder 3: Winter */}
                                <div
                                    className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.08] transition-all"
                                    onClick={() => setVehicle({ ...vehicle, remind_winter: !vehicle.remind_winter })}
                                >
                                    <span className="flex items-center gap-3">
                                        <Thermometer className="w-5 h-5 text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.5)]" />
                                        <span className="text-white/90">תזכורת חורף (1 בנובמבר)</span>
                                    </span>
                                    {/* Toggle Switch */}
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={vehicle.remind_winter}
                                        className={`relative w-12 h-6 rounded-full transition-all duration-300 ${vehicle.remind_winter
                                            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                                            : 'bg-slate-600'
                                            }`}
                                    >
                                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${vehicle.remind_winter ? 'right-0.5' : 'left-0.5'
                                            }`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Save Button - Primary Action */}
                        <button
                            onClick={saveReminders}
                            className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            <Save className="w-5 h-5" />
                            שמור הגדרות
                        </button>

                        {/* Delete Button - Danger Zone */}
                        <button
                            onClick={deleteVehicle}
                            className="w-full mt-2 bg-transparent hover:bg-red-500/20 text-red-400 font-bold py-3 px-6 rounded-xl border border-red-500/50 hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            <Trash className="w-5 h-5" />
                            מחק רכב
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}