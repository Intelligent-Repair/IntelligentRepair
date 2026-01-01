// client/app/garage/requests/page.tsx
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MessageSquare, CheckCircle, Clock, Search, Loader2, AlertCircle, X, Phone, Car, FileText } from 'lucide-react';

interface GarageRequest {
    id: string;
    client: string;
    phone: string;
    car: string;
    fault: string;
    status: string;
    date: string;
    vehicle_info: {
        manufacturer?: string;
        model?: string;
        year?: number;
        license_plate?: string;
    } | null;
    mechanic_summary: {
        topDiagnosis?: Array<{ name: string; recommendation?: string }>;
        shortDescription?: string;
        formattedText?: string;
        category?: string;
    } | null;
}

const filters = [
    { key: 'all', label: 'כל הפניות', icon: Mail },
    { key: 'pending', label: 'לא נקראו', icon: Clock },
    { key: 'viewed', label: 'נקראו ולא נענו', icon: MessageSquare },
    { key: 'answered', label: 'נקראו ונענו', icon: CheckCircle },
];

export default function GarageInquiriesPage() {
    const [activeFilter, setActiveFilter] = useState('all');
    const [requests, setRequests] = useState<GarageRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequest, setSelectedRequest] = useState<GarageRequest | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const router = useRouter();

    // Fetch requests from API
    useEffect(() => {
        const fetchRequests = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/garage/requests');
                const data = await res.json();

                if (data.error) {
                    setError(data.error);
                } else {
                    setRequests(data.requests || []);
                }
            } catch (err) {
                console.error('Error fetching requests:', err);
                setError('שגיאה בטעינת הפניות');
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, []);

    // Filter and search requests
    const filteredRequests = useMemo(() => {
        let result = requests;

        // Filter by status
        if (activeFilter !== 'all') {
            result = result.filter(r => r.status === activeFilter);
        }

        // Filter by search term
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(r =>
                r.client.toLowerCase().includes(term) ||
                r.car.toLowerCase().includes(term) ||
                r.fault.toLowerCase().includes(term)
            );
        }

        return result;
    }, [requests, activeFilter, searchTerm]);

    // Update request status
    const updateStatus = useCallback(async (requestId: string, newStatus: string) => {
        console.log('[updateStatus] Starting update:', { requestId, newStatus });
        setUpdatingStatus(true);
        try {
            const res = await fetch(`/api/garage/requests/${requestId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });

            console.log('[updateStatus] Response status:', res.status);
            const data = await res.json();
            console.log('[updateStatus] Response data:', data);

            if (res.ok) {
                // Update local state
                setRequests(prev => prev.map(r =>
                    r.id === requestId ? { ...r, status: newStatus } : r
                ));
                if (selectedRequest?.id === requestId) {
                    setSelectedRequest({ ...selectedRequest, status: newStatus });
                }
                console.log('[updateStatus] Local state updated');
            } else {
                console.error('[updateStatus] API error:', data);
            }
        } catch (err) {
            console.error('[updateStatus] Error:', err);
        } finally {
            setUpdatingStatus(false);
        }
    }, [selectedRequest]);

    // Open popup with request details
    const handleOpenDetails = (request: GarageRequest) => {
        console.log('[handleOpenDetails] Opening:', { id: request.id, status: request.status });

        setSelectedRequest(request);
        // Mark as viewed if pending
        if (request.status === 'pending') {
            console.log('[handleOpenDetails] Status is pending, calling updateStatus...');
            updateStatus(request.id, 'viewed');
        } else {
            console.log('[handleOpenDetails] Status is not pending, skipping update');
        }
    };

    // Get status display
    const getStatusDisplay = (status: string) => {
        switch (status) {
            case 'pending':
                return { label: 'חדש', className: 'bg-red-900/50 text-red-300' };
            case 'viewed':
                return { label: 'נצפה', className: 'bg-yellow-900/50 text-yellow-300' };
            case 'answered':
                return { label: 'נענה', className: 'bg-green-900/50 text-green-300' };
            default:
                return { label: 'חדש', className: 'bg-red-900/50 text-red-300' };
        }
    };

    // Get fault category from mechanic_summary
    const getFaultCategory = (request: GarageRequest) => {
        if (request.mechanic_summary?.category) {
            return request.mechanic_summary.category;
        }
        if (request.mechanic_summary?.topDiagnosis?.[0]?.name) {
            return request.mechanic_summary.topDiagnosis[0].name;
        }
        if (request.mechanic_summary?.shortDescription) {
            return request.mechanic_summary.shortDescription.substring(0, 30) + '...';
        }
        return 'לא צוין';
    };

    // Get vehicle display
    const getVehicleDisplay = (request: GarageRequest) => {
        if (request.vehicle_info) {
            const { manufacturer, model, year } = request.vehicle_info;
            if (manufacturer || model) {
                return `${manufacturer || ''} ${model || ''} ${year ? `(${year})` : ''}`.trim();
            }
        }
        return request.car || 'לא צוין';
    };

    // Format mechanic summary for display
    const formatMechanicSummary = (summary: GarageRequest['mechanic_summary']) => {
        if (!summary) {
            return '⚠️ פנייה זו נוצרה לפני הוספת סיכום AI.\nאנא בדוק את תיאור הלקוח ופנה אליו ישירות לפרטים.';
        }

        // Handle formattedText (best case)
        if (summary.formattedText) {
            return summary.formattedText;
        }

        let result = '';

        // Handle shortDescription
        if (summary.shortDescription) {
            result += `📋 תיאור: ${summary.shortDescription}\n\n`;
        }

        // Handle topDiagnosis array
        if (summary.topDiagnosis && summary.topDiagnosis.length > 0) {
            result += '🔍 אבחון:\n';
            summary.topDiagnosis.forEach((d, i) => {
                result += `${i + 1}. ${d.name}`;
                if (d.recommendation) {
                    result += `\n   המלצה: ${d.recommendation}`;
                }
                result += '\n';
            });
        }

        // Handle needsTow field
        if (typeof (summary as any).needsTow === 'boolean') {
            result += `\n🚗 צריך גרירה: ${(summary as any).needsTow ? 'כן' : 'לא'}\n`;
        }

        // If we found something, return it
        if (result.trim()) {
            return result;
        }

        // Fallback: show raw data
        try {
            const rawJson = JSON.stringify(summary, null, 2);
            return `📄 נתוני אבחון:\n${rawJson}`;
        } catch {
            return 'אין סיכום זמין';
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
            {/* Background effects */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
                <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
                <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-indigo-600/20 blur-[180px]" />
            </div>

            <main dir="rtl" className="relative mx-auto w-full max-w-7xl px-6 pb-16 pt-8 sm:px-10 lg:px-12">
                <h1 className="text-4xl font-extrabold text-white mb-8 border-b border-white/10 pb-4">
                    פניות מלקוחות (Inbox)
                </h1>

                {/* Filters */}
                <section className="flex flex-wrap gap-4 mb-8">
                    {filters.map(filter => {
                        const Icon = filter.icon;
                        const isActive = activeFilter === filter.key;
                        const count = filter.key === 'all'
                            ? requests.length
                            : requests.filter(r => r.status === filter.key).length;

                        return (
                            <button
                                key={filter.key}
                                onClick={() => setActiveFilter(filter.key)}
                                className={`
                                    flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition duration-300 backdrop-blur-xl
                                    ${isActive
                                        ? 'bg-sky-500 text-slate-900 shadow-sky-500/40 hover:bg-sky-400'
                                        : 'bg-white/10 border border-white/10 text-white hover:bg-white/20'
                                    }
                                `}
                            >
                                <Icon className="w-5 h-5" /> {filter.label}
                                {count > 0 && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-slate-900/30' : 'bg-white/20'}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </section>

                {/* Table Section */}
                <section className="rounded-xl border border-white/10 bg-white/5 shadow-xl backdrop-blur-md overflow-hidden">
                    {/* Header with search */}
                    <div className="flex justify-between items-center p-4 border-b border-white/10">
                        <h2 className="text-xl font-semibold text-slate-200">
                            פניות: {filters.find(f => f.key === activeFilter)?.label}
                        </h2>
                        <div className="flex items-center gap-3">
                            <Search className="w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="חיפוש לפי שם לקוח או רכב..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-zinc-800/80 border border-zinc-700 p-2 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-sky-500 focus:border-sky-500 transition"
                                dir="rtl"
                            />
                        </div>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 animate-spin text-sky-400" />
                            <p className="mt-4 text-slate-400">טוען פניות...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <AlertCircle className="w-10 h-10 text-red-400" />
                            <p className="mt-4 text-red-400">{error}</p>
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Mail className="w-12 h-12 text-slate-500" />
                            <p className="mt-4 text-slate-400">אין פניות להצגה</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-right text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-700 text-slate-400 bg-zinc-800/50">
                                        <th className="py-3 px-4 font-normal">שם לקוח</th>
                                        <th className="py-3 px-4 font-normal">רכב</th>
                                        <th className="py-3 px-4 font-normal">קטגוריית תקלה</th>
                                        <th className="py-3 px-4 font-normal">תאריך פנייה</th>
                                        <th className="py-3 px-4 font-normal">סטטוס</th>
                                        <th className="py-3 px-4 font-normal">פרטי פנייה</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRequests.map((item) => {
                                        const statusDisplay = getStatusDisplay(item.status);
                                        return (
                                            <tr
                                                key={item.id}
                                                className="border-b border-white/5 hover:bg-white/10 transition"
                                            >
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-slate-100">{item.client}</div>
                                                </td>
                                                <td className="py-3 px-4 text-slate-300">
                                                    {getVehicleDisplay(item)}
                                                </td>
                                                <td className="py-3 px-4 text-slate-300">
                                                    {getFaultCategory(item)}
                                                </td>
                                                <td className="py-3 px-4 text-slate-400">{item.date}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusDisplay.className}`}>
                                                        {statusDisplay.label}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <button
                                                        onClick={() => handleOpenDetails(item)}
                                                        className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm transition flex items-center gap-2"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                        צפה בפרטים
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>

            {/* Popup Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gradient-to-b from-[#0a1628] to-[#071226] rounded-2xl border border-white/20 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-6 border-b border-white/10">
                            <h2 className="text-2xl font-bold text-white">פרטי פנייה</h2>
                            <button
                                onClick={() => setSelectedRequest(null)}
                                className="text-slate-400 hover:text-white transition"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto max-h-[60vh]" dir="rtl">
                            {/* Customer Info */}
                            <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                                <h3 className="text-lg font-semibold text-cyan-300 mb-3">פרטי לקוח</h3>
                                <div className="grid grid-cols-2 gap-4 text-slate-300">
                                    <div>
                                        <span className="text-slate-500">שם:</span>
                                        <span className="mr-2 font-medium">{selectedRequest.client}</span>
                                    </div>
                                    <div>
                                        <Phone className="w-4 h-4 inline-block ml-2 text-slate-500" />
                                        <span>{selectedRequest.phone || 'לא צוין'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <Car className="w-4 h-4 inline-block ml-2 text-slate-500" />
                                        <span>{getVehicleDisplay(selectedRequest)}</span>
                                        {selectedRequest.vehicle_info?.license_plate && (
                                            <span className="mr-4 text-slate-500">
                                                ({selectedRequest.vehicle_info.license_plate})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* AI Summary */}
                            <div className="mb-6 p-4 rounded-xl bg-sky-900/20 border border-sky-400/30">
                                <h3 className="text-lg font-semibold text-sky-300 mb-3">סיכום אבחון AI</h3>
                                <div className="text-sky-100 whitespace-pre-wrap leading-relaxed">
                                    {formatMechanicSummary(selectedRequest.mechanic_summary)}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-white/10 flex justify-end gap-4">
                            <button
                                onClick={() => setSelectedRequest(null)}
                                className="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
                            >
                                סגור
                            </button>
                            <button
                                onClick={() => router.push(`/garage/chats/${selectedRequest.id}`)}
                                className="px-6 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition flex items-center gap-2"
                            >
                                <MessageSquare className="w-4 h-4" />
                                פתח צ'אט
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

