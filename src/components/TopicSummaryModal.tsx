"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  BookOpen,
  CheckCircle,
  Copy,
  Lightbulb,
  FileText,
  AlertCircle,
  Check,
} from "lucide-react";
import { Portal } from "./Portal";
import { useLanguage } from "@/lib/i18n";

interface TopicSummaryModalProps {
  moduleId: string;
  topicId: string;
  topicName: string;
  isOpen: boolean;
  onClose: () => void;
  onStartGapTraining: (topicId: string) => void;
}

export function TopicSummaryModal({
  moduleId,
  topicId,
  topicName,
  isOpen,
  onClose,
  onStartGapTraining,
}: TopicSummaryModalProps) {
  const { lang, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && topicId) {
      fetchSummary();
    }
  }, [isOpen, topicId]);

  const fetchSummary = async () => {
    setLoading(true);
    setSummaryData(null);
    try {
      const storedProvider = localStorage.getItem("studyhub_ai_provider") || "local";
      const storedKey =
        localStorage.getItem(`studyhub_api_key_${storedProvider}`) ||
        localStorage.getItem("studyhub_api_key") ||
        undefined;

      const res = await fetch("/api/trainer/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          topicId,
          apiKey: storedKey,
          provider: storedProvider,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error("Error fetching summary:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (summaryData?.summary) {
      navigator.clipboard.writeText(summaryData.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === "de" ? `KI-Spickzettel: ${topicName}` : `AI Cheat Sheet: ${topicName}`}
              </h3>
              <p className="text-xs text-slate-500">
                {t.aiCheatSheetSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 space-y-5 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {lang === "de" ? "Durchsuche Vorlesungsfolien & Altklausuren..." : "Searching lecture slides & past exams..."}
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                {lang === "de" ? "RAG extrahiert Definitionen und formuliert einen fokussierten Spickzettel." : "RAG extracts definitions and creates a focused cheat sheet."}
              </p>
            </div>
          ) : summaryData ? (
            <>
              {/* Sources */}
              {summaryData.sourceRefs?.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{lang === "de" ? "Quellen:" : "Sources:"}</span>
                  {summaryData.sourceRefs.map((src: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                    >
                      {src}
                    </span>
                  ))}
                </div>
              )}

              {/* Main Summary */}
              <div className="prose prose-sm dark:prose-invert max-w-none bg-slate-50/50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 leading-relaxed whitespace-pre-line text-xs sm:text-sm">
                {summaryData.summary}
              </div>

              {/* Exam Tips */}
              {summaryData.examTips?.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    {t.examTipsTitle}
                  </div>
                  <ul className="text-xs text-amber-900 dark:text-amber-200 space-y-1 list-disc pl-4">
                    {summaryData.examTips.map((tip: string, idx: number) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-xs text-slate-500 py-6">
              {lang === "de" ? "Keine Daten verfügbar." : "No data available."}
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!summaryData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t.copiedBtn : t.copyTextBtn}
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onStartGapTraining(topicId);
            }}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
          >
            {t.closeGapNowBtn}
          </button>
        </div>
      </div>
    </div>
  </Portal>
  );
}
