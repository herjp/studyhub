"use client";

import React, { useState } from "react";
import { Plus, BookPlus } from "lucide-react";
import { Portal } from "./Portal";
import { useLanguage } from "@/lib/i18n";

interface AddModuleDialogProps {
  semesterId: string;
  isOpen: boolean;
  onClose: () => void;
  onModuleAdded: () => void;
}

export function AddModuleDialog({
  semesterId,
  isOpen,
  onClose,
  onModuleAdded,
}: AddModuleDialogProps) {
  const { lang, t } = useLanguage();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [ects, setEcts] = useState("6.0");
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("");
  const [examLocation, setExamLocation] = useState("");
  const [examDescription, setExamDescription] = useState("");
  const [status, setStatus] = useState("IN_PROGRESS");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId,
          name: name.trim(),
          code: code.trim() || undefined,
          ects: parseFloat(ects) || 5.0,
          examDate: examDate || undefined,
          examTime: examTime.trim() || undefined,
          examLocation: examLocation.trim() || undefined,
          examDescription: examDescription.trim() || undefined,
          status,
        }),
      });

      if (res.ok) {
        onClose();
        setName("");
        setCode("");
        setExamDate("");
        setExamTime("");
        setExamLocation("");
        setExamDescription("");
        onModuleAdded();
      }
    } catch (err) {
      console.error("Error creating module:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <BookPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t.addModuleTitle}
            </h3>
            <p className="text-xs text-slate-500">
              {t.addModuleDesc}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.moduleNameLabel}
            </label>
            <input
              type="text"
              required
              placeholder={t.moduleNamePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.moduleCodeLabel}
              </label>
              <input
                type="text"
                placeholder={t.moduleCodePlaceholder}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.ectsLabel}
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="30"
                required
                value={ects}
                onChange={(e) => setEcts(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.examDateLabel}
            </label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span>{t.examStructureLabel}</span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">{t.aiRelevantBadge}</span>
            </label>
            <textarea
              rows={2}
              placeholder={t.examStructurePlaceholder}
              value={examDescription}
              onChange={(e) => setExamDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.statusLabel}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <option value="IN_PROGRESS">{t.statusInProgress}</option>
              <option value="PLANNED">{t.statusPlanned}</option>
              <option value="COMPLETED">{t.statusCompleted}</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {isSubmitting ? t.saving : t.createModuleBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}
