// client/app/garage/requests/[request_id]/report/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowRight, CheckCircle, Loader2, AlertCircle, Wrench, FileText, Car, Tag } from 'lucide-react';

interface ProblemCategory {
    code: string;
    name_he: string;
    name_en?: string;
}

interface VehicleInfo {
    manufacturer?: string;
    model?: string;
    year?: number;
    license_plate?: string;
}

export default function ReportSolutionPage() {
    const router = useRouter();
    const params = useParams();
    const requestId = params?.request_id as string;

    const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
    const [categories, setCategories] = useState<ProblemCategory[]>([]);
    const [formData, setFormData] = useState({
        problem_category: '',
        description: '',
        labor_hours: '',
    });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load request info and categories
    useEffect(() => {
        const loadData = async () => {
            if (!requestId) return;

            setLoading(true);
            setError(null);

            try {
                // Load garage request to get vehicle info
                const requestRes = await fetch(`/api/garage/requests/${requestId}`);
                if (!requestRes.ok) {
                    const errorData = await requestRes.json().catch(() => ({}));
                    throw new Error(errorData.error || `Failed to load request details (${requestRes.status})`);
                }
                const requestData = await requestRes.json();
                if (requestData.error) {
                    throw new Error(requestData.error);
                }
                
                if (!requestData.request) {
                    throw new Error('Request data not found in response');
                }

                // Extract vehicle info
                const vehicle = requestData.request?.vehicle_info || {};
                console.log('[ReportPage] Vehicle info received:', vehicle);
                
                setVehicleInfo({
                    manufacturer: vehicle.manufacturer || '',
                    model: vehicle.model || '',
                    year: vehicle.year || null,
                    license_plate: vehicle.license_plate || '',
                });

                // Load problem categories
                const categoriesRes = await fetch('/api/problem-categories');
                if (!categoriesRes.ok) {
                    throw new Error('Failed to load categories');
                }
                const categoriesData = await categoriesRes.json();
                if (categoriesData.error) {
                    throw new Error(categoriesData.error);
                }
                setCategories(categoriesData.categories || []);
            } catch (err) {
                console.error('Error loading data:', err);
                setError(err instanceof Error ? err.message : 'שגיאה בטעינת הנתונים');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [requestId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        // Validation
        if (!formData.problem_category) {
            setError('יש לבחור קטגוריית תקלה');
            setIsSaving(false);
            return;
        }

        if (!formData.description || formData.description.trim().length < 50) {
            setError('יש להזין תיאור מפורט (מינימום 50 תווים)');
            setIsSaving(false);
            return;
        }

        if (!formData.labor_hours || parseFloat(formData.labor_hours) <= 0) {
            setError('יש להזין שעות עבודה תקינות');
            setIsSaving(false);
            return;
        }

        try {
            const res = await fetch(`/api/garage/requests/${requestId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem_category: formData.problem_category,
                    description: formData.description.trim(),
                    labor_hours: parseFloat(formData.labor_hours),
                }),
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                throw new Error(data.error || 'שגיאה בשמירת הדיווח');
            }

            // Success - redirect back to requests page
            router.push('/garage/requests');
        } catch (err) {
            console.error('Error completing repair:', err);
            setError(err instanceof Error ? err.message : 'שגיאה בשמירת הדיווח');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
                <div className="flex items-center justify-center min-h-screen">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
            {/* Background effects */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
                <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
                <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-indigo-600/20 blur-[180px]" />
            </div>

            <main dir="rtl" className="relative mx-auto w-full max-w-4xl px-6 pb-16 pt-8 sm:px-10 lg:px-12">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
                    >
                        <ArrowRight className="w-5 h-5" />
                    </button>
                    <h1 className="text-4xl font-extrabold text-white border-b border-white/10 pb-4 flex-1 flex items-center gap-3">
                        <Wrench className="w-8 h-8 text-cyan-300" />
                        דיווח על סיום טיפול
                    </h1>
                </div>

                {error && (
                    <div className="p-4 mb-6 rounded-xl bg-red-900/40 text-red-300 text-center font-medium flex items-center justify-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-md space-y-6">
                    {/* Section 1: Vehicle Info (Read-only) */}
                    <div className="rounded-lg border border-white/10 bg-white/5 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Car className="w-5 h-5 text-cyan-400" />
                            <h2 className="text-lg font-semibold text-white">נתוני רכב</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-slate-400 block mb-1">יצרן</label>
                                <div className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white">
                                    {vehicleInfo?.manufacturer || 'לא צוין'}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm text-slate-400 block mb-1">דגם</label>
                                <div className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white">
                                    {vehicleInfo?.model || 'לא צוין'}
                                </div>
                            </div>
                            {vehicleInfo?.year && (
                                <div>
                                    <label className="text-sm text-slate-400 block mb-1">שנת ייצור</label>
                                    <div className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white">
                                        {vehicleInfo.year}
                                    </div>
                                </div>
                            )}
                            {vehicleInfo?.license_plate && (
                                <div>
                                    <label className="text-sm text-slate-400 block mb-1">מספר רישוי</label>
                                    <div className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white">
                                        {vehicleInfo.license_plate}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section 2: Problem Category */}
                    <div>
                        <label className="text-sm text-slate-400 block mb-2 flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            קטגוריית תקלה *
                        </label>
                        <select
                            name="problem_category"
                            value={formData.problem_category}
                            onChange={handleChange}
                            required
                            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-right"
                            dir="rtl"
                        >
                            <option value="">בחר קטגוריה...</option>
                            {categories.map((cat) => (
                                <option key={cat.code} value={cat.code}>
                                    {cat.name_he}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Section 3: Description */}
                    <div>
                        <label className="text-sm text-slate-400 block mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            תיאור מפורט של התיקון *
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            required
                            rows={6}
                            minLength={50}
                            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-right"
                            dir="rtl"
                            placeholder="תאר את התיקון שביצעת: מה הייתה הבעיה, מה עשית, ואיך פתרת אותה. מינימום 50 תווים."
                        />
                        <div className="text-xs text-slate-500 mt-1 text-left">
                            {formData.description.length}/50 תווים לפחות
                        </div>
                    </div>

                    {/* Section 4: Labor Hours */}
                    <div>
                        <label className="text-sm text-slate-400 block mb-2">
                            שעות עבודה *
                        </label>
                        <input
                            type="number"
                            name="labor_hours"
                            value={formData.labor_hours}
                            onChange={handleChange}
                            required
                            step="0.5"
                            min="0"
                            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-right"
                            dir="rtl"
                            placeholder="0"
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-3 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
                            disabled={isSaving}
                        >
                            ביטול
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/40 transition hover:-translate-y-0.5 hover:shadow-cyan-500/60 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    מעבד ושמור...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    סיים טיפול
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
