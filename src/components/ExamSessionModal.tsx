"use client";

import React, { useState } from "react";
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
} from "lucide-react";

export interface QuestionOption {
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface QuizQuestion {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "FREE_TEXT";
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

  // Session aggregate stats
  const [scoreEarned, setScoreEarned] = useState(0);
  const [totalPossible, setTotalPossible] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  if (!isOpen || questions.length === 0) return null;

  const currentQ = questions[currentIndex];

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
      const storedKey = localStorage.getItem("studyhub_api_key") || undefined;
      const storedProvider = (localStorage.getItem("studyhub_ai_provider") as any) || "local";

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
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedSingle(null);
      setSelectedMulti([]);
      setFreeTextAnswer("");
      setIsAnswerSubmitted(false);
      setFreeTextEvaluation(null);
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
    setIsAnswerSubmitted(false);
    setFreeTextEvaluation(null);
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
                    <div className="flex items-center justify-between pb-3 border-b border-indigo-100 dark:border-indigo-900/60">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {t.evalHeader} ({freeTextEvaluation.modelUsed})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 shadow-sm">
                          {freeTextEvaluation.score} / {freeTextEvaluation.maxScore} {lang === "de" ? "Punkte" : "Points"}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                      {freeTextEvaluation.feedback}
                    </p>

                    {/* Identified and Missing Key Terms */}
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
                            {lang === "de" ? "⚠ Fehlende Kernaspekte:" : "⚠ Missing Core Aspects:"}
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

                    {/* Sample solution accordion */}
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
                      (currentQ.type === "FREE_TEXT" && !freeTextAnswer.trim())
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
