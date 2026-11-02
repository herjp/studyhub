"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  FileText,
  Flame,
  Gauge,
  GraduationCap,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { FahrschulBar } from "./FahrschulBar";
import { CircularProgress } from "./CircularProgress";
import { EditModuleDialog } from "./EditModuleDialog";
import { formatGrade, formatEcts } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

export interface ModuleData {
  id: string;
  semesterId: string;
  name: string;
  code?: string | null;
  ects: number;
  examDate?: string | null;
  examTime?: string | null;
  examLocation?: string | null;
  examDescription?: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  grade?: number | null;
  daysUntilExam?: number | null;
  readinessScore?: number;
  dailyGoal?: number;
  answeredToday?: number;
  dueQuestionsCount?: number;
  documents?: any[];
  topics?: any[];
  questions?: any[];
}

export function ModuleCard({
  module,
  onUpdated,
}: {
  module: ModuleData;
  onUpdated?: () => void;
}) {
  const { lang, t } = useLanguage();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const isCompleted = module.status === "COMPLETED";
  const isFailed = module.status === "FAILED";
  const readiness = module.readinessScore ?? 0;
  const daysLeft = module.daysUntilExam;
  const dailyGoal = module.dailyGoal ?? 3;
  const answeredToday = module.answeredToday ?? 0;

  // Status badge styling
  let statusBadge = "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800";
  let statusLabel = t.inProgress;

  if (isCompleted) {
    statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800";
    statusLabel = module.grade ? `${t.passed} (${t.grade}: ${formatGrade(module.grade)})` : t.passed;
  } else if (isFailed) {
    statusBadge = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800";
    statusLabel = t.failed;
  } else if (module.status === "PLANNED") {
    statusBadge = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    statusLabel = t.planned;
  }

  // Countdown badge styling
  let countdownBadge = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  let CountdownIcon = Calendar;
  if (daysLeft !== null && daysLeft !== undefined) {
    if (daysLeft <= 7) {
      countdownBadge = "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 font-bold animate-pulse";
      CountdownIcon = Flame;
    } else if (daysLeft <= 21) {
      countdownBadge = "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 font-bold";
      CountdownIcon = Clock;
    }
  }

  return (
    <div className="group rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between">
      {/* Card Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {module.code && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {module.code}
              </span>
            )}
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {formatEcts(module.ects)} ECTS
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadge}`}
            >
              {isCompleted && <CheckCircle2 className="w-3 h-3" />}
              {statusLabel}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsEditOpen(true);
              }}
              title={lang === "de" ? "Modul bearbeiten oder löschen" : "Edit or delete course"}
              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <Link href={`/module/${module.id}`}>
          <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
            {module.name}
          </h3>
        </Link>

        {/* Exam Countdown & Dates */}
        <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
          {daysLeft !== null && daysLeft !== undefined ? (
            daysLeft < 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                {lang === "de" ? "Klausur vorüber" : "Exam passed"}
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${countdownBadge}`}
              >
                <CountdownIcon className="w-3.5 h-3.5" />
                {daysLeft === 0
                  ? t.examToday
                  : t.daysRemaining.replace("{n}", daysLeft.toString())}
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3.5 h-3.5" /> {t.noExamDate}
            </span>
          )}

          <span className="inline-flex items-center gap-1 text-slate-400 ml-auto">
            <FileText className="w-3.5 h-3.5" />
            {module.documents?.length ?? 0} {t.documents}
          </span>
        </div>

        {module.examDescription && (
          <p className="mt-2 text-[11px] text-slate-500 line-clamp-1 italic bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800">
            📝 {module.examDescription}
          </p>
        )}
      </div>

      {/* Fahrschul-Prüfungsbalken & Learning Stats */}
      <div className="px-5 py-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 space-y-4">
        {/* Fahrschul-Bar */}
        <FahrschulBar score={readiness} title={t.examReadiness} size="md" />

        {/* Daily Goal & Spaced Repetition */}
        {!isCompleted && (
          <div className="flex items-center justify-between pt-1">
            <CircularProgress
              value={answeredToday}
              max={dailyGoal}
              size={54}
              strokeWidth={5}
              label={`${t.dailyGoal}: ${dailyGoal} ${lang === "de" ? "Fragen" : "Qs"}`}
              sublabel={
                answeredToday >= dailyGoal
                  ? (lang === "de" ? "Tagesziel erreicht! 🎉" : "Daily goal met! 🎉")
                  : (lang === "de"
                      ? `Noch ${Math.max(0, dailyGoal - answeredToday)} Fragen heute`
                      : `${Math.max(0, dailyGoal - answeredToday)} questions left today`)
              }
            />

            {(module.dueQuestionsCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-3 h-3" />
                {module.dueQuestionsCount} {t.dueQuestions}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <Link
          href={`/module/${module.id}?tab=documents`}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1"
        >
          {t.documents}
        </Link>
        <Link
          href={`/module/${module.id}?tab=trainer`}
          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
        >
          {t.examTrainer} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {/* Edit Module Dialog */}
      <EditModuleDialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        module={module}
        onUpdated={() => {
          if (onUpdated) onUpdated();
        }}
        onDeleted={() => {
          if (onUpdated) onUpdated();
        }}
      />
    </div>
  );
}
