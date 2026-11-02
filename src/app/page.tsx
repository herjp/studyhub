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
        const semesterList = Array.isArray(data) ? data : [];
        setSemesters(semesterList);

        // Auto select active semester or first semester
        if (semesterList.length > 0) {
          const exists = semesterList.some((s: SemesterType) => s.id === selectedSemesterId);
          if (!selectedSemesterId || !exists) {
            const active = semesterList.find((s: SemesterType) => s.isActive);
            setSelectedSemesterId(active ? active.id : semesterList[0].id);
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
        setModules(Array.isArray(data) ? data : []);
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
        window.dispatchEvent(new Event("studyhub_user_updated"));
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

  const selectedSemester = Array.isArray(semesters) ? semesters.find((s) => s.id === selectedSemesterId) : undefined;

  // Filter modules by status if desired
  const safeModules = Array.isArray(modules) ? modules : [];
  const filteredModules = safeModules.filter((m) => {
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
        <section data-tour="semesters" className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm">
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
                data-tour="calendar-link"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                title={lang === "de" ? "Kalender & Stundenplan" : "Calendar & schedule"}
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-500" /> {lang === "de" ? "Kalender importieren" : "Import Calendar"}
              </Link>

              {/* Add Module Button */}
              {selectedSemesterId && (
                <button
                  type="button"
                  data-tour="add-module"
                  onClick={() => setIsAddModuleOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow transition-all flex-shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> {t.addModule}
                </button>
              )}
            </div>
          </div>

          {/* Module Cards Grid */}
          <div data-tour="module-cards">
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
          </div>
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
            window.dispatchEvent(new Event("studyhub_user_updated"));
          }}
        />
      )}
    </div>
  );
}
