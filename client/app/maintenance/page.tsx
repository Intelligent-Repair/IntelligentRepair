'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { Plus, Car, Calendar, ArrowLeft } from 'lucide-react';

interface Vehicle {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    license_plate: string;
    remind_test?: boolean;
    remind_oil?: boolean;
}

export default function MaintenancePage() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    // שליפת שם המשתמש
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('first_name')
                        .eq('id', user.id)
                        .single();

                    if (profile?.first_name) {
                        setUserName(profile.first_name);
                    } else if (user.email) {
                        setUserName(user.email.split('@')[0]);
                    }

                    // שליפת הרכבים
                    const { data: vehiclesData } = await supabase
                        .from('vehicles')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .returns<Vehicle[]>();

                    if (vehiclesData) setVehicles(vehiclesData);
                }
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return (
        // הרקע הכללי (כהה/שקוף)
        <div dir="rtl" className="min-h-screen p-8 text-white">

            {/* כותרת יפה ונקייה */}
            <header className="max-w-5xl mx-auto mb-10 mt-4 text-center">
                <h1 className="text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-l from-blue-400 to-white">
                    המוסך שלי 🚗
                </h1>
                <p className="text-white/60 text-lg">
                    שלום <span className="text-blue-300 font-bold">{userName || 'אורח'}</span>, הנה הרכבים שלך.
                </p>
            </header>

            <main className="max-w-5xl mx-auto pb-20">

                {loading && (
                    <div className="flex justify-center mt-10 mb-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                )}

                {/* --- 1. רשימת הרכבים (עכשיו למעלה) --- */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-10">
                    {vehicles.map((vehicle) => (
                        <Link key={vehicle.id} href={`/maintenance/${vehicle.id}`}>
                            <div className="
                group
                relative
                overflow-hidden
                rounded-2xl
                border border-white/10
                bg-white/5
                backdrop-blur-md
                p-6
                hover:border-blue-500/50
                hover:shadow-[0_0_30px_-10px_rgba(59,130,246,0.5)]
                transition-all duration-300
                shadow-xl cursor-pointer
              ">

                                {/* אפקט רקע עדין בהובר */}
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-blue-600/0 group-hover:to-blue-600/10 transition-all" />

                                <div className="relative z-10 flex justify-between items-start">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-2">
                                            {vehicle.manufacturer} {vehicle.model}
                                        </h2>
                                        <div className="inline-block bg-black/30 border border-white/10 px-3 py-1 rounded-lg text-white/80 font-mono text-sm tracking-wider">
                                            {vehicle.license_plate} 🇮🇱
                                        </div>
                                    </div>
                                    <div className="bg-white/10 p-2 rounded-lg">
                                        {/* הוספתי פה בסוף את scale-x-[-1] כדי להפוך את המכונית */}
                                        <Car className="w-8 h-8 text-blue-400 scale-x-[-1]" />
                                    </div>
                                </div>

                                <div className="relative z-10 mt-8 pt-4 border-t border-white/10 flex justify-between items-center text-sm text-white/60">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 ml-1" />
                                        <span>שנת {vehicle.year}</span>
                                    </div>
                                    <div className="flex items-center text-blue-400 font-medium group-hover:text-blue-300 group-hover:translate-x-1 transition-all">
                                        כניסה לרכב
                                        <ArrowLeft className="w-4 h-4 mr-1" />
                                    </div>
                                </div>

                            </div>
                        </Link>
                    ))}
                </div>

                {/* הודעה אם אין רכבים (רק למקרה חירום) */}
                {!loading && vehicles.length === 0 && (
                    <div className="text-center py-8 mb-8 rounded-2xl bg-white/5 border border-white/10">
                        <p className="text-white/50 text-lg">המוסך שלך ריק כרגע.</p>
                    </div>
                )}

                {/* --- 2. כפתור הוספת רכב (עכשיו למטה) --- */}
                <Link href="/maintenance/add">
                    <div className="
            group
            p-6
            rounded-2xl
            border border-dashed border-white/20
            bg-white/5 hover:bg-white/10
            backdrop-blur-sm
            transition-all duration-300
            cursor-pointer
            flex items-center justify-center
            gap-4
            hover:border-blue-400/50
          ">
                        <div className="bg-blue-600/20 p-3 rounded-full group-hover:bg-blue-500 group-hover:scale-110 transition-all shadow-lg">
                            <Plus className="w-6 h-6 text-blue-400 group-hover:text-white" />
                        </div>
                        <span className="text-xl font-medium text-white/80 group-hover:text-white">
                            הוסף רכב חדש לאוסף
                        </span>
                    </div>
                </Link>

            </main>
        </div>
    );
}