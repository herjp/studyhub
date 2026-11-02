"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Sparkles,
  ArrowRight,
  Clock,
  MapPin,
  Check,
  ChevronDown,
  ChevronUp,
  Trash2,
  ExternalLink,
  BookOpen,
  Flame,
  Zap,
  GraduationCap,
  Layers,
} from "lucide-react";
import { Portal } from "./Portal";
import { useLanguage } from "@/lib/i18n";
import {
  parseIcsContent,
  groupIcsEventsByCourse,
  CourseGroup,
  ParsedIcsEvent,
} from "@/lib/ics-parser";
import { getCampusMapInfo } from "@/lib/campus-maps";

interface IcsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  modules: Array<{ id: string; name: string; code?: string | null }>;
  onSuccess: () => void;
}

export function IcsImportModal({
  isOpen,
  onClose,
  modules,
  onSuccess,
}: IcsImportModalProps) {
  const { lang, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);
  const [rawEventsCount, setRawEventsCount] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [cleanDuplicates, setCleanDuplicates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const [preferredUniversity, setPreferredUniversity] = useState("tu_wien");
  const [customUniversity, setCustomUniversity] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedUni = localStorage.getItem("studyhub_preferred_university");
        if (savedUni) setPreferredUniversity(savedUni);
        const savedCustom = localStorage.getItem("studyhub_custom_university");
        if (savedCustom) setCustomUniversity(savedCustom);
      } catch (e) {
        console.warn("Storage restricted:", e);
      }
    }
  }, []);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setError(null);
    setSuccessInfo(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseIcsContent(text, modules);
        if (parsed.length === 0) {
          setError(
            lang === "de"
              ? "Keine gültigen Termine (VEVENT) in dieser Datei gefunden."
              : "No valid events (VEVENT) found in this file."
          );
          setCourseGroups([]);
          return;
        }

        setRawEventsCount(parsed.length);
        const grouped = groupIcsEventsByCourse(parsed, modules);
        setCourseGroups(grouped);

        // Auto-expand courses that have tests or exams
        const initialExpanded: Record<string, boolean> = {};
        grouped.forEach((g) => {
          if (g.examCount > 0 || g.testCount > 0) {
            initialExpanded[g.cleanModuleName] = true;
          }
        });
        setExpandedGroups(initialExpanded);
      } catch (err: any) {
        setError(
          lang === "de"
            ? "Fehler beim Lesen der .ics Datei: " + err.message
            : "Error parsing .ics file: " + err.message
        );
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const toggleGroupExpanded = (modName: string) => {
    setExpandedGroups((prev) => ({ ...prev, [modName]: !prev[modName] }));
  };

  const handleGroupActionChange = (
    modName: string,
    action: "link" | "create_new" | "ignore",
    matchedModuleId?: string | null
  ) => {
    setCourseGroups((prev) =>
      prev.map((g) => {
        if (g.cleanModuleName !== modName) return g;
        return {
          ...g,
          action,
          matchedModuleId: action === "link" ? matchedModuleId || g.matchedModuleId : null,
        };
      })
    );
  };

  const toggleSubEvent = (modName: string, uid: string) => {
    setCourseGroups((prev) =>
      prev.map((g) => {
        if (g.cleanModuleName !== modName) return g;
        return {
          ...g,
          allEvents: g.allEvents.map((ev) =>
            ev.uid === uid ? { ...ev, selected: !ev.selected } : ev
          ),
        };
      })
    );
  };

  const handleQuickCleanup = async () => {
    setIsCleaning(true);
    setCleanupMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/calendar/cleanup-duplicates", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler beim Bereinigen");

      setCleanupMessage(data.message);
      onSuccess(); // Refresh modules in background
    } catch (err: any) {
      setError(err.message || "Fehler beim Bereinigen");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSubmit = async () => {
    const activeGroups = courseGroups.filter((g) => g.action !== "ignore");
    if (activeGroups.length === 0) {
      setError(
        lang === "de"
          ? "Bitte wähle mindestens ein Fach zum Importieren aus."
          : "Please select at least one course to import."
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      courseGroups: activeGroups,
      cleanDuplicatesBeforeImport: cleanDuplicates,
    };

    try {
      const res = await fetch("/api/calendar/import-ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Import fehlgeschlagen");
      }

      setSuccessInfo(data.message);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || "Fehler beim Import");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalExams = courseGroups.reduce((acc, g) => acc + g.examCount, 0);
  const totalTests = courseGroups.reduce((acc, g) => acc + g.testCount, 0);
  const totalLectures = courseGroups.reduce((acc, g) => acc + g.lectureCount, 0);
  const totalExercises = courseGroups.reduce((acc, g) => acc + g.exerciseCount, 0);

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {lang === "de" ? "Stundenplan & Kalender (.ics) importieren" : "Import Calendar (.ics)"}
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-500" /> Smart Grouping
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === "de"
                    ? "Gruppiert Vorlesungen, Übungen und Tests automatisch nach Modul – kein Modul-Chaos!"
                    : "Groups lectures, exercises, and tests under their course modules automatically."}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1 rounded-lg"
            >
              ✕
            </button>
          </div>

          {/* Modal Body */}
          <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
            {/* Quick Cleanup Tool if user has messy dummy modules */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
                <Trash2 className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span>
                  {lang === "de"
                    ? "Alte oder leere Termin-Duplikate im Semester vorhanden?"
                    : "Clean up empty duplicate appointments from previous imports?"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleQuickCleanup}
                disabled={isCleaning}
                className="px-3 py-1.5 rounded-xl font-bold bg-amber-200/80 hover:bg-amber-300 dark:bg-amber-900/60 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-100 transition-all flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
              >
                {isCleaning
                  ? (lang === "de" ? "Bereinige..." : "Cleaning...")
                  : (lang === "de" ? "🧹 Leere Duplikate löschen" : "🧹 Clean empty duplicates")}
              </button>
            </div>

            {cleanupMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{cleanupMessage}</span>
              </div>
            )}

            {/* File Upload Dropzone */}
            {courseGroups.length === 0 ? (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer transition-all bg-indigo-50/30 dark:bg-indigo-950/20 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ics,text/calendar"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                  {lang === "de"
                    ? ".ics Kalenderdatei hier ablegen oder klicken"
                    : "Drop your .ics calendar file here or click to browse"}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {lang === "de"
                    ? "Unterstützt TU Wien TISS, Moodle, Stud.IP, HISinOne, Google & Apple Calendar. Erkennt automatisch Klausuren, Tests und Vorlesungen!"
                    : "Supports TU Wien TISS, Moodle, Stud.IP, Apple/Google Calendar. Automatically detects exams, tests, and lectures!"}
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* File info and group statistics banner */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-bold text-slate-800 dark:text-slate-200">{fileName}</span>
                      <span className="text-slate-400">
                        ({rawEventsCount} {lang === "de" ? "Termine" : "events"} →{" "}
                        <strong className="text-indigo-600 dark:text-indigo-400">
                          {courseGroups.length} {lang === "de" ? "Module" : "modules"}
                        </strong>
                        )
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCourseGroups([]);
                        setFileName(null);
                      }}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {lang === "de" ? "Andere Datei wählen" : "Change File"}
                    </button>
                  </div>

                  {/* Summary badges */}
                  <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                      <Layers className="w-3 h-3" /> {courseGroups.length} {lang === "de" ? "Module" : "Courses"}
                    </span>
                    {totalExams > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800">
                        <Flame className="w-3 h-3 text-rose-500" /> {totalExams} {lang === "de" ? "Klausuren" : "Exams"}
                      </span>
                    )}
                    {totalTests > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                        <Zap className="w-3 h-3 text-amber-500" /> {totalTests} {lang === "de" ? "Tests" : "Tests"}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold border border-sky-200 dark:border-sky-800">
                      <BookOpen className="w-3 h-3 text-sky-500" /> {totalLectures + totalExercises}{" "}
                      {lang === "de" ? "Vorlesungen/Übungen" : "Lectures/Exercises"}
                    </span>
                  </div>
                </div>

                {/* Pre-import cleanup checkbox */}
                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none px-1">
                  <input
                    type="checkbox"
                    checked={cleanDuplicates}
                    onChange={(e) => setCleanDuplicates(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>
                    {lang === "de"
                      ? "Leere Modul-Einträge ohne Dokumente vor dem Import bereinigen (empfohlen)"
                      : "Clean empty dummy modules before importing (recommended)"}
                  </span>
                </label>

                {/* Course Groups List */}
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {courseGroups.map((group) => {
                    const isExpanded = Boolean(expandedGroups[group.cleanModuleName]);
                    const isIgnored = group.action === "ignore";

                    return (
                      <div
                        key={group.cleanModuleName}
                        className={`rounded-2xl border transition-all ${
                          isIgnored
                            ? "bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800 opacity-50"
                            : "bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 shadow-sm"
                        }`}
                      >
                        {/* Group Header */}
                        <div className="p-3.5 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {group.cleanModuleName}
                                </h4>
                                {group.courseCode && (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {group.courseCode}
                                  </span>
                                )}
                                {group.semesterName && (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                      group.semesterType === "SUMMER"
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                        : "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                                    }`}
                                  >
                                    {group.semesterType === "SUMMER" ? "🌿" : "❄️"} {group.semesterName}
                                  </span>
                                )}
                              </div>

                              {/* Badges for Event Types */}
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap">
                                {group.examCount > 0 && (
                                  <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                                    <Flame className="w-3 h-3" /> {group.examCount} Klausur
                                  </span>
                                )}
                                {group.testCount > 0 && (
                                  <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                                    <Zap className="w-3 h-3" /> {group.testCount} Test
                                  </span>
                                )}
                                {group.lectureCount > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    <BookOpen className="w-3 h-3 text-sky-500" /> {group.lectureCount} Vorlesung(en)
                                  </span>
                                )}
                                {group.exerciseCount > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    ✏️ {group.exerciseCount} Übung(en)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Toggle Details Button */}
                            <button
                              type="button"
                              onClick={() => toggleGroupExpanded(group.cleanModuleName)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 flex items-center gap-1 flex-shrink-0"
                            >
                              <span>{group.allEvents.length} Termine</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          </div>

                          {/* Action Selector */}
                          <div className="pt-1.5 flex items-center gap-2 text-xs">
                            <span className="font-semibold text-slate-500 whitespace-nowrap">
                              {lang === "de" ? "Aktion:" : "Action:"}
                            </span>
                            <select
                              value={
                                group.action === "ignore"
                                  ? "ignore"
                                  : group.action === "link" && group.matchedModuleId
                                  ? group.matchedModuleId
                                  : "create_new"
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "ignore") {
                                  handleGroupActionChange(group.cleanModuleName, "ignore");
                                } else if (val === "create_new") {
                                  handleGroupActionChange(group.cleanModuleName, "create_new");
                                } else {
                                  handleGroupActionChange(group.cleanModuleName, "link", val);
                                }
                              }}
                              className="flex-1 text-xs py-1 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                            >
                              {group.matchedModuleId && (
                                <option value={group.matchedModuleId}>
                                  ✨ Zuordnen zu "{group.matchedModuleName}" (Auto-Match)
                                </option>
                              )}
                              <option value="create_new">
                                ➕ {lang === "de"
                                  ? `Als neues Modul erstellen (${group.semesterName || "5 ECTS"})`
                                  : `Create as new module (${group.semesterName || "5 ECTS"})`}
                              </option>
                              <optgroup label={lang === "de" ? "Bestehende Module:" : "Existing Modules:"}>
                                {modules
                                  .filter((m: any) => {
                                    if (!group.semesterName || !m.semester?.name) return true;
                                    const mSem = m.semester.name.toLowerCase();
                                    return (
                                      (group.semesterType === "SUMMER" && (mSem.includes("sommer") || mSem.includes("sose") || mSem.includes("ss"))) ||
                                      (group.semesterType === "WINTER" && (mSem.includes("winter") || mSem.includes("wise") || mSem.includes("ws")))
                                    );
                                  })
                                  .map((m: any) => (
                                    <option key={m.id} value={m.id}>
                                      {m.semester?.name ? `[${m.semester.name}] ` : ""}{m.code ? `[${m.code}] ` : ""}{m.name}
                                    </option>
                                  ))}
                              </optgroup>
                              <option value="ignore">
                                🚫 {lang === "de" ? "Dieses Fach ignorieren" : "Ignore this course"}
                              </option>
                            </select>
                          </div>
                        </div>

                        {/* Expandable Sub-Events List */}
                        {isExpanded && (
                          <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 rounded-b-2xl space-y-2">
                            <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                              <span>Termine für {group.cleanModuleName}:</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                Häkchen setzen um Termin zu importieren
                              </span>
                            </div>

                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {group.allEvents.map((ev) => {
                                const mapInfo = getCampusMapInfo(ev.location, preferredUniversity, customUniversity);
                                let typeBadge = (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                                    Termin
                                  </span>
                                );
                                if (ev.eventType === "EXAM") {
                                  typeBadge = (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                      🔥 Klausur
                                    </span>
                                  );
                                } else if (ev.eventType === "TEST") {
                                  typeBadge = (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                      ⚡ Test
                                    </span>
                                  );
                                } else if (ev.eventType === "LECTURE") {
                                  typeBadge = (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                                      Vorlesung
                                    </span>
                                  );
                                } else if (ev.eventType === "EXERCISE") {
                                  typeBadge = (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                      Übung
                                    </span>
                                  );
                                }

                                return (
                                  <div
                                    key={ev.uid}
                                    className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                                      ev.selected
                                        ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                        : "bg-slate-100/50 dark:bg-slate-900/50 border-transparent opacity-40"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <input
                                        type="checkbox"
                                        checked={ev.selected}
                                        onChange={() => toggleSubEvent(group.cleanModuleName, ev.uid)}
                                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          {typeBadge}
                                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                            {ev.summary}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                          <span>{ev.dateStr}</span>
                                          {ev.timeStr && (
                                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                              • {ev.timeStr}{ev.endTimeStr ? ` – ${ev.endTimeStr}` : ""} Uhr
                                            </span>
                                          )}
                                          {ev.location && (
                                            <span className="flex items-center gap-1 truncate">
                                              • <MapPin className="w-3 h-3 text-rose-500 flex-shrink-0" />
                                              {mapInfo.url ? (
                                                <a
                                                  href={mapInfo.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="text-sky-600 hover:underline flex items-center gap-0.5"
                                                  title={`In ${mapInfo.providerName} öffnen`}
                                                >
                                                  {mapInfo.cleanLocation}
                                                  <ExternalLink className="w-2.5 h-2.5" />
                                                </a>
                                              ) : (
                                                <span>{ev.location}</span>
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successInfo && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successInfo}</span>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t.cancel}
            </button>

            {courseGroups.length > 0 && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || courseGroups.filter((g) => g.action !== "ignore").length === 0}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {isSubmitting
                  ? (lang === "de" ? "Wird importiert..." : "Importing...")
                  : (lang === "de"
                      ? `${courseGroups.filter((g) => g.action !== "ignore").length} Module & Termine importieren`
                      : `Import ${courseGroups.filter((g) => g.action !== "ignore").length} Modules & Events`)}
              </button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}