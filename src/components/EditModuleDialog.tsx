"use client";

import React, { useState, useEffect } from "react";
import {
  Pencil,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  FileText,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import { Portal } from "./Portal";
import { useLanguage } from "@/lib/i18n";
import { ModuleData } from "./ModuleCard";

interface EditModuleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  module: ModuleData | null;
  onUpdated: () => void;
  onDeleted?: () => void;
}

export function EditModuleDialog({
  isOpen,
  onClose,
  module,
  onUpdated,
  onDeleted,
}: EditModuleDialogProps) {
  const { lang, t } = useLanguage();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [ects, setEcts] = useState("5");
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("");
  const [examLocation, setExamLocation] = useState("");
  const [examDescription, setExamDescription] = useState("");
  const [status, setStatus] = useState<string>("IN_PROGRESS");
  const [grade, setGrade] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (module) {
      setName(module.name || "");
      setCode(module.code || "");
      setEcts(module.ects ? module.ects.toString() : "5");
      setExamDate(module.examDate ? module.examDate.slice(0, 10) : "");
      setExamTime(module.examTime || "");
      setExamLocation(module.examLocation || "");
      setExamDescription(module.examDescription || "");
      setStatus(module.status || "IN_PROGRESS");
      setGrade(module.grade ? module.grade.toString() : "");
      setShowConfirmDelete(false);
      setError(null);
    }
  }, [module]);

  if (!isOpen || !module) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(lang === "de" ? "Name ist erforderlich" : "Name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/modules/${module.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || null,
          ects: parseFloat(ects) || 5,
          examDate: examDate ? examDate : null,
          examTime: examTime || null,
          examLocation: examLocation || null,
          examDescription: examDescription || null,
          status,
          grade: grade ? parseFloat(grade) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }

      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Fehler beim Speichern");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/modules/${module.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Löschen");
      }

      if (onDeleted) onDeleted();
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Fehler beim Löschen");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Pencil className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === "de" ? "Modul bearbeiten" : "Edit Course"}
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-xs">{module.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {showConfirmDelete ? (
            /* Delete Confirmation Box */
            <div className="py-6 space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === "de" ? "Modul wirklich löschen?" : "Delete Course?"}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  {lang === "de"
                    ? `Möchtest du "${module.name}" unwiderruflich entfernen? Alle hinterlegten Dokumente, Fragen und Lernfortschritte werden gelöscht.`
                    : `Are you sure you want to delete "${module.name}"? All associated documents, questions, and progress will be deleted.`}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeleting
                    ? (lang === "de" ? "Wird gelöscht..." : "Deleting...")
                    : (lang === "de" ? "Ja, Modul löschen" : "Yes, Delete Course")}
                </button>
              </div>
            </div>
          ) : (
            /* Edit Form */
            <form onSubmit={handleSave} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "de" ? "Modulname *" : "Course Title *"}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === "de" ? "Kürzel (optional)" : "Code (optional)"}
                  </label>
                  <input
                    type="text"
                    placeholder="z. B. INF-101"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ECTS-Punkte *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="30"
                    required
                    value={ects}
                    onChange={(e) => setEcts(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Status and Grade */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="IN_PROGRESS">{t.inProgress}</option>
                    <option value="PLANNED">{t.planned}</option>
                    <option value="COMPLETED">{t.passed}</option>
                    <option value="FAILED">{t.failed}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Note (1.0 bis 5.0)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    placeholder="z. B. 1.7"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Exam date, time, location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === "de" ? "Prüfungstermin" : "Exam Date"}
                  </label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === "de" ? "Uhrzeit & Raum" : "Time & Room"}
                  </label>
                  <input
                    type="text"
                    placeholder="z. B. 09:00, Audimax"
                    value={examLocation}
                    onChange={(e) => setExamLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "de" ? "Dozentenhinweise / Klausuraufbau" : "Exam Format Notes"}
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    lang === "de"
                      ? "z. B. 90 Min, 30% MC, 70% Freitext, 1 DIN-A4-Spickzettel erlaubt..."
                      : "e.g., 90 min, 30% MC, 70% essay, 1 cheat sheet allowed..."
                  }
                  value={examDescription}
                  onChange={(e) => setExamDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {lang === "de" ? "Modul löschen" : "Delete"}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isSubmitting
                      ? (lang === "de" ? "Wird gespeichert..." : "Saving...")
                      : (lang === "de" ? "Änderungen speichern" : "Save Changes")}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </Portal>
  );
}
