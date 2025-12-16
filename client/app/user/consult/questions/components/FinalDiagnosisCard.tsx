"use client";

import React from "react";

interface DiagnosisResult {
  issue: string;
  probability: number;
  description?: string;
  explanation?: string;
}

interface FinalDiagnosisCardProps {
  summary: string;
  results: DiagnosisResult[];
  confidence: number;
  recommendations?: string[];
  disclaimer?: string;
}

export default function FinalDiagnosisCard({
  summary,
  results,
  recommendations,
  disclaimer,
}: FinalDiagnosisCardProps) {
  const safeResults = Array.isArray(results) ? results : [];
  const hasResults = safeResults.length > 0;

  const formatPercent = (value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    return `${clamped}%`;
  };

  const dedupedResults: DiagnosisResult[] = React.useMemo(() => {
    const byIssue = new Map<string, DiagnosisResult>();

    safeResults.forEach((item) => {
      if (!item || !item.issue) return;
      const existing = byIssue.get(item.issue);
      if (!existing || (item.probability ?? 0) > (existing.probability ?? 0)) {
        byIssue.set(item.issue, item);
      }
    });

    return Array.from(byIssue.values())
      .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
      .slice(0, 3);
  }, [safeResults]);

  const hasUniqueResults = dedupedResults.length > 0;

  const topDiagnosis = hasUniqueResults ? dedupedResults[0] : undefined;
  const secondDiagnosis = hasUniqueResults ? dedupedResults[1] : undefined;

  const hasClearTopDiagnosis = !!topDiagnosis &&
    (!secondDiagnosis ||
      (topDiagnosis.probability ?? 0) >= (secondDiagnosis.probability ?? 0) + 5);

  const topExplanation =
    (topDiagnosis?.description || topDiagnosis?.explanation || "").trim();

  const shouldShowWhySection =
    hasClearTopDiagnosis &&
    (summary?.trim().length > 0 || topExplanation.length > 0);

  return (
    <div className="flex justify-start mb-4" dir="rtl">
      <div className="max-w-[90%] rounded-3xl p-6 bg-white/10 backdrop-blur-lg border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] text-white">
        {/* 🔍 אבחון סופי */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">
                🔍
              </span>
              <span>אבחון סופי</span>
            </h3>
          </div>
          <p className="text-white/80 leading-relaxed text-sm md:text-base">{summary}</p>
        </div>

        {/* 🧠 למה זו האבחנה הסבירה ביותר */}
        {shouldShowWhySection && topDiagnosis && (
          <div className="mt-3 mb-2 rounded-2xl bg-white/5 border border-white/15 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="text-base" aria-hidden="true">
                  🧠
                </span>
                <span>למה זו האבחנה הסבירה ביותר</span>
              </h4>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#4A90E2]/60 bg-[#4A90E2]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#c4ddff]">
                האבחנה המובילה
              </span>
            </div>
            <p className="text-xs text-white/75 leading-relaxed">
              האבחנה המובילה היא{" "}
              <span className="font-semibold text-white">
                {topDiagnosis.issue}
              </span>{" "}
              עם הסתברות של{" "}
              <span className="font-semibold text-white">
                {formatPercent(topDiagnosis.probability ?? 0)}
              </span>
              .{" "}
              {topExplanation
                ? `ההסבר הטכני שזוהה: ${topExplanation}`
                : `הסיכום הכללי של הבדיקה מצביע על כך שזו ההתאמה הטובה ביותר לתיאור התקלה שקיבלנו.`}
            </p>
          </div>
        )}

        {/* רשימת אבחנות + הדגשת הסתברות */}
        {hasUniqueResults && (
          <div className="mt-4 space-y-3">
            {dedupedResults.map((item, index) => {
              const percent = Math.max(0, Math.min(100, Math.round(item.probability)));
              const isTop = index === 0;
              const explanation = item.description || item.explanation || "";

              return (
                <div
                  key={`${item.issue}-${index}`}
                  className={`relative rounded-2xl border p-4 bg-white/5 backdrop-blur-sm ${
                    isTop
                      ? "border-[#4A90E2]/70 bg-white/10 shadow-[0_8px_24px_rgba(74,144,226,0.35)]"
                      : "border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
                  }`}
                >
                  {isTop && (
                    <div className="absolute -top-2 left-4 inline-flex items-center gap-1 rounded-full bg-[#4A90E2]/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
                      <span aria-hidden="true">⭐</span>
                      <span>האבחנה המובילה</span>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-full ${
                            isTop ? "bg-[#4A90E2]/20 text-[#9ec7ff]" : "bg-white/10 text-white/70"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="text-base font-semibold text-white">{item.issue}</span>
                      </div>
                      {explanation && (
                        <p className="text-xs text-white/70 leading-relaxed mt-1">{explanation}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[11px] text-white/60 mb-0.5">
                        הסתברות משוערת
                      </span>
                      <span
                        className={`font-bold text-white leading-none ${
                          isTop ? "text-3xl md:text-4xl" : "text-2xl"
                        }`}
                      >
                        {formatPercent(percent)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1 text-[11px] text-white/55">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isTop ? "bg-[#4A90E2]" : "bg-white/60"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 🧰 מה ניתן לבדוק לבד */}
        {Array.isArray(recommendations) && recommendations.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <span className="text-base" aria-hidden="true">
                🧰
              </span>
              <span>מה ניתן לבדוק לבד</span>
            </h4>
            <p className="text-xs text-white/70 mb-2">
              בדיקות פשוטות שכל נהג יכול לבצע לפני הגעה למוסך:
            </p>
            <ul className="list-disc pr-5 space-y-1 text-sm text-white/80">
              {recommendations.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ℹ️ דיסקליימר */}
        {typeof disclaimer === "string" && disclaimer.trim().length > 0 && (
          <div className="mt-6 pt-3 border-t border-white/10">
            <h4 className="text-xs font-semibold text-white mb-1 flex items-center gap-1.5">
              <span className="text-sm" aria-hidden="true">
                ℹ️
              </span>
              <span>דיסקליימר</span>
            </h4>
            <p className="text-xs text-white/60 leading-relaxed">{disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

