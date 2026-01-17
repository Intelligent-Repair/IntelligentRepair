// client/app/garage/requests/page.tsx
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MessageSquare, CheckCircle, Clock, Search, Loader2, AlertCircle, X, Phone, Car, FileText, Wrench, Home, Trash2, ChevronLeft, User, Bot, Shield } from 'lucide-react';

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
        // New schema (v2)
        schemaVersion?: number;
        vehicleType?: string;
        originalComplaint?: string;
        conversationNarrative?: string;
        driverFindings?: string[];
        diagnoses?: Array<{ issue: string; probability: number }>;
        recommendations?: string[];
        recommendedActions?: string[];
        needsTow?: boolean;
        urgency?: 'low' | 'medium' | 'high' | 'critical';
        category?: string;
        formattedText?: string;
        // Legacy schema
        topDiagnosis?: Array<{ name?: string; issue?: string; recommendation?: string; probability?: number }>;
        shortDescription?: string;
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
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const router = useRouter();

    // Fetch requests from API
    const fetchRequests = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            const res = await fetch('/api/garage/requests');
            const data = await res.json();

            if (data.error) {
                setError(data.error);
            } else {
                setRequests(data.requests || []);
                setLastRefresh(new Date());
            }
        } catch (err) {
            console.error('Error fetching requests:', err);
            setError('שגיאה בטעינת הפניות');
        } finally {
            if (showLoader) setLoading(false);
        }
    }, []);

    // Initial fetch on mount
    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    // Auto-refresh every 30 seconds (only when modal is closed)
    useEffect(() => {
        const interval = setInterval(() => {
            // Don't refresh if modal is open
            if (!selectedRequest) {
                fetchRequests(false); // Don't show loader on auto-refresh
            }
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [fetchRequests, selectedRequest]);

    // Filter and search requests
    const filteredRequests = useMemo(() => {
        let result = requests;

        // Filter by status
        if (activeFilter !== 'all') {
            if (activeFilter === 'answered') {
                // Show answered, completed, closed_no, and closed_yes as "נקראו ונענו"
                result = result.filter(r =>
                    r.status === 'answered' || r.status === 'completed' || r.status === 'closed_no' || r.status === 'closed_yes'
                );
            } else {
                result = result.filter(r => r.status === activeFilter);
            }
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

    // Delete request
    const handleDelete = useCallback(async (requestId: string) => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/garage/requests/${requestId}/delete`, {
                method: 'DELETE',
            });

            if (res.ok) {
                // Remove from local state
                setRequests(prev => prev.filter(r => r.id !== requestId));
                setSelectedRequest(null);
                setShowDeleteConfirm(false);
            } else {
                const data = await res.json();
                console.error('Delete failed:', data);
                alert('שגיאה במחיקת הפנייה');
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('שגיאה במחיקת הפנייה');
        } finally {
            setDeleting(false);
        }
    }, []);

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

    // Get status display with capsule badge styles
    const getStatusDisplay = (status: string) => {
        switch (status) {
            case 'pending':
                return {
                    label: 'חדש',
                    bgClass: 'bg-red-500/10',
                    dotClass: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse',
                    textClass: 'text-red-400'
                };
            case 'viewed':
                return {
                    label: 'בטיפול',
                    bgClass: 'bg-amber-500/10',
                    dotClass: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]',
                    textClass: 'text-amber-400'
                };
            case 'answered':
                return {
                    label: 'נענה',
                    bgClass: 'bg-emerald-500/10',
                    dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
                    textClass: 'text-emerald-400'
                };
            case 'completed':
            case 'closed_yes':
                return {
                    label: 'טופל',
                    bgClass: 'bg-emerald-500/10',
                    dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
                    textClass: 'text-emerald-400'
                };
            case 'closed_no':
                return {
                    label: 'סגור',
                    bgClass: 'bg-slate-500/10',
                    dotClass: 'bg-slate-500',
                    textClass: 'text-slate-400'
                };
            default:
                return {
                    label: status || 'לא ידוע',
                    bgClass: 'bg-slate-500/10',
                    dotClass: 'bg-slate-500',
                    textClass: 'text-slate-400'
                };
        }
    };

    // Get fault category from description or mechanic_summary
    const getFaultCategory = (request: GarageRequest) => {
        // Priority 1: Use fault field (now contains diagnosis title from frontend)
        if (request.fault && request.fault !== 'לא צוין' && request.fault !== 'אבחון הושלם') {
            return request.fault;
        }
        // Priority 2: Use category if explicitly set in mechanic_summary
        if (request.mechanic_summary?.category) {
            return request.mechanic_summary.category;
        }
        // Priority 3: Use diagnoses[0].issue (new AI format)
        if (request.mechanic_summary?.diagnoses?.[0]?.issue) {
            return request.mechanic_summary.diagnoses[0].issue;
        }
        // Priority 4: Use topDiagnosis[0].name (legacy format)
        if (request.mechanic_summary?.topDiagnosis?.[0]?.name) {
            return request.mechanic_summary.topDiagnosis[0].name;
        }
        // Priority 5: Use originalComplaint
        if (request.mechanic_summary?.originalComplaint && request.mechanic_summary.originalComplaint !== 'לא ידוע') {
            return request.mechanic_summary.originalComplaint.substring(0, 50);
        }
        // Priority 6: Use shortDescription
        if (request.mechanic_summary?.shortDescription) {
            return request.mechanic_summary.shortDescription.substring(0, 50);
        }
        return 'בעיה ברכב';
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

        // Handle formattedText (best case - new format)
        if (summary.formattedText) {
            return summary.formattedText;
        }

        // Handle schema v1 with structured fields
        const s = summary as any;
        let result = '';

        // Title
        if (s.shortTitle) {
            result += `📋 ${s.shortTitle}\n\n`;
        }

        // User complaint
        if (s.userComplaint && s.userComplaint !== 'לא ידוע') {
            result += `🚗 תלונת הלקוח:\n${s.userComplaint}\n\n`;
        }

        // Warning lights
        if (Array.isArray(s.warningLightsReported) && s.warningLightsReported.length > 0) {
            result += `💡 נורות אזהרה:\n`;
            s.warningLightsReported.forEach((light: string) => {
                result += `   • ${light}\n`;
            });
            result += '\n';
        }

        // Findings
        if (Array.isArray(s.findings) && s.findings.length > 0) {
            result += `🔍 ממצאים:\n`;
            s.findings.forEach((finding: string) => {
                result += `   • ${finding}\n`;
            });
            result += '\n';
        }

        // Handle topDiagnosis array (legacy format)
        if (summary.topDiagnosis && summary.topDiagnosis.length > 0) {
            result += '🔍 אבחון:\n';
            summary.topDiagnosis.forEach((d, i) => {
                result += `${i + 1}. ${d.name}`;
                if (d.recommendation) {
                    result += `\n   המלצה: ${d.recommendation}`;
                }
                result += '\n';
            });
            result += '\n';
        }

        // Recommendations
        if (Array.isArray(s.recommendations) && s.recommendations.length > 0) {
            result += `💡 המלצות:\n`;
            s.recommendations.forEach((rec: string) => {
                result += `   • ${rec}\n`;
            });
            result += '\n';
        }

        // Actions requested
        if (Array.isArray(s.actionsRequested) && s.actionsRequested.length > 0) {
            result += `✅ פעולות שנדרשו:\n`;
            s.actionsRequested.forEach((action: any) => {
                let actionLine = `   • ${action.instruction || action}`;
                if (action.userResult) {
                    actionLine += ` → ${action.userResult}`;
                }
                result += actionLine + '\n';
            });
            result += '\n';
        }

        // Handle needsTow field
        if (typeof s.needsTow === 'boolean') {
            result += `🚗 צריך גרירה: ${s.needsTow ? 'כן' : 'לא'}\n`;
        }

        // Confidence
        if (s.confidence) {
            const confMap: Record<string, string> = { high: 'גבוהה ✓', medium: 'בינונית', low: 'נמוכה ⚠' };
            const confText = confMap[s.confidence] || s.confidence;
            result += `📊 רמת ביטחון: ${confText}\n`;
        }

        // If we found something, return it
        if (result.trim()) {
            return result;
        }

        // Last fallback: shortDescription
        if (summary.shortDescription) {
            return `📋 ${summary.shortDescription}`;
        }

        return 'אין סיכום זמין';
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
                {/* Header with back button */}
                <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                    <div>
                        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-white">
                            מרכז הפניות
                        </h1>
                        <p className="text-sm text-slate-400 mt-1" suppressHydrationWarning>
                            עדכון אחרון: {lastRefresh.toLocaleTimeString('he-IL')} • רענון אוטומטי כל 30 שניות
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => fetchRequests(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-slate-300 text-sm"
                            title="רענון ידני"
                        >
                            🔄 רענן
                        </button>
                        <button
                            onClick={() => router.push('/garage')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
                        >
                            <Home className="w-5 h-5" />
                            חזרה לתפריט הראשי
                        </button>
                    </div>
                </div>

                {/* Filters - Segmented Control */}
                <section className="flex flex-wrap gap-3 mb-8">
                    {filters.map(filter => {
                        const Icon = filter.icon;
                        const isActive = activeFilter === filter.key;
                        const count = filter.key === 'all'
                            ? requests.length
                            : filter.key === 'answered'
                                ? requests.filter(r =>
                                    r.status === 'answered' || r.status === 'completed' || r.status === 'closed_no' || r.status === 'closed_yes'
                                ).length
                                : requests.filter(r => r.status === filter.key).length;

                        return (
                            <button
                                key={filter.key}
                                onClick={() => setActiveFilter(filter.key)}
                                className={`
                                    flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300
                                    ${isActive
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                                        : 'bg-transparent border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white hover:border-white/20'
                                    }
                                `}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                                {filter.label}
                                {count > 0 && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/20' : 'bg-white/10'}`}>
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
                        /* Floating Cards List */
                        <div className="p-4 space-y-3">
                            {filteredRequests.map((item, index) => {
                                const statusDisplay = getStatusDisplay(item.status);
                                const initials = item.client.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                const manufacturer = item.vehicle_info?.manufacturer?.toLowerCase() || '';

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => handleOpenDetails(item)}
                                        className="group cursor-pointer rounded-xl p-4 bg-slate-800/40 backdrop-blur-sm border border-white/5 hover:border-blue-500/50 hover:bg-slate-800/70 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.15)]"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Avatar */}
                                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center">
                                                <span className="text-sm font-bold text-cyan-300">{initials}</span>
                                            </div>

                                            {/* Main Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="text-base font-bold text-white truncate">{item.client}</h3>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm">
                                                    {/* Car with brand hint */}
                                                    <span className="text-slate-300 flex items-center gap-1.5">
                                                        <Car className="w-4 h-4 text-cyan-400" />
                                                        {getVehicleDisplay(item)}
                                                    </span>
                                                    {/* Category */}
                                                    <span className="text-slate-500 hidden sm:inline text-xs">
                                                        {getFaultCategory(item)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Date */}
                                            <div className="hidden md:block text-xs text-slate-600 min-w-[80px]">
                                                {item.date}
                                            </div>

                                            {/* Status Capsule Badge */}
                                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${statusDisplay.bgClass} min-w-[90px] justify-center`}>
                                                <div className={`w-2 h-2 rounded-full ${statusDisplay.dotClass}`} />
                                                <span className={`text-xs font-semibold ${statusDisplay.textClass}`}>
                                                    {statusDisplay.label}
                                                </span>
                                            </div>

                                            {/* Arrow */}
                                            <ChevronLeft className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>

            {/* Popup Modal - Digital Diagnostic Briefing */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-blue-500/30 shadow-2xl shadow-blue-500/10 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">

                        {/* ===== HEADER SECTION - Client Identity ===== */}
                        <div className="p-6 bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-b border-cyan-500/20">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-white">
                                    פרטי פנייה
                                </h2>
                                <button
                                    onClick={() => {
                                        setSelectedRequest(null);
                                        setShowDeleteConfirm(false);
                                    }}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Client Info Row */}
                            <div className="flex items-center justify-between gap-4" dir="rtl">
                                {/* Right: Avatar + Name */}
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/30 to-indigo-500/30 border border-cyan-500/30 flex items-center justify-center">
                                        <span className="text-lg font-bold text-cyan-300">
                                            {selectedRequest.client.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-lg">{selectedRequest.client}</p>
                                        <p className="text-xs text-slate-500">לקוח</p>
                                    </div>
                                </div>

                                {/* Center: Phone with Call Action */}
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-mono text-lg" dir="ltr">
                                        {selectedRequest.phone || '---'}
                                    </span>
                                    {selectedRequest.phone && (
                                        <a
                                            href={`tel:${selectedRequest.phone}`}
                                            className="px-3 py-1.5 rounded-full bg-transparent border border-white/10 text-cyan-400 hover:bg-white/5 transition flex items-center gap-1.5 text-sm font-medium"
                                        >
                                            <Phone className="w-4 h-4" />
                                            התקשר
                                        </a>
                                    )}
                                </div>

                                {/* Left: Car Badge */}
                                <div className="px-4 py-2 rounded-xl bg-slate-800/80 backdrop-blur border border-slate-700/50 text-center">
                                    <div className="flex items-center gap-2 justify-center">
                                        <Car className="w-5 h-5 text-cyan-400" />
                                        <div>
                                            <p className="font-medium text-white text-sm">{getVehicleDisplay(selectedRequest)}</p>
                                            {selectedRequest.vehicle_info?.license_plate && (
                                                <p className="text-xs text-slate-500 text-center" dir="ltr">{selectedRequest.vehicle_info.license_plate}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Glowing Divider */}
                            <div className="mt-4 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                        </div>

                        <div
                            className="flex-1 overflow-y-auto p-6 modal-scrollbar"
                            dir="rtl"
                            style={{
                                scrollbarWidth: 'thin',
                                scrollbarColor: '#334155 #0f172a'
                            }}
                        >
                            {/* Urgency Tag - Top Right */}
                            {(() => {
                                const urgency = (selectedRequest.mechanic_summary as any)?.urgency || 'medium';
                                const urgencyConfig: Record<string, { label: string; bgClass: string; textClass: string; icon: string }> = {
                                    critical: { label: 'דחיפות קריטית', bgClass: 'bg-red-500/20', textClass: 'text-red-400', icon: '🔥' },
                                    high: { label: 'דחיפות גבוהה', bgClass: 'bg-orange-500/20', textClass: 'text-orange-400', icon: '⚠️' },
                                    medium: { label: 'דחיפות בינונית', bgClass: 'bg-amber-500/20', textClass: 'text-amber-400', icon: '⏱️' },
                                    low: { label: 'דחיפות נמוכה', bgClass: 'bg-emerald-500/20', textClass: 'text-emerald-400', icon: '✓' }
                                };
                                const config = urgencyConfig[urgency] || urgencyConfig.medium;
                                return (
                                    <div className={`mb-4 px-3 py-1.5 rounded-full ${config.bgClass} w-fit flex items-center gap-2`}>
                                        <span>{config.icon}</span>
                                        <span className={`text-sm font-semibold ${config.textClass}`}>{config.label}</span>
                                    </div>
                                );
                            })()}

                            {/* Section 1: Driver Findings - סיכום תשאול הנהג */}
                            {(() => {
                                const summary = selectedRequest.mechanic_summary as any;
                                if (!summary) return null;

                                // Try to get narrative from various sources
                                let displayText: string | null = null;

                                // 1. New unified format: conversationNarrative
                                if (summary.conversationNarrative && summary.conversationNarrative !== 'לא זמין') {
                                    displayText = summary.conversationNarrative;
                                }
                                // 2. KB format: formattedText (extract the narrative section)
                                else if (summary.formattedText) {
                                    // Extract just the narrative part from formattedText (before אבחון/diagnoses)
                                    const text = summary.formattedText as string;
                                    // Remove markdown headers and format nicely
                                    let cleaned = text
                                        .replace(/📋[^\n]*/g, '') // Remove header
                                        .replace(/═+/g, '') // Remove separator
                                        .replace(/🚗[^\n]*/g, '') // Remove vehicle line
                                        .replace(/🔴[^\n]*/g, '') // Keep light info
                                        .replace(/📍[^\n]*/g, '') // Keep scenario
                                        .split('📝 מהלך השיחה:')[1]?.split('🔍')[0] || ''; // Get conversation section

                                    // If we got conversation text, format it
                                    if (cleaned.trim()) {
                                        displayText = cleaned.replace(/•/g, '').trim().split('\n').filter(l => l.trim()).join(' ');
                                    } else {
                                        // Fallback to originalComplaint or scenarioDescription
                                        displayText = summary.originalComplaint || summary.scenarioDescription;
                                    }
                                }
                                // 3. KB format: build from conversationLog
                                else if (summary.conversationLog && Array.isArray(summary.conversationLog) && summary.conversationLog.length > 0) {
                                    const answers = summary.conversationLog.map((item: any) => item.userAnswer).filter(Boolean);
                                    if (answers.length > 0) {
                                        displayText = `הלקוח דיווח: ${answers.join('. ')}`;
                                    }
                                }
                                // 4. Fallback to originalComplaint
                                else if (summary.originalComplaint && summary.originalComplaint !== 'לא צוין') {
                                    displayText = summary.originalComplaint;
                                }

                                // Also check for driverFindings array
                                const driverFindings = summary.driverFindings || [];

                                // If no data at all, skip
                                if (!displayText && driverFindings.length === 0) return null;

                                return (
                                    <div className="mb-6 p-4 rounded-lg bg-slate-900/50 backdrop-blur-sm border-r-[3px] border-r-cyan-500">
                                        <h4 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-cyan-400" />
                                            ממצאי תשאול הנהג
                                        </h4>
                                        {driverFindings.length > 0 ? (
                                            <ul className="space-y-2">
                                                {driverFindings.map((finding: string, idx: number) => (
                                                    <li key={idx} className="text-slate-300 text-sm flex items-start gap-2">
                                                        <span className="text-cyan-400 mt-1">•</span>
                                                        <span>{finding}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : displayText ? (
                                            <p className="text-slate-300 text-sm leading-relaxed">{displayText}</p>
                                        ) : null}
                                    </div>
                                );
                            })()}

                            {/* Section 2: Probabilistic Analysis with Progress Bars */}
                            {(() => {
                                const summary = selectedRequest.mechanic_summary as any;
                                const diagnoses = summary?.diagnoses || summary?.topDiagnosis || [];
                                console.log('🔍 DIAGNOSES:', diagnoses);

                                if (diagnoses.length === 0) return null;

                                return (
                                    <div className="mb-6 p-4 rounded-lg bg-slate-900/50 backdrop-blur-sm border-r-[3px] border-r-cyan-500">
                                        <h4 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                                            <Bot className="w-4 h-4 text-cyan-400" />
                                            ניתוח הסתברותי
                                        </h4>
                                        <div className="space-y-3">
                                            {diagnoses.map((d: any, idx: number) => {
                                                const name = d.issue || d.name || 'אבחון';
                                                const prob = d.probability != null ? d.probability : (idx === 0 ? 0.75 : 0.25);
                                                console.log(`  Diagnosis ${idx}: name="${name}", prob=${d.probability}, usedProb=${prob}`);
                                                const percentage = Math.round(prob * 100);
                                                const isHighPriority = idx === 0;

                                                return (
                                                    <div key={idx} className="p-3 rounded-lg bg-slate-800/60">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className={`font-medium ${isHighPriority ? 'text-orange-300' : 'text-amber-300'}`}>
                                                                {name}
                                                            </span>
                                                            <span className={`text-sm font-bold ${isHighPriority ? 'text-orange-400' : 'text-amber-400'}`}>
                                                                {percentage}%
                                                            </span>
                                                        </div>
                                                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${isHighPriority
                                                                    ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]'
                                                                    : 'bg-gradient-to-r from-amber-500 to-yellow-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                                                                    }`}
                                                                style={{ width: `${percentage}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Section 3: Recommended Actions */}
                            {(() => {
                                const summary = selectedRequest.mechanic_summary as any;
                                let actions = summary?.recommendedActions || summary?.recommendations || [];

                                // Fallback for single recommendation string
                                if (actions.length === 0 && summary?.recommendation) {
                                    actions = [summary.recommendation];
                                }

                                if (actions.length === 0) return null;

                                return (
                                    <div className="p-4 rounded-lg bg-slate-900/50 backdrop-blur-sm border-r-[3px] border-r-cyan-500">
                                        <h4 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                                            <Wrench className="w-4 h-4 text-cyan-400" />
                                            פעולות מומלצות לצוות
                                        </h4>
                                        <ol className="space-y-2">
                                            {actions.map((action: string, idx: number) => (
                                                <li key={idx} className="text-slate-300 text-sm flex items-start gap-2">
                                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">
                                                        {idx + 1}
                                                    </span>
                                                    <span>{action}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-white/10 bg-slate-900/50">
                            {/* Delete Confirmation */}
                            {showDeleteConfirm ? (
                                <div className="flex items-center justify-between bg-red-900/30 border border-red-500/40 rounded-xl p-4">
                                    <span className="text-red-300">האם אתה בטוח שברצונך למחוק?</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowDeleteConfirm(false)}
                                            className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
                                        >
                                            ביטול
                                        </button>
                                        <button
                                            onClick={() => handleDelete(selectedRequest.id)}
                                            disabled={deleting}
                                            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            מחק
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center">
                                    {/* Delete - De-emphasized */}
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="text-red-400/70 hover:text-red-400 transition flex items-center gap-1.5 text-sm"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        מחק
                                    </button>

                                    {/* Main Actions */}
                                    <div className="flex gap-3">
                                        {(selectedRequest.status === 'pending' || selectedRequest.status === 'viewed') && (
                                            <>
                                                <button
                                                    onClick={async () => {
                                                        await updateStatus(selectedRequest.id, 'closed_no');
                                                        setSelectedRequest(null);
                                                    }}
                                                    disabled={updatingStatus}
                                                    className="px-5 py-2.5 rounded-xl bg-transparent border border-slate-600 text-slate-300 font-medium hover:bg-slate-800 hover:text-white transition-all flex items-center gap-2 disabled:opacity-50"
                                                >
                                                    {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                                    סיים ללא טיפול
                                                </button>
                                                <button
                                                    onClick={() => router.push(`/garage/requests/${selectedRequest.id}/report`)}
                                                    className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] flex items-center gap-2"
                                                >
                                                    <Wrench className="w-4 h-4" />
                                                    דווח על סיום טיפול
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
