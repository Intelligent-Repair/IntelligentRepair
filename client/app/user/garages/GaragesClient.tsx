"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowRight,
    Phone,
    MapPin,
    Building2,
    Send,
    Filter,
    Loader2,
    CheckCircle2,
    Clock
} from "lucide-react";

interface OperatingHours {
    day: string;
    open: string;
    close: string;
    isClosed: boolean;
}

interface Garage {
    id: string;
    garage_name: string;
    phone: string | null;
    City: string | null;
    Street: string | null;
    Number: string | null;
    hasOwner: boolean;  // TRUE = real garage with owner, FALSE = display only
    operating_hours?: OperatingHours[] | null;
}

export default function GaragesClient() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const requestId = searchParams.get("requestId");

    const [garages, setGarages] = useState<Garage[]>([]);
    const [cities, setCities] = useState<string[]>([]);
    const [selectedCity, setSelectedCity] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [sendingTo, setSendingTo] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Fetch garages on mount and when city filter changes
    useEffect(() => {
        const fetchGarages = async () => {
            setLoading(true);
            try {
                const url = selectedCity
                    ? `/api/garages?city=${encodeURIComponent(selectedCity)}`
                    : "/api/garages";

                const res = await fetch(url);
                const data = await res.json();

                if (data.error) {
                    setError(data.error);
                } else {
                    setGarages(data.garages || []);
                    if (data.cities && cities.length === 0) {
                        setCities(data.cities);
                    }
                }
            } catch (err) {
                setError("שגיאה בטעינת המוסכים");
                console.error("Error fetching garages:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchGarages();
    }, [selectedCity]);

    // Handle sending request to garage
    const handleSendRequest = async (garage: Garage) => {
        if (!requestId) {
            alert("לא נמצאה פנייה לשליחה");
            return;
        }

        setSendingTo(garage.id);

        try {
            const res = await fetch("/api/garage-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    garage_id: garage.id,
                    request_id: requestId,
                }),
            });

            const data = await res.json();

            if (data.error) {
                alert(`שגיאה: ${data.error}`);
            } else {
                setSentTo(prev => [...prev, garage.id]);
                // Show success briefly then go back
                setTimeout(() => {
                    router.push("/user");
                }, 1500);
            }
        } catch (err) {
            console.error("Error sending request:", err);
            alert("שגיאה בשליחת הפנייה");
        } finally {
            setSendingTo(null);
        }
    };

    // Format address from components
    const formatAddress = (garage: Garage): string => {
        const parts = [garage.City, garage.Street, garage.Number].filter(Boolean);
        return parts.length > 0 ? parts.join(", ") : "כתובת לא זמינה";
    };

    // Format phone for tel: link
    const formatPhoneLink = (phone: string | null): string => {
        if (!phone) return "";
        return `tel:${phone.replace(/[^0-9+]/g, "")}`;
    };

    // Format operating hours for display
    const formatOperatingHours = (hours: OperatingHours[] | null | undefined): string => {
        if (!hours || !Array.isArray(hours) || hours.length === 0) {
            return "שעות פעילות לא זמינות";
        }

        // Get current day (0 = Sunday, 6 = Saturday)
        const today = new Date().getDay();
        const todayHours = hours[today];

        if (todayHours && !todayHours.isClosed) {
            return `פתוח היום: ${todayHours.open} - ${todayHours.close}`;
        }

        // Find next open day
        for (let i = 1; i <= 7; i++) {
            const nextDay = (today + i) % 7;
            const nextDayHours = hours[nextDay];
            if (nextDayHours && !nextDayHours.isClosed) {
                return `פתוח מחר (${nextDayHours.day}): ${nextDayHours.open} - ${nextDayHours.close}`;
            }
        }

        return "סגור כעת";
    };

    // Get operating hours summary
    const getOperatingHoursSummary = (hours: OperatingHours[] | null | undefined): string => {
        if (!hours || !Array.isArray(hours) || hours.length === 0) {
            return "";
        }

        // Count open days
        const openDays = hours.filter(h => !h.isClosed).length;
        if (openDays === 0) return "סגור כל השבוע";
        if (openDays === 7) return "פתוח כל השבוע";

        // Get common hours if all open days have same hours
        const openDaysHours = hours.filter(h => !h.isClosed);
        const firstOpen = openDaysHours[0];
        const allSame = openDaysHours.every(h => h.open === firstOpen.open && h.close === firstOpen.close);

        if (allSame) {
            return `${openDays} ימים בשבוע: ${firstOpen.open} - ${firstOpen.close}`;
        }

        return `${openDays} ימים בשבוע`;
    };

    return (
        <div
            className="min-h-screen bg-gradient-to-br from-[#0a0f1c] via-[#0d1424] to-[#0a0f1c] text-white"
            dir="rtl"
        >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#0a0f1c]/95 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                        >
                            <ArrowRight size={24} />
                        </button>
                        <h1 className="text-xl font-bold">בחר מוסך לשליחת הפנייה</h1>
                        <div className="w-10" /> {/* Spacer */}
                    </div>

                    {/* City Filter */}
                    <div className="mt-4">
                        <div className="relative">
                            <Filter size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50" />
                            <select
                                value={selectedCity}
                                onChange={(e) => setSelectedCity(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pr-10 pl-4 text-white appearance-none focus:outline-none focus:border-blue-500/50 transition-colors"
                            >
                                <option value="" className="bg-[#1a1f2e] text-white">כל הערים</option>
                                {cities.map((city) => (
                                    <option key={city} value={city} className="bg-[#1a1f2e] text-white">{city}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 size={40} className="animate-spin text-blue-400" />
                        <p className="mt-4 text-white/60">טוען מוסכים...</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-20">
                        <p className="text-red-400">{error}</p>
                    </div>
                ) : garages.length === 0 ? (
                    <div className="text-center py-20">
                        <Building2 size={48} className="mx-auto text-white/30 mb-4" />
                        <p className="text-white/60">לא נמצאו מוסכים</p>
                        {selectedCity && (
                            <button
                                onClick={() => setSelectedCity("")}
                                className="mt-4 text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                הצג את כל המוסכים
                            </button>
                        )}
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        <div className="space-y-4">
                            {garages.map((garage, index) => {
                                const isSent = sentTo.includes(garage.id);
                                const isSending = sendingTo === garage.id;
                                const canSend = garage.hasOwner;  // Only garages with real owners can receive requests

                                return (
                                    <motion.div
                                        key={garage.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={`
                      relative overflow-hidden rounded-2xl border backdrop-blur-xl
                      ${isSent
                                                ? "bg-emerald-500/10 border-emerald-500/30"
                                                : "bg-white/5 border-white/10 hover:border-white/20"
                                            }
                      transition-all duration-300
                    `}
                                    >
                                        <div className="p-5">
                                            {/* Garage Name */}
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2.5 rounded-xl bg-blue-500/15">
                                                    <Building2 size={20} className="text-blue-400" />
                                                </div>
                                                <h3 className="text-lg font-bold text-white">
                                                    {garage.garage_name}
                                                </h3>
                                            </div>

                                            {/* Address */}
                                            <div className="flex items-center gap-2 text-white/70 mb-2">
                                                <MapPin size={16} className="text-white/50 flex-shrink-0" />
                                                <span className="text-sm">{formatAddress(garage)}</span>
                                            </div>

                                            {/* Phone */}
                                            {garage.phone && (
                                                <a
                                                    href={formatPhoneLink(garage.phone)}
                                                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors mb-2"
                                                >
                                                    <Phone size={16} />
                                                    <span className="text-sm font-medium" dir="ltr">
                                                        {garage.phone}
                                                    </span>
                                                </a>
                                            )}

                                            {/* Operating Hours - Only show for garages with owners */}
                                            {garage.hasOwner && garage.operating_hours && (
                                                <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Clock size={16} className="text-white/50 flex-shrink-0" />
                                                        <span className="text-sm font-semibold text-white/90">שעות פעילות</span>
                                                    </div>
                                                    <div className="text-sm text-white/70 mb-1">
                                                        {formatOperatingHours(garage.operating_hours)}
                                                    </div>
                                                    <div className="text-xs text-white/50">
                                                        {getOperatingHoursSummary(garage.operating_hours)}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Send Button - only for garages with owners */}
                                            {canSend && (
                                                <div className="mt-4 pt-4 border-t border-white/10">
                                                    <button
                                                        onClick={() => handleSendRequest(garage)}
                                                        disabled={isSending || isSent || !requestId}
                                                        className={`
                            w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                            font-semibold transition-all
                            ${isSent
                                                                ? "bg-emerald-500/20 text-emerald-400 cursor-default"
                                                                : isSending
                                                                    ? "bg-blue-500/50 text-white cursor-wait"
                                                                    : !requestId
                                                                        ? "bg-white/5 text-white/30 cursor-not-allowed"
                                                                        : "bg-blue-600 hover:bg-blue-500 text-white"
                                                            }
                          `}
                                                    >
                                                        {isSent ? (
                                                            <>
                                                                <CheckCircle2 size={18} />
                                                                <span>נשלח בהצלחה!</span>
                                                            </>
                                                        ) : isSending ? (
                                                            <>
                                                                <Loader2 size={18} className="animate-spin" />
                                                                <span>שולח...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Send size={18} />
                                                                <span>שלח פנייה</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Success overlay */}
                                        {isSent && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="absolute inset-0 bg-emerald-500/10 pointer-events-none"
                                            />
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </AnimatePresence>
                )}
            </div>

            {/* No requestId warning */}
            {!requestId && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-amber-500/10 border-t border-amber-500/30">
                    <p className="text-center text-amber-400 text-sm">
                        לא נמצאה פנייה לשליחה. חזור לדף האבחון.
                    </p>
                </div>
            )}
        </div>
    );
}
