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
import { SUPPORTED_UNIVERSITIES } from "@/lib/campus-maps";
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
  const [preferredUniversity, setPreferredUniversity] = useState("tu_wien");

  const persistAiSettings = (
    provider: string,
    keys: Record<string, string>,
    model?: string
  ) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("studyhub_ai_provider", provider);
    localStorage.setItem("studyhub_api_key_gemini", keys.gemini || "");
    localStorage.setItem("studyhub_api_key_openai", keys.openai || "");
    localStorage.setItem("studyhub_api_key_anthropic", keys.anthropic || "");

    const activeKey = (keys as any)[provider] || "";
    localStorage.setItem("studyhub_api_key", activeKey);

    if (model) {
      localStorage.setItem(`studyhub_ai_model_${provider}`, model);
      localStorage.setItem("studyhub_ai_model", model);
    }

    // Fire global events so every component (like ModuleTutorChat) updates instantly
    window.dispatchEvent(
      new CustomEvent("studyhub_ai_config_updated", {
        detail: { provider, activeKey, keys, model },
      })
    );
    window.dispatchEvent(new Event("storage"));

    // Async DB sync to current user account
    fetch("/api/ai/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        geminiApiKey: keys.gemini,
        openaiApiKey: keys.openai,
        anthropicApiKey: keys.anthropic,
        model,
      }),
    }).catch((err) => console.warn("Failed to sync AI settings to server:", err));
  };

  const handleProviderChange = (newProvider: string) => {
    setAiProvider(newProvider);
    setTestStatus(null);
    persistAiSettings(newProvider, providerKeys);
  };

  const handleKeyChange = (val: string) => {
    const updated = { ...providerKeys, [aiProvider]: val };
    setProviderKeys(updated);
    setTestStatus(null);
    persistAiSettings(aiProvider, updated);
  };

  const getDisplayModel = (provider: string) => {
    if (typeof window === "undefined") return "";
    const stored =
      localStorage.getItem(`studyhub_ai_model_${provider}`) ||
      (aiProvider === provider ? localStorage.getItem("studyhub_ai_model") : null);
    if (stored) return stored;
    if (provider === "gemini") return "gemini-2.5-flash";
    if (provider === "openai") return "gpt-4o-mini";
    if (provider === "anthropic") return "claude-3-5-sonnet";
    return lang === "de" ? "Lokale Heuristik (Offline)" : "Local Heuristics (Offline)";
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
        persistAiSettings(aiProvider, providerKeys, data.model);
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

  const checkFirstLoginTour = (user: any) => {
    if (!user) return;
    try {
      const userTourKey = `studyhub_tour_seen_${user.id}`;
      const generalSeen =
        localStorage.getItem("studyhub_tour_completed") ||
        localStorage.getItem(userTourKey);
      if (!generalSeen) {
        setShowOnboarding(true);
      }
    } catch (e) {
      console.warn("Storage restricted", e);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        if (data.user) {
          checkFirstLoginTour(data.user);

          // Restore AI settings from user account in DB if available
          const dbProvider = data.user.aiProvider || "gemini";
          const dbGemini = data.user.geminiApiKey || "";
          const dbOpenai = data.user.openaiApiKey || "";
          const dbAnthropic = data.user.anthropicApiKey || "";

          setProviderKeys((prev) => {
            const merged = {
              gemini: prev.gemini || dbGemini,
              openai: prev.openai || dbOpenai,
              anthropic: prev.anthropic || dbAnthropic,
            };
            if (merged.gemini) localStorage.setItem("studyhub_api_key_gemini", merged.gemini);
            if (merged.openai) localStorage.setItem("studyhub_api_key_openai", merged.openai);
            if (merged.anthropic) localStorage.setItem("studyhub_api_key_anthropic", merged.anthropic);
            if (dbProvider) {
              setAiProvider(dbProvider);
              localStorage.setItem("studyhub_ai_provider", dbProvider);
              const activeKey = (merged as any)[dbProvider] || "";
              if (activeKey) localStorage.setItem("studyhub_api_key", activeKey);
            }
            return merged;
          });
        }
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

    const handleUserUpdate = () => {
      fetchCurrentUser();
      fetchStats();
    };
    window.addEventListener("studyhub_user_updated", handleUserUpdate);

    const handleOpenAiSettings = () => {
      setShowSettings(true);
    };
    window.addEventListener("studyhub_open_ai_settings", handleOpenAiSettings);

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

    const storedUni = localStorage.getItem("studyhub_preferred_university");
    if (storedUni) setPreferredUniversity(storedUni);

    const handleUniUpdate = () => {
      const u = localStorage.getItem("studyhub_preferred_university");
      if (u) setPreferredUniversity(u);
    };
    window.addEventListener("studyhub_university_updated", handleUniUpdate);

    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);

    return () => {
      window.removeEventListener("studyhub_user_updated", handleUserUpdate);
      window.removeEventListener("studyhub_open_ai_settings", handleOpenAiSettings);
      window.removeEventListener("studyhub_university_updated", handleUniUpdate);
    };
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem("studyhub_target_ects", targetEcts.toString());
    localStorage.setItem("studyhub_daily_goal", defaultDailyGoal.toString());
    localStorage.setItem("studyhub_session_size", defaultSessionSize.toString());
    localStorage.setItem("studyhub_preferred_university", preferredUniversity);
    window.dispatchEvent(new CustomEvent("studyhub_university_updated", { detail: { university: preferredUniversity } }));

    // Persist AI configuration immediately to localStorage & user DB
    persistAiSettings(aiProvider, providerKeys);

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
              data-tour="ects-tracker"
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

            {/* Help / Onboarding Tour Question Mark Button */}
            <button
              onClick={() => setShowOnboarding(true)}
              title={lang === "de" ? "Hilfe & Interaktive Tour" : "Help & Interactive Tour"}
              aria-label={lang === "de" ? "Hilfe & Interaktive Tour" : "Help & Interactive Tour"}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors cursor-pointer"
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
                  {/* Gemini */}
                  <label
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      aiProvider === "gemini"
                        ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value="gemini"
                      checked={aiProvider === "gemini"}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                        Gemini
                        <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[10px] rounded-full font-bold">
                          {lang === "de" ? "Empfohlen" : "Recommended"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {lang === "de" ? "Modell:" : "Model:"}
                        </span>{" "}
                        <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                          {getDisplayModel("gemini")}
                        </code>
                        {" • "}
                        {lang === "de"
                          ? "Kostenloser API-Key bei Google AI Studio"
                          : "Free API key from Google AI Studio"}
                      </p>
                    </div>
                  </label>

                  {/* OpenAI */}
                  <label
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      aiProvider === "openai"
                        ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value="openai"
                      checked={aiProvider === "openai"}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        OpenAI
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {lang === "de" ? "Modell:" : "Model:"}
                        </span>{" "}
                        <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                          {getDisplayModel("openai")}
                        </code>
                        {" • "}
                        {lang === "de"
                          ? "OpenAI API Key (gpt-4o / mini)"
                          : "OpenAI API key (gpt-4o / mini)"}
                      </p>
                    </div>
                  </label>

                  {/* Claude */}
                  <label
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      aiProvider === "anthropic"
                        ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value="anthropic"
                      checked={aiProvider === "anthropic"}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        Claude
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {lang === "de" ? "Modell:" : "Model:"}
                        </span>{" "}
                        <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                          {getDisplayModel("anthropic")}
                        </code>
                        {" • "}
                        {lang === "de"
                          ? "Anthropic API Key (Claude 3.5 Sonnet)"
                          : "Anthropic API key (Claude 3.5 Sonnet)"}
                      </p>
                    </div>
                  </label>

                  {/* Offline (RAG) */}
                  <label
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      aiProvider === "local"
                        ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value="local"
                      checked={aiProvider === "local"}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                        Offline (RAG)
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] rounded font-semibold">
                          {lang === "de" ? "Kein Key nötig" : "No Key Required"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {lang === "de" ? "Modus:" : "Mode:"}
                        </span>{" "}
                        <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-mono">
                          {getDisplayModel("local")}
                        </code>
                        {" • "}
                        {lang === "de"
                          ? "Kostenlos & komplett lokal im Browser"
                          : "Free & fully local in-browser"}
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
                      onChange={(e) => handleKeyChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />

                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      {lang === "de"
                        ? "Wird sofort automatisch gespeichert & mit deinem Account verbunden."
                        : "Instantly auto-saved & linked to your account."}
                    </p>

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

              {/* Campus Navigation / University */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                    {lang === "de" ? "Campus-Raumsuche & Hörsäle" : "Campus Navigation & Rooms"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {lang === "de" ? "Aktiv:" : "Active:"} {preferredUniversity === "google_maps" ? "Google Maps" : preferredUniversity === "tu_wien" ? "TU Wien Maps" : preferredUniversity === "tum" ? "TUM Nav" : (SUPPORTED_UNIVERSITIES.find((u) => u.id === preferredUniversity)?.shortName || preferredUniversity)}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SUPPORTED_UNIVERSITIES.slice(0, 4).map((uni) => (
                    <button
                      key={uni.id}
                      type="button"
                      onClick={() => setPreferredUniversity(uni.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        preferredUniversity === uni.id
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 font-bold shadow-xs"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>{uni.shortName}</span>
                        {preferredUniversity === uni.id && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{uni.mapSystem}</div>
                    </button>
                  ))}
                </div>
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
          checkFirstLoginTour(user);
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
