"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to client console for debugging
    console.error("StudyHub Global Error Boundary caught exception:", error);
  }, [error]);

  const handleClearCacheAndReload = () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.clear();
        // Do not delete critical keys, but allow a hard reload
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200/90 dark:border-slate-800 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center shadow-inner">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Unerwarteter Anzeigefehler
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Ein unerwarteter Client-Fehler ist aufgetreten. Deine Daten sind auf dem Server sicher gespeichert.
          </p>
          {error?.message && (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 font-mono text-[11px] text-slate-700 dark:text-slate-300 text-left overflow-x-auto break-all border border-slate-200 dark:border-slate-700">
              {error.message}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Erneut versuchen
          </button>

          <Link
            href="/"
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all border border-slate-200/80 dark:border-slate-700"
          >
            <Home className="w-3.5 h-3.5" /> Zur Startseite
          </Link>
        </div>

        <button
          onClick={handleClearCacheAndReload}
          className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline transition-colors"
        >
          Seite komplett neu laden
        </button>
      </div>
    </div>
  );
}
