"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Award,
  TrendingUp,
  Clock,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  GraduationCap,
  Calculator,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatGrade, formatEcts } from "@/lib/utils";
import { Portal } from "./Portal";

interface EctsCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetEcts: number;
}

export function EctsCalculatorModal({
  isOpen,
  onClose,
  targetEcts,
}: EctsCalculatorModalProps) {
  const { lang, t } = useLanguage();
  const [semesters, setSemesters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [plannedPace, setPlannedPace] = useState(30);
  const [expandedSemesterId, setExpandedSemesterId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/semesters");
      if (res.ok) {
        const data = await res.json();
        setSemesters(data);
        if (data.length > 0) {
          setExpandedSemesterId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Calculate stats
  let totalCompletedEcts = 0;
  let totalGradedPoints = 0;
  let totalGradedEcts = 0;
  let semestersWithCompletedModules = 0;

  const semesterBreakdowns = semesters.map((sem) => {
    let semCompletedEcts = 0;
    let semTotalEcts = 0;
    let semGradedPoints = 0;
    let semGradedEcts = 0;
    const completedModules: any[] = [];
    const inProgressModules: any[] = [];

    (sem.modules || []).forEach((mod: any) => {
      semTotalEcts += mod.ects;
      if (mod.status === "COMPLETED") {
        semCompletedEcts += mod.ects;
        completedModules.push(mod);
        if (mod.grade && mod.grade > 0) {
          semGradedPoints += mod.grade * mod.ects;
          semGradedEcts += mod.ects;
        }
      } else {
        inProgressModules.push(mod);
      }
    });

    totalCompletedEcts += semCompletedEcts;
    totalGradedPoints += semGradedPoints;
    totalGradedEcts += semGradedEcts;
    if (semCompletedEcts > 0) {
      semestersWithCompletedModules += 1;
    }

    const semGpa = semGradedEcts > 0 ? semGradedPoints / semGradedEcts : null;

    return {
      ...sem,
      semCompletedEcts,
      semTotalEcts,
      semGpa,
      completedModules,
      inProgressModules,
    };
  });

  const overallGpa = totalGradedEcts > 0 ? totalGradedPoints / totalGradedEcts : null;

  // Average ECTS per completed semester (or count all past semesters with modules)
  const divisor = Math.max(1, semestersWithCompletedModules || 1);
  const avgEctsPerSemester = Number((totalCompletedEcts / divisor).toFixed(1));

  // Progress percentage
  const ectsPercent = Math.min(100, Math.round((totalCompletedEcts / targetEcts) * 100));

  // Remaining ECTS and estimated semesters
  const remainingEcts = Math.max(0, targetEcts - totalCompletedEcts);
  const estimatedSemestersNeeded =
    plannedPace > 0 ? Math.ceil(remainingEcts / plannedPace) : 0;

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {t.ectsCalculatorTitle}
              </h3>
              <p className="text-xs text-slate-500">
                {t.ectsCalculatorSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-sm p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1">
          {/* Top Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Total ECTS */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block mb-1">
                {t.totalCollected}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-indigo-950 dark:text-white">
                  {formatEcts(totalCompletedEcts)}
                </span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                  / {targetEcts}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {ectsPercent}% {lang === "de" ? "des Studiums" : "of degree"}
              </span>
            </div>

            {/* Average ECTS per Semester */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block mb-1">
                {t.avgEctsPerSemester}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-emerald-950 dark:text-white">
                  Ø {avgEctsPerSemester}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  ECTS
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {semestersWithCompletedModules} {lang === "de" ? "aktive Semester" : "active semesters"}
              </span>
            </div>

            {/* GPA */}
            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 block mb-1">
                {t.gpaTracker}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-amber-950 dark:text-white">
                  {overallGpa !== null ? formatGrade(overallGpa) : "—"}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {formatEcts(totalGradedEcts)} ECTS {lang === "de" ? "benotet" : "graded"}
              </span>
            </div>

            {/* Standard Pace Comparison */}
            <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 block mb-1">
                {t.standardComparison}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-sky-950 dark:text-white">
                  30.0
                </span>
                <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold">
                  ECTS / Sem.
                </span>
              </div>
              <span
                className={`text-[10px] font-bold mt-1 block ${
                  avgEctsPerSemester >= 30
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {avgEctsPerSemester >= 30
                  ? (lang === "de" ? "✓ Voll auf Kurs" : "✓ On track")
                  : `${(avgEctsPerSemester - 30).toFixed(1)} ECTS ${lang === "de" ? "vom Richtwert" : "from target"}`}
              </span>
            </div>
          </div>

          {/* Interactive Pace Simulator */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                {t.simulationTitle}
              </span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                {remainingEcts} ECTS {lang === "de" ? "noch offen" : "remaining"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  {t.simulationPace}
                </label>
                <div className="flex items-center gap-1.5">
                  {[20, 25, 30, 35].map((pace) => (
                    <button
                      key={pace}
                      type="button"
                      onClick={() => setPlannedPace(pace)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        plannedPace === pace
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {pace} ECTS
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                {t.simulationTarget}{" "}
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                  ~{estimatedSemestersNeeded} {t.semesters}
                </span>
              </div>
            </div>
          </div>

          {/* Semester-by-Semester Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.semesterBreakdownTitle}
            </h4>

            {semesterBreakdowns.map((sem) => {
              const isExpanded = expandedSemesterId === sem.id;
              const semProgress = Math.min(100, Math.round((sem.semCompletedEcts / 30) * 100));

              return (
                <div
                  key={sem.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/40 overflow-hidden shadow-sm transition-all"
                >
                  {/* Semester Bar Header */}
                  <div
                    onClick={() =>
                      setExpandedSemesterId(isExpanded ? null : sem.id)
                    }
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs">
                        <Calendar className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                            {sem.name}
                          </h5>
                          {sem.isActive && (
                            <span className="px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {t.activeSemester}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {sem.modules?.length ?? 0} {t.modulesInSemester}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* ECTS in this semester */}
                      <div className="text-right">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                            {formatEcts(sem.semCompletedEcts)}
                          </span>
                          <span className="text-[11px] text-slate-400">/ 30 ECTS</span>
                        </div>
                        {sem.semGpa !== null && (
                          <span className="text-[10px] text-slate-500">
                            Ø Note: {formatGrade(sem.semGpa)}
                          </span>
                        )}
                      </div>

                      {/* Mini Bar */}
                      <div className="w-16 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="bg-indigo-600 h-full rounded-full"
                          style={{ width: `${semProgress}%` }}
                        />
                      </div>

                      <div className="text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Module Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-800/30">
                      {(sem.modules || []).length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">
                          {t.noModulesInSemester}
                        </p>
                      ) : (
                        (sem.modules || []).map((mod: any) => {
                          const isDone = mod.status === "COMPLETED";
                          return (
                            <div
                              key={mod.id}
                              className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isDone ? "bg-emerald-500" : "bg-sky-500"
                                  }`}
                                />
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {mod.code ? `[${mod.code}] ` : ""}
                                    {mod.name}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                {mod.grade && (
                                  <span className="font-bold text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700">
                                    {t.grade}: {formatGrade(mod.grade)}
                                  </span>
                                )}
                                <span
                                  className={`font-black px-2 py-0.5 rounded-full text-[11px] ${
                                    isDone
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                      : "bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                                  }`}
                                >
                                  {formatEcts(mod.ects)} ECTS
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
