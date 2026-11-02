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
  UploadCloud,
  ExternalLink,
  Zap,
  BookOpen,
  RotateCcw,
  Trash2,
  ChevronDown,
  GraduationCap,
} from "lucide-react";
import { FahrschulBar } from "./FahrschulBar";
import { Portal } from "./Portal";
import { IcsImportModal } from "./IcsImportModal";
import { useLanguage } from "@/lib/i18n";
import { getCampusMapInfo, SUPPORTED_UNIVERSITIES, UniversityProvider } from "@/lib/campus-maps";

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

export interface CalendarSubEvent {
  id: string;
  moduleId: string;
  moduleName: string;
  moduleCode?: string | null;
  semesterName: string;
  title: string;
  eventType: "EXAM" | "TEST" | "LECTURE" | "EXERCISE" | "DEADLINE" | "OTHER";
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  description?: string | null;
}

export interface UnifiedCalendarItem {
  id: string;
  moduleId: string;
  moduleName: string;
  moduleCode?: string | null;
  semesterName: string;
  title: string;
  eventType: "EXAM" | "TEST" | "LECTURE" | "EXERCISE" | "DEADLINE" | "OTHER";
  date: string; // ISO date string or YYYY-MM-DD
  time?: string | null;
  location?: string | null;
  description?: string | null;
  readinessScore?: number;
  daysUntilExam?: number;
  isDirectExam?: boolean;
}

