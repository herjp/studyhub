"use client";

import React, { useState } from "react";
import {
  Calendar,
  Plus,
  MoreVertical,
  Check,
  Edit2,
  Trash2,
  Archive,
  Layers,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Portal } from "./Portal";

export interface SemesterType {
  id: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  order: number;
  modules?: any[];
}

interface SemesterTabsProps {
  semesters: SemesterType[];
  selectedSemesterId: string | null;
  onSelectSemester: (id: string) => void;
  onSemesterChanged: () => void;
}

export function SemesterTabs({
  semesters,
  selectedSemesterId,
  onSelectSemester,
  onSemesterChanged,
}: SemesterTabsProps) {
  const { lang, t } = useLanguage();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSemester, setEditingSemester] = useState<SemesterType | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ id: string; top: number; right: number } | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [isNewActive, setIsNewActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick preset suggestions
  const currentYear = new Date().getFullYear();
  const presets = lang === "de"
    ? [
        `Sommersemester ${currentYear}`,
        `Wintersemester ${currentYear}/${(currentYear + 1).toString().slice(2)}`,
        `Sommersemester ${currentYear + 1}`,
        `Wintersemester ${currentYear + 1}/${(currentYear + 2).toString().slice(2)}`,
      ]
    : [
        `Summer Semester ${currentYear}`,
        `Winter Semester ${currentYear}/${(currentYear + 1).toString().slice(2)}`,
        `Summer Semester ${currentYear + 1}`,
        `Winter Semester ${currentYear + 1}/${(currentYear + 2).toString().slice(2)}`,
      ];

  const handleOpenAdd = () => {
    setName(
      lang === "de"
        ? `Wintersemester ${currentYear}/${(currentYear + 1).toString().slice(2)}`
        : `Winter Semester ${currentYear}/${(currentYear + 1).toString().slice(2)}`
    );
    setIsNewActive(false);
    setShowAddModal(true);
  };

  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/semesters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          isActive: isNewActive,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setShowAddModal(false);
        onSemesterChanged();
        onSelectSemester(created.id);
      }
    } catch (err) {
      console.error("Failed to create semester:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSemester || !name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/semesters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSemester.id,
          name: name.trim(),
        }),
      });

      if (res.ok) {
        setEditingSemester(null);
        onSemesterChanged();
      }
    } catch (err) {
      console.error("Failed to update semester:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetActive = async (id: string) => {
    setMenuAnchor(null);
    try {
      await fetch("/api/semesters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: true }),
      });
      onSemesterChanged();
      onSelectSemester(id);
    } catch (err) {
      console.error("Error setting active semester:", err);
    }
  };

  const handleDelete = async (id: string) => {
    setMenuAnchor(null);
    if (!confirm("Semester wirklich löschen? Alle zugehörigen Module werden ebenfalls gelöscht.")) {
      return;
    }
    try {
      await fetch(`/api/semesters?id=${id}`, { method: "DELETE" });
      onSemesterChanged();
    } catch (err) {
      console.error("Error deleting semester:", err);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {t.semesterOverview}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
            {semesters.length} {semesters.length === 1 ? t.semester : t.semesters}
          </span>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> {t.addSemester}
        </button>
      </div>

      {/* Horizontal Tabs / Tiles */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
        {semesters.map((sem) => {
          const isSelected = selectedSemesterId === sem.id;
          const moduleCount = sem.modules?.length ?? 0;

          return (
            <div
              key={sem.id}
              className={`group relative flex-shrink-0 flex items-center justify-between rounded-xl px-4 py-2.5 border transition-all cursor-pointer ${
                isSelected
                  ? "bg-white dark:bg-slate-800 border-indigo-600 text-slate-900 dark:text-white shadow-md ring-2 ring-indigo-500/20"
                  : "bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800/80"
              }`}
              onClick={() => onSelectSemester(sem.id)}
            >
              <div className="flex items-center gap-2.5 pr-2">
                <Calendar
                  className={`w-4 h-4 ${
                    isSelected
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold tracking-tight">{sem.name}</span>
                    {sem.isActive && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                        {t.activeSemester}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    {moduleCount} {moduleCount === 1 ? (lang === "de" ? "Modul" : "Course") : (lang === "de" ? "Module" : "Courses")}
                  </span>
                </div>
              </div>

              {/* 3-Dots Menu Trigger */}
              <div
                className="relative"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (menuAnchor?.id === sem.id) {
                    setMenuAnchor(null);
                  } else {
                    setMenuAnchor({
                      id: sem.id,
                      top: rect.bottom + 6,
                      right: window.innerWidth - rect.right,
                    });
                  }
                }}
              >
                <button
                  type="button"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating 3-Dots Menu in Foreground (outside horizontal overflow) */}
      {menuAnchor && (
        <>
          <div
            className="fixed inset-0 z-50 bg-transparent"
            onClick={() => setMenuAnchor(null)}
          />
          {(() => {
            const sem = semesters.find((s) => s.id === menuAnchor.id);
            if (!sem) return null;
            return (
              <div
                style={{ top: `${menuAnchor.top}px`, right: `${menuAnchor.right}px` }}
                className="fixed z-50 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 text-xs animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5 dark:ring-white/10 space-y-0.5"
              >
                {!sem.isActive && (
                  <button
                    onClick={() => {
                      handleSetActive(sem.id);
                      setMenuAnchor(null);
                    }}
                    className="w-full px-3 py-2 text-left rounded-xl flex items-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold transition-colors"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> {t.setAsActive}
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenuAnchor(null);
                    setEditingSemester(sem);
                    setName(sem.name);
                  }}
                  className="w-full px-3 py-2 text-left rounded-xl flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> {t.rename}
                </button>
                <button
                  onClick={() => {
                    setMenuAnchor(null);
                    handleDelete(sem.id);
                  }}
                  className="w-full px-3 py-2 text-left rounded-xl flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 flex-shrink-0" /> {t.deleteSemester}
                </button>
              </div>
            );
          })()}
        </>
      )}

      {/* Add Semester Dialog */}
      {showAddModal && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto animate-in fade-in zoom-in-95 duration-150">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                {t.addSemesterTitle}
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                {t.addSemesterDesc}
              </p>

              {/* Presets */}
              <div className="mb-4">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t.quickPresetsLabel}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setName(preset)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleCreateSemester} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.semesterNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t.semesterNamePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activeCheck"
                    checked={isNewActive}
                    onChange={(e) => setIsNewActive(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="activeCheck"
                    className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                  >
                    {t.markAsActiveCheckbox}
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                    {isSubmitting ? t.creatingSemester : t.saveSemesterBtn}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Edit Semester Dialog */}
      {editingSemester && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                {t.editSemesterTitle}
              </h3>
              <form onSubmit={handleUpdateSemester} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.editSemesterNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingSemester(null)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                    {isSubmitting ? t.saving : t.savingChanges}
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
