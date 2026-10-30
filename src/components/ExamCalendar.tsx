"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  FileText,
  Plus,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Search,
  Check,
} from "lucide-react";
import { FahrschulBar } from "./FahrschulBar";
import { Portal } from "./Portal";
import { useLanguage } from "@/lib/i18n";

export interface CalendarExam {
  id: string;
  name: string;
  code?: string | null;
  ects: number;
  semesterId: string;
  semesterName: string;
  examDate: string;
  examTime?: string | null;
  examLocation?: string | null;
  examDescription?: string | null;
  status: string;
  daysUntilExam: number;
  readinessScore: number;
}

export function ExamCalendar({ onExamUpdated }: { onExamUpdated?: () => void }) {
  const { lang, t } = useLanguage();
  const [exams, setExams] = useState<CalendarExam[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  // Current calendar month view
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Modal State for adding/assigning exam
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [moduleSearchQuery, setModuleSearchQuery] = useState("");
  const [examTime, setExamTime] = useState("");
  const [examLocation, setExamLocation] = useState("");
  const [examDescription, setExamDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoMatchedModule, setAutoMatchedModule] = useState<any>(null);

  const fetchExams = async () => {
    try {
      const [resExams, resModules] = await Promise.all([
        fetch("/api/calendar"),
        fetch("/api/modules"),
      ]);
      if (resExams.ok) {
        const data = await resExams.json();
        setExams(data);
      }
      if (resModules.ok) {
        const modData = await resModules.json();
        setModules(modData);
      }
    } catch (err) {
      console.error("Failed to load calendar data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  // Live Auto-Matching as user types search query
  useEffect(() => {
    if (moduleSearchQuery.trim().length > 1) {
      const q = moduleSearchQuery.toLowerCase();
      const match = modules.find(
        (m) =>
          (m.code && m.code.toLowerCase().includes(q)) ||
          m.name.toLowerCase().includes(q) ||
          q.includes(m.name.toLowerCase())
      );
      if (match) {
        setAutoMatchedModule(match);
        setSelectedModuleId(match.id);
      } else {
        setAutoMatchedModule(null);
      }
    } else {
      setAutoMatchedModule(null);
    }
  }, [moduleSearchQuery, modules]);

  const handleOpenAddForDate = (date: Date) => {
    const formatted = date.toISOString().split("T")[0];
    setSelectedDateStr(formatted);
    setSelectedModuleId(modules[0]?.id || "");
    setModuleSearchQuery("");
    setAutoMatchedModule(null);
    setExamTime("10:00 – 11:30");
    setExamLocation("");
    setExamDescription("");
    setIsAddModalOpen(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDateStr || !selectedModuleId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: selectedModuleId,
          examDate: selectedDateStr,
          examTime: examTime.trim() || undefined,
          examLocation: examLocation.trim() || undefined,
          examDescription: examDescription.trim() || undefined,
        }),
      });

      if (res.ok) {
        setIsAddModalOpen(false);
        fetchExams();
        if (onExamUpdated) onExamUpdated();
      }
    } catch (err) {
      console.error("Failed to save exam date:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Month calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = lang === "de"
    ? [
        "Januar", "Februar", "März", "April", "Mai", "Juni",
        "Juli", "August", "September", "Oktober", "November", "Dezember",
      ]
    : [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Day offset (0 for Sunday, 1 for Monday...)
  let startOffset = firstDayOfMonth.getDay() - 1;
  if (startOffset === -1) startOffset = 6; // Sunday -> 6

  const daysArray = [];
  // Empty slots before month start
  for (let i = 0; i < startOffset; i++) {
    daysArray.push(null);
  }
  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(new Date(year, month, d));
  }

  // Get exams for a specific day
  const getExamsForDay = (day: Date) => {
    const dayStr = day.toISOString().split("T")[0];
    return exams.filter((e) => {
      const eStr = new Date(e.examDate).toISOString().split("T")[0];
      return eStr === dayStr;
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 md:p-8 space-y-6">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              {t.calendarTitle}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t.calendarSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === "calendar"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {lang === "de" ? "Monatsansicht" : "Month View"}
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === "list"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {lang === "de" ? `Terminliste (${exams.length})` : `Schedule List (${exams.length})`}
            </button>
          </div>

          <button
            onClick={() => handleOpenAddForDate(new Date())}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> {t.addExamDateBtn}
          </button>
        </div>
      </div>

      {/* MONTH CALENDAR VIEW */}
      {viewMode === "calendar" && (
        <div className="space-y-4">
          {/* Month Header Controller */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {monthNames[month]} {year}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.today}
              </button>
              <button
                onClick={nextMonth}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-1">
            <span>{lang === "de" ? "Mo" : "Mon"}</span>
            <span>{lang === "de" ? "Di" : "Tue"}</span>
            <span>{lang === "de" ? "Mi" : "Wed"}</span>
            <span>{lang === "de" ? "Do" : "Thu"}</span>
            <span>{lang === "de" ? "Fr" : "Fri"}</span>
            <span className="text-indigo-600 dark:text-indigo-400">{lang === "de" ? "Sa" : "Sat"}</span>
            <span className="text-indigo-600 dark:text-indigo-400">{lang === "de" ? "So" : "Sun"}</span>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-7 gap-2">
            {daysArray.map((day, idx) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="h-28 rounded-2xl bg-slate-50/40 dark:bg-slate-800/20 border border-transparent"
                  />
                );
              }

              const dayExams = getExamsForDay(day);
              const isToday =
                new Date().toISOString().split("T")[0] === day.toISOString().split("T")[0];

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => handleOpenAddForDate(day)}
                  className={`h-28 p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group overflow-hidden ${
                    isToday
                      ? "border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 ring-1 ring-indigo-500/30"
                      : "border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black w-6 h-6 rounded-lg flex items-center justify-center ${
                        isToday
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-700 dark:text-slate-300 group-hover:text-indigo-600"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayExams.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </div>

                  {/* Exam Pills inside day slot */}
                  <div className="space-y-1 overflow-y-auto max-h-16 scrollbar-none">
                    {dayExams.map((exam) => (
                      <Link
                        key={exam.id}
                        href={`/module/${exam.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block px-1.5 py-0.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-[10px] font-bold text-indigo-900 dark:text-indigo-200 truncate border border-indigo-200 dark:border-indigo-800"
                      >
                        {exam.code ? `${exam.code}: ` : ""}
                        {exam.name}
                      </Link>
                    ))}
                  </div>

                  <div className="text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity text-right">
                    + Termin
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LIST VIEW (TIMELINE) */}
      {viewMode === "list" && (
        <div className="space-y-4">
          {exams.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CalendarIcon className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-xs">{t.examListNoExams}</p>
            </div>
          ) : (
            exams.map((exam) => {
              const daysLeft = exam.daysUntilExam;
              let badgeColor = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
              if (daysLeft <= 7) {
                badgeColor = "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-black animate-pulse";
              } else if (daysLeft <= 21) {
                badgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold";
              }

              return (
                <div
                  key={exam.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow transition-all"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-xl text-xs ${badgeColor}`}>
                        {daysLeft === 0 ? t.examToday : t.daysRemaining.replace("{n}", daysLeft.toString())}
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {new Date(exam.examDate).toLocaleDateString(lang === "de" ? "de-DE" : "en-US", {
                          weekday: "short",
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      {exam.examTime && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5" /> {exam.examTime}
                        </span>
                      )}
                      {exam.examLocation && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="w-3.5 h-3.5" /> {exam.examLocation}
                        </span>
                      )}
                    </div>

                    <div>
                      <Link href={`/module/${exam.id}`}>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white hover:text-indigo-600 transition-colors">
                          {exam.code ? `${exam.code} – ` : ""}
                          {exam.name}
                        </h4>
                      </Link>
                      <span className="text-xs text-slate-400">
                        {exam.semesterName} • {exam.ects} ECTS
                      </span>
                    </div>

                    {exam.examDescription && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800/90 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
                        📝 {t.examStructureLabel}: {exam.examDescription}
                      </p>
                    )}
                  </div>

                  {/* Readiness mini meter & jump button */}
                  <div className="md:w-64 space-y-3">
                    <FahrschulBar score={exam.readinessScore} size="sm" />
                    <Link
                      href={`/module/${exam.id}?tab=trainer`}
                      className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all"
                    >
                      {t.openTrainer} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL: KLAUSURTERMIN EINTRAGEN & AUTOMATISCH ZUORDNEN */}
      {isAddModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t.addExamModalTitle}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t.addExamModalDesc}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="space-y-4 py-4">
              {/* Smart Auto-Matching / Search */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>{t.selectModuleOrMatchLabel}</span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black">
                    {t.smartAutoMatchBadge}
                  </span>
                </label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder={t.searchModulePlaceholder}
                    value={moduleSearchQuery}
                    onChange={(e) => setModuleSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  />
                </div>

                {autoMatchedModule ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-semibold mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>
                      {t.autoMatchedBadge} <strong>{autoMatchedModule.name}</strong> ({autoMatchedModule.code || "Course"})
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedModuleId}
                    onChange={(e) => setSelectedModuleId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                  >
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code ? `[${m.code}] ` : ""}
                        {m.name} ({m.ects} ECTS)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.examDateRequiredLabel}
                  </label>
                  <input
                    type="date"
                    required
                    value={selectedDateStr}
                    onChange={(e) => setSelectedDateStr(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.examTimeLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={t.examTimePlaceholder}
                    value={examTime}
                    onChange={(e) => setExamTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.examLocationLabel}
                </label>
                <input
                  type="text"
                  placeholder={t.examLocationPlaceholder}
                  value={examLocation}
                  onChange={(e) => setExamLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              {/* Exam Description / Comments */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.examCommentLabel}
                  </label>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                    {t.examCommentHint}
                  </span>
                </div>
                <textarea
                  rows={3}
                  placeholder={t.examStructurePlaceholder}
                  value={examDescription}
                  onChange={(e) => setExamDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSubmitting ? t.saving : t.saveAndAssignExamBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
