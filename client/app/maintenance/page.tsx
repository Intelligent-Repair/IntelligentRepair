'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Car, Calendar, ArrowLeft, Home } from 'lucide-react';

// 1. הגדרת המבנה של המידע בטבלת הקטלוג
interface VehicleCatalog {
    manufacturer: string;
    model: string;
    year: number;
}

// 2. הגדרת המבנה הגולמי שמגיע מ-Supabase (כולל הקינון)
// זה מחליף את ה-any ומגדיר בדיוק מה מגיע מהשאילתה
interface RawDatabaseRow {
    id: string;
    license_plate: string;
    test_date?: string | null;
    // כאן אנחנו אומרים ל-TS שזה יכול להיות אובייקט (אם נמצא רכב) או null
    // או מערך (במקרים מסוימים של הגדרות Supabase)
    vehicle_catalog: VehicleCatalog | VehicleCatalog[] | null;
}

// 3. הממשק של הרכב הסופי שמוצג באפליקציה (שטוח ונוח לשימוש)
interface Vehicle {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    license_plate: string;
    test_date?: string | null;
}

export default function MaintenancePage() {
    const router = useRouter();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. קבלת המשתמש הנוכחי
                const { data: { user }, error: authError } = await supabase.auth.getUser();

                if (authError || !user) {
                    router.push('/login');
                    return;
                }

                // 2. עדכון שם המשתמש
                const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'חבר';
                setUserName(name);

                // 3. משיכת הרכבים
                const { data, error: vehiclesError } = await supabase
                    .from('people_cars')
                    .select(`
                        id,
                        license_plate,
                        test_date,
                        vehicle_catalog (
                            manufacturer,
                            model,
                            year
                        )
                    `)
                    .eq('user_id', user.id);

                if (vehiclesError) {
                    console.error('Error fetching vehicles:', vehiclesError);
                } else {
                    // המרה בטוחה: אנחנו אומרים ל-TS להתייחס למידע כרשימה של RawDatabaseRow
                    // השימוש ב-unknown הוא טכניקה בטוחה יותר מ-any להמרה יזומה
                    const rawData = data as unknown as RawDatabaseRow[];

                    const formattedVehicles: Vehicle[] = rawData.map((row) => {
                        // טיפול במקרה ש-vehicle_catalog הוא מערך (קורה לפעמים ב-Joins)
                        const catalogItem = Array.isArray(row.vehicle_catalog)
                            ? row.vehicle_catalog[0]
                            : row.vehicle_catalog;

                        return {
                            id: row.id, // זה ה-ID שנשלח לדף הבא
                            license_plate: row.license_plate,
                            test_date: row.test_date,

                            // שימוש בנתונים מהקטלוג אם קיימים
                            manufacturer: catalogItem?.manufacturer || 'לא ידוע',
                            model: catalogItem?.model || '',
                            year: catalogItem?.year || 0,
                        };
                    });

                    setVehicles(formattedVehicles);
                }

            } catch (error) {
                console.error('Unexpected error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [router]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-white">טוען נתונים...</div>;
    }

    return (
        <div dir="rtl" className="min-h-screen p-8 text-white relative">

            {/* כפתור חזרה לאזור האישי */}
            <div className="absolute top-6 right-6">
                <Link href="/user" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors bg-white/10 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 hover:bg-white/20">
                    <Home className="w-4 h-4" />
                    <span>חזרה לאזור האישי</span>
                </Link>
            </div>

            {/* כותרת */}
            <header className="max-w-6xl mx-auto mb-10 mt-16 pr-2">
                <h1 className="text-5xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-l from-blue-400 to-white leading-tight">
                    המוסך שלי 🚗
                </h1>
                <p className="text-white/60 text-xl font-light">
                    שלום <span className="text-blue-300 font-medium">{userName}</span>, כאן מנהלים את התחזוקה בראש שקט.
                </p>
            </header>

            <main className="max-w-6xl mx-auto pb-24">

                {/* רשימת הרכבים */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
                    {vehicles.map((vehicle) => (
                        <Link key={vehicle.id} href={`/maintenance/${vehicle.id}`}>
                            <div className="
                                group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-7
                                hover:bg-white/10 hover:border-blue-500/30 hover:-translate-y-2 transition-all duration-300 shadow-lg cursor-pointer
                            ">
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <h2 className="text-3xl font-bold text-white mb-3 group-hover:text-blue-300 transition-colors">
                                            {vehicle.manufacturer} {vehicle.model}
                                        </h2>
                                        <div className="inline-block bg-black/40 px-3 py-1.5 rounded-xl text-white/80 font-mono text-sm border border-white/5 shadow-inner tracking-widest">
                                            {vehicle.license_plate} 🇮🇱
                                        </div>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-2xl group-hover:bg-blue-600/20 transition-colors">
                                        <Car className="w-9 h-9 text-white/70 group-hover:text-blue-400 scale-x-[-1]" />
                                    </div>
                                </div>

                                <div className="border-t border-white/10 pt-5 flex justify-between items-center text-sm text-white/50">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        <span>מודל {vehicle.year}</span>
                                    </div>
                                    <div className="flex items-center text-blue-400 font-medium opacity-80 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                        לפרטים ותחזוקה
                                        <ArrowLeft className="w-4 h-4 mr-1" />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* הודעה אם אין רכבים */}
                {!loading && vehicles.length === 0 && (
                    <div className="text-center py-16 mb-8 rounded-3xl bg-white/5 border border-white/5 border-dashed">
                        <Car className="w-16 h-16 text-white/20 mx-auto mb-4 scale-x-[-1]" />
                        <p className="text-white/40 text-xl">החניה ריקה. זה הזמן להוסיף רכב!</p>
                    </div>
                )}

                {/* כפתור הוספה למטה */}
                <Link href="/maintenance/add">
                    <div className="
                        group p-8 rounded-3xl border border-dashed border-white/20 bg-gradient-to-r from-white/5 to-white/0
                        hover:bg-white/10 hover:border-blue-400/40 backdrop-blur-sm transition-all duration-300 cursor-pointer
                        flex flex-col items-center justify-center gap-4
                    ">
                        <div className="bg-blue-600/20 p-4 rounded-full group-hover:bg-blue-500 group-hover:scale-110 group-hover:rotate-90 transition-all duration-500 shadow-lg">
                            <Plus className="w-8 h-8 text-blue-400 group-hover:text-white" />
                        </div>
                        <span className="text-xl font-medium text-white/70 group-hover:text-white transition-colors">
                            לחץ להוספת רכב חדש
                        </span>
                    </div>
                </Link>

            </main>
        </div>
    );
}