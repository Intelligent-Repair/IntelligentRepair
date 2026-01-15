"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Car, Plus, ChevronLeft } from "lucide-react";
import { createClientSupabase } from "@/lib/supabaseClient";

interface VehicleCatalog {
    manufacturer: string | null;
    model: string | null;
    year: number | null;
}

interface Vehicle {
    id: string;
    license_plate: string | null;
    manufacturer: string;
    model: string;
    year: number | null;
}

// Brand Emblem Component - Etched Monogram Emblem style
const BrandEmblem = ({ brand }: { brand: string }) => {
    const getBrandInitial = (b: string) => {
        const lowerBrand = b.toLowerCase();
        if (lowerBrand.includes('toyota')) return 'T';
        if (lowerBrand.includes('volkswagen') || lowerBrand.includes('vw')) return 'VW';
        if (lowerBrand.includes('mazda')) return 'M';
        if (lowerBrand.includes('honda')) return 'H';
        if (lowerBrand.includes('hyundai')) return 'H';
        if (lowerBrand.includes('kia')) return 'K';
        if (lowerBrand.includes('mercedes')) return 'MB';
        if (lowerBrand.includes('bmw')) return 'BMW';
        if (lowerBrand.includes('audi')) return 'A';
        if (lowerBrand.includes('ford')) return 'F';
        if (lowerBrand.includes('chevrolet')) return 'C';
        if (lowerBrand.includes('nissan')) return 'N';
        if (lowerBrand.includes('subaru')) return 'S';
        if (lowerBrand.includes('mitsubishi')) return 'M';
        return b.charAt(0).toUpperCase();
    };

    const initial = getBrandInitial(brand);
    // Adjust font size based on character count - larger for premium look
    const fontSize = initial.length > 2 ? 'text-4xl' : initial.length > 1 ? 'text-5xl' : 'text-6xl';

    return (
        <div
            className="absolute -left-10 top-1/2 pointer-events-none select-none"
            style={{ transform: 'translateY(-50%) rotate(-12deg)' }}
        >
            {/* Large Emblem Container */}
            <div
                className="w-32 h-32 rounded-full flex items-center justify-center"
                style={{
                    background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)',
                    border: '2px solid rgba(255,255,255,0.08)',
                    boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.02)'
                }}
            >
                {/* Inner decorative ring */}
                <div
                    className="w-28 h-28 rounded-full flex items-center justify-center"
                    style={{
                        border: '1px solid rgba(255,255,255,0.05)',
                        boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.4)'
                    }}
                >
                    {/* The Letter - Premium serif typography */}
                    <span
                        className={`${fontSize} font-black tracking-tight`}
                        style={{
                            fontFamily: 'Georgia, "Times New Roman", serif',
                            color: 'rgba(255,255,255,0.08)',
                            textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 0 40px rgba(255,255,255,0.03)'
                        }}
                    >
                        {initial}
                    </span>
                </div>
            </div>
        </div>
    );
};

// Israeli License Plate Component - Compact with inset shadow
const LicensePlate = ({ number }: { number: string }) => (
    <div className="flex items-stretch rounded overflow-hidden shadow-lg w-fit">
        {/* Blue IL Strip */}
        <div className="bg-[#003399] px-1.5 py-1 flex flex-col items-center justify-center">
            <span className="text-[7px] text-white font-bold leading-none">🇮🇱</span>
            <span className="text-[8px] text-white font-bold leading-none mt-0.5">IL</span>
        </div>
        {/* Yellow Plate with inset shadow */}
        <div
            className="bg-[#FFCC00] px-3 py-1.5 flex items-center justify-center"
            style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15), inset 0 -1px 2px rgba(255,255,255,0.3)' }}
        >
            <span className="text-black font-mono font-black text-base tracking-[0.12em]">
                {number}
            </span>
        </div>
    </div>
);

