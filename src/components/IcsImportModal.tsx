"use client";

import React, { useState, useRef } from "react";
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
  HelpCircle,
} from "lucide-react";
import { Portal } from "./Portal";
import { useLanguage } from "@/lib/i18n";
import { parseIcsContent, ParsedIcsEvent } from "@/lib/ics-parser";

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
  const [events, setEvents] = useState<ParsedIcsEvent[]>([]);
  const [filterMode, setFilterMode] = useState<"all" | "exams" | "selected">("all");
  const [eventTargets, setEventTargets] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setError(null);
    setSuccessCount(null);
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
          setEvents([]);
          return;
        }

        setEvents(parsed);

        // Pre-fill target assignments
        const initialTargets: Record<string, string> = {};
        parsed.forEach((ev) => {
          if (ev.matchedModuleId) {
            initialTargets[ev.uid] = ev.matchedModuleId;
          } else if (ev.isExam) {
            initialTargets[ev.uid] = "create_new";
          } else {
            initialTargets[ev.uid] = "create_new";
          }
        });
        setEventTargets(initialTargets);

        // If there are exams, set filter to exams by default for better focus
        const hasExams = parsed.some((p) => p.isExam);
        if (hasExams) {
          setFilterMode("exams");
        }
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

  const toggleEventSelected = (uid: string) => {
    setEvents((prev) =>
      prev.map((ev) => (ev.uid === uid ? { ...ev, selected: !ev.selected } : ev))
    );
  };

  const selectAll = (selected: boolean) => {
    setEvents((prev) => prev.map((ev) => ({ ...ev, selected })));
  };

  const handleTargetChange = (uid: string, target: string) => {
    setEventTargets((prev) => ({ ...prev, [uid]: target }));
  };

  const handleSubmit = async () => {
    const selectedEvents = events.filter((ev) => ev.selected);
    if (selectedEvents.length === 0) {
      setError(
        lang === "de"
          ? "Bitte wähle mindestens einen Termin zum Importieren aus."
          : "Please select at least one event to import."
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      events: selectedEvents.map((ev) => ({
        summary: ev.summary,
        dateStr: ev.dateStr,
        timeStr: ev.timeStr,
        location: ev.location,
        description: ev.description,
        target: eventTargets[ev.uid] || "create_new",
        newModuleName: ev.summary,
        newModuleEcts: 5,
      })),
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

      setSuccessCount(data.importedCount);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Fehler beim Import");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (filterMode === "exams") return ev.isExam;
    if (filterMode === "selected") return ev.selected;
    return true;
  });

  const selectedCount = events.filter((e) => e.selected).length;

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
                  {lang === "de" ? "Studentenkalender (.ics) importieren" : "Import Student Calendar (.ics)"}
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                    Auto-Match
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === "de"
                    ? "Vorlesungen & Klausurtermine aus Moodle, HISinOne, Stud.IP, TUMonline etc."
                    : "Import exams and lectures from your campus portal via iCalendar .ics file."}
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
            {/* File Upload Dropzone */}
            {events.length === 0 ? (
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
                    ? "Unterstützt alle Standard-Kalenderexporte (HISinOne, Moodle, Stud.IP, Outlook, Apple Calendar, Google Calendar)."
                    : "Supports all standard campus exports (HISinOne, Moodle, Stud.IP, Apple/Google Calendar)."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* File info bar */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-slate-800 dark:text-slate-200">{fileName}</span>
                    <span className="text-slate-400">({events.length} {lang === "de" ? "Termine erkannt" : "events found"})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEvents([]);
                      setFileName(null);
                    }}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {lang === "de" ? "Andere Datei wählen" : "Change File"}
                  </button>
                </div>

                {/* Filter and Selection Tools */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterMode("all")}
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${
                        filterMode === "all"
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {lang === "de" ? `Alle (${events.length})` : `All (${events.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode("exams")}
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${
                        filterMode === "exams"
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {lang === "de"
                        ? `Nur Klausuren (${events.filter((e) => e.isExam).length})`
                        : `Exams Only (${events.filter((e) => e.isExam).length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode("selected")}
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${
                        filterMode === "selected"
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {lang === "de" ? `Ausgewählt (${selectedCount})` : `Selected (${selectedCount})`}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => selectAll(true)}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold"
                    >
                      {lang === "de" ? "Alle markieren" : "Select All"}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => selectAll(false)}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold"
                    >
                      {lang === "de" ? "Keine" : "Deselect All"}
                    </button>
                  </div>
                </div>

                {/* Event Cards List */}
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {filteredEvents.map((ev) => {
                    const currentTarget = eventTargets[ev.uid] || "create_new";
                    return (
                      <div
                        key={ev.uid}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          ev.selected
                            ? "bg-white dark:bg-slate-800/90 border-indigo-200 dark:border-indigo-800 shadow-sm"
                            : "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 opacity-60"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={ev.selected}
                            onChange={() => toggleEventSelected(ev.uid)}
                            className="w-4 h-4 mt-1 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />

                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {ev.summary}
                              </h5>
                              {ev.isExam && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex-shrink-0">
                                  🔥 {lang === "de" ? "Klausur" : "Exam"}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <CalendarIcon className="w-3 h-3 text-sky-500" />
                                {ev.dateStr}
                              </span>
                              {ev.timeStr && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {ev.timeStr} Uhr
                                </span>
                              )}
                              {ev.location && (
                                <span className="flex items-center gap-1 truncate max-w-[200px]">
                                  <MapPin className="w-3 h-3 text-rose-500" />
                                  {ev.location}
                                </span>
                              )}
                            </div>

                            {/* Module Assignment Selector */}
                            <div className="pt-1.5 flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                                {lang === "de" ? "Zuordnen zu:" : "Assign to:"}
                              </span>
                              <select
                                value={currentTarget}
                                onChange={(e) => handleTargetChange(ev.uid, e.target.value)}
                                className="flex-1 text-xs py-1 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                              >
                                {ev.matchedModuleId && (
                                  <option value={ev.matchedModuleId}>
                                    ✨ {ev.matchedModuleName} (Auto-Match)
                                  </option>
                                )}
                                <option value="create_new">
                                  ➕ {lang === "de" ? "Als neues Modul anlegen (5 ECTS)" : "Create as new module (5 ECTS)"}
                                </option>
                                <optgroup label={lang === "de" ? "Bestehende Fächer:" : "Existing Modules:"}>
                                  {modules.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.code ? `[${m.code}] ` : ""}{m.name}
                                    </option>
                                  ))}
                                </optgroup>
                                <option value="ignore">
                                  🚫 {lang === "de" ? "Nicht importieren" : "Do not import"}
                                </option>
                              </select>
                            </div>
                          </div>
                        </div>
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

            {successCount !== null && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>
                  {lang === "de"
                    ? `Erfolgreich ${successCount} Termine in den Kalender übernommen!`
                    : `Successfully imported ${successCount} events into the calendar!`}
                </span>
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

            {events.length > 0 && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || selectedCount === 0}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {isSubmitting
                  ? (lang === "de" ? "Wird importiert..." : "Importing...")
                  : (lang === "de"
                      ? `${selectedCount} Termine übernehmen`
                      : `Import ${selectedCount} Events`)}
              </button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
