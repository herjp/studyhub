"use client";

import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  BookOpen,
  Calendar,
  BrainCircuit,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  UploadCloud,
  Award,
  Layers,
} from "lucide-react";
import { Portal } from "./Portal";
import { useLanguage } from "@/lib/i18n";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { lang } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: GraduationCap,
      color: "from-indigo-600 to-sky-500",
      title: lang === "de" ? "Willkommen bei StudyHub! 🎓⚡" : "Welcome to StudyHub! 🎓⚡",
      badge: lang === "de" ? "Schritt 1 von 4: Übersicht" : "Step 1 of 4: Overview",
      description:
        lang === "de"
          ? "Dein ganzheitlicher Studien- und Klausurmanager. Entwickelt, um dein Studium von Semester zu Semester zu organisieren, Leistungsziele zu überwachen und dich mit KI auf deine Klausuren vorzubereiten."
          : "Your all-in-one study and exam manager. Organize semesters, track GPA and ECTS goals, and prepare for exams with adaptive AI.",
      features: [
        {
          title: lang === "de" ? "Semester-Hierarchie" : "Semester Hierarchy",
          desc: lang === "de" ? "Beliebig viele Semester anlegen, wechseln und archivieren." : "Create, switch, and organize as many semesters as you need.",
        },
        {
          title: lang === "de" ? "ECTS- & GPA-Tracker" : "ECTS & GPA Tracker",
          desc: lang === "de" ? "Automatisch nach ECTS-Punkten gewichteter Notenschnitt." : "Automatically weighted grade point average based on credits.",
        },
        {
          title: lang === "de" ? "Cloud-Sync & Accounts" : "Cloud Sync & Accounts",
          desc: lang === "de" ? "Eigener Account, geräteübergreifend synchronisiert." : "Personal account synced safely across all your devices.",
        },
      ],
    },
    {
      icon: BookOpen,
      color: "from-sky-500 to-indigo-600",
      title: lang === "de" ? "Semester & Fächer anlegen 📚" : "Manage Semesters & Courses 📚",
      badge: lang === "de" ? "Schritt 2 von 4: Organisation" : "Step 2 of 4: Organization",
      description:
        lang === "de"
          ? "Dein Account startet komplett sauber und blank. Du bestimmst, welche Semester und Fächer du belegst."
          : "Your account starts completely clean. Customize semesters and courses to match your exact curriculum.",
      features: [
        {
          title: lang === "de" ? "+ Neues Fach anlegen" : "+ Add Course",
          desc: lang === "de" ? "Name, ECTS-Punkte und Prüfungstermin eintragen." : "Enter course title, credit points, and exam date.",
        },
        {
          title: lang === "de" ? "Klausuraufbau-Notizen" : "Exam Format Notes",
          desc: lang === "de" ? "Trage Dozentenhinweise ein (z. B. '90 Min, 30% MC, Spickzettel erlaubt')." : "Add professor tips (e.g., '90 mins, 30% MC, 1 cheat sheet allowed').",
        },
        {
          title: lang === "de" ? "ECTS-Rechner & Analyse" : "ECTS Calculator",
          desc: lang === "de" ? "Klicke im Header auf ECTS für Semesterübersichten und Zielwert-Simulation." : "Click ECTS in the header for semester analytics and pace simulation.",
        },
      ],
    },
    {
      icon: Calendar,
      color: "from-indigo-600 to-purple-600",
      title: lang === "de" ? "Klausuren-Kalender & .ics-Import 📅" : "Exam Calendar & .ics Import 📅",
      badge: lang === "de" ? "Schritt 3 von 4: Termine" : "Step 3 of 4: Schedule",
      description:
        lang === "de"
          ? "Behalte alle Fristen und Prüfungstermine im Blick – ohne manuelles Abtippen!"
          : "Keep track of all deadlines and exams effortlessly without manual typing!",
      features: [
        {
          title: lang === "de" ? "Campus .ics-Import" : "Campus .ics Import",
          desc: lang === "de" ? "Exportiere deinen Kalender aus Moodle, HISinOne oder Stud.IP und lade die Datei mit 1 Klick hoch." : "Export from Moodle or campus portal and import with 1 click.",
        },
        {
          title: lang === "de" ? "Smart Auto-Match" : "Smart Auto-Match",
          desc: lang === "de" ? "Erkennt automatisch Prüfungen und ordnet Termine deinen Fächern zu." : "Detects exams automatically and assigns them to your courses.",
        },
        {
          title: lang === "de" ? "Prüfungs-Countdowns" : "Exam Countdowns",
          desc: lang === "de" ? "Tagesgenaue Countdown-Anzeige auf deinen Modulkarten." : "Live countdowns and urgency warnings on your module cards.",
        },
      ],
    },
    {
      icon: BrainCircuit,
      color: "from-purple-600 to-indigo-600",
      title: lang === "de" ? "KI-Klausurtrainer & Spaced Repetition 🧠" : "AI Exam Trainer & Spaced Repetition 🧠",
      badge: lang === "de" ? "Schritt 4 von 4: Klausurvorbereitung" : "Step 4 of 4: Exam Prep",
      description:
        lang === "de"
          ? "Das Herzstück von StudyHub: Verwandle Vorlesungsfolien und Altklausuren in echtes Prüfungswissen."
          : "The core of StudyHub: Turn lecture slides and past exams into true mastery.",
      features: [
        {
          title: lang === "de" ? "RAG-Dokumenten-Hub" : "RAG Document Hub",
          desc: lang === "de" ? "Skripte hochladen – die KI lernt den Stil deiner Dozenten." : "Upload slides – the AI adapts to your instructor's exact style.",
        },
        {
          title: lang === "de" ? "Prüfungsreife-Score" : "Exam Readiness Score",
          desc: lang === "de" ? "3-Zonen-Reifebalken (Rot, Gelb, Grün) zeigt deinen aktuellen Lernstand." : "Traffic-light readiness bar shows your exam readiness.",
        },
        {
          title: lang === "de" ? "Spaced Repetition & Tagesziel" : "Spaced Repetition & Daily Goal",
          desc: lang === "de" ? "Wiederhole Fragen nach Vergessenskurve (1, 3, 7, 14 Tage) bis zur Klausur." : "Review questions using spaced intervals (1, 3, 7, 14 days).",
        },
      ],
    },
  ];

  const current = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
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
    localStorage.setItem("studyhub_onboarding_seen", "true");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 backdrop-blur-md p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col">
          {/* Header Badge & Close */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              {current.badge}
            </span>

            <button
              onClick={handleFinish}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              {lang === "de" ? "Überspringen ✕" : "Skip ✕"}
            </button>
          </div>

          {/* Slide Content */}
          <div className="py-6 space-y-5">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${current.color} text-white flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0`}
              >
                <current.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {current.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {current.description}
                </p>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="space-y-2.5 pt-1">
              {current.features.map((feat, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-start gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold mt-0.5 flex-shrink-0">
                    ✓
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                      {feat.title}
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                      {feat.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
            {/* Step Indicators */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
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
                  className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {lang === "de" ? "Zurück" : "Back"}
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02]"
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    <Check className="w-4 h-4" />
                    {lang === "de" ? "Los geht's!" : "Get Started!"}
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
