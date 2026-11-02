"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Sparkles,
  Layers,
  CheckCircle2,
  ArrowLeftRight,
} from "lucide-react";
import { Portal } from "./Portal";
import { useLanguage } from "@/lib/i18n";

export interface OptionItem {
  text: string;
  isCorrect: boolean;
  explanation: string;
  target?: string;
}

export interface QuestionData {
  id: string;
  moduleId: string;
  topicId?: string | null;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "FREE_TEXT" | "MATCHING";
  questionText: string;
  options?: string | null;
  sampleSolution?: string | null;
  sourceRef?: string | null;
}

interface EditQuestionDialogProps {
  question: QuestionData | null;
  isOpen: boolean;
  onClose: () => void;
  onQuestionUpdated: () => void;
}

export function EditQuestionDialog({
  question,
  isOpen,
  onClose,
  onQuestionUpdated,
}: EditQuestionDialogProps) {
  const { lang, t } = useLanguage();
  const [questionText, setQuestionText] = useState("");
  const [type, setType] = useState<"SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "FREE_TEXT" | "MATCHING">("SINGLE_CHOICE");
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [sampleSolution, setSampleSolution] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (question) {
      setQuestionText(question.questionText || "");
      setType(question.type || "SINGLE_CHOICE");
      setSampleSolution(question.sampleSolution || "");
      setSourceRef(question.sourceRef || "");
      setError(null);

      // Parse options
      if (question.options) {
        try {
          const parsed = JSON.parse(question.options);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setOptions(
              parsed.map((opt: any) => ({
                text: opt.text || "",
                isCorrect: Boolean(opt.isCorrect ?? true),
                explanation: opt.explanation || "",
                target: opt.target || "",
              }))
            );
          } else {
            initDefaultOptions();
          }
        } catch {
          initDefaultOptions();
        }
      } else {
        initDefaultOptions();
      }
    }
  }, [question]);

  const initDefaultOptions = () => {
    setOptions([
      { text: "", isCorrect: true, explanation: "" },
      { text: "", isCorrect: false, explanation: "" },
      { text: "", isCorrect: false, explanation: "" },
      { text: "", isCorrect: false, explanation: "" },
    ]);
  };

  if (!isOpen || !question) return null;

  const handleOptionTextChange = (idx: number, text: string) => {
    const updated = [...options];
    updated[idx].text = text;
    setOptions(updated);
  };

  const handleOptionTargetChange = (idx: number, target: string) => {
    const updated = [...options];
    updated[idx].target = target;
    setOptions(updated);
  };

  const handleOptionExplanationChange = (idx: number, explanation: string) => {
    const updated = [...options];
    updated[idx].explanation = explanation;
    setOptions(updated);
  };

  const handleToggleCorrect = (idx: number) => {
    const updated = [...options];
    if (type === "SINGLE_CHOICE") {
      // In Single Choice, only one option can be correct
      updated.forEach((o, i) => {
        o.isCorrect = i === idx;
      });
    } else {
      updated[idx].isCorrect = !updated[idx].isCorrect;
    }
    setOptions(updated);
  };

  const handleAddOption = () => {
    setOptions([...options, { text: "", isCorrect: type === "MATCHING", explanation: "", target: "" }]);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) {
      alert(lang === "de" ? "Eine Aufgabe benötigt mindestens 2 Optionen bzw. Paare." : "A question requires at least 2 options or pairs.");
      return;
    }
    setOptions(options.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      setError(lang === "de" ? "Bitte gib einen Fragentext ein." : "Please enter a question text.");
      return;
    }

    if (type === "MATCHING") {
      if (options.length < 2) {
        setError(lang === "de" ? "Eine Zuordnungsaufgabe benötigt mindestens 2 Begriff-Zielfeld-Paare." : "A matching question requires at least 2 pairs.");
        return;
      }
      if (options.some((o) => !o.text.trim() || !(o.target || "").trim())) {
        setError(lang === "de" ? "Bitte fülle bei allen Paaren Begriff und Zielfeld aus." : "Please fill in term and target slot for all pairs.");
        return;
      }
    } else if (type !== "FREE_TEXT") {
      if (options.some((o) => !o.text.trim())) {
        setError(lang === "de" ? "Bitte fülle alle Antwortoptionen aus oder lösche leere Optionen." : "Please fill in all answer options or delete empty ones.");
        return;
      }
      if (!options.some((o) => o.isCorrect)) {
        setError(lang === "de" ? "Mindestens eine Antwortoption muss als 'richtig' markiert sein." : "At least one answer option must be marked as correct.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/trainer/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: question.id,
          questionText: questionText.trim(),
          type,
          options: type !== "FREE_TEXT" ? JSON.stringify(options) : "[]",
          sampleSolution: sampleSolution.trim(),
          sourceRef: sourceRef.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || (lang === "de" ? "Speichern fehlgeschlagen" : "Save failed"));
      }

      onQuestionUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || (lang === "de" ? "Fehler beim Speichern der Frage." : "Error saving question."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === "de" ? "Klausurfrage bearbeiten" : "Edit Exam Question"}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === "de"
                    ? "Passe Fragentext, Antwortoptionen oder die Musterlösung an."
                    : "Adjust question text, options, or sample solution."}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            {/* Question Type Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                {lang === "de" ? "Fragetyp" : "Question Type"}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setType("SINGLE_CHOICE")}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    type === "SINGLE_CHOICE"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-300 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Single Choice
                </button>
                <button
                  type="button"
                  onClick={() => setType("MULTIPLE_CHOICE")}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    type === "MULTIPLE_CHOICE"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-300 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <Layers className="w-4 h-4" /> Multiple Choice
                </button>
                <button
                  type="button"
                  onClick={() => setType("MATCHING")}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    type === "MATCHING"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-300 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <ArrowLeftRight className="w-4 h-4" /> {lang === "de" ? "Zuordnung" : "Matching"}
                </button>
                <button
                  type="button"
                  onClick={() => setType("FREE_TEXT")}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    type === "FREE_TEXT"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-300 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <Sparkles className="w-4 h-4" /> {lang === "de" ? "Freitext" : "Free Text"}
                </button>
              </div>
            </div>

            {/* Question Text */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                {lang === "de" ? "Fragestellung / Aufgabenstellung *" : "Question / Problem Statement *"}
              </label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={lang === "de" ? "z. B. Welche Eigenschaften kennzeichnen das Saga-Pattern in Microservices?" : "e.g. Which properties characterize the Saga pattern in microservices?"}
              />
            </div>

            {/* Matching Pairs Editor */}
            {type === "MATCHING" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {lang === "de" ? "Zuordnungspaare (Begriff ➔ Zielfeld / Definition)" : "Matching Pairs (Term ➔ Target Slot / Definition)"}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> {lang === "de" ? "Paar hinzufügen" : "Add pair"}
                  </button>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500">
                          {lang === "de" ? "Paar" : "Pair"} #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                          title={lang === "de" ? "Paar löschen" : "Delete pair"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                            {lang === "de" ? "Begriff / Schema-Bezeichnung" : "Term / Label"}
                          </label>
                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                            placeholder={lang === "de" ? "z. B. Chloroplast" : "e.g. Chloroplast"}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                            {lang === "de" ? "Zielfeld / Definition" : "Target Slot / Definition"}
                          </label>
                          <input
                            type="text"
                            value={opt.target || ""}
                            onChange={(e) => handleOptionTargetChange(idx, e.target.value)}
                            placeholder={lang === "de" ? "z. B. Ort der Photosynthese" : "e.g. Site of photosynthesis"}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                          />
                        </div>
                      </div>

                      <input
                        type="text"
                        value={opt.explanation}
                        onChange={(e) => handleOptionExplanationChange(idx, e.target.value)}
                        placeholder={lang === "de" ? "Erklärung / Kontext (optional)..." : "Explanation / Context (optional)..."}
                        className="w-full px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Options for SC and MC */}
            {(type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {lang === "de"
                      ? `Antwortoptionen (${type === "SINGLE_CHOICE" ? "1 richtige Option" : "mehrere Optionen möglich"})`
                      : `Answer Options (${type === "SINGLE_CHOICE" ? "1 correct option" : "multiple options allowed"})`}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> {lang === "de" ? "Option hinzufügen" : "Add Option"}
                  </button>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {options.map((opt, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border transition-all ${
                        opt.isCorrect
                          ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleCorrect(idx)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                            opt.isCorrect
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          {opt.isCorrect
                            ? (lang === "de" ? "Richtig" : "Correct")
                            : (lang === "de" ? "Als Richtig markieren" : "Mark as Correct")}
                        </button>
                        <span className="text-[11px] text-slate-400 font-semibold ml-auto">
                          Option {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                          title={lang === "de" ? "Option löschen" : "Delete option"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                        placeholder={lang === "de" ? `Antworttext für Option ${idx + 1}...` : `Answer text for option ${idx + 1}...`}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 mb-1.5"
                      />

                      <input
                        type="text"
                        value={opt.explanation}
                        onChange={(e) => handleOptionExplanationChange(idx, e.target.value)}
                        placeholder={lang === "de" ? "Erklärung (warum richtig/falsch - optional)..." : "Explanation (why correct/incorrect - optional)..."}
                        className="w-full px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample Solution (especially for Free Text) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                {lang === "de" ? "Musterlösung / Erwartete Antwort" : "Sample Solution / Expected Answer"}
              </label>
              <textarea
                value={sampleSolution}
                onChange={(e) => setSampleSolution(e.target.value)}
                rows={type === "FREE_TEXT" ? 4 : 2}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={lang === "de" ? "Ausführliche Musterlösung oder Erläuterung..." : "Detailed sample solution or explanation..."}
              />
            </div>

            {/* Source Reference */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                {lang === "de" ? "Quellenangabe (z. B. Folie, Vorlesung oder Kapitel)" : "Source Reference (e.g. slide, lecture, or chapter)"}
              </label>
              <input
                type="text"
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                placeholder={lang === "de" ? "z. B. Vorlesung 03, Folie 24 (Microservices)" : "e.g. Lecture 03, Slide 24 (Microservices)"}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {saving ? t.saving : (lang === "de" ? "Änderungen speichern" : "Save Changes")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
