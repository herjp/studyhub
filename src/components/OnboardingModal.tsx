"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  GraduationCap,
  BookOpen,
  Calendar,
  BrainCircuit,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Award,
  Layers,
  HelpCircle,
  X,
  Compass,
  ArrowUp,
  ArrowDown,
  Globe,
} from "lucide-react";
import { Portal } from "./Portal";
import { useLanguage } from "@/lib/i18n";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TourStep {
  id: string;
  targetSelector?: string;
  icon: any;
  color: string;
  titleDe: string;
  titleEn: string;
  badgeDe: string;
  badgeEn: string;
  descriptionDe: string;
  descriptionEn: string;
  bulletsDe: string[];
  bulletsEn: string[];
  placement?: "bottom" | "top" | "center";
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { lang, setLang } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);

  const steps: TourStep[] = [
    // Step 0: Welcome & Language Choice (Intro)
    {
      id: "welcome",
      icon: GraduationCap,
      color: "from-indigo-600 to-sky-500",
      titleDe: "Willkommen bei StudyHub! 🎓⚡",
      titleEn: "Welcome to StudyHub! 🎓⚡",
      badgeDe: "Schritt 1 von 5: Einführung",
      badgeEn: "Step 1 of 5: Welcome",
      descriptionDe:
        "Dein ganzheitlicher Studien- und Klausurmanager. Wähle deine bevorzugte Sprache und starte eine interaktive geführte Tour durch dein Dashboard.",
      descriptionEn:
        "Your all-in-one study and exam manager. Choose your preferred language and start an interactive guided tour through your dashboard.",
      bulletsDe: [
        "Semester & Fächer flexibel organisieren",
        "Klausuren-Kalender mit automatischer Semester-Zuordnung",
        "KI-Klausurtrainer mit Altklausuren & Spaced Repetition",
      ],
      bulletsEn: [
        "Organize semesters & courses with full flexibility",
        "Exam calendar with smart automatic semester sorting",
        "AI exam trainer with past papers & spaced repetition",
      ],
      placement: "center",
    },
    // Step 1: Semester Tabs
    {
      id: "semesters",
      targetSelector: '[data-tour="semesters"]',
      icon: Layers,
      color: "from-indigo-600 to-violet-600",
      titleDe: "Semester-Leiste & Organisation 📚",
      titleEn: "Semester Bar & Organization 📚",
      badgeDe: "Schritt 2 von 5: Semester",
      badgeEn: "Step 2 of 5: Semesters",
      descriptionDe:
        "Hier verwaltest du alle deine Studiensemester (z. B. Wintersemester, Sommersemester).",
      descriptionEn:
        "Manage all your academic semesters here (e.g. Winter Semester, Summer Semester).",
      bulletsDe: [
        "Klicke auf '+ Semester', um ein neues Semester anzulegen.",
        "Über das 3-Punkte-Menü (⋮) kannst du ein Semester als aktiv markieren, umbenennen oder löschen.",
        "Das aktive Semester hebt automatisch deine aktuellen Fächer hervor.",
      ],
      bulletsEn: [
        "Click '+ Add Semester' to create a new academic term.",
        "Click the 3 dots (⋮) on any semester to set it as active, rename, or delete it.",
        "Your active semester automatically highlights your current courses.",
      ],
      placement: "bottom",
    },
    // Step 2: Add Module
    {
      id: "add-module",
      targetSelector: '[data-tour="add-module"]',
      icon: BookOpen,
      color: "from-sky-500 to-indigo-600",
      titleDe: "Fächer & Module anlegen ✍️",
      titleEn: "Add Courses & Modules ✍️",
      badgeDe: "Schritt 3 von 5: Fächer",
      badgeEn: "Step 3 of 5: Courses",
      descriptionDe:
        "Hier erstellst du deine Lehrveranstaltungen und Prüfungstermine für das gewählte Semester.",
      descriptionEn:
        "Create courses, credit points (ECTS), and exam schedules for your chosen semester.",
      bulletsDe: [
        "Trage ECTS-Punkte, Klausurdatum und Uhrzeit ein.",
        "Notizen zum Prüfungsformat: Hinterlege Dozenten-Tipps (z. B. '90 Min, 30% MC, Formelsammlung erlaubt').",
        "Tagesaktuelle Live-Countdowns warnen dich automatisch vor anstehenden Klausuren.",
      ],
      bulletsEn: [
        "Enter ECTS credits, exam date, and time.",
        "Exam format notes: Save instructor advice (e.g., '90 mins, 30% MC, 1 cheat sheet allowed').",
        "Live day countdowns warn you automatically before upcoming exams.",
      ],
      placement: "bottom",
    },
    // Step 3: Calendar & .ics Import
    {
      id: "calendar",
      targetSelector: '[data-tour="calendar-link"]',
      icon: Calendar,
      color: "from-purple-600 to-indigo-600",
      titleDe: "Klausuren-Kalender & .ics-Import 📅",
      titleEn: "Exam Calendar & .ics Import 📅",
      badgeDe: "Schritt 4 von 5: Termine",
      badgeEn: "Step 4 of 5: Schedule",
      descriptionDe:
        "Dein zentraler Kalender mit Raumsuche (TU Wien Maps, Google Maps, TUM Nav) und .ics-Import.",
      descriptionEn:
        "Your central calendar with smart room navigation (TU Wien Maps, Google Maps, TUM Nav) and .ics import.",
      bulletsDe: [
        "Importiere deinen Stundenplan aus Moodle, TISS, TUMonline etc. mit einem Klick.",
        "Automatische Semester-Erkennung: Termine in der Zukunft (z. B. April) werden automatisch dem nächsten Semester zugeordnet!",
        "Klicke auf Hörsäle für direkte Navigation auf Google Maps oder TU Wien Maps.",
      ],
      bulletsEn: [
        "Import your schedule from Moodle or campus portal via .ics with 1 click.",
        "Smart semester matching: Future terms (e.g. April) are automatically grouped into the right semester!",
        "Click on rooms for instant navigation via Google Maps, TUM Nav, or TU Wien Maps.",
      ],
      placement: "bottom",
    },
    // Step 4: ECTS Tracker & AI Settings
    {
      id: "ects-tracker",
      targetSelector: '[data-tour="ects-tracker"]',
      icon: Award,
      color: "from-amber-500 to-indigo-600",
      titleDe: "ECTS-Tracker & KI-Trainer 🧠✨",
      titleEn: "ECTS Tracker & AI Trainer 🧠✨",
      badgeDe: "Schritt 5 von 5: Rechner & KI",
      badgeEn: "Step 5 of 5: Analytics & AI",
      descriptionDe:
        "Im Header behältst du deinen Notenschnitt (GPA) und deinen ECTS-Fortschritt im Blick.",
      descriptionEn:
        "In the header you track your grade point average (GPA) and degree completion progress.",
      bulletsDe: [
        "Klicke auf ECTS für den interaktiven ECTS-Rechner und Zielwert-Simulationen.",
        "Im KI-Trainer kannst du Vorlesungsfolien und Altklausuren hochladen.",
        "Adaptive Prüfungsfragen mit Spaced Repetition (Fahrschul-Reifebalken) bereiten dich optimal vor.",
      ],
      bulletsEn: [
        "Click ECTS for the interactive credit calculator and graduation pace simulation.",
        "In the AI trainer, upload lecture slides and past exams to generate real practice questions.",
        "Adaptive Spaced Repetition (Readiness Score) ensures you remember everything on exam day.",
      ],
      placement: "bottom",
    },
  ];

  const current = steps[currentStep];

  // Update target rect when step changes or window resizes
  const updateTargetRect = useCallback(() => {
    if (!current.targetSelector) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(current.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [current.targetSelector]);

  useEffect(() => {
    if (isOpen) {
      updateTargetRect();
      const handleResize = () => updateTargetRect();
      window.addEventListener("resize", handleResize);
      window.addEventListener("scroll", handleResize, { passive: true });
      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("scroll", handleResize);
      };
    }
  }, [isOpen, currentStep, updateTargetRect]);

  // Keyboard navigation: Arrow Left/Right, Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleFinish();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setIsInteractiveMode(true);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("studyhub_tour_v2", "true");
        localStorage.setItem("studyhub_onboarding_seen", "true");
      }
    } catch {
      // Ignore in restricted private storage mode
    }
    onClose();
  };

  if (!isOpen) return null;

  // Calculate card position when pointing to a target
  const getCardStyle = (): React.CSSProperties => {
    if (!targetRect || current.placement === "center") {
      return {};
    }

    const cardWidth = Math.min(window.innerWidth - 32, 480);
    let left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    // Keep within viewport boundaries
    left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, left));

    const spaceBelow = window.innerHeight - targetRect.bottom;
    const placeAbove = spaceBelow < 320 && targetRect.top > 320;

    if (placeAbove) {
      return {
        position: "fixed",
        left: `${left}px`,
        bottom: `${window.innerHeight - targetRect.top + 16}px`,
        width: `${cardWidth}px`,
        zIndex: 120,
      };
    }

    return {
      position: "fixed",
      left: `${left}px`,
      top: `${Math.min(window.innerHeight - 380, targetRect.bottom + 16)}px`,
      width: `${cardWidth}px`,
      zIndex: 120,
    };
  };

  const cardStyle = getCardStyle();
  const hasTarget = Boolean(targetRect && current.targetSelector);

  return (
    <Portal>
      {/* 1. Backdrop */}
      <div className="fixed inset-0 z-[105] bg-black/60 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto">
        {/* Spotlight cutout border around targeted element */}
        {hasTarget && targetRect && (
          <div
            style={{
              top: `${targetRect.top - 6}px`,
              left: `${targetRect.left - 6}px`,
              width: `${targetRect.width + 12}px`,
              height: `${targetRect.height + 12}px`,
            }}
            className="fixed pointer-events-none rounded-2xl ring-4 ring-indigo-500 ring-offset-4 ring-offset-black/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] animate-pulse transition-all duration-300 z-[110]"
          />
        )}
      </div>

      {/* 2. Interactive Tour Card */}
      <div
        className={
          hasTarget
            ? "pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
            : "fixed inset-0 z-[115] flex items-center justify-center p-4 overflow-y-auto pointer-events-auto"
        }
      >
        <div
          style={cardStyle}
          className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto flex flex-col relative z-[120] ring-1 ring-black/10 dark:ring-white/10"
        >
          {/* Top Header: Badge, Language Toggle & Close */}
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                {lang === "de" ? current.badgeDe : current.badgeEn}
              </span>
            </div>

            {/* Language Switcher Button in Tour Card */}
            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-bold border border-slate-200/70 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setLang("de")}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    lang === "de"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                  title="Auf Deutsch umschalten"
                >
                  🇩🇪 DE
                </button>
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    lang === "en"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                  title="Switch to English"
                >
                  🇬🇧 EN
                </button>
              </div>

              <button
                type="button"
                onClick={handleFinish}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-1"
                title={lang === "de" ? "Tour beenden" : "Close tour"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Arrow Pointer indicating direction to real element */}
          {hasTarget && targetRect && (
            <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 animate-bounce">
              {window.innerHeight - targetRect.bottom < 320 && targetRect.top > 320 ? (
                <>
                  <ArrowDown className="w-4 h-4" />
                  <span>{lang === "de" ? "Hier unten verankert:" : "Target element below:"}</span>
                </>
              ) : (
                <>
                  <ArrowUp className="w-4 h-4" />
                  <span>{lang === "de" ? "Blick nach oben gerichtet:" : "Look at the highlighted element above:"}</span>
                </>
              )}
            </div>
          )}

          {/* Slide Content */}
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${current.color} text-white flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0`}
              >
                <current.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {lang === "de" ? current.titleDe : current.titleEn}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {lang === "de" ? current.descriptionDe : current.descriptionEn}
                </p>
              </div>
            </div>

            {/* Bullet Highlights */}
            <div className="space-y-2 pt-1">
              {(lang === "de" ? current.bulletsDe : current.bulletsEn).map((bullet, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300"
                >
                  <div className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold mt-0.5 flex-shrink-0">
                    ✓
                  </div>
                  <span className="leading-snug">{bullet}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Controls: Dots, Back, Next */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
            {/* Step Indicator Dots */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setCurrentStep(idx);
                    setIsInteractiveMode(idx > 0);
                  }}
                  className={`h-2 rounded-full transition-all ${
                    currentStep === idx
                      ? "w-6 bg-indigo-600"
                      : "w-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300"
                  }`}
                  title={`Schritt ${idx + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {lang === "de" ? "Zurück" : "Back"}
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02]"
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    <Check className="w-4 h-4" />
                    {lang === "de" ? "Tour abschließen! 🎯" : "Finish Tour! 🎯"}
                  </>
                ) : (
                  <>
                    {lang === "de" ? "Weiter" : "Next"}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
