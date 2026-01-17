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

import { getCarBrandLogo } from "@/lib/data/car-brands";

// Brand Emblem Component - Real Logo with Backlight Glow Effect
const BrandEmblem = ({ brand }: { brand: string }) => {
    const logoUrl = getCarBrandLogo(brand);

    // Fallback to first letter if no logo found
    const fallbackInitial = brand.charAt(0).toUpperCase();

    return (
        <div
            className="absolute -left-10 top-1/2 pointer-events-none select-none"
            style={{ transform: 'translateY(-50%) rotate(-12deg)' }}
        >
            {/* Large Emblem Container */}
            <div
                className="w-32 h-32 rounded-full flex items-center justify-center relative"
                style={{
                    background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)',
                    border: '2px solid rgba(255,255,255,0.08)',
                    boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.02)'
                }}
            >
                {/* Inner decorative ring */}
                <div
                    className="w-28 h-28 rounded-full flex items-center justify-center overflow-hidden relative"
                    style={{
                        border: '1px solid rgba(255,255,255,0.05)',
                        boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.4)'
                    }}
                >
                    {logoUrl ? (
                        <>
                            {/* Backlight Glow Effect */}
                            <div
                                className="absolute inset-0 rounded-full"
                                style={{
                                    background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)',
                                    filter: 'blur(8px)'
                                }}
                            />
                            {/* Logo - White/Light watermark style */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={logoUrl}
                                alt={brand}
                                className="w-16 h-16 object-contain relative z-10"
                                style={{
                                    opacity: 0.3,
                                    filter: 'brightness(0) invert(1) drop-shadow(0 0 8px rgba(255,255,255,0.15))'
                                }}
                            />
                        </>
                    ) : (
                        /* Fallback to letter */
                        <span
                            className="text-6xl font-black tracking-tight"
                            style={{
                                fontFamily: 'Georgia, "Times New Roman", serif',
                                color: 'rgba(255,255,255,0.15)',
                                textShadow: '0 0 20px rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.3)'
                            }}
                        >
                            {fallbackInitial}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

// Israeli License Plate Component - Compact Realistic Style
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
                borderRadius: '4px',
                border: '2px solid #1a1a1a',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
            }}
        >
            {/* Blue IL Section - Compact */}
            <div
                className="flex flex-col items-center justify-center px-1.5 py-1"
                style={{
                    background: 'linear-gradient(180deg, #0047AB 0%, #003399 100%)',
                    minWidth: '28px'
                }}
            >
                {/* Mini Israeli Flag */}
                <div className="flex flex-col items-center mb-0.5">
                    <div
                        className="w-4 h-2.5 flex items-center justify-center relative"
                        style={{
                            background: 'white',
                            border: '1px solid rgba(0,0,0,0.1)'
                        }}
                    >
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#0038b8]" />
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0038b8]" />
                        <span className="text-[5px] text-[#0038b8] leading-none">✡</span>
                    </div>
                </div>
                <span className="text-[8px] text-white font-black leading-none">IL</span>
                <span className="text-[4px] text-white/80 leading-none mt-0.5">ישראל</span>
            </div>

            {/* Yellow Plate Area - Compact */}
            <div
                className="flex items-center justify-center px-2.5 py-1"
                style={{
                    background: 'linear-gradient(180deg, #FFD700 0%, #FFCC00 50%, #FFB800 100%)',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4), inset 0 -1px 2px rgba(0,0,0,0.1)'
                }}
            >
                <span
                    className="font-black text-sm tracking-[0.05em]"
                    style={{
                        fontFamily: '"Arial Black", "Helvetica Neue", sans-serif',
                        color: '#1a1a1a',
                        textShadow: '0 1px 0 rgba(255,255,255,0.2)'
                    }}
                >
                    {formatPlateNumber(number)}
                </span>
            </div>
        </div>
    );
};

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
                    <div className="flex flex-row-reverse items-center justify-center gap-3 mb-2">
                        <div
                            className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl"
                            style={{
                                boxShadow: '0 8px 32px rgba(6, 182, 212, 0.4), 0 0 20px rgba(6, 182, 212, 0.3)',
                                filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.5))'
                            }}
                        >
                            <Car size={32} className="text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-white">
                            המוסך של{' '}
                            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
                                {userName}
                            </span>
                        </h1>
                    </div>
                    <p className="text-slate-500 text-sm">
                        ניהול חכם לכל הרכבים שלך
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
                        <div className="rounded-2xl border-2 border-dashed border-slate-600/50 bg-white/[0.01] hover:border-cyan-400/60 hover:bg-cyan-500/5 hover:shadow-[0_0_40px_rgba(6,182,212,0.12)] transition-all duration-300 p-6 flex flex-col items-center justify-center gap-3">

                            {/* Plus Icon */}
                            <div className="p-3 bg-slate-800/40 rounded-full group-hover:bg-cyan-500/15 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all duration-300">
                                <Plus size={24} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                            </div>

                            {/* Text with glow on hover */}
                            <span
                                className="text-sm font-medium text-slate-500 group-hover:text-cyan-300 transition-all duration-300"
                                style={{ textShadow: 'none' }}
                            >
                                <span className="group-hover:[text-shadow:0_0_12px_rgba(6,182,212,0.5)]">
                                    הוסף רכב חדש
                                </span>
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
