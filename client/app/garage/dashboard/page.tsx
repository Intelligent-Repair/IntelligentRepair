// client/app/garage/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
// הוספנו את Loader2 ואימתנו את כל שאר האייקונים
import { Filter, Car, Wrench, DollarSign, Clock, BarChart3, TrendingUp, ChevronDown, Loader2 } from 'lucide-react'; 
import { useRouter } from 'next/navigation';

// --- נתוני דמה (Mock Data) לתרשים ולמדדים ---
const mockTopFaults = [
    { name: 'תקלת Check Engine', count: 68 },
    { name: 'רעש בבלמים', count: 45 },
    { name: 'מצבר חלש', count: 35 },
    { name: 'בעיית חיישן חום', count: 20 },
    { name: 'החלפת שמן/טיפול תקופתי', count: 15 },
];

const mockKPIs = {
    monthlyRepairs: 124,
    monthlyRevenue: '₪ 145,800',
    repairsChange: 12.5, // שינוי חודשי (%)
};

// הגדרת טיפוסים לנתונים
type TopItem = { name: string; count: number; };

export default function GarageDashboardPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [topFaults, setTopFaults] = useState<TopItem[]>(mockTopFaults);
    
    // נתוני סינון (כפי שהגדרנו קודם)
    const [filters, setFilters] = useState({
        timeframe: 'monthly',
    });

    // פונקציה לטעינת נתונים (תתחבר ל-Supabase RPC בהמשך)
    const fetchAnalytics = useCallback(async () => {
        setIsLoading(true);
        // ... Supabase logic here (RPC call to get filtered data) ...
        await new Promise(resolve => setTimeout(resolve, 800)); 
        setIsLoading(false);
    }, [filters]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);


    // רכיב כרטיס KPI קטן
    const KPICard = ({ title, value, icon: Icon, change }: { 
        title: string; 
        value: string | number; 
        icon: React.ElementType; 
        change?: number; 
    }) => (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between">
                <Icon className="w-8 h-8 text-sky-400 p-1 rounded-full bg-sky-900/30"/>
                {change !== undefined && (
                    <div className={`flex items-center text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        <TrendingUp className={`w-4 h-4 ml-1 ${change < 0 && 'transform rotate-180 text-red-400'}`} />
                        {Math.abs(change).toFixed(1)}%
                    </div>
                )}
            </div>
            <p className="text-sm text-slate-400 mt-3">{title}</p>
            <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
    );

    return (
        // מעטפת הרקע הכהה והיוקרתית של הפרויקט
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
             {/* אפקטי האור והטשטוש */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
                <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
            </div>

            <main dir="rtl" className="relative mx-auto w-full max-w-7xl px-6 pb-16 pt-8 sm:px-10 lg:px-12">
                
                <h1 className="text-4xl font-extrabold text-white mb-8 border-b border-white/10 pb-4 flex items-center gap-3">
                    <BarChart3 className="w-8 h-8 text-cyan-300"/> דשבורד אנליטי - תובנות מוסך
                </h1>

                {/* --- 1. אזור הסינון (Filters) --- */}
                <section className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md mb-10">
                    <div className="flex justify-between items-center">
                         <h2 className="text-xl font-semibold text-cyan-300 flex items-center gap-2">
                            <Filter className="w-5 h-5"/> סינון נתונים
                        </h2>
                        {/* כאן ניתן להרחיב לסינון לפי יצרן / דגם / תקלה */}
                        <div className="flex items-center gap-3">
                            <label className="text-sm text-slate-400">צפייה לפי:</label>
                            <select
                                className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:ring-sky-500 flex items-center gap-1"
                                value={filters.timeframe}
                                onChange={(e) => setFilters({ ...filters, timeframe: e.target.value })}
                            >
                                <option value="monthly">חודש נוכחי</option>
                                <option value="quarterly">רבעון אחרון</option>
                                <option value="yearly">שנה אחרונה</option>
                            </select>
                        </div>
                    </div>
                </section>
                
                {isLoading && (
                    <div className="text-center py-10 text-xl text-slate-400 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin mr-3"/> טוען נתוני אנליטיקה...
                    </div>
                )}
                
                {!isLoading && (
                    <section className="space-y-8">
                        
                        {/* --- 2. מדדי ביצוע עיקריים (KPIs) --- */}
                        {/* שונה מ-md:grid-cols-3 ל-md:grid-cols-2 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> 
                            <KPICard 
                                title="סה״כ טיפולים חודשי"
                                value={mockKPIs.monthlyRepairs}
                                icon={Wrench}
                                change={mockKPIs.repairsChange}
                            />
                            <KPICard 
                                title="הכנסה כוללת (חודש)"
                                value={mockKPIs.monthlyRevenue}
                                icon={DollarSign}
                                change={-4.2}
                            />
                            {/* הוסר: זמן טיפול ממוצע */}
                        </div>

                        {/* --- 3. תרשים ורשימת תקלות --- */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* רכיב תרשים עוגה */}
                            <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md h-[400px] flex flex-col justify-center items-center">
                                <h2 className="text-xl font-semibold mb-4 text-sky-400">
                                    פילוח TOP 10 תקלות (תרשים עוגה)
                                </h2>
                                <div className="text-slate-500 py-10">
                                    [Placeholder for Chart.js Pie Chart Component]
                                </div>
                            </div>
                            
                            {/* רשימת ה-TOP 5 (טבלת נתונים) */}
                            <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md h-full">
                                <h2 className="text-xl font-semibold mb-4 text-sky-400">
                                    TOP 5 תקלות נפוצות
                                </h2>
                                <ul className="space-y-3">
                                    {topFaults.map((item, index) => (
                                        <li key={item.name} className="flex justify-between items-center bg-zinc-800/50 p-3 rounded-lg border border-zinc-700 hover:border-sky-500/50 transition">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-cyan-300">{index + 1}.</span>
                                                <span className="text-slate-200">{item.name}</span>
                                            </div>
                                            <span className="text-sm font-bold text-red-400 bg-red-900/30 px-3 py-1 rounded-full">{item.count}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}