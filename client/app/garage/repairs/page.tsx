// client/app/garage/repairs/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Wrench, Loader2, AlertCircle, Filter, FileText, Edit } from 'lucide-react';

type Repair = {
    id: string;
    ai_summary: string;
    mechanic_notes: string;
    status: string;
    final_issue_type: string;
    created_at: string;
    updated_at: string;
    request: {
        id: string;
        problem_description: string;
        created_at: string;
    } | null;
    car: {
        id: string;
        license_plate: string;
        manufacturer: string;
        model: string;
    } | null;
    user: {
        id: string;
        full_name: string;
        phone: string;
    } | null;
};

export default function GarageRepairsPage() {
    const [repairs, setRepairs] = useState<Repair[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Filters
    const [statusFilter, setStatusFilter] = useState('all');
    const [issueTypeFilter, setIssueTypeFilter] = useState('all');
    const [manufacturerFilter, setManufacturerFilter] = useState('');
    const [modelFilter, setModelFilter] = useState('');
    
    // Selected repair for editing
    const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        mechanic_notes: '',
        status: '',
        final_issue_type: '',
    });
    const [updating, setUpdating] = useState(false);

    // Fetch repairs
    useEffect(() => {
        const fetchRepairs = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (statusFilter !== 'all') params.append('status', statusFilter);
                if (issueTypeFilter !== 'all') params.append('issue_type', issueTypeFilter);
                if (manufacturerFilter) params.append('manufacturer', manufacturerFilter);
                if (modelFilter) params.append('model', modelFilter);

                const response = await fetch(`/api/garage/repairs/list?${params.toString()}`);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch repairs');
                }
                
                setRepairs(data.repairs || []);
            } catch (err) {
                console.error('Error fetching repairs:', err);
                setError(err instanceof Error ? err.message : 'Failed to load repairs');
            } finally {
                setLoading(false);
            }
        };

        fetchRepairs();
    }, [statusFilter, issueTypeFilter, manufacturerFilter, modelFilter]);

    // Open edit modal
    const handleEditRepair = (repair: Repair) => {
        setSelectedRepair(repair);
        setEditForm({
            mechanic_notes: repair.mechanic_notes || '',
            status: repair.status || 'in_progress',
            final_issue_type: repair.final_issue_type || '',
        });
        setEditModalOpen(true);
    };

    // Update repair
    const handleUpdateRepair = async () => {
        if (!selectedRepair) return;

        setUpdating(true);
        try {
            const response = await fetch(`/api/garage/repairs/${selectedRepair.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(editForm),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update repair');
            }

            // Refresh repairs list
            const refreshResponse = await fetch(`/api/garage/repairs/list`);
            const refreshData = await refreshResponse.json();
            setRepairs(refreshData.repairs || []);

            setEditModalOpen(false);
            setSelectedRepair(null);
            alert('התיקון עודכן בהצלחה!');
        } catch (err) {
            console.error('Error updating repair:', err);
            alert(err instanceof Error ? err.message : 'Failed to update repair');
        } finally {
            setUpdating(false);
        }
    };

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('he-IL');
    };

    // Status display
    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { text: string; class: string }> = {
            in_progress: { text: 'בטיפול', class: 'bg-yellow-900/50 text-yellow-300' },
            completed: { text: 'הושלם', class: 'bg-green-900/50 text-green-300' },
            on_hold: { text: 'בהמתנה', class: 'bg-orange-900/50 text-orange-300' },
            cancelled: { text: 'בוטל', class: 'bg-red-900/50 text-red-300' },
        };
        return statusMap[status] || { text: status, class: 'bg-gray-900/50 text-gray-300' };
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
                <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
            </div>

            <div dir="rtl" className="relative mx-auto max-w-7xl px-6 py-8">
                <h1 className="text-4xl font-extrabold text-white mb-8 border-b border-white/10 pb-4 flex items-center gap-3">
                    <Wrench className="w-8 h-8 text-cyan-300" /> היסטוריית טיפולים של המוסך
                </h1>

                {/* Filters */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md mb-8">
                    <h2 className="text-xl font-semibold text-cyan-300 flex items-center gap-2 mb-4">
                        <Filter className="w-5 h-5" /> סינון תיקונים
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="text-sm text-slate-400 block mb-2">סטטוס</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
                            >
                                <option value="all">הכל</option>
                                <option value="in_progress">בטיפול</option>
                                <option value="completed">הושלם</option>
                                <option value="on_hold">בהמתנה</option>
                                <option value="cancelled">בוטל</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-sm text-slate-400 block mb-2">סוג בעיה</label>
                            <select
                                value={issueTypeFilter}
                                onChange={(e) => setIssueTypeFilter(e.target.value)}
                                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
                            >
                                <option value="all">הכל</option>
                                <option value="engine">מנוע</option>
                                <option value="brakes">בלמים</option>
                                <option value="electrical">חשמל</option>
                                <option value="ac">מיזוג אוויר</option>
                                <option value="starting">מערכת התנעה</option>
                                <option value="gearbox">תיבת הילוכים</option>
                                <option value="noise">רעש/רטט</option>
                                <option value="suspension">מתלים</option>
                                <option value="transmission">תמסורת</option>
                                <option value="fuel_system">מערכת דלק</option>
                                <option value="cooling_system">מערכת קירור</option>
                                <option value="exhaust">פליטה</option>
                                <option value="tires">צמיגים</option>
                                <option value="steering">היגוי</option>
                                <option value="other">אחר</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-sm text-slate-400 block mb-2">יצרן</label>
                            <input
                                type="text"
                                value={manufacturerFilter}
                                onChange={(e) => setManufacturerFilter(e.target.value)}
                                placeholder="הזן יצרן..."
                                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-slate-400 block mb-2">דגם</label>
                            <input
                                type="text"
                                value={modelFilter}
                                onChange={(e) => setModelFilter(e.target.value)}
                                placeholder="הזן דגם..."
                                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="text-center py-20 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin ml-3 text-sky-400" /> טוען תיקונים...
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="text-center py-20 text-red-300">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                        <p>{error}</p>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !error && repairs.length === 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>אין תיקונים להצגה</p>
                    </div>
                )}

                {/* Repairs Table */}
                {!loading && !error && repairs.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/5 shadow-xl backdrop-blur-md overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-right text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-700 text-slate-400 bg-zinc-800/50">
                                        <th className="py-3 px-4 font-normal">מזהה</th>
                                        <th className="py-3 px-4 font-normal">לקוח</th>
                                        <th className="py-3 px-4 font-normal">רכב</th>
                                        <th className="py-3 px-4 font-normal">בעיה</th>
                                        <th className="py-3 px-4 font-normal">סטטוס</th>
                                        <th className="py-3 px-4 font-normal">סוג בעיה</th>
                                        <th className="py-3 px-4 font-normal">תאריך</th>
                                        <th className="py-3 px-4 font-normal">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {repairs.map((repair) => {
                                        const statusBadge = getStatusBadge(repair.status);
                                        return (
                                            <tr
                                                key={repair.id}
                                                className="border-b border-white/5 hover:bg-white/10 transition cursor-pointer"
                                            >
                                                <td className="py-3 px-4 text-slate-200">#{repair.id}</td>
                                                <td className="py-3 px-4 text-slate-200">
                                                    {repair.user?.full_name || '—'}
                                                </td>
                                                <td className="py-3 px-4 text-slate-200">
                                                    <div>{repair.car?.manufacturer} {repair.car?.model}</div>
                                                    <div className="text-xs text-slate-400">{repair.car?.license_plate}</div>
                                                </td>
                                                <td className="py-3 px-4 text-slate-200 max-w-xs truncate">
                                                    {repair.request?.problem_description || '—'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge.class}`}>
                                                        {statusBadge.text}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-slate-200">
                                                    {repair.final_issue_type || '—'}
                                                </td>
                                                <td className="py-3 px-4 text-slate-400">{formatDate(repair.created_at)}</td>
                                                <td className="py-3 px-4">
                                                    <button
                                                        onClick={() => handleEditRepair(repair)}
                                                        className="bg-sky-600 hover:bg-sky-700 text-white p-2 rounded-full text-sm transition"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editModalOpen && selectedRepair && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-xl max-w-2xl w-full p-6" dir="rtl">
                        <h2 className="text-2xl font-bold text-white mb-6">עדכון תיקון #{selectedRepair.id}</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-slate-400 block mb-2">סטטוס</label>
                                <select
                                    value={editForm.status}
                                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                    className="w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
                                >
                                    <option value="in_progress">בטיפול</option>
                                    <option value="completed">הושלם</option>
                                    <option value="on_hold">בהמתנה</option>
                                    <option value="cancelled">בוטל</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm text-slate-400 block mb-2">סוג בעיה סופי</label>
                                <select
                                    value={editForm.final_issue_type}
                                    onChange={(e) => setEditForm({ ...editForm, final_issue_type: e.target.value })}
                                    className="w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
                                >
                                    <option value="">בחר סוג בעיה...</option>
                                    <option value="engine">מנוע</option>
                                    <option value="brakes">בלמים</option>
                                    <option value="electrical">חשמל</option>
                                    <option value="ac">מיזוג אוויר</option>
                                    <option value="starting">מערכת התנעה</option>
                                    <option value="gearbox">תיבת הילוכים</option>
                                    <option value="noise">רעש/רטט</option>
                                    <option value="suspension">מתלים</option>
                                    <option value="transmission">תמסורת</option>
                                    <option value="fuel_system">מערכת דלק</option>
                                    <option value="cooling_system">מערכת קירור</option>
                                    <option value="exhaust">פליטה</option>
                                    <option value="tires">צמיגים</option>
                                    <option value="steering">היגוי</option>
                                    <option value="other">אחר</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm text-slate-400 block mb-2">הערות מכונאי (אופציונלי)</label>
                                <textarea
                                    value={editForm.mechanic_notes}
                                    onChange={(e) => setEditForm({ ...editForm, mechanic_notes: e.target.value })}
                                    placeholder="הזן הערות על התיקון..."
                                    rows={5}
                                    className="w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-6">
                            <button
                                onClick={handleUpdateRepair}
                                disabled={updating}
                                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
                            >
                                {updating ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" /> מעדכן...
                                    </span>
                                ) : (
                                    'עדכן תיקון'
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setEditModalOpen(false);
                                    setSelectedRepair(null);
                                }}
                                disabled={updating}
                                className="flex-1 bg-zinc-700 hover:bg-zinc-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
                            >
                                ביטול
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
