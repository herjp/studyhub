"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  LogIn,
  UserPlus,
  KeyRound,
  Mail,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  RotateCw,
  Lock,
  Camera,
  UploadCloud,
} from "lucide-react";
import { Portal } from "./Portal";
import { useLanguage } from "@/lib/i18n";

const PRESET_AVATARS = [
  { id: "grad", emoji: "🎓", name: "Academic Cap", url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="%234F46E5"/><text x="50%" y="54%" font-size="40" dominant-baseline="middle" text-anchor="middle">🎓</text></svg>` },
  { id: "owl", emoji: "🦉", name: "Wise Owl", url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="%230EA5E9"/><text x="50%" y="54%" font-size="40" dominant-baseline="middle" text-anchor="middle">🦉</text></svg>` },
  { id: "rocket", emoji: "🚀", name: "High Achiever", url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="%23E11D48"/><text x="50%" y="54%" font-size="40" dominant-baseline="middle" text-anchor="middle">🚀</text></svg>` },
  { id: "coder", emoji: "💻", name: "Tech / Coder", url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="%23059669"/><text x="50%" y="54%" font-size="40" dominant-baseline="middle" text-anchor="middle">💻</text></svg>` },
  { id: "science", emoji: "🔬", name: "Scientist", url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="%237C3AED"/><text x="50%" y="54%" font-size="40" dominant-baseline="middle" text-anchor="middle">🔬</text></svg>` },
  { id: "coffee", emoji: "☕", name: "Coffee Learner", url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="%23D97706"/><text x="50%" y="54%" font-size="40" dominant-baseline="middle" text-anchor="middle">☕</text></svg>` },
];

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
  onLogout?: () => void;
  onSuccess: (user: any) => void;
}

