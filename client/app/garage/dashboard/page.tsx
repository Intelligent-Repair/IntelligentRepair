// client/app/garage/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Car, Wrench, Bot, ChevronLeft, ChevronRight, Loader2, Home, Database, Globe, X } from 'lucide-react';

interface ConsultationSummary {
  shortDescription?: string;
  formattedText?: string;
  conversationLog?: string;
  topDiagnosis?: Array<{ name: string; probability?: number; recommendation?: string }>;
}

interface Repair {
  id: string;
  vehicle: {
    manufacturer: string;
    model: string;
    year: number | null;
    licensePlate: string;
  } | null;
  issueType: string;
  issueTypeLabel: string;
  consultationSummary: ConsultationSummary | null;
  mechanicSolution: string | null;
  completedAt: string | null;
}

interface FilterOptions {
  manufacturers: string[];
  modelsByManufacturer: Record<string, string[]>;
  issueTypes: Array<{ value: string; label: string }>;
  years: number[];
}


interface TopVehicle {
  manufacturer: string;
  model: string;
  count: number;
}

interface TopIssue {
  issue_description: string;
  occurrences: number;
}

export default function GarageKnowledgeBasePage() {
  const router = useRouter();

  // State
  const [mode, setMode] = useState<"local" | "global">("local");
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);

  // Stats State
  const [topVehicles, setTopVehicles] = useState<TopVehicle[]>([]);
  const [topIssues, setTopIssues] = useState<TopIssue[]>([]);

  // Modal state
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);

  // Filters
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedIssueType, setSelectedIssueType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [licensePlate, setLicensePlate] = useState<string>("");

  // Fetch repairs
  const fetchRepairs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("mode", mode);
      params.set("offset", offset.toString());
      if (selectedManufacturer) params.set("manufacturer", selectedManufacturer);
      if (selectedModel) params.set("model", selectedModel);
      if (selectedYear) params.set("year", selectedYear);
      if (selectedIssueType !== "all") params.set("issueType", selectedIssueType);
      if (dateRange !== "all") params.set("dateRange", dateRange);
      if (licensePlate) params.set("licensePlate", licensePlate);

      const res = await fetch(`/api/garage/knowledge-base?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch repairs");
      }

      setRepairs(data.repairs || []);
      setTotalCount(data.totalCount || 0);
      if (data.filters) {
        setFilterOptions(data.filters);
      }
    } catch (err) {
      console.error('[KnowledgeBase] Error:', err);
      setError(err instanceof Error ? err.message : "שגיאה בטעינת הנתונים");
    } finally {
      setLoading(false);
    }
  }, [mode, offset, selectedManufacturer, selectedModel, selectedYear, selectedIssueType, dateRange, licensePlate]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("mode", mode);
      if (dateRange !== "all") params.set("dateRange", dateRange);

      const [vehiclesRes, issuesRes] = await Promise.all([
        fetch(`/api/garage/dashboard/top-models?${params.toString()}`),
        fetch(`/api/garage/dashboard/top-issues?${params.toString()}`)
      ]);

      const vehiclesData = await vehiclesRes.json();
      const issuesData = await issuesRes.json();

      if (vehiclesRes.ok) setTopVehicles(vehiclesData.top5 || []);
      if (issuesRes.ok) setTopIssues(issuesData.top5 || []);

    } catch (err) {
      console.error('[Dashboard] Error fetching stats:', err);
    }
  }, [mode, dateRange]);

  // Initial load and reload on filter change
  useEffect(() => {
    fetchRepairs();
    fetchStats();
  }, [fetchRepairs, fetchStats]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [mode, selectedManufacturer, selectedModel, selectedYear, selectedIssueType, dateRange, licensePlate]);

  // Get available models based on selected manufacturer
  const availableModels = useMemo(() => {
    if (!filterOptions || !selectedManufacturer) return [];
    return filterOptions.modelsByManufacturer[selectedManufacturer] || [];
  }, [filterOptions, selectedManufacturer]);

  // Reset model and year when manufacturer changes
  useEffect(() => {
    setSelectedModel("");
    setSelectedYear("");
  }, [selectedManufacturer]);

  // Pagination
  const handleNextPage = () => setOffset(prev => prev + 12);
  const handlePrevPage = () => setOffset(prev => Math.max(0, prev - 12));

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("he-IL");
  };

  // Format AI summary for display
  const formatConsultationSummary = (summary: ConsultationSummary | null) => {
    if (!summary) return null;

    // Try to get the most useful summary text
    if (summary.formattedText) return summary.formattedText;
    if (summary.shortDescription) return summary.shortDescription;
    if (summary.topDiagnosis && summary.topDiagnosis.length > 0) {
      return summary.topDiagnosis.map(d =>
        `• ${d.name}${d.probability ? ` (${Math.round(d.probability * 100)}%)` : ''}${d.recommendation ? ` - ${d.recommendation}` : ''}`
      ).join('\n');
    }
    return null;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[200px]" />
        <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
      </div>

      {/* Modal */}
      {selectedRepair && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setSelectedRepair(null)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-gradient-to-b from-[#0a1628] to-[#071226] border border-white/20 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#0a1628] border-b border-white/10 p-6 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <Car className="w-8 h-8 text-cyan-400" />
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {selectedRepair.vehicle?.manufacturer || 'רכב לא ידוע'} {selectedRepair.vehicle?.model || ''}
                    {selectedRepair.vehicle?.year && ` (${selectedRepair.vehicle.year})`}
                  </h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="px-3 py-1 rounded-full bg-cyan-900/50 text-cyan-300 text-sm font-medium">
                      {selectedRepair.issueTypeLabel}
                    </span>
                    {selectedRepair.completedAt && (
                      <span className="text-slate-400 text-sm">
                        {formatDate(selectedRepair.completedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedRepair(null)}
                className="p-2 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6" dir="rtl">
              {/* AI Consultation Summary */}
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-cyan-300 mb-3">
                  <Bot className="w-5 h-5" />
                  סיכום ייעוץ AI
                </h3>
                <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/20">
                  {formatConsultationSummary(selectedRepair.consultationSummary) ? (
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                      {formatConsultationSummary(selectedRepair.consultationSummary)}
                    </p>
                  ) : (
                    <p className="text-slate-400 text-sm">לא קיים סיכום ייעוץ AI לתיקון זה</p>
                  )}
                </div>
              </div>

              {/* Mechanic Solution */}
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-green-300 mb-3">
                  <Wrench className="w-5 h-5" />
                  פתרון המכונאי
                </h3>
                <div className="p-4 rounded-xl bg-green-900/20 border border-green-500/20">
                  {selectedRepair.mechanicSolution ? (
                    <p className="text-green-100 text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedRepair.mechanicSolution}
                    </p>
                  ) : (
                    <p className="text-slate-400 text-sm">לא תועד פתרון לתיקון זה</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main dir="rtl" className="relative mx-auto w-full max-w-7xl px-6 pb-16 pt-8 sm:px-10 lg:px-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Database className="w-8 h-8 text-cyan-300" />
            <div>
              <h1 className="text-3xl font-extrabold text-white">מאגר ידע תיקונים</h1>
              <p className="text-sm text-slate-400 mt-1">חפש פתרונות לתקלות מתיקונים קודמים</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/garage')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
          >
            <Home className="w-5 h-5" />
            חזרה לתפריט
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setMode('local')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition ${mode === 'local'
              ? 'bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/30'
              : 'bg-white/10 text-white hover:bg-white/20'
              }`}
          >
            <Wrench className="w-5 h-5" />
            המוסך שלי
          </button>
          <button
            onClick={() => setMode('global')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition ${mode === 'global'
              ? 'bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/30'
              : 'bg-white/10 text-white hover:bg-white/20'
              }`}
          >
            <Globe className="w-5 h-5" />
            כל המוסכים
          </button>
        </div>

        {/* Filters */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md mb-8">
          <h2 className="text-lg font-semibold text-cyan-300 flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5" />
            סינון
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* License Plate */}
            <div>
              <label className="text-sm text-slate-400 block mb-2">מספר רכב</label>
              <input
                type="text"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                placeholder="חפש לוחית רישוי..."
                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
            {/* Manufacturer */}
            <div>
              <label className="text-sm text-slate-400 block mb-2">יצרן</label>
              <select
                value={selectedManufacturer}
                onChange={(e) => setSelectedManufacturer(e.target.value)}
                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                <option value="">כל היצרנים</option>
                {filterOptions?.manufacturers.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Model */}
            <div>
              <label className="text-sm text-slate-400 block mb-2">דגם</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!selectedManufacturer}
                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white disabled:opacity-50"
              >
                <option value="">כל הדגמים</option>
                {availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="text-sm text-slate-400 block mb-2">שנה</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                <option value="">כל השנים</option>
                {filterOptions?.years?.map(y => (
                  <option key={y} value={y.toString()}>{y}</option>
                ))}
              </select>
            </div>

            {/* Issue Type */}
            <div>
              <label className="text-sm text-slate-400 block mb-2">סוג תקלה</label>
              <select
                value={selectedIssueType}
                onChange={(e) => setSelectedIssueType(e.target.value)}
                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                <option value="all">כל הסוגים</option>
                {filterOptions?.issueTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="text-sm text-slate-400 block mb-2">טווח זמן</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                <option value="all">כל הזמנים</option>
                <option value="weekly">שבוע אחרון</option>
                <option value="monthly">חודש אחרון</option>
                <option value="yearly">שנה אחרונה</option>
              </select>
            </div>
          </div>
        </section>

        {/* Results */}
        <section>
          {/* Results count */}
          {!loading && (
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-400">
                נמצאו {totalCount} תיקונים
              </span>
              <span className="text-slate-500 text-sm">לחץ על כרטיס לפרטים</span>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-20 flex flex-col items-center">
              <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mb-4" />
              <span className="text-slate-400">טוען תיקונים...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-center py-20 text-red-400 bg-red-900/20 rounded-xl border border-red-500/30 p-6">
              <p className="font-semibold mb-2">שגיאה</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && repairs.length === 0 && (
            <div className="text-center py-20 text-slate-400 bg-white/5 rounded-xl border border-white/10">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>לא נמצאו תיקונים התואמים לחיפוש</p>
            </div>
          )}

          {/* Repair Cards - Clickable Grid */}
          {!loading && !error && repairs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {repairs.map((repair) => (
                <div
                  key={repair.id}
                  onClick={() => setSelectedRepair(repair)}
                  className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-md hover:border-cyan-500/50 hover:bg-white/10 transition group"
                >
                  {/* Vehicle Info */}
                  <div className="flex items-center gap-3 mb-3">
                    <Car className="w-6 h-6 text-cyan-400 group-hover:text-cyan-300" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold truncate">
                        {repair.vehicle?.manufacturer || 'רכב לא ידוע'} {repair.vehicle?.model || ''}
                      </h3>
                      {repair.vehicle?.year && (
                        <span className="text-slate-400 text-sm">{repair.vehicle.year}</span>
                      )}
                    </div>
                  </div>

                  {/* Issue Type Badge */}
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-cyan-900/50 text-cyan-300 text-xs font-medium">
                      {repair.issueTypeLabel}
                    </span>
                    {repair.completedAt && (
                      <span className="text-slate-500 text-xs">
                        {formatDate(repair.completedAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && repairs.length > 0 && (
            <div className="flex justify-between items-center mt-6">
              <button
                onClick={handlePrevPage}
                disabled={offset === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${offset === 0
                  ? 'bg-zinc-800 text-slate-500 cursor-not-allowed'
                  : 'bg-zinc-800 text-white border border-zinc-700 hover:border-cyan-500'
                  }`}
              >
                <ChevronRight className="w-5 h-5" />
                הקודם
              </button>
              <span className="text-slate-400">
                עמוד {Math.floor(offset / 12) + 1}
              </span>
              <button
                onClick={handleNextPage}
                disabled={offset + 12 >= totalCount}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${offset + 12 >= totalCount
                  ? 'bg-zinc-800 text-slate-500 cursor-not-allowed'
                  : 'bg-zinc-800 text-white border border-zinc-700 hover:border-cyan-500'
                  }`}
              >
                הבא
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          )}
        </section>

        {/* Top Stats Section */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            {/* Top 5 Vehicles */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-xl backdrop-blur-md">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Car className="w-6 h-6 text-purple-400" />
                5 הרכבים הנפוצים
              </h3>
              <div className="space-y-4">
                {topVehicles.length > 0 ? (
                  topVehicles.map((vehicle, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-purple-500/20 text-purple-300 text-sm font-bold">
                          {index + 1}
                        </span>
                        <span className="text-white font-medium">
                          {vehicle.manufacturer} {vehicle.model !== 'לא ידוע' ? vehicle.model : ''}
                        </span>
                      </div>
                      <span className="text-slate-400 text-sm">
                        {vehicle.count} תיקונים
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 py-8">
                    אין נתונים להצגה
                  </div>
                )}
              </div>
            </div>

            {/* Top 5 Issues */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-xl backdrop-blur-md">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Wrench className="w-6 h-6 text-pink-400" />
                5 התקלות הנפוצות
              </h3>
              <div className="space-y-4">
                {topIssues.length > 0 ? (
                  topIssues.map((issue, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-pink-500/20 text-pink-300 text-sm font-bold">
                          {index + 1}
                        </span>
                        <span className="text-white font-medium">
                          {issue.issue_description}
                        </span>
                      </div>
                      <span className="text-slate-400 text-sm">
                        {issue.occurrences} מקרים
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 py-8">
                    אין נתונים להצגה
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div >
  );
}
