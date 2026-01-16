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
    Search,
    Loader2,
    CheckCircle2,
    Clock,
    BadgeCheck
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

// Israeli city coordinates lookup (approximate center of each city)
const ISRAEL_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
    // גוש דן
    "תל אביב": { lat: 32.0853, lng: 34.7818 },
    "תל אביב יפו": { lat: 32.0853, lng: 34.7818 },
    "רמת גן": { lat: 32.0680, lng: 34.8248 },
    "גבעתיים": { lat: 32.0717, lng: 34.8124 },
    "בני ברק": { lat: 32.0833, lng: 34.8333 },
    "פתח תקווה": { lat: 32.0841, lng: 34.8878 },
    "גבעת שמואל": { lat: 32.0758, lng: 34.8506 },
    "הרצליה": { lat: 32.1667, lng: 34.8333 },
    "רעננה": { lat: 32.1833, lng: 34.8667 },
    "כפר סבא": { lat: 32.1833, lng: 34.9000 },
    "הוד השרון": { lat: 32.1500, lng: 34.8833 },
    "ראשון לציון": { lat: 31.9500, lng: 34.8000 },
    "חולון": { lat: 32.0167, lng: 34.7833 },
    "בת ים": { lat: 32.0167, lng: 34.7500 },
    // מרכז
    "נתניה": { lat: 32.3333, lng: 34.8500 },
    "אשדוד": { lat: 31.8000, lng: 34.6500 },
    "אשקלון": { lat: 31.6667, lng: 34.5667 },
    "רחובות": { lat: 31.8928, lng: 34.8113 },
    "נס ציונה": { lat: 31.9333, lng: 34.8000 },
    "לוד": { lat: 31.9500, lng: 34.9000 },
    "רמלה": { lat: 31.9167, lng: 34.8667 },
    "מודיעין": { lat: 31.8989, lng: 35.0101 },
    // צפון
    "חיפה": { lat: 32.7940, lng: 34.9896 },
    "קריית אתא": { lat: 32.8000, lng: 35.1000 },
    "קריית ביאליק": { lat: 32.8333, lng: 35.0833 },
    "קריית מוצקין": { lat: 32.8333, lng: 35.0667 },
    "עכו": { lat: 32.9333, lng: 35.0833 },
    "נהריה": { lat: 33.0000, lng: 35.1000 },
    "טבריה": { lat: 32.7939, lng: 35.5300 },
    "נצרת": { lat: 32.7000, lng: 35.3000 },
    "עפולה": { lat: 32.6167, lng: 35.2833 },
    // דרום
    "באר שבע": { lat: 31.2589, lng: 34.7997 },
    "אילת": { lat: 29.5569, lng: 34.9517 },
    "דימונה": { lat: 31.0667, lng: 35.0333 },
    // ירושלים
    "ירושלים": { lat: 31.7683, lng: 35.2137 },
    "בית שמש": { lat: 31.7500, lng: 34.9833 },
};

