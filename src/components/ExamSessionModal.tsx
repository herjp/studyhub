"use client";

import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { Portal } from "./Portal";
import { useLanguage } from "@/lib/i18n";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  BookOpen,
  HelpCircle,
  Trophy,
  RotateCcw,
  Clock,
  Send,
  Loader2,
  FileText,
  BookmarkCheck,
  Brain,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface QuestionOption {
  text: string;
  isCorrect?: boolean;
  explanation?: string;
  target?: string;
}

export interface QuizQuestion {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "FREE_TEXT" | "MATCHING";
  questionText: string;
  options?: any;
  sampleSolution?: string | null;
  sourceRef?: string | null;
  topic?: { id: string; name: string } | null;
}

interface ExamSessionModalProps {
  moduleId: string;
  questions: QuizQuestion[];
  modeName: string;
  isOpen: boolean;
  onClose: () => void;
  onSessionCompleted?: () => void;
}

export function ExamSessionModal({
  moduleId,
  questions,
  modeName,
  isOpen,
  onClose,
  onSessionCompleted,
}: ExamSessionModalProps) {
  const { lang, t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSingle, setSelectedSingle] = useState<number | null>(null);
  const [selectedMulti, setSelectedMulti] = useState<number[]>([]);
  const [freeTextAnswer, setFreeTextAnswer] = useState("");

  // Feedback states
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [freeTextEvaluation, setFreeTextEvaluation] = useState<any>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  // Session aggregate stats
  const [scoreEarned, setScoreEarned] = useState(0);
  const [totalPossible, setTotalPossible] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Current question reference
  const currentQ = questions[currentIndex] || null;

  // Matching question state
  const [matchingSlots, setMatchingSlots] = useState<{ target: string; correctTerm: string; explanation?: string }[]>([]);
  const [availableTerms, setAvailableTerms] = useState<string[]>([]);
  const [assignedMatches, setAssignedMatches] = useState<Record<number, string>>({});
  const [selectedMatchingTerm, setSelectedMatchingTerm] = useState<string | null>(null);

  // Initialize matching slots when current question changes
  useEffect(() => {
    if (currentQ?.type === "MATCHING") {
      let opts: any[] = [];
      try {
        opts = typeof currentQ.options === "string" ? JSON.parse(currentQ.options) : currentQ.options || [];
      } catch {
        opts = [];
      }

      const slots = opts.map((o: any, idx: number) => ({
        target: o.target || o.explanation || `Slot ${idx + 1}`,
        correctTerm: o.text || `Begriff ${idx + 1}`,
        explanation: o.explanation || "",
      }));

      setMatchingSlots(slots);
      // Randomize terms for user selection
      const terms = slots.map((s) => s.correctTerm).sort(() => Math.random() - 0.5);
      setAvailableTerms(terms);
      setAssignedMatches({});
      setSelectedMatchingTerm(null);
    }
  }, [currentIndex, currentQ?.id, currentQ?.type]);

  if (!isOpen || questions.length === 0 || !currentQ) return null;

  // Parse options safely
  let parsedOptions: QuestionOption[] = [];
  if (currentQ.options) {
    try {
      parsedOptions =
        typeof currentQ.options === "string"
          ? JSON.parse(currentQ.options)
          : currentQ.options;
    } catch (e) {
      parsedOptions = [];
    }
  }

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (e) {}
  };

  const handleToggleMulti = (idx: number) => {
    if (isAnswerSubmitted) return;
    if (selectedMulti.includes(idx)) {
      setSelectedMulti(selectedMulti.filter((i) => i !== idx));
    } else {
      setSelectedMulti([...selectedMulti, idx]);
    }
  };

  const handleAssignTermToSlot = (slotIdx: number, termToAssign: string) => {
    if (isAnswerSubmitted) return;
    const newAssigned = { ...assignedMatches };

    // If this term was already placed in another slot, clear it from that slot
    Object.keys(newAssigned).forEach((k) => {
      const idx = Number(k);
      if (newAssigned[idx] === termToAssign) {
        delete newAssigned[idx];
      }
    });

    newAssigned[slotIdx] = termToAssign;
    setAssignedMatches(newAssigned);

    // Update remaining available terms pool
    const currentlyAssigned = Object.values(newAssigned);
    const allTerms = matchingSlots.map((s) => s.correctTerm);
    setAvailableTerms(allTerms.filter((term) => !currentlyAssigned.includes(term)));
    setSelectedMatchingTerm(null);
  };

  const handleUnassignSlot = (slotIdx: number) => {
    if (isAnswerSubmitted) return;
    const term = assignedMatches[slotIdx];
    if (!term) return;

    const newAssigned = { ...assignedMatches };
    delete newAssigned[slotIdx];
    setAssignedMatches(newAssigned);

    const currentlyAssigned = Object.values(newAssigned);
    const allTerms = matchingSlots.map((s) => s.correctTerm);
    setAvailableTerms(allTerms.filter((t) => !currentlyAssigned.includes(t)));
  };

  const handleSubmitAnswer = async () => {
    if (isAnswerSubmitted || isEvaluating) return;

    if (currentQ.type === "SINGLE_CHOICE") {
      if (selectedSingle === null) return;
      const chosen = parsedOptions[selectedSingle];
      const isCorrect = Boolean(chosen?.isCorrect);

      setIsAnswerSubmitted(true);
      const earned = isCorrect ? 1 : 0;
      setScoreEarned((prev) => prev + earned);
      setTotalPossible((prev) => prev + 1);

      if (isCorrect) triggerConfetti();

      // Update Spaced Repetition in DB
      try {
        await fetch("/api/trainer/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: currentQ.id,
            isCorrect,
          }),
        });
      } catch (err) {
        console.error(err);
      }
    } else if (currentQ.type === "MULTIPLE_CHOICE") {
      if (selectedMulti.length === 0) return;

      // Partial credit calculation:
      // total correct options
      const correctIndices = parsedOptions
        .map((opt, idx) => (opt.isCorrect ? idx : -1))
        .filter((idx) => idx !== -1);

      let correctPicks = 0;
      let wrongPicks = 0;

      selectedMulti.forEach((idx) => {
        if (parsedOptions[idx].isCorrect) correctPicks++;
        else wrongPicks++;
      });

      const maxPoints = 1.0;
      let partialScore =
        correctIndices.length > 0 ? (correctPicks - wrongPicks * 0.5) / correctIndices.length : 0;
      partialScore = Math.max(0, Math.min(maxPoints, Math.round(partialScore * 10) / 10));

      const isFullyCorrect = partialScore >= 0.8;
      setIsAnswerSubmitted(true);
      setScoreEarned((prev) => prev + partialScore);
      setTotalPossible((prev) => prev + 1);

      if (isFullyCorrect) triggerConfetti();

      try {
        await fetch("/api/trainer/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: currentQ.id,
            isCorrect: isFullyCorrect,
          }),
        });
      } catch (err) {
        console.error(err);
      }
    } else if (currentQ.type === "FREE_TEXT") {
      if (!freeTextAnswer.trim()) return;

      setIsEvaluating(true);
      let storedProvider = (localStorage.getItem("studyhub_ai_provider") as any) || "gemini";
      let storedKey =
        localStorage.getItem(`studyhub_api_key_${storedProvider}`) ||
        localStorage.getItem("studyhub_api_key") ||
        (storedProvider === "gemini" ? localStorage.getItem("studyhub_api_key_gemini") : undefined) ||
        undefined;

      if (!storedKey) {
        const geminiKey = localStorage.getItem("studyhub_api_key_gemini");
        const openaiKey = localStorage.getItem("studyhub_api_key_openai");
        const anthropicKey = localStorage.getItem("studyhub_api_key_anthropic");
        if (geminiKey) {
          storedProvider = "gemini";
          storedKey = geminiKey;
        } else if (openaiKey) {
          storedProvider = "openai";
          storedKey = openaiKey;
        } else if (anthropicKey) {
          storedProvider = "anthropic";
          storedKey = anthropicKey;
        }
      }

      try {
        const res = await fetch("/api/trainer/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: currentQ.id,
            moduleId,
            questionText: currentQ.questionText,
            sampleSolution: currentQ.sampleSolution,
            userAnswer: freeTextAnswer,
            sourceRef: currentQ.sourceRef,
            apiKey: storedKey,
            provider: storedProvider,
          }),
        });

        if (res.ok) {
          const evalResult = await res.json();
          setFreeTextEvaluation(evalResult);
          setIsAnswerSubmitted(true);
          setScoreEarned((prev) => prev + (evalResult.score / 5)); // normalized to 1
          setTotalPossible((prev) => prev + 1);

          if (evalResult.isCorrect) triggerConfetti();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsEvaluating(false);
      }
    } else if (currentQ.type === "MATCHING") {
      if (matchingSlots.length === 0) return;
      if (Object.keys(assignedMatches).length === 0) return;

      let correctCount = 0;
      matchingSlots.forEach((slot, idx) => {
        if (assignedMatches[idx] === slot.correctTerm) {
          correctCount++;
        }
      });

      const totalSlots = matchingSlots.length;
      const scoreFraction = totalSlots > 0 ? correctCount / totalSlots : 0;
      const roundedScore = Math.round(scoreFraction * 10) / 10;
      const isFullyCorrect = correctCount === totalSlots;

      setIsAnswerSubmitted(true);
      setScoreEarned((prev) => prev + roundedScore);
      setTotalPossible((prev) => prev + 1);

      if (isFullyCorrect || roundedScore >= 0.8) triggerConfetti();

      try {
        await fetch("/api/trainer/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: currentQ.id,
            isCorrect: isFullyCorrect,
          }),
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedSingle(null);
      setSelectedMulti([]);
      setFreeTextAnswer("");
      setAssignedMatches({});
      setSelectedMatchingTerm(null);
      setIsAnswerSubmitted(false);
      setFreeTextEvaluation(null);
      setShowReasoning(false);
    } else {
      setIsFinished(true);
      if (onSessionCompleted) onSessionCompleted();
    }
  };

  const restartQuiz = () => {
    setCurrentIndex(0);
    setSelectedSingle(null);
    setSelectedMulti([]);
    setFreeTextAnswer("");
    setAssignedMatches({});
    setSelectedMatchingTerm(null);
    setIsAnswerSubmitted(false);
    setFreeTextEvaluation(null);
    setShowReasoning(false);
    setScoreEarned(0);
    setTotalPossible(0);
    setIsFinished(false);
  };

  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Top Header */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {modeName}
            </span>
            {currentQ?.topic?.name && (
              <span className="text-xs font-semibold text-slate-500 truncate max-w-[200px]">
                • {currentQ.topic.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t.questionOf.replace("{current}", (currentIndex + 1).toString()).replace("{total}", questions.length.toString())}
            </span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5">
          <div
            className="bg-indigo-600 h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Modal Body */}
        {!isFinished ? (
          <div className="p-6 md:p-8 space-y-6">
            {/* Question Type Badge */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {currentQ.type === "SINGLE_CHOICE"
                  ? (lang === "de" ? "Single Choice (1 Antwort)" : "Single Choice (1 Answer)")
                  : currentQ.type === "MULTIPLE_CHOICE"
                  ? (lang === "de" ? "Multiple Choice (Mehrere Antworten möglich)" : "Multiple Choice (Multiple correct)")
                  : currentQ.type === "MATCHING"
                  ? (lang === "de" ? "Zuordnung & Abbildung (Drag & Drop)" : "Matching & Diagram (Drag & Drop)")
                  : (lang === "de" ? "Freitext-Aufgabe (KI-bewertet)" : "Free Text (AI Evaluated)")}
              </span>
            </div>

            {/* Question Text */}
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
              {currentQ.questionText}
            </h3>

            {/* Source Reference preview */}
            {currentQ.sourceRef && (
              <div className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{lang === "de" ? "Quelle:" : "Source:"} {currentQ.sourceRef}</span>
              </div>
            )}

            {/* SINGLE CHOICE OPTIONS */}
            {currentQ.type === "SINGLE_CHOICE" && (
              <div className="space-y-2.5 pt-2">
                {parsedOptions.map((opt, idx) => {
                  const isSelected = selectedSingle === idx;
                  let cardStyle =
                    "border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-white dark:bg-slate-800/80";

                  if (isAnswerSubmitted) {
                    if (opt.isCorrect) {
                      cardStyle =
                        "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500";
                    } else if (isSelected && !opt.isCorrect) {
                      cardStyle =
                        "border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 ring-1 ring-rose-500";
                    }
                  } else if (isSelected) {
                    cardStyle =
                      "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-600";
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => !isAnswerSubmitted && setSelectedSingle(idx)}
                      className={`p-3.5 rounded-xl border text-xs sm:text-sm cursor-pointer transition-all ${cardStyle}`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "border-slate-300 dark:border-slate-600 text-slate-500"
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <div className="flex-1">
                          <p>{opt.text}</p>
                          {isAnswerSubmitted && opt.explanation && (
                            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 italic">
                              💡 {opt.explanation}
                            </p>
                          )}
                        </div>
                        {isAnswerSubmitted && opt.isCorrect && (
                          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        )}
                        {isAnswerSubmitted && isSelected && !opt.isCorrect && (
                          <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* MULTIPLE CHOICE OPTIONS */}
            {currentQ.type === "MULTIPLE_CHOICE" && (
              <div className="space-y-2.5 pt-2">
                {parsedOptions.map((opt, idx) => {
                  const isChecked = selectedMulti.includes(idx);
                  let cardStyle =
                    "border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-white dark:bg-slate-800/80";

                  if (isAnswerSubmitted) {
                    if (opt.isCorrect) {
                      cardStyle =
                        "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500";
                    } else if (isChecked && !opt.isCorrect) {
                      cardStyle =
                        "border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 ring-1 ring-rose-500";
                    }
                  } else if (isChecked) {
                    cardStyle =
                      "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-600";
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => handleToggleMulti(idx)}
                      className={`p-3.5 rounded-xl border text-xs sm:text-sm cursor-pointer transition-all ${cardStyle}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          className="w-4 h-4 rounded text-indigo-600 mt-0.5 pointer-events-none"
                        />
                        <div className="flex-1">
                          <p>{opt.text}</p>
                          {isAnswerSubmitted && opt.explanation && (
                            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 italic">
                              💡 {opt.explanation}
                            </p>
                          )}
                        </div>
                        {isAnswerSubmitted && opt.isCorrect && (
                          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        )}
                        {isAnswerSubmitted && isChecked && !opt.isCorrect && (
                          <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* FREE TEXT AREA */}
            {currentQ.type === "FREE_TEXT" && (
              <div className="space-y-4 pt-2">
                <div>
                  <textarea
                    rows={5}
                    disabled={isAnswerSubmitted || isEvaluating}
                    value={freeTextAnswer}
                    onChange={(e) => setFreeTextAnswer(e.target.value)}
                    placeholder={t.freeTextPlaceholder}
                    className="w-full p-3.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                    <span>
                      {lang === "de" ? "Wörter:" : "Words:"} {freeTextAnswer.trim() ? freeTextAnswer.trim().split(/\s+/).length : 0}
                    </span>
                    <span>{lang === "de" ? "Tipp: Verwende präzise Fachterminologie aus dem Skript." : "Tip: Use precise technical terms from lecture materials."}</span>
                  </div>
                </div>

                {/* Free Text AI Evaluation Result Box */}
                {freeTextEvaluation && (
                  <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 p-5 space-y-4 animate-in fade-in duration-200">
                    {/* Header with Dynamic Score Badge */}
                    <div className="flex items-center justify-between pb-3 border-b border-indigo-100 dark:border-indigo-900/60">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {t.evalHeader} ({freeTextEvaluation.modelUsed})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-black px-3 py-1 rounded-full border shadow-sm ${
                            Number(freeTextEvaluation.score) >= 4
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                              : Number(freeTextEvaluation.score) >= 3
                              ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700"
                              : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                          }`}
                        >
                          {freeTextEvaluation.score} / {freeTextEvaluation.maxScore} {lang === "de" ? "Punkte" : "Points"}
                        </span>
                      </div>
                    </div>

                    {/* 1. Kurz & Knapp Zusammenfassung (Highlight-Box) */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200/90 dark:border-indigo-800/90 shadow-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950 dark:text-indigo-300">
                        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>{lang === "de" ? "Kurz & knapp auf den Punkt:" : "Summary & Key Takeaway:"}</span>
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                        {freeTextEvaluation.summary || freeTextEvaluation.accuracyComment || freeTextEvaluation.feedback}
                      </p>
                    </div>

                    {/* 2. Strukturierte Detailbewertung (Gut / Falsch / Was fehlt) */}
                    <div className="space-y-2.5">
                      {/* Was gut & richtig war */}
                      {freeTextEvaluation.whatWasGood && freeTextEvaluation.whatWasGood.length > 0 && (
                        <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/80 space-y-1.5">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            {lang === "de" ? "Das hast du richtig & gut erklärt:" : "What was correct & well understood:"}
                          </span>
                          <ul className="space-y-1 text-xs text-emerald-950 dark:text-emerald-200 pl-5 list-disc marker:text-emerald-500">
                            {freeTextEvaluation.whatWasGood.map((good: string, i: number) => (
                              <li key={i}>{good}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Was sachlich falsch / Missverständnis war (nur wenn Falschaussagen existieren) */}
                      {freeTextEvaluation.whatWasWrong && freeTextEvaluation.whatWasWrong.length > 0 && (
                        <div className="p-3 sm:p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/80 space-y-1.5">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-300">
                            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                            {lang === "de" ? "Sachliche Fehler / Missverständnisse:" : "Factual inaccuracies / Misunderstandings:"}
                          </span>
                          <ul className="space-y-1 text-xs text-rose-950 dark:text-rose-200 pl-5 list-disc marker:text-rose-500">
                            {freeTextEvaluation.whatWasWrong.map((wrong: string, i: number) => (
                              <li key={i}>{wrong}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Was zur vollen Punktzahl noch gefehlt hat */}
                      {freeTextEvaluation.whatWasMissing && freeTextEvaluation.whatWasMissing.length > 0 && (
                        <div className="p-3 sm:p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/80 space-y-1.5">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            {lang === "de" ? "Das hat noch für die volle Punktzahl gefehlt:" : "What was missing for full points:"}
                          </span>
                          <ul className="space-y-1 text-xs text-amber-950 dark:text-amber-200 pl-5 list-disc marker:text-amber-500">
                            {freeTextEvaluation.whatWasMissing.map((missing: string, i: number) => (
                              <li key={i}>{missing}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* 3. Aufklappbares KI-Reasoning (Gedankengang der semantischen Korrektur) */}
                    {freeTextEvaluation.reasoning && (
                      <div className="rounded-xl border border-indigo-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowReasoning(!showReasoning)}
                          className="w-full flex items-center justify-between p-2.5 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-indigo-50/50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <span className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200">
                            <Brain className="w-4 h-4 text-indigo-500 shrink-0" />
                            {lang === "de" ? "KI-Reasoning & Bewertungsabwägung einblenden" : "Show AI reasoning & grading balance"}
                          </span>
                          {showReasoning ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        {showReasoning && (
                          <div className="p-3.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/60 dark:bg-slate-950/40 whitespace-pre-line animate-in fade-in duration-150">
                            {freeTextEvaluation.reasoning}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. Identified and Missing Key Terms */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {freeTextEvaluation.detectedKeyTerms?.length > 0 && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-1">
                            {lang === "de" ? "✓ Erkannte Fachbegriffe:" : "✓ Identified Key Terms:"}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {freeTextEvaluation.detectedKeyTerms.map((term: string, i: number) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[10px] font-semibold"
                              >
                                {term}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {freeTextEvaluation.missingKeyTerms?.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
                          <span className="font-bold text-amber-800 dark:text-amber-300 block mb-1">
                            {lang === "de" ? "⚠ Vertiefungsbegriffe:" : "⚠ Deepening Terms:"}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {freeTextEvaluation.missingKeyTerms.map((term: string, i: number) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px] font-semibold"
                              >
                                {term}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 5. Sample solution accordion */}
                    {currentQ.sampleSolution && (
                      <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/50">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          {lang === "de" ? "Offizielle Musterlösung:" : "Official Sample Solution:"}
                        </span>
                        <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line bg-white/70 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                          {currentQ.sampleSolution}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* MATCHING / DIAGRAM DRAG & DROP AREA */}
            {currentQ.type === "MATCHING" && (
              <div className="space-y-4 pt-2">
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50 text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <p>
                    {lang === "de"
                      ? "Ordne die Begriffe den passenden Feldern zu: Ziehe sie per Drag & Drop oder klicke zuerst auf einen Begriff und anschließend auf das Zielfeld."
                      : "Match terms to their targets: Drag & drop them or click a term then click its slot."}
                  </p>
                </div>

                {/* Pool of Available Terms */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      {lang === "de" ? "Verfügbare Begriffe / Zuordnungselemente:" : "Available Terms:"} ({availableTerms.length})
                    </span>
                    {selectedMatchingTerm && (
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 animate-pulse">
                        {lang === "de" ? "Klicke jetzt auf ein Zielfeld zum Ablegen" : "Click a target slot to place"}
                      </span>
                    )}
                  </div>
                  {availableTerms.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      {lang === "de" ? "✓ Alle Begriffe wurden den Feldern zugeordnet." : "✓ All terms placed."}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableTerms.map((term, tIdx) => {
                        const isSelected = selectedMatchingTerm === term;
                        return (
                          <div
                            key={tIdx}
                            draggable={!isAnswerSubmitted}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", term);
                            }}
                            onClick={() => {
                              if (isAnswerSubmitted) return;
                              setSelectedMatchingTerm(isSelected ? null : term);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-grab active:cursor-grabbing transition-all select-none border ${
                              isSelected
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400 scale-105"
                                : "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:shadow-sm"
                            }`}
                          >
                            {term}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Target Slots / Diagram Definitions */}
                <div className="space-y-3">
                  {matchingSlots.map((slot, sIdx) => {
                    const assignedTerm = assignedMatches[sIdx];
                    const isSlotCorrect = isAnswerSubmitted && assignedTerm === slot.correctTerm;
                    const isSlotWrong = isAnswerSubmitted && assignedTerm !== slot.correctTerm;

                    let slotCardStyle = "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80";
                    if (isAnswerSubmitted) {
                      if (isSlotCorrect) {
                        slotCardStyle = "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-1 ring-emerald-500";
                      } else {
                        slotCardStyle = "border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 ring-1 ring-rose-500";
                      }
                    } else if (selectedMatchingTerm) {
                      slotCardStyle = "border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 bg-white dark:bg-slate-800 cursor-pointer";
                    }

                    return (
                      <div
                        key={sIdx}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const droppedTerm = e.dataTransfer.getData("text/plain");
                          if (droppedTerm) {
                            handleAssignTermToSlot(sIdx, droppedTerm);
                          }
                        }}
                        onClick={() => {
                          if (isAnswerSubmitted) return;
                          if (selectedMatchingTerm) {
                            handleAssignTermToSlot(sIdx, selectedMatchingTerm);
                          }
                        }}
                        className={`p-4 rounded-2xl border transition-all ${slotCardStyle}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Target Description / Definition */}
                          <div className="flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                              Zielfeld #{sIdx + 1}
                            </span>
                            <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100">
                              {slot.target}
                            </p>
                          </div>

                          {/* Assigned Term Drop Target */}
                          <div className="flex-shrink-0 min-w-[180px]">
                            {assignedTerm ? (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnassignSlot(sIdx);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                  isAnswerSubmitted
                                    ? isSlotCorrect
                                      ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border-emerald-300"
                                      : "bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 border-rose-300"
                                    : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border-indigo-200 hover:bg-indigo-100"
                                }`}
                              >
                                <span className="truncate">{assignedTerm}</span>
                                {!isAnswerSubmitted && (
                                  <span className="text-slate-400 hover:text-rose-500 font-bold ml-1 text-sm">✕</span>
                                )}
                                {isAnswerSubmitted && isSlotCorrect && (
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                )}
                                {isAnswerSubmitted && isSlotWrong && (
                                  <XCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                                )}
                              </div>
                            ) : (
                              <div
                                className={`px-3 py-2 rounded-xl text-xs font-semibold border-2 border-dashed text-center transition-all ${
                                  selectedMatchingTerm
                                    ? "border-indigo-400 bg-indigo-50/40 text-indigo-700 animate-pulse"
                                    : "border-slate-300 dark:border-slate-700 text-slate-400 bg-slate-50/50 dark:bg-slate-900/40"
                                }`}
                              >
                                {selectedMatchingTerm
                                  ? (lang === "de" ? "Hier platzieren" : "Place here")
                                  : (lang === "de" ? "Begriff ablegen oder anklicken" : "Drop or click term")}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* If submitted and wrong, show correct term & explanation */}
                        {isAnswerSubmitted && isSlotWrong && (
                          <div className="mt-2.5 pt-2 border-t border-rose-200 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                            <span className="font-bold">{lang === "de" ? "Richtige Zuordnung:" : "Correct match:"}</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 font-bold">
                              {slot.correctTerm}
                            </span>
                            {slot.explanation && (
                              <span className="text-slate-600 dark:text-slate-400 italic ml-1">
                                ({slot.explanation})
                              </span>
                            )}
                          </div>
                        )}
                        {isAnswerSubmitted && isSlotCorrect && slot.explanation && (
                          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 italic">
                            💡 {slot.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400">
                {lang === "de" ? `Punkte im Training: ${scoreEarned} / ${totalPossible}` : `Points scored: ${scoreEarned} / ${totalPossible}`}
              </span>

              <div className="flex items-center gap-2">
                {!isAnswerSubmitted ? (
                  <button
                    type="button"
                    onClick={handleSubmitAnswer}
                    disabled={
                      isEvaluating ||
                      (currentQ.type === "SINGLE_CHOICE" && selectedSingle === null) ||
                      (currentQ.type === "MULTIPLE_CHOICE" && selectedMulti.length === 0) ||
                      (currentQ.type === "FREE_TEXT" && !freeTextAnswer.trim()) ||
                      (currentQ.type === "MATCHING" && Object.keys(assignedMatches).length < matchingSlots.length)
                    }
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-all shadow-sm"
                  >
                    {isEvaluating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> {t.evaluatingAi}
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> {lang === "de" ? "Antwort einreichen" : "Submit Answer"}
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
                  >
                    {currentIndex + 1 < questions.length ? (
                      <>
                        {t.nextQuestionBtn}
                      </>
                    ) : (
                      <>
                        {lang === "de" ? "Training abschließen" : "Finish Training"} <Trophy className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Session Completed Summary Screen */
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {t.sessionFinishedTitle} 🎉
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {lang === "de"
                  ? "Dein Spaced-Repetition-Intervall und deine Klausurreife wurden aktualisiert."
                  : "Your spaced repetition intervals and exam readiness scores have been updated."}
              </p>
            </div>

            <div className="max-w-xs mx-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {scoreEarned} / {totalPossible} {lang === "de" ? "Punkte" : "Points"}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {lang === "de" ? "Erfolgsquote:" : "Success rate:"} {totalPossible > 0 ? Math.round((scoreEarned / totalPossible) * 100) : 100}%
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={restartQuiz}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                <RotateCcw className="w-3.5 h-3.5" /> {t.practiceAgainBtn}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow"
              >
                {t.finishSessionBtn}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </Portal>
  );
}
