// client/app/garage/requests/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MessageSquare, CheckCircle, Clock, Search, Loader2, AlertCircle } from 'lucide-react';

type Request = {
    id: number;
    description: string;
    problem_description: string;
    status: string;
    created_at: string;
    client: {
        id: string;
        name: string;
        phone: string;
        email: string;
    } | null;
    car: {
        id: string;
        license_plate: string;
        manufacturer: string;
        model: string;
        year: string;
        full_name: string;
    } | null;
};

const filters = [
    { key: 'all', label: 'כל הפניות', icon: Mail },
    { key: 'new', label: 'לא נקראו', icon: Clock },
    { key: 'pending', label: 'נקראו ולא נענו', icon: MessageSquare },
    { key: 'answered', label: 'נקראו ונענו', icon: CheckCircle },
];

export default function GarageInquiriesPage() {
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Fetch requests from API
    useEffect(() => {
        const fetchRequests = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/garage/requests/list?status=${activeFilter}&search=${encodeURIComponent(searchTerm)}`);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch requests');
                }
                
                setRequests(data.requests || []);
            } catch (err) {
                console.error('Error fetching requests:', err);
                setError(err instanceof Error ? err.message : 'Failed to load requests');
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, [activeFilter, searchTerm]);

    const filteredInquiries = useMemo(() => {
        return requests;
    }, [requests]);

    // Navigate to request details
    const handleOpenDetails = (inquiryId: number) => {
        router.push(`/garage/requests/${inquiryId}`); 
    };

    // Format date to readable format
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('he-IL');
    };

    // Map status to display
    const getStatusDisplay = (status: string) => {
        switch (status) {
            case 'open':
                return { text: 'חדש', class: 'bg-red-900/50 text-red-300' };
            case 'pending':
                return { text: 'בטיפול', class: 'bg-yellow-900/50 text-yellow-300' };
            case 'answered':
            case 'closed':
                return { text: 'נענה', class: 'bg-green-900/50 text-green-300' };
            case 'accepted':
                return { text: 'התקבל', class: 'bg-blue-900/50 text-blue-300' };
            default:
                return { text: status, class: 'bg-gray-900/50 text-gray-300' };
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
            {/* אפקטי רקע... */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
                <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
                <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-indigo-600/20 blur-[180px]" />
            </div>

            <main dir="rtl" className="relative mx-auto w-full max-w-7xl px-6 pb-16 pt-8 sm:px-10 lg:px-12">
                <h1 className="text-4xl font-extrabold text-white mb-8 border-b border-white/10 pb-4">
                    פניות מלקוחות (Inbox)
                </h1>

                <section className="flex flex-wrap gap-4 mb-8">
                    {filters.map(filter => {
                        const Icon = filter.icon;
                        const isActive = activeFilter === filter.key;
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
                                <Icon className="w-5 h-5"/> {filter.label}
                            </button>
                        );
                    })}
                </section>

                <section className="rounded-xl border border-white/10 bg-white/5 shadow-xl backdrop-blur-md overflow-hidden">
                    {/* כותרת הטבלה וסרגל חיפוש */}
                    <div className="flex justify-between items-center p-4 border-b border-white/10">
                        <h2 className="text-xl font-semibold text-slate-200">
                            פניות: {filters.find(f => f.key === activeFilter)?.label}
                        </h2>
                        <div className="flex items-center gap-3">
                            <Search className="w-5 h-5 text-slate-400"/>
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

                    {/* Loading state */}
                    {loading && (
                        <div className="text-center py-20 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin ml-3 text-sky-400"/> טוען פניות...
                        </div>
                    )}

                    {/* Error state */}
                    {error && (
                        <div className="text-center py-20 text-red-300">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2"/>
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !error && filteredInquiries.length === 0 && (
                        <div className="text-center py-20 text-slate-400">
                            <Mail className="w-12 h-12 mx-auto mb-4 opacity-50"/>
                            <p>אין פניות להצגה</p>
                        </div>
                    )}

                    {/* Table with data */}
                    {!loading && !error && filteredInquiries.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-right text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-700 text-slate-400 bg-zinc-800/50">
                                        <th className="py-3 px-4 font-normal">לקוח/רכב</th>
                                        <th className="py-3 px-4 font-normal">תקלה עיקרית</th>
                                        <th className="py-3 px-4 font-normal">תאריך פנייה</th>
                                        <th className="py-3 px-4 font-normal">סטטוס</th>
                                        <th className="py-3 px-4 font-normal">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInquiries.map((item) => {
                                        const statusDisplay = getStatusDisplay(item.status);
                                        return (
                                            <tr key={item.id} className="border-b border-white/5 hover:bg-white/10 transition">
                                                <td className="py-3 px-4 cursor-pointer" onClick={() => handleOpenDetails(item.id)}>
                                                    <div className="font-semibold text-slate-100">{item.client?.name || 'לקוח לא ידוע'}</div>
                                                    <div className="text-xs text-slate-400">{item.car?.full_name || 'רכב לא ידוע'}</div>
                                                </td>
                                                <td className="py-3 px-4 text-slate-200 max-w-xs truncate">
                                                    {item.problem_description || item.description || '—'}
                                                </td>
                                                <td className="py-3 px-4 text-slate-400">{formatDate(item.created_at)}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusDisplay.class}`}>
                                                        {statusDisplay.text}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <button
                                                        onClick={() => handleOpenDetails(item.id)} 
                                                        className="bg-sky-600 hover:bg-sky-700 text-white p-2 rounded-full text-sm transition"
                                                    >
                                                        <MessageSquare className="w-4 h-4"/>
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
        </div>
    );
}