export function safeDateKey(d: any): string {
  if (!d) return "";
  if (typeof d === "string") {
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return "";
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }
  if (d instanceof Date && !isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return "";
}

export function ExamCalendar({ onExamUpdated }: { onExamUpdated?: () => void }) {
  const { lang, t } = useLanguage();
  const [exams, setExams] = useState<CalendarExam[]>([]);
  const [subEvents, setSubEvents] = useState<CalendarSubEvent[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [eventFilter, setEventFilter] = useState<"all" | "exams" | "tests" | "lectures" | "exercises">("all");
  const [selectedDayForDetail, setSelectedDayForDetail] = useState<Date | null>(null);

  // Current calendar month view
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Modal State for adding/assigning exam
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isIcsModalOpen, setIsIcsModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [moduleSearchQuery, setModuleSearchQuery] = useState("");
  const [examTime, setExamTime] = useState("");
  const [examLocation, setExamLocation] = useState("");
  const [examDescription, setExamDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoMatchedModule, setAutoMatchedModule] = useState<any>(null);

  // Reset Calendar Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [deleteEmptyOnReset, setDeleteEmptyOnReset] = useState(true);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // University / Campus Provider State
  const [preferredUniversity, setPreferredUniversity] = useState<string>("tu_wien");
  const [customUniversity, setCustomUniversity] = useState<string>("");
  const [showUniDropdown, setShowUniDropdown] = useState(false);

  // Merge Duplicate Courses State
  const [isMergingCourses, setIsMergingCourses] = useState(false);
  const [mergeMessage, setMergeMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedUni = localStorage.getItem("studyhub_preferred_university");
        if (savedUni) setPreferredUniversity(savedUni);
        const savedCustom = localStorage.getItem("studyhub_custom_university");
        if (savedCustom) setCustomUniversity(savedCustom);
      } catch (e) {
        console.warn("localStorage restricted:", e);
      }
    }
  }, []);

  const handleSelectUniversity = (uniId: string, customName?: string) => {
    setPreferredUniversity(uniId);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("studyhub_preferred_university", uniId);
        if (customName !== undefined) {
          setCustomUniversity(customName);
          localStorage.setItem("studyhub_custom_university", customName);
        }
      } catch (e) {
        console.warn("Could not save to localStorage:", e);
      }
    }
    setShowUniDropdown(false);
  };

  const handleMergeCourses = async () => {
    setIsMergingCourses(true);
    setMergeMessage(null);
    try {
      const res = await fetch("/api/calendar/merge-courses", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (lang === "de" ? "Fehler beim Zusammenführen" : "Error merging courses"));
      setMergeMessage(data.message);
      await fetchCalendarData();
      if (onExamUpdated) onExamUpdated();
      setTimeout(() => setMergeMessage(null), 4000);
    } catch (err: any) {
      console.error("Failed to merge courses:", err);
    } finally {
      setIsMergingCourses(false);
    }
  };

  const fetchCalendarData = async () => {
    try {
      const [resCal, resModules] = await Promise.all([
        fetch("/api/calendar"),
        fetch("/api/modules"),
      ]);
      if (resCal.ok) {
        const data = await resCal.json();
        if (Array.isArray(data)) {
          setExams(data);
          setSubEvents([]);
        } else if (data && typeof data === "object") {
          setExams(Array.isArray(data.exams) ? data.exams : []);
          setSubEvents(Array.isArray(data.events) ? data.events : []);
        }
      }
      if (resModules.ok) {
        const modData = await resModules.json();
        setModules(Array.isArray(modData) ? modData : []);
      }
    } catch (err) {
      console.error("Failed to load calendar data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, []);

  // Live Auto-Matching as user types search query
  useEffect(() => {
    if (moduleSearchQuery.trim().length > 1 && Array.isArray(modules)) {
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
    const formatted = safeDateKey(date) || safeDateKey(new Date());
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
        fetchCalendarData();
        if (onExamUpdated) onExamUpdated();
      }
    } catch (err) {
      console.error("Failed to save exam date:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetCalendar = async () => {
    setIsResetting(true);
    setResetError(null);
    setResetMessage(null);

    try {
      const res = await fetch("/api/calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteEmptyModules: deleteEmptyOnReset }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (lang === "de" ? "Fehler beim Zurücksetzen des Kalenders" : "Failed to reset calendar"));
      }

      setResetMessage(
        data.message ||
          (lang === "de"
            ? "Kalender erfolgreich zurückgesetzt."
            : "Calendar successfully reset.")
      );
      // Immediately clear local state for instant feedback
      setExams([]);
      setSubEvents([]);
      fetchCalendarData();
      if (onExamUpdated) onExamUpdated();

      setTimeout(() => {
        setIsResetModalOpen(false);
        setResetMessage(null);
      }, 1400);
    } catch (err: any) {
      setResetError(err.message || (lang === "de" ? "Fehler beim Zurücksetzen" : "Reset failed"));
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteSingleEvent = async (eventId: string) => {
    try {
      const realId = eventId.replace(/^event-/, "").replace(/^exam-/, "");
      const res = await fetch("/api/calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: realId }),
      });
      if (res.ok) {
        fetchCalendarData();
        if (onExamUpdated) onExamUpdated();
        if (selectedDayForDetail) {
          // Keep day detail modal open and refreshed
          const remaining = getItemsForDay(selectedDayForDetail).filter((i) => i.id !== eventId);
          if (remaining.length === 0) {
            setSelectedDayForDetail(null);
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete event:", err);
    }
  };

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Build unified calendar items list
  const unifiedItems: UnifiedCalendarItem[] = [];

  // 1. Add module exams
  exams.forEach((exam) => {
    unifiedItems.push({
      id: `exam-${exam.id}`,
      moduleId: exam.id,
      moduleName: exam.name,
      moduleCode: exam.code,
      semesterName: exam.semesterName,
      title: `${exam.code ? `[${exam.code}] ` : ""}${exam.name}`,
      eventType: "EXAM",
      date: exam.examDate,
      time: exam.examTime,
      location: exam.examLocation,
      description: exam.examDescription,
      readinessScore: exam.readinessScore,
      daysUntilExam: exam.daysUntilExam,
      isDirectExam: true,
    });
  });

  // 2. Add calendar sub-events (lectures, tests, exercises)
  subEvents.forEach((evt) => {
    // Deduplicate if an exam event already exists on the same day for this module
    const evtDateStr = safeDateKey(evt.date);
    const isDuplicateExam =
      evt.eventType === "EXAM" &&
      evtDateStr !== "" &&
      exams.some(
        (e) =>
          e.id === evt.moduleId &&
          safeDateKey(e.examDate) === evtDateStr
      );

    if (!isDuplicateExam) {
      const evtTime = evt.date ? new Date(evt.date).getTime() : NaN;
      const diffMs = !isNaN(evtTime) ? evtTime - Date.now() : 0;
      const daysUntil = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      unifiedItems.push({
        id: `event-${evt.id}`,
        moduleId: evt.moduleId,
        moduleName: evt.moduleName,
        moduleCode: evt.moduleCode,
        semesterName: evt.semesterName,
        title: evt.title,
        eventType: evt.eventType,
        date: evt.date,
        time: evt.startTime ? `${evt.startTime}${evt.endTime ? ` – ${evt.endTime}` : ""}` : null,
        location: evt.location,
        description: evt.description,
        daysUntilExam: daysUntil,
        isDirectExam: false,
      });
    }
  });

  // Filter unified items
  const filteredItems = unifiedItems.filter((item) => {
    if (eventFilter === "exams") return item.eventType === "EXAM";
    if (eventFilter === "tests") return item.eventType === "TEST";
    if (eventFilter === "lectures") return item.eventType === "LECTURE";
    if (eventFilter === "exercises") return item.eventType === "EXERCISE";
    return true;
  });

  const examCount = unifiedItems.filter((i) => i.eventType === "EXAM").length;
  const testCount = unifiedItems.filter((i) => i.eventType === "TEST").length;
  const lectureCount = unifiedItems.filter((i) => i.eventType === "LECTURE").length;
  const exerciseCount = unifiedItems.filter((i) => i.eventType === "EXERCISE").length;

  // Sort by date ascending safely
  filteredItems.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
  });

  // Month calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames =
    lang === "de"
      ? [
          "Januar", "Februar", "März", "April", "Mai", "Juni",
          "Juli", "August", "September", "Oktober", "November", "Dezember",
        ]
      : [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December",
        ];
  const currentProviderObj = SUPPORTED_UNIVERSITIES.find((u) => u.id === preferredUniversity);
  const activeMapName =
    preferredUniversity === "google_maps"
      ? "Google Maps"
      : preferredUniversity === "tum"
      ? "TUM"
      : preferredUniversity === "tu_wien"
      ? "TU Wien Maps"
      : preferredUniversity === "other"
      ? (customUniversity || "Google Maps")
      : (currentProviderObj?.shortName || "Campus Maps");

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let startOffset = firstDayOfMonth.getDay() - 1;
  if (startOffset === -1) startOffset = 6; // Sunday -> 6

  const daysArray = [];
  for (let i = 0; i < startOffset; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(new Date(year, month, d));
  }

  const getItemsForDay = (day: Date) => {
    const dayStr = safeDateKey(day);
    if (!dayStr) return [];
    return filteredItems.filter((item) => {
      const itemDateStr = safeDateKey(item.date);
      return itemDateStr === dayStr;
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

        <div className="flex items-center gap-3 flex-wrap">
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
              {lang === "de" ? `Terminliste (${filteredItems.length})` : `Schedule List (${filteredItems.length})`}
            </button>
          </div>

          {/* University Campus Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUniDropdown((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs transition-all"
              title={lang === "de" ? "Campus für Raumsuche & Hörsäle auswählen" : "Select university for room navigation"}
            >
              <GraduationCap className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span>
                {preferredUniversity === "google_maps"
                  ? "Google Maps"
                  : preferredUniversity === "tum"
                  ? "TUM (TU München)"
                  : preferredUniversity === "other" && customUniversity
                  ? customUniversity
                  : (SUPPORTED_UNIVERSITIES.find((u) => u.id === preferredUniversity)?.shortName || "TU Wien")}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showUniDropdown && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  {lang === "de" ? "Hochschule / Campus für Raumsuche" : "University for Room Navigation"}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-0.5 pt-1">
                  {SUPPORTED_UNIVERSITIES.map((uni) => (
                    <button
                      key={uni.id}
                      type="button"
                      onClick={() => {
                        if (uni.id !== "other") {
                          handleSelectUniversity(uni.id);
                        } else {
                          const name = prompt(
                            lang === "de"
                              ? "Name deiner Universität / Hochschule (z. B. 'Uni Köln', 'KIT', 'Uni Innsbruck'):"
                              : "Name of your university (e.g. 'Uni Cologne', 'KIT'):",
                            customUniversity || ""
                          );
                          if (name !== null) {
                            handleSelectUniversity("other", name.trim());
                          }
                        }
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        preferredUniversity === uni.id
                          ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{uni.name}</div>
                        <div className="text-[10px] text-slate-400">{uni.mapSystem}</div>
                      </div>
                      {preferredUniversity === uni.id && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Import .ics Calendar */}
          <button
            onClick={() => setIsIcsModalOpen(true)}
            title={lang === "de" ? "Kalenderdatei (.ics) importieren" : "Import calendar (.ics)"}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-50 dark:bg-sky-950/70 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 transition-all shadow-sm"
          >
            <UploadCloud className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>{lang === "de" ? "Kalender (.ics) importieren" : "Import Calendar (.ics)"}</span>
          </button>

          <button
            onClick={() => handleOpenAddForDate(new Date())}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> {t.addExamDateBtn.replace(/^\+\s*/, "")}
          </button>

          {/* Reset Calendar Button */}
          <button
            onClick={() => setIsResetModalOpen(true)}
            title={lang === "de" ? "Gesamten Kalender zurücksetzen & Termine leeren" : "Reset entire calendar & clear events"}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/70 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 transition-all shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>{lang === "de" ? "Kalender zurücksetzen" : "Reset Calendar"}</span>
          </button>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setEventFilter("all")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              eventFilter === "all"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            {lang === "de" ? `Alle Termine (${unifiedItems.length})` : `All Events (${unifiedItems.length})`}
          </button>
          <button
            type="button"
            onClick={() => setEventFilter("exams")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              eventFilter === "exams"
                ? "bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-200 shadow-sm border border-rose-300 dark:border-rose-800"
                : "text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
            }`}
          >
            <Flame className="w-3 h-3 text-rose-500" />
            {lang === "de" ? `Klausuren (${examCount})` : `Exams (${examCount})`}
          </button>
          <button
            type="button"
            onClick={() => setEventFilter("tests")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              eventFilter === "tests"
                ? "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 shadow-sm border border-amber-300 dark:border-amber-800"
                : "text-slate-500 hover:text-amber-600 dark:hover:text-amber-400"
            }`}
          >
            <Zap className="w-3 h-3 text-amber-500" />
            {lang === "de" ? `Tests (${testCount})` : `Tests (${testCount})`}
          </button>
          <button
            type="button"
            onClick={() => setEventFilter("lectures")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              eventFilter === "lectures"
                ? "bg-sky-100 dark:bg-sky-950 text-sky-900 dark:text-sky-200 shadow-sm border border-sky-300 dark:border-sky-800"
                : "text-slate-500 hover:text-sky-600 dark:hover:text-sky-400"
            }`}
          >
            <BookOpen className="w-3 h-3 text-sky-500" />
            {lang === "de" ? `Vorlesungen (${lectureCount})` : `Lectures (${lectureCount})`}
          </button>
          <button
            type="button"
            onClick={() => setEventFilter("exercises")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              eventFilter === "exercises"
                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 shadow-sm border border-emerald-300 dark:border-emerald-800"
                : "text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            <span>✏️</span>
            {lang === "de" ? `Übungen (${exerciseCount})` : `Exercises (${exerciseCount})`}
          </button>
        </div>

        {/* Dynamic Campus / Navigation Map Provider Hint */}
        <div
          onClick={() => setShowUniDropdown(true)}
          className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 cursor-pointer transition-colors"
          title={lang === "de" ? "Klicken, um Campus-Navigationssystem zu wechseln" : "Click to change campus map provider"}
        >
          <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
          <span>
            {lang === "de" ? (
              <>Hörsäle & Räume mit <strong>{activeMapName}</strong> verlinkt</>
            ) : (
              <>Rooms & halls linked via <strong>{activeMapName}</strong></>
            )}
          </span>
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

              const dayItems = getItemsForDay(day);
              const isToday =
                safeDateKey(new Date()) === safeDateKey(day);
              const hasExamsOnDay = dayItems.some((i) => i.eventType === "EXAM" || i.eventType === "TEST");

              return (
                <div
                  key={safeDateKey(day) || `day-${idx}`}
                  onClick={() => {
                    if (dayItems.length > 0) {
                      setSelectedDayForDetail(day);
                    } else {
                      handleOpenAddForDate(day);
                    }
                  }}
                  className={`min-h-[130px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group overflow-hidden ${
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
                    <div className="flex items-center gap-1">
                      {hasExamsOnDay && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddForDate(day);
                        }}
                        title={lang === "de" ? "Termin an diesem Tag hinzufügen" : "Add event on this date"}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 transition-opacity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Pills inside day slot */}
                  <div className="space-y-1 overflow-y-auto max-h-24 scrollbar-none my-1">
                    {dayItems.map((item) => {
                      let badgeStyles =
                        "bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-900 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800";
                      let icon = "📅";

                      if (item.eventType === "EXAM") {
                        badgeStyles =
                          "bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800 font-bold";
                        icon = "🔥";
                      } else if (item.eventType === "TEST") {
                        badgeStyles =
                          "bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 font-bold";
                        icon = "⚡";
                      } else if (item.eventType === "LECTURE") {
                        badgeStyles =
                          "bg-sky-100 hover:bg-sky-200 dark:bg-sky-950 dark:hover:bg-sky-900 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-800";
                        icon = "📚";
                      } else if (item.eventType === "EXERCISE") {
                        badgeStyles =
                          "bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800";
                        icon = "✏️";
                      }

                      const itemMap = item.location ? getCampusMapInfo(item.location, preferredUniversity, customUniversity) : null;
                      return (
                        <div
                          key={item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayForDetail(day);
                          }}
                          className={`block px-1.5 py-1 rounded-lg text-[10px] border transition-colors shadow-2xs hover:opacity-90 cursor-pointer ${badgeStyles}`}
                          title={`${icon} ${item.title}${item.time ? ` (${item.time})` : ""}${item.location ? ` @ ${item.location}` : ""}`}
                        >
                          <div className="flex items-center justify-between gap-1 leading-tight">
                            <span className="font-bold truncate flex items-center gap-0.5">
                              <span>{icon}</span>
                              {item.time && <span>{item.time}</span>}
                            </span>
                            {item.location && itemMap && (
                              itemMap.url ? (
                                <a
                                  href={itemMap.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title={`📍 Raum sofort auf ${itemMap.providerName} suchen: ${itemMap.cleanLocation}`}
                                  className="text-[9px] opacity-90 hover:opacity-100 font-bold truncate max-w-[65px] hover:underline flex items-center gap-0.5 bg-black/5 dark:bg-white/10 px-1 py-0.2 rounded transition-colors"
                                >
                                  <span>📍</span>
                                  <span className="truncate">{itemMap.cleanLocation}</span>
                                </a>
                              ) : (
                                <span className="text-[9px] opacity-75 truncate max-w-[55px]">
                                  📍 {itemMap.cleanLocation}
                                </span>
                              )
                            )}
                          </div>
                          <div className="truncate font-medium mt-0.5">
                            {item.moduleCode ? `[${item.moduleCode}] ` : ""}
                            {item.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-[10px] text-slate-400 group-hover:text-indigo-600 transition-colors flex items-center justify-between">
                    <span>{dayItems.length > 0 ? `${dayItems.length} Termin(e)` : ""}</span>
                    <span className="opacity-0 group-hover:opacity-100">+ Termin</span>
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
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CalendarIcon className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-xs">{t.examListNoExams}</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const daysLeft = item.daysUntilExam ?? 0;
              let badgeColor = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
              if (item.eventType === "EXAM") {
                if (daysLeft <= 7) {
                  badgeColor = "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-black animate-pulse";
                } else if (daysLeft <= 21) {
                  badgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold";
                }
              }

              const mapInfo = item.location ? getCampusMapInfo(item.location, preferredUniversity, customUniversity) : null;

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow transition-all"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Event Type Badge */}
                      {item.eventType === "EXAM" && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                          <Flame className="w-3 h-3 text-rose-500" /> {lang === "de" ? "Klausur" : "Exam"}
                        </span>
                      )}
                      {item.eventType === "TEST" && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-500" /> {lang === "de" ? "Test" : "Test"}
                        </span>
                      )}
                      {item.eventType === "LECTURE" && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-sky-500" /> {lang === "de" ? "Vorlesung" : "Lecture"}
                        </span>
                      )}
                      {item.eventType === "EXERCISE" && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                          ✏️ {lang === "de" ? "Übung" : "Exercise"}
                        </span>
                      )}

                      {item.eventType === "EXAM" && (
                        <span className={`px-2.5 py-0.5 rounded-xl text-xs ${badgeColor}`}>
                          {daysLeft === 0 ? t.examToday : t.daysRemaining.replace("{n}", daysLeft.toString())}
                        </span>
                      )}

                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {item.date && !isNaN(new Date(item.date).getTime())
                          ? new Date(item.date).toLocaleDateString(lang === "de" ? "de-DE" : "en-US", {
                              weekday: "short",
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })
                          : item.date || "–"}
                      </span>

                      {item.time && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5" /> {item.time} Uhr
                        </span>
                      )}

                      {/* Location with Campus Map link */}
                      {item.location && mapInfo && (
                        <span className="flex items-center gap-1 text-xs">
                          {mapInfo.url ? (
                            <a
                              href={mapInfo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-semibold"
                              title={`In ${mapInfo.providerName} öffnen`}
                            >
                              <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                              <span className="truncate max-w-[200px]">{mapInfo.cleanLocation}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-sky-500" />
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold ml-1">
                                {mapInfo.badgeLabel}
                              </span>
                            </a>
                          ) : (
                            <span className="flex items-center gap-1 text-slate-500">
                              <MapPin className="w-3.5 h-3.5 text-rose-500" /> {item.location}
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    <div>
                      <Link href={`/module/${item.moduleId}`}>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white hover:text-indigo-600 transition-colors truncate">
                          {item.title}
                        </h4>
                      </Link>
                      <span className="text-xs text-slate-400">
                        {item.moduleName} {item.semesterName ? `• ${item.semesterName}` : ""}
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800/90 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
                        📝 {item.description}
                      </p>
                    )}
                  </div>

                  {/* Readiness mini meter & jump button */}
                  <div className="md:w-60 space-y-2.5 flex-shrink-0">
                    {item.readinessScore !== undefined && (
                      <FahrschulBar score={item.readinessScore} size="sm" />
                    )}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/module/${item.moduleId}?tab=trainer`}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all"
                      >
                        {item.eventType === "EXAM" ? t.openTrainer : "Zum Modul"} <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteSingleEvent(item.id)}
                        title="Termin entfernen"
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-slate-200/80 dark:border-slate-700 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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

      {/* ICS Calendar Import Modal */}
      <IcsImportModal
        isOpen={isIcsModalOpen}
        onClose={() => setIsIcsModalOpen(false)}
        modules={modules}
        onSuccess={() => {
          fetchCalendarData();
          if (onExamUpdated) onExamUpdated();
        }}
      />

      {/* Reset Calendar Confirmation Modal */}
      {isResetModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {lang === "de" ? "Kalender zurücksetzen?" : "Reset Calendar?"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {lang === "de" ? "Alle Termine & Prüfungsdaten leeren" : "Clear all events & exam dates"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsResetModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <p>
                  {lang === "de"
                    ? "Möchtest du wirklich alle eingetragenen Vorlesungen, Übungen, Tests und Prüfungstermine aus deinem Kalender entfernen?"
                    : "Are you sure you want to remove all lectures, exercises, tests, and exam dates from your calendar?"}
                </p>

                <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-medium">
                  🛡️ {lang === "de"
                    ? "Deine Module mit hochgeladenen Dokumenten, Zusammenfassungen und Fragen bleiben zu 100% sicher erhalten!"
                    : "Your modules with uploaded documents, summaries, and questions will remain 100% safe!"}
                </div>

                <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={deleteEmptyOnReset}
                    onChange={(e) => setDeleteEmptyOnReset(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>
                    {lang === "de"
                      ? "Leere Modul-Einträge ohne Dokumente oder Fragen (z. B. durch frühere Kalenderimporte) ebenfalls entfernen"
                      : "Also delete empty dummy modules without documents or questions (e.g. from previous imports)"}
                  </span>
                </label>
              </div>

              {resetError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{resetMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={isResetting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleResetCalendar}
                  disabled={isResetting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isResetting
                    ? (lang === "de" ? "Wird zurückgesetzt..." : "Resetting...")
                    : (lang === "de" ? "Ja, Kalender zurücksetzen" : "Yes, Reset Calendar")}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
      {/* Day Schedule Detail Modal */}
      {selectedDayForDetail && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">
                      {selectedDayForDetail.toLocaleDateString(lang === "de" ? "de-DE" : "en-US", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {getItemsForDay(selectedDayForDetail).length}{" "}
                      {lang === "de" ? "Termine an diesem Tag" : "events on this day"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDayForDetail(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              {/* List of events on this day */}
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {getItemsForDay(selectedDayForDetail).map((item) => {
                  const mapInfo = item.location ? getCampusMapInfo(item.location, preferredUniversity, customUniversity) : null;
                  let typeBadge = (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800 flex items-center gap-1">
                      📚 {lang === "de" ? "Vorlesung" : "Lecture"}
                    </span>
                  );
                  if (item.eventType === "EXAM") {
                    typeBadge = (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
                        🔥 {lang === "de" ? "Klausur" : "Exam"}
                      </span>
                    );
                  } else if (item.eventType === "TEST") {
                    typeBadge = (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                        ⚡ {lang === "de" ? "Test" : "Test"}
                      </span>
                    );
                  } else if (item.eventType === "EXERCISE") {
                    typeBadge = (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                        ✏️ {lang === "de" ? "Übung" : "Exercise"}
                      </span>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 space-y-2.5 transition-all shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {typeBadge}
                            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                              {item.moduleCode || item.moduleName}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-0.5">
                            {item.title}
                          </h4>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteSingleEvent(item.id)}
                          title={lang === "de" ? "Termin entfernen" : "Remove event"}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Time and Location details */}
                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        {item.time && (
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                            <Clock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                            <span>⏰ {item.time} {lang === "de" ? "Uhr" : ""}</span>
                          </div>
                        )}

                        {item.location && mapInfo && (
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                              <span className="font-semibold">{item.location}</span>
                            </div>
                            {mapInfo.url && (
                              <a
                                href={mapInfo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-sm hover:shadow"
                                title={lang === "de" ? `In ${mapInfo.providerName} nach ${mapInfo.cleanLocation} suchen` : `Search ${mapInfo.cleanLocation} in ${mapInfo.providerName}`}
                              >
                                <span>🔍 {mapInfo.isOnline ? mapInfo.badgeLabel : `${lang === "de" ? "Raum sofort suchen" : "Search room"}: ${mapInfo.cleanLocation}`}</span>
                                <ExternalLink className="w-3 h-3 ml-0.5" />
                              </a>
                            )}
                            {mapInfo.secondaryUrl && (
                              <a
                                href={mapInfo.secondaryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline"
                                title={lang === "de" ? "Campus auf Google Maps anzeigen" : "Show campus on Google Maps"}
                              >
                                <span>📍 Google Maps</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        )}

                        {item.description && (
                          <p className="text-[11px] text-slate-500 pt-1 italic line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-1 flex items-center justify-end">
                        <Link
                          href={`/module/${item.moduleId}`}
                          onClick={() => setSelectedDayForDetail(null)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <span>{lang === "de" ? "Zum Modul" : "Go to module"}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedDayForDetail(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const day = selectedDayForDetail;
                    setSelectedDayForDetail(null);
                    handleOpenAddForDate(day);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === "de" ? "Weiteren Termin anlegen" : "Add Another Event"}</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}