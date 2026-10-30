import React from "react";
import { AlertCircle, CheckCircle2, Gauge, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface FahrschulBarProps {
  score: number; // 0 to 100
  title?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function FahrschulBar({
  score,
  title,
  showLabel = true,
  size = "md",
  className = "",
}: FahrschulBarProps) {
  const { lang, t } = useLanguage();
  const displayTitle = title || t.examReadiness;
  const clampedScore = Math.min(100, Math.max(0, Math.round(score)));

  // Driving school thresholds:
  // < 50: Rot (Nicht prüfungsreif)
  // 50 - 79: Gelb (Bedingt prüfungsreif / Auf gutem Weg)
  // >= 80: Grün (Prüfungsreif!)
  let statusColor = "bg-rose-500";
  let statusText = lang === "de" ? "Nicht prüfungsreif" : "Not exam-ready";
  let statusBadge = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
  let StatusIcon = ShieldAlert;

  if (clampedScore >= 80) {
    statusColor = "bg-emerald-500";
    statusText = lang === "de" ? "Prüfungsreif!" : "Exam ready!";
    statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    StatusIcon = CheckCircle2;
  } else if (clampedScore >= 50) {
    statusColor = "bg-amber-500";
    statusText = lang === "de" ? "Bedingt prüfungsreif" : "Partially prepared";
    statusBadge = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    StatusIcon = AlertCircle;
  }

  const heightClass = size === "sm" ? "h-2.5" : size === "lg" ? "h-4" : "h-3";

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="text-slate-700 dark:text-slate-300 font-semibold">
              {displayTitle}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge}`}
            >
              <StatusIcon className="w-3 h-3" />
              {statusText}
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              {clampedScore}%
            </span>
          </div>
        </div>
      )}

      {/* Fahrschul-Style segmented background with 3 zones */}
      <div className="relative w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden shadow-inner p-0.5">
        {/* Background color guides */}
        <div className="absolute inset-0 flex opacity-30 pointer-events-none">
          <div className="w-[50%] bg-rose-300/40 border-r border-slate-300 dark:border-slate-700" />
          <div className="w-[30%] bg-amber-300/40 border-r border-slate-300 dark:border-slate-700" />
          <div className="w-[20%] bg-emerald-300/40" />
        </div>

        {/* Dynamic animated progress bar */}
        <div
          className={`${heightClass} rounded-full transition-all duration-700 ease-out relative shadow-sm ${
            clampedScore >= 80
              ? "bg-gradient-to-r from-amber-400 via-emerald-400 to-emerald-500 shadow-emerald-500/20"
              : clampedScore >= 50
              ? "bg-gradient-to-r from-rose-400 via-amber-400 to-amber-500 shadow-amber-500/20"
              : "bg-gradient-to-r from-rose-500 to-rose-400 shadow-rose-500/20"
          }`}
          style={{ width: `${Math.max(4, clampedScore)}%` }}
        >
          {/* Subtle light shimmer */}
          <div className="absolute inset-0 bg-white/20 rounded-full" />
        </div>
      </div>

      {size === "lg" && (
        <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-0.5">
          <span>0% {lang === "de" ? "Start" : "Start"}</span>
          <span className="text-amber-600 dark:text-amber-400">50% {lang === "de" ? "Grundwissen" : "Basic Knowledge"}</span>
          <span className="text-emerald-600 dark:text-emerald-400">80% {lang === "de" ? "Prüfungsreife" : "Exam Ready"}</span>
          <span>100% {lang === "de" ? "Top" : "Mastered"}</span>
        </div>
      )}
    </div>
  );
}
