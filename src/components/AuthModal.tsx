"use client";

import React, { useState } from "react";
import { User, LogIn, UserPlus, KeyRound, Mail, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { Portal } from "./Portal";
import { useLanguage } from "@/lib/i18n";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
  onLogout?: () => void;
  onSuccess: (user: any) => void;
}

export function AuthModal({ isOpen, onClose, currentUser, onLogout, onSuccess }: AuthModalProps) {
  const { lang, t } = useLanguage();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSwitchAccount, setShowSwitchAccount] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload: any = { email, password };
      if (mode === "register") payload.name = name;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (lang === "de" ? "Fehler bei der Authentifizierung" : "Authentication failed"));
      }

      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || (lang === "de" ? "Ein Fehler ist aufgetreten" : "An error occurred"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data.user);
        onClose();
      } else {
        setError(data.error || "Demo login failed");
      }
    } catch (e: any) {
      setError("Demo login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentUser && !showSwitchAccount) {
    return (
      <Portal>
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-sm font-black shadow-md shadow-indigo-500/20">
                  {(currentUser.name?.[0] || currentUser.email?.[0] || "U").toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {lang === "de" ? "Dein Account" : "Your Account"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {lang === "de" ? "StudyHub Profil & Synchronisation" : "StudyHub Profile & Sync"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Name</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {currentUser.name || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">E-Mail</span>
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                    {currentUser.email}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Status</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {lang === "de" ? "Angemeldet & synchronisiert" : "Active & Synced"}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center leading-relaxed">
                {lang === "de"
                  ? "Alle deine Semester, Noten, Dokumente und Spaced-Repetition-Fortschritte sind mit diesem Konto verknüpft."
                  : "All your semesters, grades, documents, and spaced repetition progress are linked to this account."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSwitchAccount(true)}
                className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {lang === "de" ? "Anderes Konto?" : "Switch Account"}
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-colors"
                  >
                    {lang === "de" ? "Abmelden" : "Sign Out"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  {lang === "de" ? "Fertig" : "Done"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {mode === "login"
                    ? (lang === "de" ? "Bei StudyHub anmelden" : "Sign in to StudyHub")
                    : (lang === "de" ? "Konto erstellen" : "Create Account")}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === "de"
                    ? "Sichere deine Fächer, Noten und Altklausuren geräteübergreifend."
                    : "Save and sync your courses, grades, and past exams across devices."}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mt-4">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                mode === "login"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {lang === "de" ? "Anmelden" : "Sign In"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                mode === "register"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {lang === "de" ? "Registrieren" : "Register"}
            </button>
          </div>

          {/* 1-Click Demo Login Banner */}
          <div className="mt-4 p-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-sky-50 dark:from-indigo-950/40 dark:to-sky-950/40 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                {lang === "de" ? "Schnelltest ohne Passwort?" : "Quick Test without Password?"}
              </span>
              <span className="text-[11px] text-slate-500 block">
                {lang === "de" ? "Mit 1 Klick als Demo-Student einloggen." : "Instant 1-click test student login."}
              </span>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 shadow-sm hover:bg-indigo-50 transition-colors whitespace-nowrap"
            >
              {lang === "de" ? "Demo-Login →" : "Demo Login →"}
            </button>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 mt-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "de" ? "Vollständiger Name (optional)" : "Full Name (optional)"}
                </label>
                <input
                  type="text"
                  placeholder={lang === "de" ? "z. B. Max Mustermann" : "e.g. Alex Morgan"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === "de" ? "E-Mail-Adresse *" : "Email Address *"}
              </label>
              <input
                type="email"
                required
                placeholder={lang === "de" ? "student@uni.de" : "student@university.edu"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === "de" ? "Passwort *" : "Password *"}
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                {mode === "login" ? <LogIn className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                {isSubmitting
                  ? (lang === "de" ? "Wird verarbeitet..." : "Processing...")
                  : mode === "login"
                  ? (lang === "de" ? "Jetzt anmelden" : "Sign In Now")
                  : (lang === "de" ? "Konto anlegen" : "Register Now")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