// Get coordinates for a city (with fuzzy matching)
const getCityCoords = (cityName: string | null): { lat: number; lng: number } | null => {
    if (!cityName) return null;

    // Exact match
    if (ISRAEL_CITY_COORDS[cityName]) {
        return ISRAEL_CITY_COORDS[cityName];
    }

    // Fuzzy match - check if city name contains or is contained in known cities
    const normalizedCity = cityName.trim().toLowerCase();
    for (const [knownCity, coords] of Object.entries(ISRAEL_CITY_COORDS)) {
        if (knownCity.toLowerCase().includes(normalizedCity) ||
            normalizedCity.includes(knownCity.toLowerCase())) {
            return coords;
        }
    }

    return null;
};

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};

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
    const [activeFilter, setActiveFilter] = useState<string>("nearest");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [userCity, setUserCity] = useState<string | null>(null);
    const [locationStatus, setLocationStatus] = useState<"pending" | "granted" | "denied" | "unavailable">("pending");

    // Request geolocation on mount
    useEffect(() => {
        // First try to get user's registered city from localStorage or API
        const storedCity = localStorage.getItem("user_city");
        if (storedCity) {
            setUserCity(storedCity);
        }

        // Request GPS location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                    setLocationStatus("granted");
                },
                (error) => {
                    console.log("Geolocation error:", error.message);
                    setLocationStatus(error.code === 1 ? "denied" : "unavailable");
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
            );
        } else {
            setLocationStatus("unavailable");
        }
    }, []);

    // Check if garage is currently open based on operating_hours
    const isGarageOpenNow = (hours: OperatingHours[] | null | undefined): boolean => {
        if (!hours || !Array.isArray(hours) || hours.length === 0) return false;

        const now = new Date();
        const currentDay = now.getDay(); // 0 = Sunday
        const todayHours = hours[currentDay];

        if (!todayHours || todayHours.isClosed) return false;

        // Parse current time
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Parse open/close times (format: "08:00")
        const [openHour, openMin] = todayHours.open.split(":").map(Number);
        const [closeHour, closeMin] = todayHours.close.split(":").map(Number);
        const openMinutes = openHour * 60 + openMin;
        const closeMinutes = closeHour * 60 + closeMin;

        return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    };

    // Check if garage is in user's city
    const isInUserCity = (garage: Garage): boolean => {
        if (!userCity || !garage.City) return false;
        return garage.City.toLowerCase() === userCity.toLowerCase();
    };

    // Get distance to garage in km (returns null if cannot calculate)
    const getDistanceToGarage = (garage: Garage): number | null => {
        const garageCoords = getCityCoords(garage.City);
        if (!garageCoords) return null;

        // If we have GPS location, use that
        if (userLocation) {
            return calculateDistance(
                userLocation.lat, userLocation.lng,
                garageCoords.lat, garageCoords.lng
            );
        }

        // Otherwise, use city-to-city distance
        const userCoords = getCityCoords(userCity);
        if (userCoords) {
            return calculateDistance(
                userCoords.lat, userCoords.lng,
                garageCoords.lat, garageCoords.lng
            );
        }

        return null;
    };

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

    // Filter chips configuration
    const filterChips = [
        { id: "nearest", label: "הכי קרוב", icon: "📍" },
        { id: "open", label: "פתוח עכשיו", icon: "🟢" },
    ];

    return (
        <div
            className="min-h-screen bg-gradient-to-br from-[#0a0f1c] via-[#0d1424] to-[#0a0f1c] text-white"
            dir="rtl"
        >
            {/* Header - HUD Style */}
            <div className="sticky top-0 z-10 bg-[#0a0f1c]/95 backdrop-blur-xl border-b border-cyan-500/10">
                <div className="max-w-4xl mx-auto px-4 py-5">
                    {/* Top Row */}
                    <div className="flex items-center justify-between mb-5">
                        <button
                            onClick={() => router.back()}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                        >
                            <ArrowRight size={22} />
                        </button>
                        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-white">
                            בחר מוסך
                        </h1>
                        <div className="w-12" />
                    </div>

                    {/* Search Input */}
                    <div className="relative mb-4">
                        <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400/60" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="חפש מוסך לפי שם או עיר..."
                            className="w-full bg-slate-800/60 border border-slate-600/40 rounded-xl py-3.5 pr-12 pl-4 text-white placeholder-white/40 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all"
                        />
                    </div>

                    {/* Filter Chips */}
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {filterChips.map((chip) => (
                            <button
                                key={chip.id}
                                onClick={() => setActiveFilter(chip.id)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                                    ${activeFilter === chip.id
                                        ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                                        : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
                                    }
                                `}
                            >
                                <span>{chip.icon}</span>
                                <span>{chip.label}</span>
                            </button>
                        ))}
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
                            {garages
                                // Filter by search query
                                .filter(garage => {
                                    if (!searchQuery.trim()) return true;
                                    const query = searchQuery.toLowerCase().trim();
                                    return (
                                        garage.garage_name?.toLowerCase().includes(query) ||
                                        garage.City?.toLowerCase().includes(query) ||
                                        garage.Street?.toLowerCase().includes(query)
                                    );
                                })
                                // Filter by active filter
                                .filter(garage => {
                                    if (activeFilter === "open") {
                                        return isGarageOpenNow(garage.operating_hours);
                                    }
                                    return true;
                                })
                                // Sort by distance if "nearest" filter
                                .sort((a, b) => {
                                    if (activeFilter === "nearest") {
                                        const distA = getDistanceToGarage(a) ?? 9999;
                                        const distB = getDistanceToGarage(b) ?? 9999;
                                        return distA - distB;
                                    }
                                    return 0;
                                })
                                .map((garage, index) => {
                                    const isSent = sentTo.includes(garage.id);
                                    const isSending = sendingTo === garage.id;
                                    const canSend = garage.hasOwner;  // Only garages with real owners can receive requests
                                    const isOpen = isGarageOpenNow(garage.operating_hours);
                                    const sameCity = isInUserCity(garage);
                                    const distance = getDistanceToGarage(garage);

                                    return (
                                        <motion.div
                                            key={garage.id}
                                            initial={{ opacity: 0, y: 30 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            transition={{ delay: index * 0.08, duration: 0.4 }}
                                            className={`
                                            relative overflow-hidden rounded-2xl backdrop-blur-xl
                                            ${isSent
                                                    ? "bg-emerald-500/10 border-2 border-emerald-500/40"
                                                    : "bg-slate-900/60 border border-slate-700/50 hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]"
                                                }
                                            transition-all duration-300
                                        `}
                                        >
                                            <div className="p-5">
                                                {/* Header Row - Name + Badges */}
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h3 className="text-xl font-bold text-white">
                                                                {garage.garage_name}
                                                            </h3>
                                                            {garage.hasOwner && (
                                                                <BadgeCheck size={18} className="text-cyan-400" />
                                                            )}
                                                        </div>

                                                        {/* Same City Badge */}
                                                        {sameCity && (
                                                            <div className="flex items-center gap-1 mb-2">
                                                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs font-medium text-emerald-400">
                                                                    🏠 בעיר שלך
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Distance Badge + Status */}
                                                    <div className="flex flex-col items-end gap-2">
                                                        {/* Distance/City Badge */}
                                                        {garage.City && (
                                                            <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-600/50 text-xs font-medium text-white/70">
                                                                📍 {distance !== null ? `${distance.toFixed(1)} ק״מ` : garage.City}
                                                            </span>
                                                        )}

                                                        {/* Open/Closed Status - Real calculation */}
                                                        {garage.hasOwner && garage.operating_hours && (
                                                            <div className="flex items-center gap-1.5">
                                                                <div className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]'}`} />
                                                                <span className={`text-xs font-medium ${isOpen ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                    {isOpen ? 'פתוח כעת' : 'סגור'}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Address */}
                                                <div className="flex items-center gap-2 text-white/60 mb-3">
                                                    <MapPin size={14} className="text-cyan-400/60 flex-shrink-0" />
                                                    <span className="text-sm">{formatAddress(garage)}</span>
                                                </div>

                                                {/* Phone */}
                                                {garage.phone && (
                                                    <a
                                                        href={formatPhoneLink(garage.phone)}
                                                        className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors mb-3"
                                                    >
                                                        <Phone size={14} />
                                                        <span className="text-sm font-medium" dir="ltr">
                                                            {garage.phone}
                                                        </span>
                                                    </a>
                                                )}

                                                {/* Operating Hours */}
                                                {garage.hasOwner && garage.operating_hours && (
                                                    <div className="mb-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Clock size={14} className="text-white/50" />
                                                            <span className="text-sm text-white/70">
                                                                {formatOperatingHours(garage.operating_hours)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Action Button - Gradient Pill Style */}
                                                {canSend && (
                                                    <div className="mt-4 flex justify-start">
                                                        <button
                                                            onClick={() => handleSendRequest(garage)}
                                                            disabled={isSending || isSent || !requestId}
                                                            className={`
                                                            flex items-center gap-2 py-3 px-6 rounded-full font-bold transition-all
                                                            ${isSent
                                                                    ? "bg-emerald-500/20 text-emerald-400 cursor-default"
                                                                    : isSending
                                                                        ? "bg-blue-500/50 text-white cursor-wait"
                                                                        : !requestId
                                                                            ? "bg-white/5 text-white/30 cursor-not-allowed"
                                                                            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]"
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
                                                    className="absolute inset-0 bg-emerald-500/5 pointer-events-none"
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
