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
} from "lucide-react";
import { HeaderDashboard } from "@/components/HeaderDashboard";
import { SemesterTabs, SemesterType } from "@/components/SemesterTabs";
import { ModuleCard, ModuleData } from "@/components/ModuleCard";
import { AddModuleDialog } from "@/components/AddModuleDialog";
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

  // Fetch Semesters
  const fetchSemesters = async () => {
    try {
      const res = await fetch("/api/semesters");
      if (res.ok) {
        const data = await res.json();
        setSemesters(data);

        // Auto select active semester or first semester
        if (data.length > 0) {
          if (!selectedSemesterId) {
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

  useEffect(() => {
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
          fetchSemesters();
          if (selectedSemesterId) fetchModules(selectedSemesterId);
        }}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full flex-1 space-y-8">
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
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-500" /> {t.calendar}
              </Link>

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
                <ModuleCard key={mod.id} module={mod} />
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
    </div>
  );
}
