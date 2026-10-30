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
} from "lucide-react";
import { formatGrade, formatEcts } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { EctsCalculatorModal } from "./EctsCalculatorModal";
import { AuthModal } from "./AuthModal";
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
  const [aiProvider, setAiProvider] = useState<string>("local");
  const [apiKey, setApiKey] = useState<string>("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

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

    const storedProvider = localStorage.getItem("studyhub_ai_provider");
    if (storedProvider) setAiProvider(storedProvider);

    const storedKey = localStorage.getItem("studyhub_api_key");
    if (storedKey) setApiKey(storedKey);

    const isDark = document.documentElement.classList.contains("dark");
    setDarkMode(isDark);
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem("studyhub_target_ects", targetEcts.toString());
    localStorage.setItem("studyhub_ai_provider", aiProvider);
    localStorage.setItem("studyhub_api_key", apiKey);
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
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                    StudyHub
                  </h1>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    <Sparkles className="w-2.5 h-2.5" /> KI 2.0
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "de"
                    ? "Semesterplaner, RAG-Altklausuren & Klausur-Readiness-Trainer"
                    : "Semester planner, RAG exam prep & readiness trainer"}
                </p>
              </div>
            </Link>

            {/* Mobile Actions */}
            <div className="flex items-center gap-1 md:hidden">
              {currentUser ? (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="p-1.5 px-2 text-[11px] font-bold rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                  title={currentUser.name || currentUser.email}
                >
                  <User className="w-3 h-3" />
                  <span className="max-w-[55px] truncate">
                    {currentUser.name ? currentUser.name.split(" ")[0] : "Account"}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="p-1.5 px-2 text-[11px] font-bold rounded-lg bg-indigo-600 text-white flex items-center gap-1"
                >
                  <LogIn className="w-3 h-3" />
                  <span>Login</span>
                </button>
              )}
              <button
                onClick={() => setLang(lang === "de" ? "en" : "de")}
                className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                {lang === "de" ? "🇬🇧 EN" : "🇩🇪 DE"}
              </button>
              <Link
                href="/calendar"
                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold"
              >
                📅
              </Link>
              <button
                onClick={toggleDarkMode}
                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats Bar (ECTS & GPA Tracker) */}
          <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
            {/* ECTS Tracker (Clickable for ECTS Calculator & Semester Analytics) */}
            <div
              onClick={() => setShowEctsModal(true)}
              title={lang === "de" ? "Klicken für ECTS-Rechner & Semesteranalyse" : "Click for ECTS Calculator & Semester Analytics"}
              className="bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50/50 dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl px-3.5 py-2 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3 min-w-[210px] cursor-pointer transition-all group shadow-sm hover:shadow"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1">
                    {t.ectsProgress} <span className="text-[10px] opacity-70">↗</span>
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatEcts(stats.completedEcts)} / {targetEcts}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-sky-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${ectsPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* GPA Tracker */}
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl px-3.5 py-2 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3 min-w-[170px]">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                  {t.gpaTracker}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-black text-slate-900 dark:text-slate-100">
                    {stats.gpa !== null ? formatGrade(stats.gpa) : "—"}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    ({formatEcts(stats.gradedEctsSum)} ECTS {lang === "de" ? "gewichtet" : "weighted"})
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop Action Buttons */}
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              {/* Language Toggle Button */}
              <button
                onClick={() => setLang(lang === "de" ? "en" : "de")}
                title={lang === "de" ? "Switch to English" : "Auf Deutsch wechseln"}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition-colors"
              >
                <span>{lang === "de" ? "🇩🇪 DE" : "🇬🇧 EN"}</span>
              </button>

              <Link
                href="/calendar"
                title={lang === "de" ? "Klausuren-Kalender öffnen" : "Open Exam Calendar"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <span>📅</span> {t.calendar}
              </Link>
              <button
                onClick={toggleDarkMode}
                title={darkMode ? (lang === "de" ? "Hellmodus aktivieren" : "Light mode") : (lang === "de" ? "Dunkelmodus aktivieren" : "Dark mode")}
                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                title={t.settings}
                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* User Account / Login Pill */}
              {currentUser ? (
                <div className="flex items-center gap-1 pl-1">
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                    title={currentUser.email}
                  >
                    <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
                      {(currentUser.name?.[0] || currentUser.email?.[0] || "U").toUpperCase()}
                    </div>
                    <span className="max-w-[90px] truncate">{currentUser.name || currentUser.email.split("@")[0]}</span>
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20 transition-all hover:scale-[1.02]"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{lang === "de" ? "Anmelden" : "Sign In"}</span>
                </button>
              )}
            </div>
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

              {/* AI Engine & API Key */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  {t.settingsAiModeLabel}
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="provider"
                      value="local"
                      checked={aiProvider === "local"}
                      onChange={(e) => setAiProvider(e.target.value)}
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
                      onChange={(e) => setAiProvider(e.target.value)}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        OpenAI (gpt-4o) Cloud
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
                      onChange={(e) => setAiProvider(e.target.value)}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Anthropic (claude-3-5-sonnet) Cloud
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {t.settingsAnthropicDesc}
                      </p>
                    </div>
                  </label>
                </div>

                {aiProvider !== "local" && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5" /> {t.settingsApiKeyLabel} {aiProvider.toUpperCase()}
                    </label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      {t.settingsApiKeyHint}
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
    </header>
  );
}
