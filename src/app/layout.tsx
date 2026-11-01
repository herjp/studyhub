import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "StudyHub – Intelligenter Studien- & Klausurmanager",
  description:
    "Semesterplaner, RAG-Altklausuren, ECTS- & GPA-Tracker sowie adaptiver KI-Klausurtrainer mit Klausur-Readiness-Score und Spaced Repetition.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StudyHub",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="font-sans antialiased bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
