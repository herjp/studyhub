"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Calendar as CalendarIcon, Sparkles } from "lucide-react";
import { HeaderDashboard } from "@/components/HeaderDashboard";
import { ExamCalendar } from "@/components/ExamCalendar";
import { useLanguage } from "@/lib/i18n";

export default function CalendarPage() {
  const { lang, t } = useLanguage();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-16 transition-colors">
      <HeaderDashboard />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 w-full flex-1 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link
            href="/"
            className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t.semesterOverview}
          </Link>
          <span>/</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {t.calendar}
          </span>
        </div>

        {/* Main Calendar Component */}
        <ExamCalendar />
      </main>
    </div>
  );
}
