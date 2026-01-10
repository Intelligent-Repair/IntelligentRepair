// client/app/garage/dashboard/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Filter,
  Car,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  AlertCircle,
  PieChart,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

// Types
type TopVehicle = {
  manufacturer: string;
  model: string;
  count: number;
};

type TopIssue = {
  issue_description: string;
  occurrences: number;
};

type PieData = {
  label: string;
  value: number;
};

type Repair = {
  repair_id: number;
  request_id: number | null;
  license_plate: string | null;
  manufacturer: string | null;
  model: string | null;
  problem_description: string | null;
  mechanic_notes: string | null;
  created_at: string;
};

type FilterData = {
  manufacturers: string[];
  modelsByManufacturer: Record<string, string[]>;
};

export default function GarageDashboardPage() {
  const router = useRouter();

  // Filter states
  const [mode, setMode] = useState<"local" | "global">("local");
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>(
    []
  );
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<string>("monthly");
  const [issueType, setIssueType] = useState<string>("all");
  const [chartMode, setChartMode] = useState<string>("totalIssues");

  // Filter options data
  const [filterData, setFilterData] = useState<FilterData | null>(null);
  const [filterDataLoading, setFilterDataLoading] = useState(true);

  // Analytics data
  const [topModelsLoading, setTopModelsLoading] = useState(true);
  const [topModelsError, setTopModelsError] = useState<string | null>(null);
  const [topModels, setTopModels] = useState<TopVehicle[]>([]);

  const [topIssuesLoading, setTopIssuesLoading] = useState(true);
  const [topIssuesError, setTopIssuesError] = useState<string | null>(null);
  const [topIssues, setTopIssues] = useState<TopIssue[]>([]);

  const [pieLoading, setPieLoading] = useState(true);
  const [pieError, setPieError] = useState<string | null>(null);
  const [pieData, setPieData] = useState<PieData[]>([]);

  // Repairs data
  const [repairsLoading, setRepairsLoading] = useState(true);
  const [repairsError, setRepairsError] = useState<string | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [offset, setOffset] = useState(0);

  // Fetch filter options
  const fetchFilterData = useCallback(async () => {
    setFilterDataLoading(true);
    try {
      const response = await fetch("/api/garage/dashboard/filters");
      const data = await response.json();
      if (response.ok) {
        setFilterData(data);
      }
    } catch (err) {
      console.error("Error fetching filter data:", err);
    } finally {
      setFilterDataLoading(false);
    }
  }, []);

  // Build query string for filters
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("mode", mode);
    if (selectedManufacturers.length > 0) {
      params.set("manufacturers", selectedManufacturers.join(","));
    }
    if (selectedModels.length > 0) {
      params.set("models", selectedModels.join(","));
    }
    if (dateRange) {
      params.set("dateRange", dateRange);
    }
    if (issueType && issueType !== "all") {
      params.set("issueType", issueType);
    }
    return params.toString();
  }, [mode, selectedManufacturers, selectedModels, dateRange, issueType]);

  // Fetch Top 5 models
  const fetchTopModels = useCallback(async () => {
    setTopModelsLoading(true);
    setTopModelsError(null);
    try {
      const queryString = buildQueryString();
      const response = await fetch(
        `/api/garage/dashboard/top-models?${queryString}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch top models");
      }

      setTopModels(data.top5 || []);
    } catch (err) {
      console.error("Error fetching top models:", err);
      setTopModelsError(
        err instanceof Error ? err.message : "Failed to load top models"
      );
    } finally {
      setTopModelsLoading(false);
    }
  }, [buildQueryString]);

  // Fetch Top 5 issues
  const fetchTopIssues = useCallback(async () => {
    setTopIssuesLoading(true);
    setTopIssuesError(null);
    try {
      const queryString = buildQueryString();
      const response = await fetch(
        `/api/garage/dashboard/top-issues?${queryString}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch top issues");
      }

      setTopIssues(data.top5 || []);
    } catch (err) {
      console.error("Error fetching top issues:", err);
      setTopIssuesError(
        err instanceof Error ? err.message : "Failed to load top issues"
      );
    } finally {
      setTopIssuesLoading(false);
    }
  }, [buildQueryString]);

  // Fetch pie chart data
  const fetchPieData = useCallback(async () => {
    setPieLoading(true);
    setPieError(null);
    try {
      const queryString = buildQueryString();
      const response = await fetch(
        `/api/garage/dashboard/pie?${queryString}&chartMode=${chartMode}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch pie data");
      }

      setPieData(data.data || []);
    } catch (err) {
      console.error("Error fetching pie data:", err);
      setPieError(
        err instanceof Error ? err.message : "Failed to load pie chart"
      );
    } finally {
      setPieLoading(false);
    }
  }, [buildQueryString, chartMode]);

  // Fetch repairs with pagination
  const fetchRepairs = useCallback(async () => {
    setRepairsLoading(true);
    setRepairsError(null);
    try {
      const queryString = buildQueryString();
      const response = await fetch(
        `/api/garage/dashboard/repairs?${queryString}&offset=${offset}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch repairs");
      }

      setRepairs(data.repairs || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      console.error("Error fetching repairs:", err);
      setRepairsError(
        err instanceof Error ? err.message : "Failed to load repairs"
      );
    } finally {
      setRepairsLoading(false);
    }
  }, [buildQueryString, offset]);

  // Load filter data on mount
  useEffect(() => {
    fetchFilterData();
  }, [fetchFilterData]);

  // Reload all data when filters change
  useEffect(() => {
    setOffset(0);
    setCurrentPage(0);
    fetchTopModels();
    fetchTopIssues();
    fetchPieData();
    fetchRepairs();
  }, [
    mode,
    selectedManufacturers,
    selectedModels,
    dateRange,
    issueType,
    chartMode,
    fetchTopModels,
    fetchTopIssues,
    fetchPieData,
    fetchRepairs,
  ]);

  // Get available models based on selected manufacturers
  const availableModels = useMemo(() => {
    if (!filterData) return [];
    if (selectedManufacturers.length === 0) {
      // If no manufacturers selected, show all models
      return Object.values(filterData.modelsByManufacturer).flat();
    }
    return selectedManufacturers
      .flatMap((m) => filterData.modelsByManufacturer[m] || [])
      .filter((model, index, self) => self.indexOf(model) === index)
      .sort();
  }, [filterData, selectedManufacturers]);

  // Handle pagination
  const handleNextPage = () => {
    const newOffset = offset + 5;
    setOffset(newOffset);
    setCurrentPage(currentPage + 1);
  };

  const handlePreviousPage = () => {
    if (offset > 0) {
      const newOffset = Math.max(0, offset - 5);
      setOffset(newOffset);
      setCurrentPage(Math.max(0, currentPage - 1));
    }
  };

  // Navigate to request details
  const handleRowClick = (requestId: number | null) => {
    if (requestId) {
      router.push(`/garage/requests/${requestId}`);
    }
  };

  // Prepare pie chart data
  const chartData = useMemo(() => {
    if (pieData.length === 0) {
      return {
        labels: ["אין נתונים"],
        datasets: [
          {
            data: [1],
            backgroundColor: ["#64748b"],
          },
        ],
      };
    }

    const colors = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#ec4899",
      "#06b6d4",
      "#84cc16",
      "#f97316",
      "#6366f1",
    ];

    return {
      labels: pieData.map((d) => d.label),
      datasets: [
        {
          data: pieData.map((d) => d.value),
          backgroundColor: pieData.map((_, i) => colors[i % colors.length]),
          borderColor: "#1e293b",
          borderWidth: 2,
        },
      ],
    };
  }, [pieData]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#071226] to-[#03050c] text-white">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[200px]" />
        <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-b from-cyan-400/10 via-transparent to-indigo-500/10 blur-[180px]" />
      </div>

      <main
        dir="rtl"
        className="relative mx-auto w-full max-w-7xl px-6 pb-16 pt-8 sm:px-10 lg:px-12"
      >
        <h1 className="text-4xl font-extrabold text-white mb-8 border-b border-white/10 pb-4 flex items-center gap-3">
          <PieChart className="w-8 h-8 text-cyan-300" /> דשבורד מוסך
        </h1>

        {/* --- 1. Comprehensive Filter Bar --- */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md mb-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-cyan-300 flex items-center gap-2">
              <Filter className="w-5 h-5" /> סינון נתונים
            </h2>
            <button
              onClick={() => {
                setMode("local");
                setSelectedManufacturers([]);
                setSelectedModels([]);
                setDateRange("monthly");
                setIssueType("all");
              }}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition border border-red-500"
            >
              אפס פילטרים
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* View Mode */}
            <div>
              <label className="text-sm text-slate-400 block mb-2">
                מצב תצוגה
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode("local")}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition ${
                    mode === "local"
                      ? "bg-cyan-500 text-white border-2 border-cyan-400"
                      : "bg-zinc-800 text-slate-300 border-2 border-zinc-700 hover:border-zinc-600"
                  }`}
                >
                  תצוגת מוסך שלי
                </button>
                <button
                  onClick={() => setMode("global")}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition ${
                    mode === "global"
                      ? "bg-cyan-500 text-white border-2 border-cyan-400"
                      : "bg-zinc-800 text-slate-300 border-2 border-zinc-700 hover:border-zinc-600"
                  }`}
                >
                  תצוגת כלל המוסכים
                </button>
              </div>
            </div>

            {/* Manufacturer Multi-select */}
            <div>
              <label className="text-sm text-slate-400 block mb-2">יצרן</label>
              <select
                multiple
                value={selectedManufacturers}
                onChange={(e) => {
                  const values = Array.from(
                    e.target.selectedOptions,
                    (option) => option.value
                  );
                  setSelectedManufacturers(values);
                  setSelectedModels([]); // Reset models when manufacturers change
                }}
                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm min-h-[100px]"
                disabled={filterDataLoading}
              >
                {filterData?.manufacturers.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                החזק Ctrl/Cmd לבחירה מרובה
              </p>
            </div>

            {/* Model Dropdown */}
            <div>
              <label className="text-sm text-slate-400 block mb-2">דגם</label>
              <select
                multiple
                value={selectedModels}
                onChange={(e) => {
                  const values = Array.from(
                    e.target.selectedOptions,
                    (option) => option.value
                  );
                  setSelectedModels(values);
                }}
                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm min-h-[100px]"
                disabled={filterDataLoading || availableModels.length === 0}
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                החזק Ctrl/Cmd לבחירה מרובה
              </p>
            </div>

            {/* Time Range */}
            <div>
              <label className="text-sm text-slate-400 block mb-2">
                טווח זמן
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
              >
                <option value="today">היום (24 שעות)</option>
                <option value="weekly">שבוע אחרון (7 ימים)</option>
                <option value="monthly">חודש אחרון (30 ימים)</option>
                <option value="yearly">שנה אחרונה (365 ימים)</option>
              </select>
            </div>

            {/* Issue Type */}
            <div>
              <label className="text-sm text-slate-400 block mb-2">
                סוג בעיה
              </label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
              >
                <option value="all">כל הבעיות</option>
                <option value="engine">מנוע</option>
                <option value="brakes">בלמים</option>
                <option value="electrical">חשמל</option>
                <option value="ac">מיזוג אוויר</option>
                <option value="starting">מערכת התנעה</option>
                <option value="gearbox">תיבת הילוכים</option>
                <option value="noise">רעש/רטט</option>
              </select>
            </div>
          </div>
        </section>

        {/* --- 2. Pie Chart Section --- */}
        <section className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-extrabold text-white flex items-center gap-3">
              <PieChart className="w-6 h-6 text-cyan-300" /> תרשים עוגה
            </h2>
            <select
              value={chartMode}
              onChange={(e) => setChartMode(e.target.value)}
              className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
            >
              <option value="totalIssues">סה״כ תיקונים</option>
              <option value="issuesByManufacturer">תיקונים לפי יצרן</option>
              <option value="issuesByModel">תיקונים לפי דגם</option>
            </select>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md">
            {pieLoading && (
              <div className="text-center py-20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin mr-3" /> טוען תרשים...
              </div>
            )}
            {pieError && (
              <div className="text-center py-20 text-red-300">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p>{pieError}</p>
              </div>
            )}
            {!pieLoading && !pieError && (
              <div className="max-w-md mx-auto">
                <Pie data={chartData} />
              </div>
            )}
          </div>
        </section>

        {/* --- 3. Two Analytics Boxes Side by Side --- */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* Box A: Top 5 Problematic Vehicle Models */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md">
            <h2 className="text-xl font-extrabold text-white mb-6 flex items-center gap-3">
              <Car className="w-6 h-6 text-cyan-300" /> 5 דגמי הרכבים הבעייתיים
              ביותר
            </h2>

            {topModelsLoading && (
              <div className="text-center py-10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin mr-3" /> טוען נתונים...
              </div>
            )}

            {topModelsError && (
              <div className="rounded-lg border border-red-500/50 bg-red-900/20 p-4 text-red-300">
                <p className="font-semibold text-sm">שגיאה:</p>
                <p className="text-xs mt-1">{topModelsError}</p>
              </div>
            )}

            {!topModelsLoading && !topModelsError && (
              <>
                {topModels.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <p>אין נתונים להצגה</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topModels.map((vehicle, index) => (
                      <div
                        key={`${vehicle.manufacturer}-${vehicle.model}`}
                        className="rounded-lg border border-white/10 bg-zinc-800/50 p-4 hover:border-cyan-500/50 transition"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-cyan-300 text-lg">
                              {index + 1}.
                            </span>
                            <div>
                              <p className="text-slate-200 font-semibold">
                                {vehicle.manufacturer}
                              </p>
                              <p className="text-slate-400 text-sm">
                                {vehicle.model}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-red-400 bg-red-900/30 px-3 py-1 rounded-full">
                            {vehicle.count} תקלות
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Box B: Top 5 Most Common Issues */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md">
            <h2 className="text-xl font-extrabold text-white mb-6 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-cyan-300" /> 5 הבעיות הנפוצות
              ביותר
            </h2>

            {topIssuesLoading && (
              <div className="text-center py-10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin mr-3" /> טוען נתונים...
              </div>
            )}

            {topIssuesError && (
              <div className="rounded-lg border border-red-500/50 bg-red-900/20 p-4 text-red-300">
                <p className="font-semibold text-sm">שגיאה:</p>
                <p className="text-xs mt-1">{topIssuesError}</p>
              </div>
            )}

            {!topIssuesLoading && !topIssuesError && (
              <>
                {topIssues.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <p>אין נתונים להצגה</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topIssues.map((issue, index) => (
                      <div
                        key={issue.issue_description}
                        className="rounded-lg border border-white/10 bg-zinc-800/50 p-4 hover:border-cyan-500/50 transition"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <span className="font-bold text-cyan-300 text-lg">
                              {index + 1}.
                            </span>
                            <p className="text-slate-200 text-sm flex-1">
                              {issue.issue_description}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-red-400 bg-red-900/30 px-3 py-1 rounded-full whitespace-nowrap">
                            {issue.occurrences} פניות
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* --- 4. Repairs Table With Pagination --- */}
        <section className="mt-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-extrabold text-white flex items-center gap-3">
              <Wrench className="w-6 h-6 text-cyan-300" /> רשימת תיקונים אחרונים
            </h2>
            {totalCount > 0 && (
              <span className="text-slate-400 text-sm">
                סה״כ: {totalCount} תיקונים
              </span>
            )}
          </div>

          {repairsLoading && (
            <div className="text-center py-10 text-xl text-slate-400 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin mr-3" /> טוען תיקונים...
            </div>
          )}

          {repairsError && (
            <div className="rounded-xl border border-red-500/50 bg-red-900/20 p-6 text-red-300">
              <p className="font-semibold">שגיאה בטעינת תיקונים:</p>
              <p className="text-sm mt-2">{repairsError}</p>
            </div>
          )}

          {!repairsLoading && !repairsError && repairs.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>אין תיקונים להצגה</p>
            </div>
          )}

          {!repairsLoading && !repairsError && repairs.length > 0 && (
            <>
              <div className="rounded-xl border border-white/10 bg-white/5 shadow-xl backdrop-blur-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-right text-sm">
                    <thead>
                      <tr className="border-b border-zinc-700 text-slate-400 bg-zinc-800/50">
                        <th className="py-3 px-4 font-normal">מספר פנייה</th>
                        <th className="py-3 px-4 font-normal">מספר רכב</th>
                        <th className="py-3 px-4 font-normal">יצרן</th>
                        <th className="py-3 px-4 font-normal">דגם</th>
                        <th className="py-3 px-4 font-normal">בעיה</th>
                        <th className="py-3 px-4 font-normal">מה תוקן</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repairs.map((repair) => (
                        <tr
                          key={repair.repair_id}
                          onClick={() => handleRowClick(repair.request_id)}
                          className="border-b border-white/5 hover:bg-white/10 transition cursor-pointer"
                        >
                          <td className="py-3 px-4 text-slate-200">
                            {repair.request_id || "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-200">
                            {repair.license_plate || "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-200">
                            {repair.manufacturer || "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-200">
                            {repair.model || "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-200 max-w-xs truncate">
                            {repair.problem_description || "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-200 max-w-xs truncate">
                            {repair.mechanic_notes || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination Controls */}
              <div className="flex justify-between items-center mt-6">
                <button
                  onClick={handlePreviousPage}
                  disabled={offset === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
                    offset === 0
                      ? "bg-zinc-800 text-slate-500 cursor-not-allowed"
                      : "bg-zinc-800 text-white border-2 border-zinc-700 hover:border-cyan-500"
                  }`}
                >
                  <ChevronRight className="w-5 h-5" /> קודם
                </button>
                <span className="text-slate-400">
                  עמוד {currentPage + 1} • {repairs.length} תיקונים בעמוד זה
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={repairs.length < 5 || offset + 5 >= totalCount}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
                    repairs.length < 5 || offset + 5 >= totalCount
                      ? "bg-zinc-800 text-slate-500 cursor-not-allowed"
                      : "bg-zinc-800 text-white border-2 border-zinc-700 hover:border-cyan-500"
                  }`}
                >
                  הבא <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
