'use client';

import { Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Wrench, Bell, Save, Droplets, Wind, Thermometer, Calendar } from 'lucide-react';

// 1. הגדרת הממשקים (Interfaces) בצורה מדויקת
interface CatalogData {
    manufacturer: string;
    model: string;
    year: number;
}

// המבנה הגולמי שמגיע מ-Supabase ב-Join
interface RawVehicleData {
    id: string;
    license_plate: string;
    test_date: string | null;
    service_date: string | null;
    remind_oil_water: boolean;
    remind_tires: boolean;
    remind_winter: boolean;
    // האובייקט המקושר
    vehicle_catalog: CatalogData | CatalogData[] | null;
}

// המבנה הסופי והנוח לשימוש בקומפוננטה
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
    // car_model?: string; <-- מיותר
    tire_pressure_front: string;
    tire_pressure_rear: string;
    tire_instructions: string;
    oil_type: string;
    oil_instructions: string;
    coolant_type: string;
}


export default function VehicleDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'technical' | 'reminders'>('technical');
    const [loading, setLoading] = useState(true);

    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [manual, setManual] = useState<Manual | null>(null);
    const [initialReminders, setInitialReminders] = useState<RemindersSnapshot | null>(null);

    // טעינת נתונים
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

                    // חיפוש ספר רכב
                    if (catalog?.model) {
                        try {
                            const res = await fetch("/api/manuals/ensure", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    manufacturer: catalog.manufacturer,
                                    model: catalog.model,
                                    year: catalog.year,
                                }),
                            });

                            if (!res.ok) {
                                const text = await res.text();
                                console.error("API /manuals/ensure נכשל:", text);
                                throw new Error("שליפת ספר רכב נכשלה");
                            }

                            const json = await res.json();
                            if (json.manual) setManual(json.manual);
                        } catch (error) {
                            console.error("Error loading manual:", error);
                        }
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

    // שמירת תזכורות
    const saveReminders = async () => {
        if (!vehicle) return;

        try {
            const nowIso = new Date().toISOString();
            const updates: Record<string, any> = {
                test_date: vehicle.test_date,
                service_date: vehicle.service_date,
                // טסט/טיפול נחשבים פעילים אם יש תאריך
                remind_test: !!vehicle.test_date,
                remind_service: !!vehicle.service_date,
                remind_oil_water: vehicle.remind_oil_water,
                remind_tires: vehicle.remind_tires,
                remind_winter: vehicle.remind_winter,
            };

            // כאשר מפעילים תזכורת – לאתחל ספירה ולהפסיק היסטוריית שליחה
            if (vehicle.remind_oil_water && initialReminders?.remind_oil_water === false) {
                updates.oil_water_started_at = nowIso;
                updates.oil_water_last_sent_at = null;
            }
            if (vehicle.remind_tires && initialReminders?.remind_tires === false) {
                updates.tires_started_at = nowIso;
                updates.tires_last_sent_at = null;
            }
            if (vehicle.remind_winter && initialReminders?.remind_winter === false) {
                // אין started_at לחורף, מאפסים רק חותמת שליחה שנתית
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
            const errorMessage = error instanceof Error ? error.message : 'שגיאה לא ידועה';
            alert('שגיאה: ' + errorMessage);
        }
    };
    const deleteVehicle = async () => {
        if (!confirm('האם אתה בטוח שברצונך למחוק את הרכב? פעולה זו לא ניתנת לביטול.')) return;

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
            alert('שגיאה במחיקה, נסה שוב.');
        }
    };

    if (loading) return <div className="text-white text-center mt-20">טוען פרטי רכב...</div>;
    if (!vehicle) return <div className="text-white text-center mt-20">רכב לא נמצא במערכת</div>;

    return (
        <div dir="rtl" className="min-h-screen p-6 text-white pb-24">

            <Link href="/maintenance" className="inline-flex items-center text-blue-300 hover:text-white mb-6">
                <ArrowRight className="w-5 h-5 ml-2" />
                חזרה לרשימה
            </Link>

            {/* כותרת הרכב */}
            <header className="mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">
                    {vehicle.manufacturer} {vehicle.model}
                </h1>
                <div className="flex items-center gap-4 text-white/60">
                    <span className="bg-white/10 px-3 py-1 rounded-lg text-sm">{vehicle.year}</span>
                    <span className="font-mono tracking-widest">{vehicle.license_plate}</span>
                </div>
            </header>

            {/* טאבים */}
            <div className="flex gap-4 mb-8 border-b border-white/10 pb-4">
                <button
                    onClick={() => setActiveTab('technical')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full transition-all ${activeTab === 'technical'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                        : 'text-white/50 hover:bg-white/5'
                        }`}
                >
                    <Wrench className="w-4 h-4" />
                    מידע טכני
                </button>
                <button
                    onClick={() => setActiveTab('reminders')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full transition-all ${activeTab === 'reminders'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                        : 'text-white/50 hover:bg-white/5'
                        }`}
                >
                    <Bell className="w-4 h-4" />
                    הגדרות ותזכורות
                </button>
            </div>

            {/* תוכן הטאבים */}
            <div className="max-w-3xl">

                {/* טאב 1: מידע טכני */}
                {activeTab === 'technical' && (
                    <div className="grid gap-6">
                        {!manual ? (
                            <div className="p-10 text-center bg-white/5 rounded-2xl border border-dashed border-white/20">
                                <p className="text-white/50">לא נמצא ספר רכב לדגם זה במערכת.</p>
                            </div>
                        ) : (
                            <>
                                {/* לחץ אוויר */}
                                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-300">
                                        <Wind className="w-5 h-5" /> לחץ אוויר
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-black/20 p-4 rounded-xl text-center">
                                            <span className="block text-sm text-gray-400">קדמי</span>
                                            <span className="text-2xl font-bold">{manual.tire_pressure_front || '--'}</span>
                                        </div>
                                        <div className="bg-black/20 p-4 rounded-xl text-center">
                                            <span className="block text-sm text-gray-400">אחורי</span>
                                            <span className="text-2xl font-bold">{manual.tire_pressure_rear || '--'}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-white/60 bg-blue-900/20 p-3 rounded-lg border border-blue-500/20">
                                        💡 {manual.tire_instructions || 'מלא אוויר כשהצמיגים קרים.'}
                                    </p>
                                </div>

                                {/* שמן ונוזלים */}
                                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-300">
                                        <Droplets className="w-5 h-5" /> נוזלים ושמנים
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <span className="text-gray-400 text-sm block mb-1">שמן מנוע מומלץ:</span>
                                            <div className="text-lg font-mono bg-black/20 p-2 rounded-lg inline-block border border-white/5">
                                                {manual.oil_type || 'לא צוין'}
                                            </div>
                                            <p className="text-sm text-white/50 mt-1">{manual.oil_instructions}</p>
                                        </div>
                                        <div className="border-t border-white/10 pt-4">
                                            <span className="text-gray-400 text-sm block mb-1">נוזל קירור:</span>
                                            <div className="text-lg font-mono bg-black/20 p-2 rounded-lg inline-block border border-white/5">
                                                {manual.coolant_type || 'לא צוין'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* טאב 2: תזכורות */}
                {activeTab === 'reminders' && (
                    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-6">

                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">תאריך טסט הבא</label>
                                <input
                                    type="date"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white"
                                    value={vehicle.test_date || ''}
                                    onChange={(e) => setVehicle({ ...vehicle, test_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">תאריך טיפול הבא</label>
                                <input
                                    type="date"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white"
                                    value={vehicle.service_date || ''}
                                    onChange={(e) => setVehicle({ ...vehicle, service_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-white/10">
                            <h3 className="font-bold text-gray-300">הגדרות תזכורות אוטומטיות</h3>

                            <label className="flex items-center justify-between bg-white/5 p-4 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                                <span className="flex items-center gap-3">
                                    <Droplets className="w-5 h-5 text-blue-400" />
                                    בדיקת שמן ומים (כל שבועיים)
                                </span>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 accent-blue-600"
                                    checked={vehicle.remind_oil_water || false}
                                    onChange={(e) => setVehicle({ ...vehicle, remind_oil_water: e.target.checked })}
                                />
                            </label>

                            <label className="flex items-center justify-between bg-white/5 p-4 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                                <span className="flex items-center gap-3">
                                    <Wind className="w-5 h-5 text-green-400" />
                                    בדיקת לחץ אוויר (כל שבועיים)
                                </span>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 accent-blue-600"
                                    checked={vehicle.remind_tires || false}
                                    onChange={(e) => setVehicle({ ...vehicle, remind_tires: e.target.checked })}
                                />
                            </label>

                            <label className="flex items-center justify-between bg-white/5 p-4 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                                <span className="flex items-center gap-3">
                                    <Thermometer className="w-5 h-5 text-orange-400" />
                                    תזכורת חורף (1 בנובמבר)
                                </span>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 accent-blue-600"
                                    checked={vehicle.remind_winter || false}
                                    onChange={(e) => setVehicle({ ...vehicle, remind_winter: e.target.checked })}
                                />
                            </label>
                        </div>

                        <button
                            onClick={saveReminders}
                            className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Save className="w-5 h-5" />
                            שמור הגדרות
                        </button>
                        <button
                            onClick={deleteVehicle}
                            className="w-full mt-4 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
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