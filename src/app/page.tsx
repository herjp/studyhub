"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  BookOpen,
  Calendar,
  Layers,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Filter,
  User,
  ShieldCheck,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Portal } from "@/components/Portal";
import { HeaderDashboard } from "@/components/HeaderDashboard";
import { SemesterTabs, SemesterType } from "@/components/SemesterTabs";
import { ModuleCard, ModuleData } from "@/components/ModuleCard";
import { AddModuleDialog } from "@/components/AddModuleDialog";
import { AuthModal } from "@/components/AuthModal";
import { useLanguage } from "@/lib/i18n";

export default function HomePage() {
  const { lang, t } = useLanguage();
  const [semesters, setSemesters] = useState<SemesterType[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "IN_PROGRESS" | "COMPLETED">("ALL");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoggingInDemo, setIsLoggingInDemo] = useState(false);

  // Reset Calendar & Merge Courses State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [deleteEmptyOnReset, setDeleteEmptyOnReset] = useState(true);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isMergingCourses, setIsMergingCourses] = useState(false);
  const [mergeMessage, setMergeMessage] = useState<string | null>(null);

  const handleMergeCourses = async () => {
    setIsMergingCourses(true);
    setMergeMessage(null);
    try {
      const res = await fetch("/api/calendar/merge-courses", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler beim Zusammenführen");
      setMergeMessage(data.message);
      if (selectedSemesterId) fetchModules(selectedSemesterId);
      setTimeout(() => setMergeMessage(null), 3500);
    } catch (err: any) {
      console.error("Failed to merge courses:", err);
    } finally {
      setIsMergingCourses(false);
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
      if (!res.ok) throw new Error(data.error || "Fehler beim Zurücksetzen");
      setResetMessage(
        data.message ||
          (lang === "de"
            ? "Kalender erfolgreich zurückgesetzt."
            : "Calendar successfully reset.")
      );
      if (selectedSemesterId) fetchModules(selectedSemesterId);
      setTimeout(() => {
        setIsResetModalOpen(false);
        setResetMessage(null);
      }, 1400);
    } catch (err: any) {
      setResetError(err.message || "Fehler beim Zurücksetzen");
    } finally {
      setIsResetting(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  };

  // Fetch Semesters
  const fetchSemesters = async () => {
    try {
      const res = await fetch("/api/semesters");
      if (res.ok) {
        const data = await res.json();
        setSemesters(data);

        // Auto select active semester or first semester
        if (data.length > 0) {
          const exists = data.some((s: SemesterType) => s.id === selectedSemesterId);
          if (!selectedSemesterId || !exists) {
            const active = data.find((s: SemesterType) => s.isActive);
            setSelectedSemesterId(active ? active.id : data[0].id);
          }
        } else {
          setSelectedSemesterId(null);
        }
      }
    } catch (err) {
      console.error("Error fetching semesters:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Modules for selected semester
  const fetchModules = async (semesterId: string) => {
    setModulesLoading(true);
    try {
      const res = await fetch(`/api/modules?semesterId=${semesterId}`);
      if (res.ok) {
        const data = await res.json();
        setModules(data);
      }
    } catch (err) {
      console.error("Error fetching modules:", err);
    } finally {
      setModulesLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoggingInDemo(true);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      if (res.ok) {
        await fetchCurrentUser();
        await fetchSemesters();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoggingInDemo(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchSemesters();
  }, []);

  useEffect(() => {
    if (selectedSemesterId) {
      fetchModules(selectedSemesterId);
    } else {
      setModules([]);
    }
  }, [selectedSemesterId]);

  const selectedSemester = semesters.find((s) => s.id === selectedSemesterId);

  // Filter modules by status if desired
  const filteredModules = modules.filter((m) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "IN_PROGRESS") return m.status === "IN_PROGRESS" || m.status === "PLANNED";
    if (statusFilter === "COMPLETED") return m.status === "COMPLETED";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-16 transition-colors">
      <HeaderDashboard
        onStatsUpdated={() => {
          fetchCurrentUser();
          fetchSemesters();
          if (selectedSemesterId) fetchModules(selectedSemesterId);
        }}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full flex-1 space-y-8">
        {/* Guest / Visitor Welcome Banner */}
        {!loading && !currentUser && (
          <section className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-indigo-400/20">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                {lang === "de" ? "Willkommen bei StudyHub" : "Welcome to StudyHub"}
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                {lang === "de" ? "Dein persönlicher KI-Klausur- & Studienassistent" : "Your personal AI exam & study trainer"}
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100 max-w-xl">
                {lang === "de"
                  ? "Erstelle Semester und Module, lade Folien als PDF oder Bild hoch und lerne mit KI-generierten Klausurfragen. Deine Daten werden geschützt in deinem Account verwaltet."
                  : "Organize semesters and courses, upload slides as PDF or images, and practice with AI-generated exam questions. Your data is strictly private."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <User className="w-4 h-4" />
                {lang === "de" ? "Registrieren / Login" : "Sign Up / Log In"}
              </button>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={isLoggingInDemo}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                {isLoggingInDemo ? "Lädt..." : (lang === "de" ? "1-Klick Demo-Account" : "1-Click Demo Account")}
              </button>
            </div>
          </section>
        )}
        {/* Semester Navigation Bar */}
        <section className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <SemesterTabs
            semesters={semesters}
            selectedSemesterId={selectedSemesterId}
            onSelectSemester={(id) => setSelectedSemesterId(id)}
            onSemesterChanged={() => {
              fetchSemesters();
              if (selectedSemesterId) fetchModules(selectedSemesterId);
            }}
          />
        </section>

        {/* Modules Section for Selected Semester */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {selectedSemester?.name || (lang === "de" ? "Fächer & Module" : "Courses & Modules")}
                </h2>
                {selectedSemester?.isActive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {t.activeSemester}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {modules.length} {t.modulesInSemester}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Filter Tabs */}
              <div className="inline-flex rounded-xl bg-slate-200/60 dark:bg-slate-800 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    statusFilter === "ALL"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {t.filterAll} ({modules.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("IN_PROGRESS")}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    statusFilter === "IN_PROGRESS"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {t.filterInProgress}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("COMPLETED")}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    statusFilter === "COMPLETED"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {t.filterCompleted}
                </button>
              </div>

              {/* Calendar Link Button */}
              <Link
                href="/calendar"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                title={lang === "de" ? "Kalender & .ics Termin-Import" : "Calendar & .ics schedule import"}
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-500" /> {t.calendar} &amp; .ics
              </Link>

              {/* Merge Duplicate Courses Button */}
              <button
                type="button"
                onClick={handleMergeCourses}
                disabled={isMergingCourses}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all disabled:opacity-50"
                title={lang === "de" ? "Doppelte Termine gleicher Modulnummern (330...) automatisch zu einem Modul zusammenführen" : "Consolidate duplicate course numbers into single modules"}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>{isMergingCourses ? (lang === "de" ? "Führe zusammen..." : "Merging...") : (lang === "de" ? "Module zusammenführen" : "Merge Courses")}</span>
              </button>

              {/* Reset Calendar Button */}
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-all"
                title={lang === "de" ? "Gesamten Kalender zurücksetzen & Termine leeren" : "Reset entire calendar & clear events"}
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>{lang === "de" ? "Kalender zurücksetzen" : "Reset Calendar"}</span>
              </button>

              {/* Add Module Button */}
              {selectedSemesterId && (
                <button
                  type="button"
                  onClick={() => setIsAddModuleOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow transition-all flex-shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> {t.addModule}
                </button>
              )}
            </div>
          </div>

          {mergeMessage && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{mergeMessage}</span>
            </div>
          )}

          {/* Module Cards Grid */}
          {modulesLoading ? (
            <div className="py-16 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredModules.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {t.noModulesFound}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {selectedSemesterId
                  ? t.noModulesHint
                  : (lang === "de" ? "Lege oben zuerst ein Semester an." : "Create a semester first above.")}
              </p>
              {selectedSemesterId && (
                <button
                  onClick={() => setIsAddModuleOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all mt-2"
                >
                  <Plus className="w-3.5 h-3.5" /> {t.firstModuleBtn}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredModules.map((mod) => (
                <ModuleCard
                  key={mod.id}
                  module={mod}
                  onUpdated={() => {
                    if (selectedSemesterId) fetchModules(selectedSemesterId);
                    fetchSemesters();
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Add Module Modal */}
      {selectedSemesterId && (
        <AddModuleDialog
          semesterId={selectedSemesterId}
          isOpen={isAddModuleOpen}
          onClose={() => setIsAddModuleOpen(false)}
          onModuleAdded={() => {
            fetchModules(selectedSemesterId);
            fetchSemesters();
          }}
        />
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          currentUser={currentUser}
          onLogout={() => {
            setCurrentUser(null);
            fetchSemesters();
          }}
          onSuccess={(user) => {
            setCurrentUser(user);
            fetchSemesters();
          }}
        />
      )}

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
    </div>
  );
}