export function AuthModal({
  isOpen,
  onClose,
  currentUser,
  onLogout,
  onSuccess,
}: AuthModalProps) {
  const { lang, t } = useLanguage();

  // Modal modes: "login" | "register" | "two_factor" | "forgot_request" | "forgot_reset"
  const [mode, setMode] = useState<
    "login" | "register" | "two_factor" | "forgot_request" | "forgot_reset"
  >("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSwitchAccount, setShowSwitchAccount] = useState(false);

  // 2FA state for profile toggle
  const [twoFactorActive, setTwoFactorActive] = useState<boolean>(false);
  const [isToggling2FA, setIsToggling2FA] = useState(false);

  // Profile picture & avatar state
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser?.avatarUrl || "");
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarSavedToast, setAvatarSavedToast] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser?.avatarUrl !== undefined) {
      setAvatarUrl(currentUser.avatarUrl || "");
    }
  }, [currentUser]);

  const updateProfileAvatar = async (newUrl: string) => {
    setAvatarUrl(newUrl);
    setIsSavingAvatar(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: newUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setAvatarSavedToast(true);
        setTimeout(() => setAvatarSavedToast(false), 2500);
        onSuccess(data.user);
      }
    } catch (e) {
      console.error("Failed to update avatar:", e);
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 160;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          updateProfileAvatar(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (currentUser) {
      setTwoFactorActive(Boolean(currentUser.twoFactorEnabled));
    }
  }, [currentUser]);

  if (!isOpen) return null;

  // Handle standard Login & Register
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setDevCode(null);
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
        throw new Error(
          data.error ||
            (lang === "de" ? "Fehler bei der Authentifizierung" : "Authentication failed")
        );
      }

      // Check if 2FA is required during login
      if (data.requires2FA) {
        setDevCode(data.devCode || null);
        setMode("two_factor");
        setInfoMessage(
          lang === "de"
            ? "Ein 6-stelliger 2FA-Bestätigungscode wurde an deine E-Mail gesendet."
            : "A 6-digit 2FA confirmation code was sent to your email."
        );
        return;
      }

      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || (lang === "de" ? "Ein Fehler ist aufgetreten" : "An error occurred"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle 2FA verification code submission
  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          email,
          code: twoFactorCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ungültiger Code");
      }

      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || "2FA-Prüfung fehlgeschlagen");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend 2FA code
  const handleResend2FA = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", email }),
      });
      const data = await res.json();
      if (res.ok) {
        setDevCode(data.devCode || null);
        setInfoMessage(lang === "de" ? "Neuer Code generiert!" : "New code generated!");
      }
    } catch (e) {
      setError("Fehler beim erneuten Senden");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Forgot Password - Request code
  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler beim Anfordern des Codes");

      setDevCode(data.devCode || null);
      setMode("forgot_reset");
      setInfoMessage(
        lang === "de"
          ? "Ein 6-stelliger Wiederherstellungscode wurde generiert. Bitte trage ihn zusammen mit deinem neuen Passwort ein."
          : "A 6-digit recovery code has been generated. Please enter it with your new password."
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Forgot Password - Reset password
  const handleForgotPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          email,
          code: resetCode,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler beim Zurücksetzen");

      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle 2FA in profile
  const handleToggle2FA = async () => {
    setIsToggling2FA(true);
    try {
      const nextState = !twoFactorActive;
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", enable: nextState }),
      });
      if (res.ok) {
        setTwoFactorActive(nextState);
      }
    } catch (e) {
      console.error("Failed to toggle 2FA:", e);
    } finally {
      setIsToggling2FA(false);
    }
  };

  // 1-Click Demo Login
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

  // Profile View (when logged in)
  if (currentUser && !showSwitchAccount) {
    return (
      <Portal>
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="relative group flex-shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-indigo-200 dark:border-indigo-800 shadow-md shadow-indigo-500/10"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg font-black shadow-md shadow-indigo-500/20">
                      {(currentUser.name?.[0] || currentUser.email?.[0] || "U").toUpperCase()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title={lang === "de" ? "Eigenes Foto hochladen" : "Upload your photo"}
                    className="absolute -bottom-1 -right-1 p-1 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 text-indigo-600 shadow-sm hover:scale-110 transition-transform"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {lang === "de" ? "Dein Account" : "Your Account"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {lang === "de" ? "StudyHub Profil & Sicherheit" : "StudyHub Profile & Security"}
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
              {/* Avatar Presets & Custom Upload */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    {lang === "de" ? "Profilbild & Avatar:" : "Profile Picture & Avatar:"}
                  </span>
                  {avatarSavedToast ? (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {lang === "de" ? "Gespeichert!" : "Saved!"}
                    </span>
                  ) : avatarUrl ? (
                    <button
                      type="button"
                      onClick={() => updateProfileAvatar("")}
                      className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      {lang === "de" ? "Entfernen" : "Remove"}
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_AVATARS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => updateProfileAvatar(preset.url)}
                      disabled={isSavingAvatar}
                      title={preset.name}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-base border-2 transition-all hover:scale-105 ${
                        avatarUrl === preset.url
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/80 shadow-sm"
                          : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:border-indigo-300"
                      }`}
                    >
                      <span>{preset.emoji}</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSavingAvatar}
                    title={lang === "de" ? "Foto vom Computer hochladen" : "Upload photo from computer"}
                    className="h-9 px-2.5 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-600 dark:hover:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 transition-all hover:scale-105"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{lang === "de" ? "Foto hochladen" : "Upload"}</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Name</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {currentUser.name || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">E-Mail</span>
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
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

              {/* 2FA Toggle Switch in Profile */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    2-Faktor-Authentifizierung (2FA)
                  </span>
                  <span className="text-[11px] text-slate-500 block leading-tight">
                    {lang === "de"
                      ? "Schützt dein Konto zusätzlich mit einem 6-stelligen E-Mail-Code beim Login."
                      : "Protects your account with a 6-digit email confirmation code upon login."}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isToggling2FA}
                  onClick={handleToggle2FA}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    twoFactorActive ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      twoFactorActive ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
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
                {mode === "two_factor" ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : mode.startsWith("forgot") ? (
                  <KeyRound className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {mode === "login"
                    ? (lang === "de" ? "Bei StudyHub anmelden" : "Sign in to StudyHub")
                    : mode === "register"
                    ? (lang === "de" ? "Konto erstellen" : "Create Account")
                    : mode === "two_factor"
                    ? "2-Faktor-Authentifizierung (2FA)"
                    : (lang === "de" ? "Passwort zurücksetzen" : "Reset Password")}
                </h3>
                <p className="text-xs text-slate-500">
                  {mode === "two_factor"
                    ? (lang === "de" ? "Bestätige deine Anmeldung mit dem 6-stelligen E-Mail-Code." : "Confirm your sign-in with your 6-digit email code.")
                    : mode.startsWith("forgot")
                    ? (lang === "de" ? "Erhalte einen Code zur Wiederherstellung deines Kontos." : "Receive a code to restore access to your account.")
                    : (lang === "de" ? "Sichere deine Fächer, Noten und Termine in der Cloud." : "Save and sync your courses and exams safely in the cloud.")}
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

          {/* Mode Switcher Tabs (only for login & register) */}
          {(mode === "login" || mode === "register") && (
            <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mt-4">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setInfoMessage(null);
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
                  setInfoMessage(null);
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
          )}

          {/* 1-Click Demo Login Banner (for login/register) */}
          {(mode === "login" || mode === "register") && (
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
          )}

          {/* Dev/Demo Code Badge (instant 1-click copy/fill) */}
          {devCode && (
            <div className="mt-3 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-2">
              <div className="text-xs text-indigo-950 dark:text-indigo-200 font-medium">
                <span className="font-bold">E-Mail-Code: </span>
                <span className="font-mono text-sm tracking-wider font-black text-indigo-600 dark:text-indigo-400">
                  {devCode}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (mode === "two_factor") setTwoFactorCode(devCode);
                  if (mode === "forgot_reset") setResetCode(devCode);
                }}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                {lang === "de" ? "Einfügen" : "Fill"}
              </button>
            </div>
          )}

          {infoMessage && (
            <div className="mt-3 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-300 font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 flex-shrink-0 text-sky-600" />
              <span>{infoMessage}</span>
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* --- CASE 1: LOGIN & REGISTER FORMS --- */}
          {(mode === "login" || mode === "register") && (
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {lang === "de" ? "Passwort *" : "Password *"}
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot_request");
                        setError(null);
                        setInfoMessage(null);
                      }}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {lang === "de" ? "Passwort vergessen?" : "Forgot password?"}
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50"
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
          )}

          {/* --- CASE 2: TWO FACTOR AUTH (2FA) INPUT --- */}
          {mode === "two_factor" && (
            <form onSubmit={handleVerify2FA} className="space-y-4 mt-4">
              <div className="text-center space-y-2 py-1">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === "de" ? "6-stelligen Code eingeben" : "Enter 6-digit code"}
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {lang === "de"
                    ? `Wir haben einen Bestätigungscode an ${email} gesendet.`
                    : `We sent a confirmation code to ${email}.`}
                </p>
              </div>

              <div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  placeholder="123456"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full text-center tracking-[0.4em] font-mono text-xl font-black py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={handleResend2FA}
                  disabled={isSubmitting}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <RotateCw className="w-3 h-3" />
                  {lang === "de" ? "Code erneut senden" : "Resend code"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {lang === "de" ? "Zurück zum Login" : "Back to login"}
                </button>
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
                  disabled={isSubmitting || twoFactorCode.length < 6}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {isSubmitting
                    ? (lang === "de" ? "Wird geprüft..." : "Verifying...")
                    : (lang === "de" ? "Bestätigen & Anmelden" : "Confirm & Sign In")}
                </button>
              </div>
            </form>
          )}

          {/* --- CASE 3: FORGOT PASSWORD - STEP 1 (REQUEST CODE) --- */}
          {mode === "forgot_request" && (
            <form onSubmit={handleForgotPasswordRequest} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "de" ? "Deine E-Mail-Adresse" : "Your email address"}
                </label>
                <input
                  type="email"
                  required
                  placeholder="student@uni.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  {lang === "de" ? "Zurück zum Login" : "Back to login"}
                </button>
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
                  disabled={isSubmitting || !email}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {isSubmitting
                    ? (lang === "de" ? "Code wird gesendet..." : "Sending...")
                    : (lang === "de" ? "Wiederherstellungscode anfordern" : "Request Reset Code")}
                </button>
              </div>
            </form>
          )}

          {/* --- CASE 4: FORGOT PASSWORD - STEP 2 (RESET PASSWORD) --- */}
          {mode === "forgot_reset" && (
            <form onSubmit={handleForgotPasswordReset} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "de" ? "6-stelliger Wiederherstellungscode *" : "6-Digit Recovery Code *"}
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full text-center tracking-widest font-mono text-base font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "de" ? "Neues Passwort festlegen *" : "New Password *"}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Mindestens 6 Zeichen"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  {lang === "de" ? "Zurück zum Login" : "Back to login"}
                </button>
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
                  disabled={isSubmitting || resetCode.length < 6 || newPassword.length < 6}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {isSubmitting
                    ? (lang === "de" ? "Wird gespeichert..." : "Saving...")
                    : (lang === "de" ? "Passwort ändern & Anmelden" : "Reset & Sign In")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Portal>
  );
}