export default function MaintenancePage() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            const supabase = createClientSupabase();

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: userData } = await supabase
                    .from("users")
                    .select("first_name")
                    .eq("id", user.id)
                    .single();

                if (userData && userData.first_name) {
                    setUserName(userData.first_name);
                } else {
                    setUserName(user.email?.split("@")[0] || "אורח");
                }

                const { data: vehiclesData, error } = await supabase
                    .from("people_cars")
                    .select(`
                        id,
                        license_plate,
                        vehicle_catalog:vehicle_catalog_id (
                            manufacturer,
                            model,
                            year
                        )
                    `)
                    .eq("user_id", user.id);

                if (vehiclesData && !error) {
                    const transformedVehicles: Vehicle[] = vehiclesData.map((car: any) => {
                        const catalog: VehicleCatalog = Array.isArray(car.vehicle_catalog)
                            ? car.vehicle_catalog[0] || {}
                            : car.vehicle_catalog || {};
                        return {
                            id: car.id,
                            license_plate: car.license_plate,
                            manufacturer: catalog.manufacturer || "",
                            model: catalog.model || "",
                            year: catalog.year,
                        };
                    });
                    setVehicles(transformedVehicles);
                }
            }
            setLoading(false);
        };

        fetchData();
    }, []);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    };

    return (
        <div dir="rtl" className="min-h-screen bg-[#0a0f1a] relative overflow-x-hidden text-slate-200">

            {/* Radial Gradient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/8 rounded-full blur-[150px]" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px]" />
            </div>

            {/* Main Container */}
            <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-12">

                {/* Header Section */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-10"
                >
                    <div className="flex items-center justify-center gap-3 mb-3">
                        <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/30">
                            <Car size={32} className="text-white" />
                        </div>
                        <h1 className="text-4xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                            המוסך שלי
                        </h1>
                    </div>
                    <p className="text-slate-400 text-lg">
                        שלום {userName}, כאן תוכל לנהל את הרכבים שלך
                    </p>
                </motion.div>

                {/* Vehicle Cards Grid */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                    </div>
                ) : vehicles.length > 0 ? (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
                    >
                        {vehicles.map((vehicle) => (
                            <motion.div key={vehicle.id} variants={itemVariants}>
                                <Link href={`/maintenance/${vehicle.id}`} className="block">
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        transition={{ type: "spring", stiffness: 300 }}
                                        className="relative cursor-pointer rounded-2xl bg-white/[0.03] backdrop-blur-md border-t border-white/10 border-x border-b border-white/5 hover:border-cyan-500/30 hover:shadow-[0_8px_32px_rgba(6,182,212,0.12)] transition-all duration-300 p-5 group overflow-hidden"
                                    >
                                        {/* Brand Emblem - Etched monogram on LEFT */}
                                        <BrandEmblem brand={vehicle.manufacturer} />

                                        {/* Content - Aligned to RIGHT (start in RTL) */}
                                        <div className="relative z-10 flex items-start justify-between">
                                            {/* Information Block - Vertically aligned */}
                                            <div className="flex flex-col gap-3">
                                                {/* Car Name + Year Tag */}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-lg font-bold text-white">
                                                        {vehicle.manufacturer} {vehicle.model}
                                                    </h3>
                                                    {vehicle.year && (
                                                        <span className="text-[10px] bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded">
                                                            {vehicle.year}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* License Plate - Below name */}
                                                {vehicle.license_plate && (
                                                    <LicensePlate number={vehicle.license_plate} />
                                                )}
                                            </div>

                                            {/* Arrow - Shows clickability */}
                                            <ChevronLeft size={18} className="text-slate-600 group-hover:text-cyan-400 group-hover:-translate-x-1 transition-all mt-1" />
                                        </div>
                                    </motion.div>
                                </Link>
                            </motion.div>
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12 mb-8"
                    >
                        <div className="p-4 bg-slate-800/50 rounded-full w-fit mx-auto mb-4">
                            <Car size={40} className="text-slate-500" />
                        </div>
                        <p className="text-slate-400 text-lg">עדיין לא הוספת רכבים</p>
                        <p className="text-slate-500 text-sm">הוסף רכב חדש כדי להתחיל לעקוב אחרי התחזוקה</p>
                    </motion.div>
                )}

                {/* Add New Vehicle Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Link href="/maintenance/add" className="block group">
                        <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:shadow-[0_0_30px_rgba(6,182,212,0.08)] transition-all duration-300 p-6 flex flex-col items-center justify-center gap-3">

                            {/* Plus Icon */}
                            <div className="p-3 bg-slate-800/40 rounded-full group-hover:bg-cyan-500/15 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all duration-300">
                                <Plus size={24} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                            </div>

                            {/* Text */}
                            <span className="text-sm font-medium text-slate-500 group-hover:text-cyan-300 transition-colors">
                                הוסף רכב חדש
                            </span>
                        </div>
                    </Link>
                </motion.div>

                {/* Back to User Menu */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-8 text-center"
                >
                    <Link
                        href="/user"
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={16} className="rotate-180" />
                        <span>חזרה לתפריט הראשי</span>
                    </Link>
                </motion.div>

            </div>
        </div>
    );
}
