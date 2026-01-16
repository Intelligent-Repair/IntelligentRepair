// client/app/garage/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Car, Wrench, Bot, ChevronLeft, ChevronRight, Loader2, Home, Database, Globe, X, Clock } from 'lucide-react';

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
  laborHours: number | null;
  status: 'in_progress' | 'completed' | 'on_hold' | 'cancelled' | string;
  aiSummary: string | null;
  consultationSummary: ConsultationSummary | null;
  mechanicSolution: string | null;
  mechanicSummary: {
    conversationNarrative?: string;
    driverFindings?: string[];
    diagnoses?: Array<{ issue: string; probability: number }>;
    recommendedActions?: string[];
    urgency?: string;
  } | null;
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

      const res = await fetch(`/api/garage/dashboard/repairs?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch repairs");
      }

      // Transform API response to match component's Repair interface
      const transformedRepairs: Repair[] = (data.repairs || []).map((r: any) => ({
        id: r.id,
        vehicle: r.vehicle_info ? {
          manufacturer: r.vehicle_info.manufacturer || 'לא ידוע',
          model: r.vehicle_info.model || '',
          year: r.vehicle_info.year || null,
          licensePlate: r.vehicle_info.license_plate || '',
        } : null,
        issueType: r.final_issue_type || 'other',
        issueTypeLabel: r.final_issue_type_label || 'אחר',
        laborHours: r.labor_hours || null,
        status: r.status || 'completed',
        aiSummary: r.ai_summary || null,
        consultationSummary: r.ai_summary ? { shortDescription: r.ai_summary, formattedText: r.mechanic_description_ai } : null,
        mechanicSolution: r.mechanic_notes || null,
        mechanicSummary: r.mechanic_summary || null,
        completedAt: r.completed_at || null,
      }));

      setRepairs(transformedRepairs);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      console.error('[KnowledgeBase] Error:', err);
      setError(err instanceof Error ? err.message : "שגיאה בטעינת הנתונים");
    } finally {
      setLoading(false);
    }
  }, [mode, offset, selectedManufacturer, selectedModel, selectedYear, selectedIssueType, dateRange, licensePlate]);

  // Fetch filter options from repairs data
  const fetchFilters = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("mode", mode);

      const res = await fetch(`/api/garage/dashboard/filters?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (res.ok) {
        setFilterOptions({
          manufacturers: data.manufacturers || [],
          modelsByManufacturer: data.modelsByManufacturer || {},
          issueTypes: data.issueTypes || [],
          years: data.years || [],
        });
      }
    } catch (err) {
      console.error('[Dashboard] Error fetching filters:', err);
    }
  }, [mode]);

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
    fetchFilters();
  }, [fetchRepairs, fetchStats, fetchFilters]);

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
            className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-gradient-to-b from-[#0a1628] to-[#071226] border border-white/20 shadow-2xl"
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
                  {/* Meta Row: Category + Date + Labor Hours */}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full bg-cyan-900/50 text-cyan-300 text-sm font-medium">
                      {selectedRepair.issueTypeLabel}
                    </span>
                    {selectedRepair.completedAt && (
                      <span className="text-slate-400 text-sm">
                        {formatDate(selectedRepair.completedAt)}
                      </span>
                    )}
                    {/* Labor Hours Badge */}
                    {selectedRepair.laborHours && (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-sm font-medium">
                        <Clock className="w-4 h-4" />
                        {selectedRepair.laborHours} שעות
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

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6" dir="rtl">
              {/* תיאור התקלה - Issue Description from mechanic_summary */}
              {selectedRepair.mechanicSummary && (
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-orange-300 mb-3">
                    <Bot className="w-5 h-5" />
                    תיאור התקלה
                  </h3>
                  <div className="space-y-4">
                    {/* Urgency Badge */}
                    {selectedRepair.mechanicSummary.urgency && (() => {
                      const urgencyConfig: Record<string, { label: string; bgClass: string; textClass: string }> = {
                        critical: { label: 'דחיפות קריטית', bgClass: 'bg-red-500/20', textClass: 'text-red-400' },
                        high: { label: 'דחיפות גבוהה', bgClass: 'bg-orange-500/20', textClass: 'text-orange-400' },
                        medium: { label: 'דחיפות בינונית', bgClass: 'bg-amber-500/20', textClass: 'text-amber-400' },
                        low: { label: 'דחיפות נמוכה', bgClass: 'bg-emerald-500/20', textClass: 'text-emerald-400' }
                      };
                      const config = urgencyConfig[selectedRepair.mechanicSummary.urgency!] || urgencyConfig.medium;
                      return (
                        <div className={`px-3 py-1.5 rounded-full ${config.bgClass} w-fit`}>
                          <span className={`text-sm font-semibold ${config.textClass}`}>{config.label}</span>
                        </div>
                      );
                    })()}

                    {/* Driver Findings / Conversation Narrative */}
                    {(selectedRepair.mechanicSummary.conversationNarrative || selectedRepair.mechanicSummary.driverFindings) && (
                      <div className="p-4 rounded-xl bg-slate-800/50 border border-orange-500/20">
                        <h4 className="text-sm font-semibold text-orange-300 mb-2">ממצאי תשאול הנהג</h4>
                        {selectedRepair.mechanicSummary.driverFindings && selectedRepair.mechanicSummary.driverFindings.length > 0 ? (
                          <ul className="space-y-1">
                            {selectedRepair.mechanicSummary.driverFindings.map((finding, idx) => (
                              <li key={idx} className="text-slate-300 text-sm flex items-start gap-2">
                                <span className="text-orange-400">•</span>
                                <span>{finding}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-slate-300 text-sm leading-relaxed">
                            {selectedRepair.mechanicSummary.conversationNarrative}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Probabilistic Analysis */}
                    {selectedRepair.mechanicSummary.diagnoses && selectedRepair.mechanicSummary.diagnoses.length > 0 && (
                      <div className="p-4 rounded-xl bg-slate-800/50 border border-orange-500/20">
                        <h4 className="text-sm font-semibold text-orange-300 mb-3">ניתוח הסתברותי</h4>
                        <div className="space-y-3">
                          {selectedRepair.mechanicSummary.diagnoses.map((d, idx) => {
                            const percentage = Math.round((d.probability || 0) * 100);
                            const isHighPriority = idx === 0;
                            return (
                              <div key={idx} className="p-3 rounded-lg bg-slate-800/60">
                                <div className="flex items-center justify-between mb-2">
                                  <span className={`font-medium ${isHighPriority ? 'text-orange-300' : 'text-amber-300'}`}>
                                    {d.issue}
                                  </span>
                                  <span className={`text-sm font-bold ${isHighPriority ? 'text-orange-400' : 'text-amber-400'}`}>
                                    {percentage}%
                                  </span>
                                </div>
                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${isHighPriority
                                      ? 'bg-gradient-to-r from-orange-500 to-red-500'
                                      : 'bg-gradient-to-r from-amber-500 to-yellow-500'
                                      }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Recommended Actions */}
                    {selectedRepair.mechanicSummary.recommendedActions && selectedRepair.mechanicSummary.recommendedActions.length > 0 && (
                      <div className="p-4 rounded-xl bg-slate-800/50 border border-orange-500/20">
                        <h4 className="text-sm font-semibold text-orange-300 mb-2">פעולות מומלצות</h4>
                        <ol className="space-y-2">
                          {selectedRepair.mechanicSummary.recommendedActions.map((action, idx) => (
                            <li key={idx} className="text-slate-300 text-sm flex items-start gap-2">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold">
                                {idx + 1}
                              </span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* אופן תיקון המוסך - Repair Method */}
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-cyan-300 mb-3">
                  <Wrench className="w-5 h-5" />
                  אופן תיקון המוסך
                </h3>
                <div className="p-5 rounded-xl bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/20">
                  {(selectedRepair.aiSummary || formatConsultationSummary(selectedRepair.consultationSummary)) ? (
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedRepair.aiSummary || formatConsultationSummary(selectedRepair.consultationSummary)}
                    </p>
                  ) : (
                    <p className="text-slate-400 text-sm">לא תועד אופן התיקון לטיפול זה</p>
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
              {repairs.map((repair) => {
                // Status color configuration
                const statusColors: Record<string, { border: string; bg: string; text: string }> = {
                  completed: { border: 'border-r-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
                  in_progress: { border: 'border-r-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400' },
                  on_hold: { border: 'border-r-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400' },
                  cancelled: { border: 'border-r-red-500', bg: 'bg-red-500/10', text: 'text-red-400' },
                };
                const statusConfig = statusColors[repair.status] || statusColors.completed;

                return (
                  <div
                    key={repair.id}
                    onClick={() => setSelectedRepair(repair)}
                    className={`cursor-pointer rounded-xl border border-white/10 border-r-4 ${statusConfig.border} bg-white/5 p-4 shadow-xl backdrop-blur-md hover:border-cyan-500/50 hover:bg-white/10 transition group`}
                  >
                    {/* Header: Vehicle Info + Status */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Car className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 flex-shrink-0" />
                        <div className="min-w-0">
                          <h3 className="text-white font-semibold truncate text-sm">
                            {repair.vehicle?.manufacturer || 'רכב לא ידוע'} {repair.vehicle?.model || ''}
                          </h3>
                          {repair.vehicle?.year && (
                            <span className="text-slate-500 text-xs">{repair.vehicle.year}</span>
                          )}
                        </div>
                      </div>
                      {/* License Plate */}
                      {repair.vehicle?.licensePlate && (
                        <span className="text-xs text-slate-400 font-mono bg-slate-800/50 px-2 py-0.5 rounded">
                          {repair.vehicle.licensePlate}
                        </span>
                      )}
                    </div>

                    {/* AI Summary Preview */}
                    {repair.aiSummary && (
                      <p className="text-slate-400 text-xs mb-3 line-clamp-2 leading-relaxed">
                        {repair.aiSummary}
                      </p>
                    )}

                    {/* Footer: Issue Type + Date + Labor Hours */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                      <span className="px-2 py-0.5 rounded-full bg-cyan-900/50 text-cyan-300 text-xs font-medium truncate">
                        {repair.issueTypeLabel}
                      </span>

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {/* Labor Hours */}
                        {repair.laborHours && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{repair.laborHours}ש'</span>
                          </div>
                        )}
                        {/* Date */}
                        {repair.completedAt && (
                          <span>{formatDate(repair.completedAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
