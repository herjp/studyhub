"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Award,
  BookOpen,
  Settings,
  Sparkles,
  RefreshCw,
  Moon,
  Sun,
  CheckCircle,
  KeyRound,
  Check,
  User,
  LogIn,
  LogOut,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { formatGrade, formatEcts } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { EctsCalculatorModal } from "./EctsCalculatorModal";
import { AuthModal } from "./AuthModal";
import { OnboardingModal } from "./OnboardingModal";
import { Portal } from "./Portal";

interface StatsData {
  completedEcts: number;
  plannedEcts: number;
  gpa: number | null;
  gradedEctsSum: number;
  totalQuestions: number;
  answeredCount: number;
  moduleCount: number;
}

export function HeaderDashboard({ onStatsUpdated }: { onStatsUpdated?: () => void }) {
  const { lang, setLang, t } = useLanguage();
  const [showEctsModal, setShowEctsModal] = useState(false);
  const [stats, setStats] = useState<StatsData>({
    completedEcts: 0,
    plannedEcts: 0,
    gpa: null,
    gradedEctsSum: 0,
    totalQuestions: 0,
    answeredCount: 0,
    moduleCount: 0,
  });
  const [targetEcts, setTargetEcts] = useState<number>(180);
  const [showSettings, setShowSettings] = useState(false);
  const [defaultDailyGoal, setDefaultDailyGoal] = useState<number>(5);
  const [defaultSessionSize, setDefaultSessionSize] = useState<number>(5);
  const [aiProvider, setAiProvider] = useState<string>("local");
  const [providerKeys, setProviderKeys] = useState<{ [key: string]: string }>({
    gemini: "",
    openai: "",
    anthropic: "",
  });
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  } | null>(null);

  const handleProviderChange = (newProvider: string) => {
    setAiProvider(newProvider);
    setTestStatus(null);
  };

  const handleTestConnection = async () => {
    const activeKey = (providerKeys[aiProvider] || "").trim();
    if (!activeKey) {
      setTestStatus({
        loading: false,
        success: false,
        message: lang === "de" ? "Bitte gib zuerst einen API-Schlüssel ein." : "Please enter an API key first.",
      });
      return;
    }

    setTestStatus({ loading: true });
    try {
      const res = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiProvider,
          apiKey: activeKey,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestStatus({
          loading: false,
          success: true,
          message: data.message || "Verbindung erfolgreich!",
        });
        localStorage.setItem("studyhub_ai_status", "connected");
        localStorage.setItem(`studyhub_api_key_${aiProvider}`, activeKey);
        localStorage.setItem("studyhub_api_key", activeKey);
        if (data.model) {
          localStorage.setItem(`studyhub_ai_model_${aiProvider}`, data.model);
          localStorage.setItem("studyhub_ai_model", data.model);
        }
      } else {
        setTestStatus({
          loading: false,
          success: false,
          message: data.error || "Verbindung fehlgeschlagen.",
        });
        localStorage.removeItem("studyhub_ai_status");
      }
    } catch (err: any) {
      setTestStatus({
        loading: false,
        success: false,
        message: err.message || "Netzwerkfehler beim Verbindungstest.",
      });
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      fetchStats();
      if (onStatsUpdated) onStatsUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchStats();
    // Load local settings
    const storedTarget = localStorage.getItem("studyhub_target_ects");
    if (storedTarget) setTargetEcts(Number(storedTarget));

    const storedProvider = localStorage.getItem("studyhub_ai_provider") || "gemini";
    if (storedProvider) setAiProvider(storedProvider);

    const legacyKey = localStorage.getItem("studyhub_api_key") || "";
    const geminiKey = localStorage.getItem("studyhub_api_key_gemini") || (storedProvider === "gemini" ? legacyKey : "");
    const openaiKey = localStorage.getItem("studyhub_api_key_openai") || (storedProvider === "openai" ? legacyKey : "");
    const anthropicKey = localStorage.getItem("studyhub_api_key_anthropic") || (storedProvider === "anthropic" ? legacyKey : "");

    setProviderKeys({
      gemini: geminiKey,
      openai: openaiKey,
      anthropic: anthropicKey,
    });

    const storedGoal = localStorage.getItem("studyhub_daily_goal");
    if (storedGoal) setDefaultDailyGoal(Number(storedGoal));

    const storedSession = localStorage.getItem("studyhub_session_size");
    if (storedSession) setDefaultSessionSize(Number(storedSession));

    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);

    // Check if onboarding tour has been completed
    const onboardingSeen = localStorage.getItem("studyhub_onboarding_seen");
    if (!onboardingSeen) {
      setShowOnboarding(true);
    }
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem("studyhub_target_ects", targetEcts.toString());
    localStorage.setItem("studyhub_ai_provider", aiProvider);
    localStorage.setItem("studyhub_daily_goal", defaultDailyGoal.toString());
    localStorage.setItem("studyhub_session_size", defaultSessionSize.toString());

    // Save each provider key in separate isolated storage keys
    localStorage.setItem("studyhub_api_key_gemini", providerKeys.gemini || "");
    localStorage.setItem("studyhub_api_key_openai", providerKeys.openai || "");
    localStorage.setItem("studyhub_api_key_anthropic", providerKeys.anthropic || "");

    const activeKey = providerKeys[aiProvider] || "";
    localStorage.setItem("studyhub_api_key", activeKey);

    setShowSettings(false);
  };

  const handleResetData = async () => {
    setIsResetting(true);
    setResetSuccess(false);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        setResetSuccess(true);
        fetchStats();
        if (onStatsUpdated) onStatsUpdated();
        setTimeout(() => setResetSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Reset error:", err);
    } finally {
      setIsResetting(false);
    }
  };

  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove("dark");
      setDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }
  };

  const ectsPercentage = Math.min(100, Math.round((stats.completedEcts / targetEcts) * 100));

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          
          {/* 1. Left: Logo & Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform flex-shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                    StudyHub
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    <Sparkles className="w-2.5 h-2.5" /> KI 2.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block leading-tight">
                  {lang === "de" ? "Studien- & Klausurmanager" : "Study & Exam Hub"}
                </p>
              </div>
            </Link>
          </div>

          {/* 2. Center: Sleek ECTS & GPA Trackers */}
          <div className="hidden md:flex items-center gap-2.5 lg:gap-3 flex-shrink-0 mx-auto">
            {/* ECTS Tracker (Clickable for ECTS Calculator & Semester Analytics) */}
            <div
              onClick={() => setShowEctsModal(true)}
              title={lang === "de" ? "Klicken für ECTS-Rechner & Semesteranalyse" : "Click for ECTS Calculator & Semester Analytics"}
              className="bg-slate-50/90 dark:bg-slate-800/80 hover:bg-indigo-50/60 dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl px-3 py-1.5 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-2.5 cursor-pointer transition-all group shadow-sm hover:shadow"
            >
              <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-semibold text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {t.ectsProgress} <span className="text-[9px] opacity-70">↗</span>
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatEcts(stats.completedEcts)} / {targetEcts}
                  </span>
                </div>
                <div className="w-24 sm:w-28 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-gradient-to-r from-sky-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${ectsPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* GPA Tracker */}
            <div className="bg-slate-50/90 dark:bg-slate-800/80 rounded-xl px-3 py-1.5 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-2.5 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <Award className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">
                  {t.gpaTracker}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-black text-slate-900 dark:text-slate-100 leading-none">
                    {stats.gpa !== null ? formatGrade(stats.gpa) : "—"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    ({formatEcts(stats.gradedEctsSum)} ECTS)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Right: Complete Action Bar (Kalender, Sprache, Dark Mode, Einstellungen & Profil GANZ RECHTS) */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-auto">
            <Link
              href="/calendar"
              title={lang === "de" ? "Klausuren-Kalender öffnen" : "Open Exam Calendar"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 transition-colors"
            >
              <span>📅</span>
              <span className="hidden sm:inline">{t.calendar}</span>
            </Link>

            <button
              onClick={() => setLang(lang === "de" ? "en" : "de")}
              title={lang === "de" ? "Switch to English" : "Auf Deutsch wechseln"}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 transition-colors"
            >
              {lang === "de" ? "🇩🇪 DE" : "🇬🇧 EN"}
            </button>

            <button
              onClick={toggleDarkMode}
              title={darkMode ? (lang === "de" ? "Hellmodus aktivieren" : "Light mode") : (lang === "de" ? "Dunkelmodus aktivieren" : "Dark mode")}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setShowSettings(true)}
              title={t.settings}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Help / Onboarding Tour Button */}
            <button
              onClick={() => setShowOnboarding(true)}
              title={lang === "de" ? "Kurzanleitung & App-Tour öffnen" : "Open App Tour & Guide"}
              className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* User Account / Profile / Login - GANZ RECHTS */}
            <div className="pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
              {currentUser ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-sm"
                    title={currentUser.email}
                  >
                    {currentUser.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt="Avatar"
                        className="w-5 h-5 rounded-full object-cover shadow-sm border border-indigo-300 dark:border-indigo-700"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shadow-sm">
                        {(currentUser.name?.[0] || currentUser.email?.[0] || "U").toUpperCase()}
                      </div>
                    )}
                    <span className="max-w-[85px] sm:max-w-[110px] truncate">
                      {currentUser.name ? currentUser.name.split(" ")[0] : currentUser.email.split("@")[0]}
                    </span>
                  </button>
                  <button
                    onClick={handleLogout}
                    title={lang === "de" ? "Abmelden" : "Sign out"}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-sm shadow-indigo-500/25 transition-all hover:scale-[1.02]"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{lang === "de" ? "Anmelden" : "Sign In"}</span>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Mobile Stats Sub-Row (visible only on small screens < md) */}
        <div className="flex md:hidden items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <div
            onClick={() => setShowEctsModal(true)}
            className="flex-1 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between cursor-pointer text-xs"
          >
            <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">{t.ectsProgress}:</span>
            <span className="font-bold text-slate-900 dark:text-white text-[11px]">{formatEcts(stats.completedEcts)} / {targetEcts}</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">GPA:</span>
            <span className="font-bold text-slate-900 dark:text-white text-[11px]">{stats.gpa !== null ? formatGrade(stats.gpa) : "—"}</span>
          </div>
        </div>

      </div>

      {/* Settings Modal */}
      {showSettings && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t.settingsTitle}
                </h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 py-4">
              {/* Target ECTS */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  {t.settingsTargetEctsLabel}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetEcts(180)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border text-center transition-all ${
                      targetEcts === 180
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    Bachelor (180 ECTS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetEcts(120)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border text-center transition-all ${
                      targetEcts === 120
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    Master (120 ECTS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetEcts(210)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border text-center transition-all ${
                      targetEcts === 210
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    7-Sem. (210 ECTS)
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-500">{t.settingsCustom}</span>
                  <input
                    type="number"
                    value={targetEcts}
                    onChange={(e) => setTargetEcts(Math.max(1, Number(e.target.value)))}
                    className="w-24 px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <span className="text-xs text-slate-500">ECTS</span>
                </div>
              </div>

              {/* Daily Learning Goal & Session Length Settings */}
              <div className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2 flex items-center justify-between">
                    <span>{lang === "de" ? "Tägliches Lernziel (Fragen pro Tag)" : "Daily Goal (Questions / Day)"}</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{defaultDailyGoal} {lang === "de" ? "Fragen/Tag" : "Qs/day"}</span>
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[3, 5, 10, 15, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setDefaultDailyGoal(num)}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all text-center ${
                          defaultDailyGoal === num
                            ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 shadow-sm"
                            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2 flex items-center justify-between">
                    <span>{lang === "de" ? "Fragen pro Trainingssession" : "Questions per Training Session"}</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{defaultSessionSize} {lang === "de" ? "Fragen" : "Qs"}</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 15, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setDefaultSessionSize(num)}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all text-center ${
                          defaultSessionSize === num
                            ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 shadow-sm"
                            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {num} {lang === "de" ? "Fragen" : "Qs"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Engine & API Key */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  {t.settingsAiModeLabel}
                </label>
                <div className="space-y-2">
                  {/* Google Gemini Pro / Flash */}
                  <label className="flex items-center gap-3 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50 cursor-pointer transition-all">
                    <input
                      type="radio"
                      name="provider"
                      value="gemini"
                      checked={aiProvider === "gemini"}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                        Google Gemini (Gemini Pro / Flash)
                        <span className="px-1.5 py-0.2 bg-indigo-600 text-white text-[10px] rounded-full font-bold">
                          Empfohlen / Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {lang === "de"
                          ? "Kostenloser API-Key auf Google AI Studio (aistudio.google.com). Echte KI-Klausurbewertung & Fragengenerierung."
                          : "Free API key from Google AI Studio (aistudio.google.com). Real semantic AI exam grading & question generation."}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="provider"
                      value="local"
                      checked={aiProvider === "local"}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        {t.settingsLocalTitle}
                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] rounded font-semibold">
                          {t.settingsLocalNoKey}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {t.settingsLocalDesc}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="provider"
                      value="openai"
                      checked={aiProvider === "openai"}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        OpenAI (gpt-4o &amp; gpt-4o-mini) Cloud
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {t.settingsOpenAiDesc}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="provider"
                      value="anthropic"
                      checked={aiProvider === "anthropic"}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Anthropic (claude-3-5-sonnet &amp; haiku) Cloud
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {t.settingsAnthropicDesc}
                      </p>
                    </div>
                  </label>
                </div>

                {aiProvider !== "local" && (
                  <div className="mt-3 space-y-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5" /> API-Key ({aiProvider === "gemini" ? "Google Gemini AI Studio" : aiProvider.toUpperCase()})
                      </span>
                      {aiProvider === "gemini" && (
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {lang === "de" ? "Key kostenlos holen ↗" : "Get free key ↗"}
                        </a>
                      )}
                      {aiProvider === "openai" && (
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          platform.openai.com ↗
                        </a>
                      )}
                      {aiProvider === "anthropic" && (
                        <a
                          href="https://console.anthropic.com/settings/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          console.anthropic.com ↗
                        </a>
                      )}
                    </label>

                    <input
                      type="password"
                      placeholder={aiProvider === "gemini" ? "AIzaSy..." : "sk-..."}
                      value={providerKeys[aiProvider] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProviderKeys((prev) => ({ ...prev, [aiProvider]: val }));
                        setTestStatus(null);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testStatus?.loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${testStatus?.loading ? "animate-spin text-indigo-600" : ""}`} />
                        {testStatus?.loading ? (lang === "de" ? "Prüfe..." : "Testing...") : (lang === "de" ? "Verbindung testen" : "Test Connection")}
                      </button>
                      <span className="text-[10px] text-slate-400">
                        {lang === "de" ? "Testet den API-Key mit einer Live-Anfrage" : "Tests API key with a live ping"}
                      </span>
                    </div>

                    {testStatus && !testStatus.loading && (
                      <div
                        className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs animate-in fade-in duration-150 ${
                          testStatus.success
                            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                            : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                        }`}
                      >
                        {testStatus.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                        )}
                        <span className="leading-snug">{testStatus.message}</span>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 mt-1">
                      {aiProvider === "gemini"
                        ? (lang === "de"
                            ? "Dein Gemini-Key wird lokal im Browser gespeichert und sicher für Klausurbewertungen & Fragengenerierung genutzt."
                            : "Your Gemini key is stored locally and used securely for exam grading & question generation.")
                        : t.settingsApiKeyHint}
                    </p>
                  </div>
                )}
              </div>

              {/* Reset Demo Data */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      {t.settingsResetDemoTitle}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {t.settingsResetDemoDesc}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetData}
                    disabled={isResetting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
                    {resetSuccess ? t.settingsResetDemoLoaded : t.settingsResetDemoBtn}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                <Check className="w-3.5 h-3.5" /> {t.save}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* ECTS Calculator & Semester Analytics Modal */}
      <EctsCalculatorModal
        isOpen={showEctsModal}
        onClose={() => setShowEctsModal(false)}
        targetEcts={targetEcts}
      />

      {/* User Authentication & Account Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onSuccess={(user) => {
          setCurrentUser(user);
          fetchStats();
          if (onStatsUpdated) onStatsUpdated();
        }}
      />

      {/* Interactive Onboarding Tour Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </header>
  );
}
