"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  BookOpen,
  Award,
  Layers,
  GraduationCap,
  Clock,
  Trash2,
  Eye,
  FileCheck,
  Flame,
  PlusCircle,
  HelpCircle,
  TrendingDown,
  Check,
  Edit2,
  MapPin,
  UploadCloud,
  Gauge,
  Search,
  AlertCircle,
} from "lucide-react";
import { HeaderDashboard } from "@/components/HeaderDashboard";
import { FahrschulBar } from "@/components/FahrschulBar";
import { CircularProgress } from "@/components/CircularProgress";
import { ExamSessionModal, QuizQuestion } from "@/components/ExamSessionModal";
import { TopicSummaryModal } from "@/components/TopicSummaryModal";
import { EditModuleDialog } from "@/components/EditModuleDialog";
import { EditQuestionDialog } from "@/components/EditQuestionDialog";
import { Portal } from "@/components/Portal";
import { formatGrade, formatEcts } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

function ModuleDetailContent() {
  const { lang, t } = useLanguage();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const moduleId = params.id as string;

  const initialTab = searchParams.get("tab") || "documents";
  const [activeTab, setActiveTab] = useState<"documents" | "trainer" | "grade">(
    initialTab as any
  );

  const [moduleData, setModuleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Document upload state
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("LECTURE_SLIDES");
  const [isPastExam, setIsPastExam] = useState(false);
  const [docText, setDocText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [uploadedFile, setUploadedFile] = useState<{
    file: File;
    name: string;
    sizeStr: string;
    base64: string;
    mimeType: string;
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Session Question Count (default from localStorage or 5)
  const [sessionQuestionCount, setSessionQuestionCount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("studyhub_session_size");
      return stored ? Number(stored) : 5;
    }
    return 5;
  });

  const handleFileSelected = (file: File) => {
    if (!docTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setDocTitle(cleanName);
    }

    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const sizeStr = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${Math.round(file.size / 1024)} KB`;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setUploadedFile({
        file,
        name: file.name,
        sizeStr,
        base64,
        mimeType: file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
      });
    };
    reader.readAsDataURL(file);
  };

  // Trainer & Quiz Modal States
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizModeName, setQuizModeName] = useState("");
  const [isQuizOpen, setIsQuizOpen] = useState(false);

  // Topic Summary Modal State
  const [activeSummaryTopic, setActiveSummaryTopic] = useState<{ id: string; name: string } | null>(
    null
  );

  // Grade & Completion State
  const [gradeInput, setGradeInput] = useState("");
  const [isCompletedCheck, setIsCompletedCheck] = useState(false);
  const [isSavingGrade, setIsSavingGrade] = useState(false);
  const [gradeSavedToast, setGradeSavedToast] = useState(false);

  // Edit Exam Details & Description State
  const [isEditExamModalOpen, setIsEditExamModalOpen] = useState(false);
  const [isEditModuleOpen, setIsEditModuleOpen] = useState(false);
  const [examDescInput, setExamDescInput] = useState("");
  const [examDateInput, setExamDateInput] = useState("");
  const [examTimeInput, setExamTimeInput] = useState("");
  const [examLocationInput, setExamLocationInput] = useState("");
  const [isSavingExamDetails, setIsSavingExamDetails] = useState(false);

  const fetchModule = async () => {
    try {
      const res = await fetch(`/api/modules/${moduleId}`);
      if (res.ok) {
        const data = await res.json();
        setModuleData(data);
        setIsCompletedCheck(data.status === "COMPLETED");
        if (data.grade) setGradeInput(data.grade.toString());
      }
    } catch (err) {
      console.error("Error fetching module:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExamDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingExamDetails(true);
    try {
      const res = await fetch("/api/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: moduleId,
          examDate: examDateInput ? new Date(examDateInput) : null,
          examTime: examTimeInput.trim() || null,
          examLocation: examLocationInput.trim() || null,
          examDescription: examDescInput.trim() || null,
        }),
      });
      if (res.ok) {
        setIsEditExamModalOpen(false);
        fetchModule();
      }
    } catch (err) {
      console.error("Error updating exam details:", err);
    } finally {
      setIsSavingExamDetails(false);
    }
  };

  useEffect(() => {
    fetchModule();
  }, [moduleId]);

  // Handle Document Upload
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) return;

    setIsUploading(true);
    try {
      const storedProvider = typeof window !== "undefined" ? localStorage.getItem("studyhub_ai_provider") || "gemini" : "gemini";
      const storedKey = typeof window !== "undefined" 
        ? (localStorage.getItem(`studyhub_api_key_${storedProvider}`) || localStorage.getItem("studyhub_api_key") || undefined) 
        : undefined;

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          title: docTitle.trim(),
          category: isPastExam ? "EXAM_PAST" : docCategory,
          isPastExam,
          fileName: uploadedFile?.name,
          fileBase64: uploadedFile?.base64,
          mimeType: uploadedFile?.mimeType,
          textContent: docText.trim() || undefined,
          apiKey: storedKey,
          provider: storedProvider,
        }),
      });

      if (res.ok) {
        setDocTitle("");
        setDocText("");
        setUploadedFile(null);
        setIsPastExam(false);
        fetchModule();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Dokument wirklich löschen?")) return;
    try {
      await fetch(`/api/documents?id=${docId}`, { method: "DELETE" });
      fetchModule();
    } catch (err) {
      console.error(err);
    }
  };

  // Launch Training Sessions
  const startTraining = (mode: "ALL" | "SC" | "MC" | "FREE_TEXT" | "DUE" | "SIMULATION") => {
    if (!moduleData?.questions?.length) {
      alert("Es sind noch keine Fragen für dieses Modul hinterlegt!");
      return;
    }

    let filtered = [...moduleData.questions];
    let modeLabel = "Klausurtraining";

    if (mode === "DUE") {
      filtered = moduleData.dueQuestions?.length > 0 ? moduleData.dueQuestions : filtered;
      modeLabel = "Wiederholung fälliger Fragen (Spaced Repetition)";
    } else if (mode === "SC") {
      filtered = filtered.filter((q) => q.type === "SINGLE_CHOICE");
      modeLabel = "Single Choice Training";
    } else if (mode === "MC") {
      filtered = filtered.filter((q) => q.type === "MULTIPLE_CHOICE");
      modeLabel = "Multiple Choice Training";
    } else if (mode === "FREE_TEXT") {
      filtered = filtered.filter((q) => q.type === "FREE_TEXT");
      modeLabel = "Freitext-Klausurtraining mit KI-Korrektur";
    } else if (mode === "SIMULATION") {
      modeLabel = "Klausursimulation (Realistischer Mix)";
      filtered = [...filtered].sort(() => Math.random() - 0.5);
    }

    if (filtered.length === 0) {
      alert(`Keine Fragen vom Typ ${mode} vorhanden.`);
      return;
    }

    // Apply chosen session question count (e.g. 5, 10, 15, 20 or all)
    if (sessionQuestionCount > 0 && filtered.length > sessionQuestionCount) {
      filtered = [...filtered].sort(() => Math.random() - 0.5).slice(0, sessionQuestionCount);
    }

    setQuizQuestions(filtered);
    setQuizModeName(`${modeLabel} (${filtered.length} ${filtered.length === 1 ? "Frage" : "Fragen"})`);
    setIsQuizOpen(true);
  };

  // AI Question Generation State
  const [isGeneratingAiQuestions, setIsGeneratingAiQuestions] = useState(false);
  const [aiSuccessToast, setAiSuccessToast] = useState<string | null>(null);
  const [aiErrorToast, setAiErrorToast] = useState<string | null>(null);

  // Question Management State
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionTypeFilter, setQuestionTypeFilter] = useState<"ALL" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "FREE_TEXT">("ALL");
  const [isDeletingQuestionId, setIsDeletingQuestionId] = useState<string | null>(null);

  const filteredManageQuestions = (moduleData?.questions || []).filter((q: any) => {
    if (questionTypeFilter !== "ALL" && q.type !== questionTypeFilter) {
      return false;
    }
    if (questionSearch.trim()) {
      const s = questionSearch.toLowerCase();
      const matchText = (q.questionText || "").toLowerCase().includes(s);
      const matchRef = (q.sourceRef || "").toLowerCase().includes(s);
      const matchSample = (q.sampleSolution || "").toLowerCase().includes(s);
      return matchText || matchRef || matchSample;
    }
    return true;
  });

  // Generate Questions via Gemini / OpenAI / Anthropic
  const handleGenerateAiQuestions = async (topicId?: string) => {
    // Check if module has uploaded documents
    if (!moduleData?.documents || moduleData.documents.length === 0) {
      setAiErrorToast(
        lang === "de"
          ? "Bitte lade zuerst im Reiter 'Vorlesungsmaterialien & Unterlagen' deine Folien (PDF/Bilder) hoch. Fragen werden ausschließlich auf Basis deiner hochgeladenen Dokumente erstellt!"
          : "Please upload lecture slides (PDF/images) in 'Lecture Materials' first. Questions are generated strictly from your uploaded documents!"
      );
      setActiveTab("documents");
      setTimeout(() => setAiErrorToast(null), 8000);
      return;
    }

    setIsGeneratingAiQuestions(true);
    setAiSuccessToast(null);
    setAiErrorToast(null);

    try {
      const storedProvider = typeof window !== "undefined" ? localStorage.getItem("studyhub_ai_provider") || "gemini" : "gemini";
      const storedKey = typeof window !== "undefined" 
        ? (localStorage.getItem(`studyhub_api_key_${storedProvider}`) || localStorage.getItem("studyhub_api_key") || undefined) 
        : undefined;

      const res = await fetch("/api/trainer/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          topicId,
          count: 5,
          apiKey: storedKey,
          provider: storedProvider,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setAiSuccessToast(
          lang === "de"
            ? `${data.count || 5} neue Klausurfragen erfolgreich aus deinen Vorlesungsunterlagen generiert und gespeichert!`
            : `${data.count || 5} new exam questions successfully generated from your documents!`
        );
        setTimeout(() => setAiSuccessToast(null), 5000);
        fetchModule();
      } else {
        setAiErrorToast(data.error || "Fehler beim Generieren der Fragen.");
        setTimeout(() => setAiErrorToast(null), 8000);
      }
    } catch (err: any) {
      console.error(err);
      setAiErrorToast(err.message || "Netzwerkfehler beim Generieren.");
      setTimeout(() => setAiErrorToast(null), 8000);
    } finally {
      setIsGeneratingAiQuestions(false);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm(lang === "de" ? "Möchtest du diese Prüfungsfrage wirklich unwiderruflich löschen?" : "Are you sure you want to delete this question?")) {
      return;
    }
    setIsDeletingQuestionId(qId);
    try {
      const res = await fetch(`/api/trainer/questions?id=${qId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchModule();
      } else {
        const data = await res.json();
        alert(data.error || "Löschen fehlgeschlagen.");
      }
    } catch (e: any) {
      alert(e.message || "Fehler beim Löschen.");
    } finally {
      setIsDeletingQuestionId(null);
    }
  };

  // Start Targeted Gap Training ("Lücke schließen" with 5 questions)
  const handleStartGapTraining = async (topicId: string) => {
    try {
      const storedProvider = typeof window !== "undefined" ? localStorage.getItem("studyhub_ai_provider") || "gemini" : "gemini";
      const storedKey = typeof window !== "undefined" 
        ? (localStorage.getItem(`studyhub_api_key_${storedProvider}`) || localStorage.getItem("studyhub_api_key") || undefined) 
        : undefined;

      const res = await fetch("/api/trainer/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          topicId,
          count: 5,
          apiKey: storedKey,
          provider: storedProvider,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setQuizQuestions(data.questions);
        setQuizModeName("Fokustraining: Lücke schließen (5 Fragen)");
        setIsQuizOpen(true);
        fetchModule();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Grade & Completion
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGrade(true);
    setGradeSavedToast(false);

    try {
      const parsedGrade = gradeInput.trim() ? parseFloat(gradeInput.replace(",", ".")) : null;
      const status = isCompletedCheck ? "COMPLETED" : "IN_PROGRESS";

      const res = await fetch("/api/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: moduleId,
          grade: parsedGrade,
          status,
        }),
      });

      if (res.ok) {
        setGradeSavedToast(true);
        fetchModule();
        setTimeout(() => setGradeSavedToast(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingGrade(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <HeaderDashboard />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!moduleData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <HeaderDashboard />
        <div className="max-w-4xl mx-auto p-8 text-center">
          <h2 className="text-xl font-bold">Modul nicht gefunden.</h2>
          <Link href="/" className="text-indigo-600 font-semibold underline mt-4 inline-block">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  const daysLeft = moduleData.daysUntilExam;
  const readiness = moduleData.readinessScore ?? 0;
  const dailyGoal = moduleData.dailyGoal ?? 3;
  const answeredToday = moduleData.answeredToday ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-16">
      <HeaderDashboard onStatsUpdated={fetchModule} />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 w-full flex-1">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link
            href="/"
            className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Semesterübersicht
          </Link>
          <span>/</span>
          <span className="text-slate-400">{moduleData.semester?.name}</span>
          <span>/</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{moduleData.name}</span>
        </div>

        {/* Module Banner Header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 md:p-8 shadow-sm mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {moduleData.code && (
                  <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {moduleData.code}
                  </span>
                )}
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {formatEcts(moduleData.ects)} ECTS Punkte
                </span>
                {moduleData.status === "COMPLETED" && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Bestanden
                    {moduleData.grade && ` (Note ${formatGrade(moduleData.grade)})`}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditModuleOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  title={lang === "de" ? "Moduldetails bearbeiten oder Modul löschen" : "Edit details or delete course"}
                >
                  <Edit2 className="w-3 h-3 text-indigo-500" />
                  {lang === "de" ? "Modul bearbeiten" : "Edit Course"}
                </button>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {moduleData.name}
              </h1>

              {/* Countdown badge & info */}
              <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                {daysLeft !== null && daysLeft !== undefined ? (
                  <span className="inline-flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-xl">
                    <Calendar className="w-3.5 h-3.5" />
                    Klausur in {daysLeft} Tagen (
                    {new Date(moduleData.examDate).toLocaleDateString("de-DE")})
                  </span>
                ) : (
                  <span className="text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Kein Prüfungstermin gesetzt
                  </span>
                )}
                <span>•</span>
                <span>{moduleData.questions?.length ?? 0} Prüfungsfragen</span>
                <span>•</span>
                <span>{moduleData.documents?.length ?? 0} Dokumente</span>
              </div>
            </div>

            {/* Header Mini Dashboard with Fahrschul-Balken & Daily Goal */}
            <div className="lg:w-80 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-3">
              <FahrschulBar score={readiness} size="md" />

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <CircularProgress
                  value={answeredToday}
                  max={dailyGoal}
                  size={50}
                  strokeWidth={5}
                  label={`Tagesziel: ${dailyGoal} Fragen`}
                  sublabel={
                    answeredToday >= dailyGoal
                      ? "Ziel heute erreicht! 🎯"
                      : `Noch ${Math.max(0, dailyGoal - answeredToday)} Fragen`
                  }
                />
              </div>
            </div>
          </div>

          {/* Klausuraufbau & Dozentenhinweise Section */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    Klausuraufbau &amp; Dozentenhinweise:
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    <Sparkles className="w-2.5 h-2.5" /> Steuert KI-Simulation
                  </span>
                </div>

                {moduleData.examDescription ? (
                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 leading-relaxed whitespace-pre-line">
                    {moduleData.examDescription}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    Noch kein Klausuraufbau hinterlegt (z. B. "90 Min, 30% Multiple Choice, 70% Freitext. Dozent legt großen Wert auf CQRS. 1 beidseitiges DIN-A4-Blatt erlaubt"). Klicke auf "Hinweise bearbeiten".
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-slate-500 pt-0.5 flex-wrap">
                  {moduleData.examTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> Uhrzeit: {moduleData.examTime}
                    </span>
                  )}
                  {moduleData.examLocation && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> Raum/Ort: {moduleData.examLocation}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setExamDescInput(moduleData.examDescription || "");
                  setExamDateInput(moduleData.examDate ? moduleData.examDate.split("T")[0] : "");
                  setExamTimeInput(moduleData.examTime || "");
                  setExamLocationInput(moduleData.examLocation || "");
                  setIsEditExamModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors self-start"
              >
                <Edit2 className="w-3.5 h-3.5 text-indigo-500" /> Klausuraufbau bearbeiten
              </button>
            </div>
          </div>
        </div>

        {/* 3 Tabs Navigation (Tab 1 -> Tab 2 -> Tab 3) */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 mb-6">
          <button
            onClick={() => setActiveTab("documents")}
            className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "documents"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            {t.tab1Name}
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600">
              {moduleData.documents?.length ?? 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("trainer")}
            className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "trainer"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            {t.tab2Name}
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600">
              {moduleData.questions?.length ?? 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("grade")}
            className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "grade"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Award className="w-4 h-4" />
            {t.tab3Name}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: DOKUMENTEN- & ALTKLAUSUREN-HUB */}
        {/* ========================================================================= */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Document Upload Card */}
              <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t.uploadDocTitle}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  {lang === "de"
                    ? "Lade PDFs, Skripte oder Altklausuren hoch. Die RAG-Pipeline indiziert den Text automatisch für präzise Quellenzitate."
                    : "Upload lecture slides, notes or past exams. The RAG pipeline indexes the text automatically for precise citations."}
                </p>

                <form onSubmit={handleUploadDocument} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t.uploadDocNameLabel}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t.uploadDocNamePlaceholder}
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t.categoryLabel}
                    </label>
                    <select
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="LECTURE_SLIDES">{t.catSlides}</option>
                      <option value="EXAM_PAST">{t.pastExamBadge}</option>
                      <option value="EXERCISE">{t.catExercises}</option>
                      <option value="LITERATURE">{t.catLiterature}</option>
                    </select>
                  </div>

                  {/* Special Past Exam Checkbox */}
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="isPastExamCheck"
                      checked={isPastExam}
                      onChange={(e) => setIsPastExam(e.target.checked)}
                      className="rounded border-amber-400 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                    />
                    <label
                      htmlFor="isPastExamCheck"
                      className="text-xs text-amber-900 dark:text-amber-200 font-medium cursor-pointer"
                    >
                      <span className="font-bold block">{t.markAsPastExam}</span>
                      {t.pastExamHint}
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === "de" ? "Datei hochladen (PDF, PNG, JPEG)" : "Upload File (PDF, PNG, JPEG)"}
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleFileSelected(file);
                      }}
                      className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                        uploadedFile
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30"
                          : "border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelected(file);
                        }}
                        className="hidden"
                      />

                      {uploadedFile ? (
                        <div className="flex items-center justify-between gap-2 text-left">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                              <FileCheck className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {uploadedFile.name}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {uploadedFile.sizeStr} • {uploadedFile.mimeType.includes("pdf") ? "PDF Dokument" : "Folie / Bild"}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadedFile(null);
                            }}
                            className="text-xs font-bold text-slate-400 hover:text-rose-500 p-1"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div>
                          <UploadCloud className="w-6 h-6 text-indigo-500 mx-auto mb-1.5" />
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {lang === "de" ? "PDF oder Folien (PNG, JPG) ablegen" : "Drop PDF or slides here"}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {lang === "de" ? "Automatische Texterkennung & Indizierung durch KI" : "Auto text recognition & AI indexing"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === "de" ? "Zusätzliche Notizen oder Text (optional)" : "Additional Notes or Text (optional)"}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={t.docTextContentPlaceholder}
                      value={docText}
                      onChange={(e) => setDocText(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isUploading}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isUploading ? t.uploadingAndIndexing : t.uploadAndIndexBtn}
                  </button>
                </form>
              </div>

              {/* Documents List */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {t.storedDocsTitle} ({moduleData.documents?.length ?? 0})
                    </h3>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t.ragPipelineActive}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleGenerateAiQuestions()}
                    disabled={isGeneratingAiQuestions}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {isGeneratingAiQuestions
                      ? (lang === "de" ? "Generiere mit KI..." : "Generating with AI...")
                      : (lang === "de" ? "Mit KI Fragen generieren" : "Generate Questions with AI")}
                  </button>
                </div>

                {aiSuccessToast && (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{aiSuccessToast}</span>
                  </div>
                )}

                {aiErrorToast && (
                  <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{aiErrorToast}</span>
                  </div>
                )}

                {moduleData.documents?.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center">
                    <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">
                      {t.noDocsUploaded}
                    </p>
                  </div>
                ) : (
                  moduleData.documents?.map((doc: any) => {
                    const isExam = doc.category === "EXAM_PAST";
                    return (
                      <div
                        key={doc.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 shadow-sm hover:shadow transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isExam
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300"
                                : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400"
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                {doc.title}
                              </h4>
                              {isExam ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                  {t.pastExamBadge}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {doc.category === "LECTURE_SLIDES"
                                    ? (lang === "de" ? "Folien" : "Slides")
                                    : doc.category === "EXERCISE"
                                    ? (lang === "de" ? "Übung" : "Exercise")
                                    : (lang === "de" ? "Literatur" : "Literature")}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {t.indexedBadge}
                              </span>
                              <span>•</span>
                              <span>{new Date(doc.createdAt).toLocaleDateString(lang === "de" ? "de-DE" : "en-US")}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {doc.parsedText && (
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title={lang === "de" ? "Textauszug ansehen" : "Preview text"}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title={t.delete}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Document Preview Modal */}
            {previewDoc && (
              <Portal>
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {t.ragSnippetModalTitle} {previewDoc.title}
                      </h4>
                      <button
                        onClick={() => setPreviewDoc(null)}
                        className="text-slate-400 hover:text-slate-600 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                    <pre className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl whitespace-pre-line max-h-96 overflow-y-auto font-mono">
                      {previewDoc.parsedText}
                    </pre>
                  </div>
                </div>
              </Portal>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: KLAUSURTRAINER & SCHWACHSTELLEN-RADAR (HERZSTÜCK) */}
        {/* ========================================================================= */}
        {activeTab === "trainer" && (
          <div className="space-y-6">
            {/* Top Dashboard: Fahrschul-Prüfungsbalken & Countdown-Lernplan */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Fahrschul-Balken Card */}
              <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Prüfungsreife (Klausur-Readiness-Score)
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    Schwellenwert: 80% = Sicherer Klausurerfolg
                  </span>
                </div>

                <FahrschulBar score={readiness} size="lg" />

                <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                    <span>
                      {readiness >= 80
                        ? "Top Vorbereitung! Dein Spaced-Repetition-Score liegt im Zielbereich."
                        : readiness >= 50
                        ? "Gute Basis! Schließe noch die Wissenslücken in den 3 schwächsten Themen."
                        : "Klausurreife noch gering. Tägliches Fragenziel einhalten!"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Countdown-Lernplan Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-500" /> Countdown-Lernplan
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-tight mb-4">
                    Formel: (Verbleibende Wissensfragen) / (Tage bis Prüfung) = Tägliches Fragenziel
                  </p>
                </div>

                <div className="flex items-center justify-center py-2">
                  <CircularProgress
                    value={answeredToday}
                    max={dailyGoal}
                    size={80}
                    strokeWidth={8}
                    label={`Heute: ${answeredToday}/${dailyGoal} Fragen`}
                    sublabel={
                      answeredToday >= dailyGoal
                        ? "Tagesziel komplett! 🎉"
                        : `Noch ${Math.max(0, dailyGoal - answeredToday)} Fragen`
                    }
                  />
                </div>

                <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                  {daysLeft ? `Noch ${daysLeft} Tage bis zur Prüfung` : "Kein Termin definiert"}
                </div>
              </div>
            </div>

            {/* Spaced-Repetition Box */}
            <div className="rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-sky-900 text-white p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                    Spaced Repetition
                  </span>
                  <span className="text-xs text-indigo-200">
                    Wiedervorlage nach Vergessenskurve
                  </span>
                </div>
                <h3 className="text-lg font-bold">
                  {moduleData.dueQuestionsCount ?? 0} Fragen heute zur Wiederholung fällig
                </h3>
                <p className="text-xs text-indigo-200 max-w-xl">
                  Richtig beantwortete Fragen verlängern ihr Intervall (1d → 3d → 7d → 14d). Fehler
                  landen direkt morgen wieder auf dem Tisch.
                </p>
              </div>

              <button
                type="button"
                onClick={() => startTraining("DUE")}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold bg-white hover:bg-slate-100 text-indigo-900 shadow-lg hover:shadow-xl transition-all flex-shrink-0"
              >
                <RotateCcw className="w-4 h-4 text-indigo-600" />
                Heute fällige Fragen wiederholen
              </button>
            </div>

            {/* Sektion: "Hier solltest du dich vertiefen" (Schwachstellen-Radar) */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-rose-500" />
                    Hier solltest du dich vertiefen (Schwachstellen-Radar)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Die 3 Themengebiete mit der geringsten Klausurreife in diesem Fach.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {moduleData.weakestTopics?.map((topic: any) => {
                  const mastery = Math.round(topic.masteryScore);
                  return (
                    <div
                      key={topic.id}
                      className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="font-bold text-slate-900 dark:text-white line-clamp-1">
                            {topic.name}
                          </span>
                          <span
                            className={`font-black px-2 py-0.5 rounded-full text-[11px] ${
                              mastery < 50
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {mastery}% Reife
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              mastery < 50 ? "bg-rose-500" : "bg-amber-500"
                            }`}
                            style={{ width: `${Math.max(5, mastery)}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setActiveSummaryTopic({ id: topic.id, name: topic.name })}
                          className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                          Zusammenfassung generieren
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartGapTraining(topic.id)}
                          className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Lücke schließen (5 Fragen)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Training Starten & Fragentypen Launcher */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Training Starten (Modus wählen)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Wähle einen spezifischen Fragentyp oder starte eine realistische Klausursimulation.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerateAiQuestions()}
                  disabled={isGeneratingAiQuestions}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  {isGeneratingAiQuestions
                    ? (lang === "de" ? "Generiere Fragen mit KI..." : "Generating with AI...")
                    : (lang === "de" ? "Mit KI neue Fragen generieren" : "Generate Questions with AI")}
                </button>
              </div>

              {aiSuccessToast && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{aiSuccessToast}</span>
                </div>
              )}

              {aiErrorToast && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{aiErrorToast}</span>
                </div>
              )}

              {/* Session Question Count Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-indigo-500" />
                    {lang === "de" ? "Fragen pro Trainingsrunde (Session-Länge):" : "Questions per Training Session:"}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {lang === "de"
                      ? `Ausgewählt: ${sessionQuestionCount > 0 ? `${sessionQuestionCount} Fragen` : "Alle Fragen"} pro Durchlauf`
                      : `Selected: ${sessionQuestionCount > 0 ? `${sessionQuestionCount} questions` : "All questions"} per round`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[5, 10, 15, 20].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => {
                        setSessionQuestionCount(count);
                        localStorage.setItem("studyhub_session_size", count.toString());
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        sessionQuestionCount === count
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                      }`}
                    >
                      {count} {lang === "de" ? "Fragen" : "Qs"}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setSessionQuestionCount(0);
                      localStorage.setItem("studyhub_session_size", "0");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      sessionQuestionCount === 0
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                    }`}
                  >
                    {lang === "de" ? `Alle (${moduleData.questions?.length ?? 0})` : `All (${moduleData.questions?.length ?? 0})`}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                {/* Single Choice */}
                <button
                  type="button"
                  onClick={() => startTraining("SC")}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white dark:bg-slate-800/60 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-left transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1">
                    Single Choice
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    1 richtige Antwort, sofortiges Feedback &amp; Begründung.
                  </p>
                </button>

                {/* Multiple Choice */}
                <button
                  type="button"
                  onClick={() => startTraining("MC")}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white dark:bg-slate-800/60 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-left transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1">
                    Multiple Choice
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    1 bis mehrere Optionen mit gerechter Teilpunktevergabe.
                  </p>
                </button>

                {/* Free Text */}
                <button
                  type="button"
                  onClick={() => startTraining("FREE_TEXT")}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white dark:bg-slate-800/60 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-left transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1">
                    Freitext mit KI-Korrektur
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Definitionen formulieren &amp; semantisches Folien-Feedback erhalten.
                  </p>
                </button>

                {/* Exam Simulation */}
                <button
                  type="button"
                  onClick={() => startTraining("SIMULATION")}
                  className="p-5 rounded-2xl border-2 border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700 text-left transition-all shadow-md group"
                >
                  <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold mb-1">Klausursimulation</h4>
                  <p className="text-[11px] text-indigo-100 leading-tight">
                    Realistischer Mix aus SC, MC &amp; Freitext mit Prüfungsbewertung.
                  </p>
                </button>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* PRÜFUNGSFRAGEN VERWALTEN (BEARBEITEN & LÖSCHEN) */}
            {/* ========================================================================= */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    {lang === "de" ? "Klausurfragen verwalten" : "Manage Exam Questions"}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                      {moduleData.questions?.length ?? 0}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {lang === "de"
                      ? "Hier kannst du alle generierten Klausurfragen ansehen, nach deinen Wünschen anpassen oder löschen."
                      : "Review, edit, or delete generated exam questions."}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={lang === "de" ? "Fragen durchsuchen..." : "Search questions..."}
                      value={questionSearch}
                      onChange={(e) => setQuestionSearch(e.target.value)}
                      className="px-3 py-1.5 pl-8 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 w-44 sm:w-56"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>

                  {/* Filter Tabs */}
                  <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setQuestionTypeFilter("ALL")}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        questionTypeFilter === "ALL"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Alle
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionTypeFilter("SINGLE_CHOICE")}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        questionTypeFilter === "SINGLE_CHOICE"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      SC
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionTypeFilter("MULTIPLE_CHOICE")}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        questionTypeFilter === "MULTIPLE_CHOICE"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      MC
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionTypeFilter("FREE_TEXT")}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        questionTypeFilter === "FREE_TEXT"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Freitext
                    </button>
                  </div>
                </div>
              </div>

              {/* Questions List */}
              {filteredManageQuestions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  {moduleData.questions?.length === 0
                    ? (lang === "de"
                        ? "Noch keine Prüfungsfragen vorhanden. Lade Unterlagen in Tab 1 hoch und klicke auf 'Mit KI neue Fragen generieren'."
                        : "No exam questions yet. Upload materials in Tab 1 and click 'Generate Questions with AI'.")
                    : (lang === "de"
                        ? "Keine Fragen entsprechen dem aktuellen Filter."
                        : "No questions match the filter.")}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredManageQuestions.map((q: any, idx: number) => {
                    let parsedOptions: any[] = [];
                    if (q.options) {
                      try {
                        parsedOptions = JSON.parse(q.options);
                      } catch {}
                    }

                    return (
                      <div
                        key={q.id}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-slate-400">
                              #{idx + 1}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                q.type === "SINGLE_CHOICE"
                                  ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300"
                                  : q.type === "MULTIPLE_CHOICE"
                                  ? "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300"
                                  : "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300"
                              }`}
                            >
                              {q.type === "SINGLE_CHOICE"
                                ? "Single Choice"
                                : q.type === "MULTIPLE_CHOICE"
                                ? "Multiple Choice"
                                : "Freitext"}
                            </span>
                            {q.sourceRef && (
                              <span className="text-[11px] text-slate-500 font-medium">
                                📖 {q.sourceRef}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditingQuestion(q)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                              {lang === "de" ? "Bearbeiten" : "Edit"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(q.id)}
                              disabled={isDeletingQuestionId === q.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {isDeletingQuestionId === q.id ? "Löscht..." : (lang === "de" ? "Löschen" : "Delete")}
                            </button>
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {q.questionText}
                        </p>

                        {/* Options preview */}
                        {parsedOptions.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {parsedOptions.map((opt: any, optIdx: number) => (
                              <div
                                key={optIdx}
                                className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-2 border ${
                                  opt.isCorrect
                                    ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-medium"
                                    : "bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                {opt.isCorrect ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 flex-shrink-0 ml-1 mr-1" />
                                )}
                                <span className="truncate">{opt.text}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Sample solution preview for free text */}
                        {q.type === "FREE_TEXT" && q.sampleSolution && (
                          <div className="p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 text-xs text-purple-950 dark:text-purple-200">
                            <span className="font-bold block text-[10px] uppercase tracking-wider text-purple-700 dark:text-purple-300 mb-0.5">
                              Musterlösung:
                            </span>
                            <p className="line-clamp-2 text-slate-700 dark:text-slate-300">
                              {q.sampleSolution}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: NOTEN- & MODULABSCHLUSS */}
        {/* ========================================================================= */}
        {activeTab === "grade" && (
          <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t.gradesCompletionTitle}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === "de"
                    ? "Trage deine finale Prüfungsnote ein, um das Modul abzuschließen und den Gesamt-Notenschnitt im Dashboard zu aktualisieren."
                    : "Enter your final exam grade to complete the module and update your GPA in the dashboard."}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveGrade} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  {t.enterGradeLabel} (1.0 {lang === "de" ? "bis" : "to"} 5.0)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    placeholder="z. B. 1.3"
                    value={gradeInput}
                    onChange={(e) => setGradeInput(e.target.value)}
                    className="w-36 px-4 py-2.5 text-base font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <span className="text-xs text-slate-500">
                    {lang === "de"
                      ? `Wird mit ${formatEcts(moduleData.ects)} ECTS in den Gesamtschnitt eingerechnet.`
                      : `Weighted with ${formatEcts(moduleData.ects)} ECTS into overall GPA.`}
                  </span>
                </div>
              </div>

              {/* Passed Checkbox */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="completedCheck"
                  checked={isCompletedCheck}
                  onChange={(e) => setIsCompletedCheck(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-0.5"
                />
                <label
                  htmlFor="completedCheck"
                  className="text-xs text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
                >
                  <span className="font-bold block text-sm">{t.markCompletedCheckboxTitle}</span>
                  {t.markCompletedCheckboxDesc}
                </label>
              </div>

              {gradeSavedToast && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {t.gradeSavedToast}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSavingGrade}
                  className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center gap-2 transition-all"
                >
                  <Award className="w-4 h-4" />
                  {isSavingGrade ? t.saving : t.saveGradeAndCompletionBtn}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Interactive Exam Session Modal */}
      {isQuizOpen && (
        <ExamSessionModal
          moduleId={moduleId}
          questions={quizQuestions}
          modeName={quizModeName}
          isOpen={isQuizOpen}
          onClose={() => setIsQuizOpen(false)}
          onSessionCompleted={() => {
            fetchModule();
          }}
        />
      )}

      {/* AI Summary / Cheat Sheet Modal */}
      {activeSummaryTopic && (
        <TopicSummaryModal
          moduleId={moduleId}
          topicId={activeSummaryTopic.id}
          topicName={activeSummaryTopic.name}
          isOpen={Boolean(activeSummaryTopic)}
          onClose={() => setActiveSummaryTopic(null)}
          onStartGapTraining={(topId) => handleStartGapTraining(topId)}
        />
      )}

      {/* Edit Exam Details & Description Modal */}
      {isEditExamModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {t.editExamDetailsModalTitle}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t.editExamDetailsModalDesc}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditExamModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveExamDetails} className="space-y-4 py-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>{t.examCommentLabel}</span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black">
                      {t.examCommentHint}
                    </span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder={t.examStructurePlaceholder}
                    value={examDescInput}
                    onChange={(e) => setExamDescInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 leading-relaxed font-medium"
                  />
                </div>

                {/* Quick Preset Buttons */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    {t.quickSnippetsLabel}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(lang === "de"
                      ? [
                          "90 Min Dauer",
                          "30% MC + 70% Freitext",
                          "Schwerpunkt Altklausuren",
                          "1 Blatt DIN-A4 Spickzettel",
                          "Keine Hilfsmittel",
                        ]
                      : [
                          "90 min duration",
                          "30% MC + 70% Free text",
                          "Focus on past exams",
                          "1 DIN-A4 cheat sheet",
                          "No aids allowed",
                        ]
                    ).map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() =>
                          setExamDescInput((prev) =>
                            prev ? `${prev}. ${chip}` : chip
                          )
                        }
                        className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t.examDateRequiredLabel}
                    </label>
                    <input
                      type="date"
                      value={examDateInput}
                      onChange={(e) => setExamDateInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t.examTimeLabel}
                    </label>
                    <input
                      type="text"
                      placeholder={t.examTimePlaceholder}
                      value={examTimeInput}
                      onChange={(e) => setExamTimeInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.examLocationLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={t.examLocationPlaceholder}
                    value={examLocationInput}
                    onChange={(e) => setExamLocationInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditExamModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingExamDetails}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isSavingExamDetails ? t.saving : t.saveExamChangesBtn}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Edit / Delete Module Dialog */}
      {isEditModuleOpen && (
        <EditModuleDialog
          isOpen={isEditModuleOpen}
          onClose={() => setIsEditModuleOpen(false)}
          module={moduleData}
          onUpdated={fetchModule}
          onDeleted={() => {
            router.push("/");
          }}
        />
      )}

      {/* Edit Question Dialog */}
      {editingQuestion && (
        <EditQuestionDialog
          question={editingQuestion}
          isOpen={Boolean(editingQuestion)}
          onClose={() => setEditingQuestion(null)}
          onQuestionUpdated={() => {
            setEditingQuestion(null);
            fetchModule();
          }}
        />
      )}
    </div>
  );
}

export default function ModuleDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ModuleDetailContent />
    </Suspense>
  );
}
