// client/app/garage/requests/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation'; // <--- הוספת useRouter
import { Mail, MessageSquare, CheckCircle, Clock, Search } from 'lucide-react';

// נתוני דמה לבדיקת העיצוב
const mockInquiries = [
    { id: 101, client: 'דניאל לוי', car: 'מאזדה 3 (2018)', fault: 'רעש מוזר בבלמים', status: 'new', date: '2025-12-05' },
    { id: 102, client: 'מאיה כהן', car: 'יונדאי i30 (2020)', fault: 'נורת מנוע דולקת', status: 'pending', date: '2025-12-04' },
    { id: 103, client: 'רועי שואף', car: 'קיה פיקנטו (2022)', fault: 'מצבר חלש', status: 'answered', date: '2025-12-03' },
    { id: 104, client: 'אחיעד רכטמן', car: 'טויוטה קורולה (2019)', fault: 'רדיאטור נוזל', status: 'new', date: '2025-12-02' },
];

const filters = [
    { key: 'all', label: 'כל הפניות', icon: Mail },
    { key: 'new', label: 'לא נקראו', icon: Clock },
    { key: 'pending', label: 'נקראו ולא נענו', icon: MessageSquare },
    { key: 'answered', label: 'נקראו ונענו', icon: CheckCircle },
];

export default function GarageInquiriesPage() {
    const [activeFilter, setActiveFilter] = useState('all');
    const router = useRouter(); // <--- אתחול ה-Router

    const filteredInquiries = useMemo(() => {
        if (activeFilter === 'all') return mockInquiries;
        return mockInquiries.filter(i => i.status === activeFilter);
    }, [activeFilter]);

    // *** פונקציה לחיבור לדף הפירוט (Request Details) ***
    const handleOpenDetails = (inquiryId: number) => {
        // מנווט לדף הדינמי: /garage/requests/101
        router.push(`/garage/requests/${inquiryId}`); 
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
                    {/* ...כותרת הטבלה וסרגל חיפוש... */}
                    <div className="flex justify-between items-center p-4 border-b border-white/10">
                        <h2 className="text-xl font-semibold text-slate-200">
                            פניות: {filters.find(f => f.key === activeFilter)?.label}
                        </h2>
                        <div className="flex items-center gap-3">
                            <Search className="w-5 h-5 text-slate-400"/>
                            <input 
                                type="text"
                                placeholder="חיפוש לפי שם לקוח או רכב..."
                                className="bg-zinc-800/80 border border-zinc-700 p-2 rounded-lg text-white text-sm placeholder-slate-500 focus:ring-sky-500 focus:border-sky-500 transition"
                                dir="rtl"
                            />
                        </div>
                    </div>

                    {/* הטבלה עצמה */}
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
                                {filteredInquiries.map((item) => (
                                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/10 transition">
                                        <td className="py-3 px-4 cursor-pointer" onClick={() => handleOpenDetails(item.id)}> {/* לחיצה על הנתון פותחת את הפירוט */}
                                            <div className="font-semibold text-slate-100">{item.client}</div>
                                            <div className="text-xs text-slate-400">{item.car}</div>
                                        </td>
                                        <td className="py-3 px-4 text-slate-200">{item.fault}</td>
                                        <td className="py-3 px-4 text-slate-400">{item.date}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${item.status === 'new' ? 'bg-red-900/50 text-red-300' : item.status === 'pending' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-green-900/50 text-green-300'}`}>
                                                {item.status === 'new' ? 'חדש' : item.status === 'pending' ? 'בטיפול' : 'נענה'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            {/* כפתור שיפתח את הצ'אט (בשלב הפירוט) */}
                                            <button
                                                onClick={() => handleOpenDetails(item.id)} 
                                                className="bg-sky-600 hover:bg-sky-700 text-white p-2 rounded-full text-sm transition"
                                            >
                                                <MessageSquare className="w-4 h-4"/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    );
}