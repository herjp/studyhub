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
  RefreshCw,
  Copy,
  ArrowLeftRight,
  Files,
  Plus,
  X,
  MessageSquareText,
  ExternalLink,
} from "lucide-react";
import { getCampusMapInfo } from "@/lib/campus-maps";
import { HeaderDashboard } from "@/components/HeaderDashboard";
import { FahrschulBar } from "@/components/FahrschulBar";
import { CircularProgress } from "@/components/CircularProgress";
import { ExamSessionModal, QuizQuestion } from "@/components/ExamSessionModal";
import { TopicSummaryModal } from "@/components/TopicSummaryModal";
import { EditModuleDialog } from "@/components/EditModuleDialog";
import { EditQuestionDialog } from "@/components/EditQuestionDialog";
import { ModuleTutorChat } from "@/components/ModuleTutorChat";
import { AuthModal } from "@/components/AuthModal";
import { Portal } from "@/components/Portal";
import { formatGrade, formatEcts } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import {
  extractPdfTextFromArrayBuffer,
  extractPdfTextWithPdfJs,
  renderPdfToCompressedJpeg,
  recognizeTextWithTesseract,
  suggestDocumentTitleFromText,
  isValidPdfText,
} from "@/lib/pdf-extractor";

function isGenericDocTitle(title: string, filename?: string): boolean {
  if (!title || !title.trim()) return true;
  const t = title.trim().toLowerCase();
  if (filename) {
    const rawF = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim().toLowerCase();
    if (t === rawF) return true;
  }
  if (/^media[_\s-]?\d+/i.test(t)) return true;
  if (/^img[_\s-]?\d+/i.test(t)) return true;
  if (/^scan[_\s-]?\d+/i.test(t)) return true;
  if (/^screenshot[_\s-]?\d+/i.test(t)) return true;
  if (/^image[_\s-]?\d+/i.test(t)) return true;
  if (/^foto[_\s-]?\d+/i.test(t)) return true;
  if (/^dokument[_\s-]?\d*/i.test(t)) return true;
  if (/^document[_\s-]?\d*/i.test(t)) return true;
  if (/^datei[_\s-]?\d*/i.test(t)) return true;
  if (/^\d{6,}$/.test(t)) return true;
  return false;
}

/**
 * Optimizes images for OCR and AI analysis while preserving 100% pixel sharpness.
 * For compact files (< 2.5 MB, e.g. iPad screenshots), preserves original resolution and format.
 */
async function compressImageForUpload(
  file: File
): Promise<{ base64: string; mimeType: string; sizeStr: string }> {
  // If image is already compact (< 2.5 MB), preserve crystal-clear pixel quality!
  if (file.size <= 2.5 * 1024 * 1024) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawUrl = e.target?.result as string;
        const cleanBase64 = rawUrl.replace(/^data:[^;]+;base64,/, "");
        resolve({
          base64: cleanBase64,
          mimeType: file.type || "image/png",
          sizeStr: `${Math.round(file.size / 1024)} KB (HD Original)`,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_DIM = 2048;
      let width = img.width;
      let height = img.height;

      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const rawUrl = e.target?.result as string;
          resolve({
            base64: rawUrl.replace(/^data:[^;]+;base64,/, ""),
            mimeType: file.type || "image/jpeg",
            sizeStr: `${Math.round(file.size / 1024)} KB`,
          });
        };
        reader.readAsDataURL(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.85);
      const cleanBase64 = compressedBase64.replace(/^data:image\/jpeg;base64,/, "");
      const approxBytes = Math.round((cleanBase64.length * 3) / 4);
      const sizeStr = `${Math.round(approxBytes / 1024)} KB (HD optimiert)`;
      resolve({ base64: cleanBase64, mimeType: "image/jpeg", sizeStr });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawUrl = e.target?.result as string;
        resolve({
          base64: rawUrl.replace(/^data:[^;]+;base64,/, ""),
          mimeType: file.type || "image/jpeg",
          sizeStr: `${Math.round(file.size / 1024)} KB`,
        });
      };
      reader.readAsDataURL(file);
    };
    img.src = url;
  });
}

export interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  sizeStr: string;
  title: string;
  suggestedTitle?: string;
  category: string;
  isPastExam: boolean;
  base64?: string;
  mimeType: string;
  clientExtractedText?: string;
  isProcessing: boolean;
  status: "idle" | "uploading" | "done" | "error";
  errorMessage?: string;
  extractedChars?: number;
}

function ModuleDetailContent() {
  const { lang, t } = useLanguage();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const moduleId = params.id as string;

  const initialTab = searchParams.get("tab") || "documents";
  const [activeTab, setActiveTab] = useState<"documents" | "trainer" | "tutor" | "grade">(
    initialTab as any
  );
  const [isTutorDrawerOpen, setIsTutorDrawerOpen] = useState(false);

  const [moduleData, setModuleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // University preference for campus room links
  const [preferredUniversity, setPreferredUniversity] = useState("tu_wien");
  const [customUniversity, setCustomUniversity] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUni = localStorage.getItem("studyhub_preferred_university");
      if (savedUni) setPreferredUniversity(savedUni);
      const savedCustom = localStorage.getItem("studyhub_custom_university");
      if (savedCustom) setCustomUniversity(savedCustom);
    }
  }, []);

  // Document upload state
  const [docTitle, setDocTitle] = useState("");
  const [suggestedDocTitle, setSuggestedDocTitle] = useState<string>("");
  const [docCategory, setDocCategory] = useState("LECTURE_SLIDES");
  const [isPastExam, setIsPastExam] = useState(false);
  const [docText, setDocText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [editingDoc, setEditingDoc] = useState<{ id: string; title: string; category?: string } | null>(null);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [isEditingDocContent, setIsEditingDocContent] = useState(false);
  const [editDocContentText, setEditDocContentText] = useState("");
  const [isSavingDocContent, setIsSavingDocContent] = useState(false);

  const handleSaveDocContent = async () => {
    if (!previewDoc) return;
    setIsSavingDocContent(true);
    try {
      const res = await fetch("/api/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: previewDoc.id,
          title: previewDoc.title,
          category: previewDoc.category,
          parsedText: editDocContentText,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setPreviewDoc((prev: any) => ({ ...prev, parsedText: updated.parsedText }));
        setModuleData((prev: any) => ({
          ...prev,
          documents: prev.documents.map((d: any) =>
            d.id === updated.id ? { ...d, parsedText: updated.parsedText } : d
          ),
        }));
        setIsEditingDocContent(false);
      }
    } catch (err) {
      console.error("Failed to update document text:", err);
    } finally {
      setIsSavingDocContent(false);
    }
  };
  const [docSearchTerm, setDocSearchTerm] = useState("");
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [uploadProgressIndex, setUploadProgressIndex] = useState<number>(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const updateQueueItemTitle = (id: string, newTitle: string) => {
    setUploadQueue((prev) =>
      prev.map((it) => (it.id === id ? { ...it, title: newTitle } : it))
    );
  };

  const updateQueueItemCategory = (id: string, newCategory: string) => {
    setUploadQueue((prev) =>
      prev.map((it) => (it.id === id ? { ...it, category: newCategory } : it))
    );
  };

  const updateQueueItemPastExam = (id: string, isPastExamVal: boolean) => {
    setUploadQueue((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              isPastExam: isPastExamVal,
              category: isPastExamVal ? "EXAM_PAST" : it.category === "EXAM_PAST" ? "LECTURE_SLIDES" : it.category,
            }
          : it
      )
    );
  };

  const removeQueueItem = (id: string) => {
    setUploadQueue((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSaveDocName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc || !editingDoc.title.trim()) return;

    setIsSavingDoc(true);
    try {
      const res = await fetch("/api/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingDoc.id,
          title: editingDoc.title.trim(),
          category: editingDoc.category,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setModuleData((prev: any) => ({
          ...prev,
          documents: prev.documents.map((d: any) =>
            d.id === updated.id ? { ...d, title: updated.title, category: updated.category } : d
          ),
        }));
        if (previewDoc && previewDoc.id === updated.id) {
          setPreviewDoc((prev: any) => ({ ...prev, title: updated.title, category: updated.category }));
        }
        setEditingDoc(null);
      }
    } catch (err) {
      console.error("Failed to update document name:", err);
    } finally {
      setIsSavingDoc(false);
    }
  };

  // Session Question Count (default from localStorage or 5)
  const [sessionQuestionCount, setSessionQuestionCount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("studyhub_session_size");
      return stored ? Number(stored) : 5;
    }
    return 5;
  });

  const processQueueItem = async (file: File, defaultCategory: string, defaultIsPastExam: boolean): Promise<UploadQueueItem> => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
    const seemsExam = /klausur|exam|prüfung|pruefung|altklausur/i.test(file.name);
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const sizeStr = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${Math.round(file.size / 1024)} KB`;

    return {
      id,
      file,
      name: file.name,
      sizeStr,
      title: cleanName || file.name,
      category: seemsExam ? "EXAM_PAST" : defaultCategory,
      isPastExam: seemsExam || defaultIsPastExam,
      mimeType: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
      isProcessing: true,
      status: "idle",
    };
  };

  const fetchSmartTitle = async (
    itemId: string,
    extractedText: string,
    cleanName: string,
    isSingleItem: boolean
  ) => {
    if (!extractedText || extractedText.trim().length < 25) return;
    try {
      const storedProvider = typeof window !== "undefined" ? localStorage.getItem("studyhub_ai_provider") || "gemini" : "gemini";
      const storedKey = typeof window !== "undefined" 
        ? (localStorage.getItem(`studyhub_api_key_${storedProvider}`) || localStorage.getItem("studyhub_api_key") || undefined) 
        : undefined;

      const res = await fetch("/api/documents/suggest-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extractedText,
          fileName: cleanName,
          apiKey: storedKey,
          provider: storedProvider,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.title && typeof data.title === "string" && data.title.trim().length > 3) {
          const smartTitle = data.title.trim();
          setUploadQueue((prev) =>
            prev.map((it) => {
              if (it.id !== itemId) return it;
              const shouldUpdate =
                isGenericDocTitle(it.title, it.name) ||
                it.title === cleanName ||
                it.title === it.suggestedTitle;
              return {
                ...it,
                suggestedTitle: smartTitle,
                title: shouldUpdate ? smartTitle : it.title,
              };
            })
          );
          if (isSingleItem) {
            setSuggestedDocTitle(smartTitle);
            setDocTitle((curr) =>
              isGenericDocTitle(curr, cleanName) || !curr.trim() || curr === cleanName
                ? smartTitle
                : curr
            );
          }
        }
      }
    } catch (err) {
      console.warn("fetchSmartTitle failed:", err);
    }
  };

  const extractContentForItem = async (itemId: string, file: File, isSingleItem: boolean) => {
    const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|heic)$/i.test(file.name);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    // 1. Photos & Lecture Slides (PNG, JPG, HEIC): Fast client compression (30ms), backend Gemini Vision will transcribe
    if (isImage) {
      try {
        const compressed = await compressImageForUpload(file);
        const detected = suggestDocumentTitleFromText("", cleanName);
        setUploadQueue((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  base64: compressed.base64,
                  mimeType: compressed.mimeType,
                  sizeStr: compressed.sizeStr,
                  suggestedTitle: detected || it.suggestedTitle,
                  title: isGenericDocTitle(it.title, it.name) && detected ? detected : it.title,
                  isProcessing: false,
                }
              : it
          )
        );
        if (isSingleItem && detected) {
          setSuggestedDocTitle(detected);
          setDocTitle((curr) => (isGenericDocTitle(curr, file.name) ? detected : curr));
        }
        return;
      } catch (err) {
        console.warn("Client photo compression fallback:", err);
      }
    }

    // 2. Client-side PDF extraction: Fast digital text extraction via Mozilla PDF.js (~50ms)
    let clientText = "";
    if (isPdf) {
      try {
        const pdfJsText = await extractPdfTextWithPdfJs(file);
        if (pdfJsText && isValidPdfText(pdfJsText)) {
          clientText = pdfJsText;
        }
      } catch (pdfJsErr: any) {
        console.warn("Client PDF.js extraction fallback:", pdfJsErr);
      }

      if (!clientText) {
        try {
          const ab = await file.arrayBuffer();
          const fallbackText = extractPdfTextFromArrayBuffer(ab);
          if (fallbackText && isValidPdfText(fallbackText)) {
            clientText = fallbackText;
          }
        } catch (err: any) {
          console.warn("Client PDF stream extraction:", err);
        }
      }
    }

    // 3. Digital text found in PDF
    if (clientText) {
      const detected = suggestDocumentTitleFromText(clientText, cleanName);
      setUploadQueue((prev) =>
        prev.map((it) => {
          if (it.id !== itemId) return it;
          const shouldUpdate = isGenericDocTitle(it.title, it.name) || it.title === cleanName;
          return {
            ...it,
            clientExtractedText: clientText,
            suggestedTitle: detected || it.suggestedTitle,
            title: shouldUpdate && detected ? detected : it.title,
            isProcessing: false,
          };
        })
      );
      if (isSingleItem) {
        setDocText(clientText);
        if (detected) {
          setSuggestedDocTitle(detected);
          setDocTitle((curr) =>
            isGenericDocTitle(curr, file.name) || !curr.trim() || curr === cleanName ? detected : curr
          );
        }
      }
      return;
    }

    // 4. Scanned PDF fallback: Render first pages to compressed JPEG instantly (100ms)
    if (isPdf) {
      try {
        const rendered = await renderPdfToCompressedJpeg(file);
        if (rendered && rendered.base64) {
          const detected = suggestDocumentTitleFromText("", cleanName);
          setUploadQueue((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? {
                    ...it,
                    base64: rendered.base64,
                    mimeType: rendered.mimeType,
                    sizeStr: rendered.sizeStr,
                    suggestedTitle: detected || it.suggestedTitle,
                    title: isGenericDocTitle(it.title, it.name) && detected ? detected : it.title,
                    isProcessing: false,
                  }
                : it
            )
          );
          if (isSingleItem && detected) {
            setSuggestedDocTitle(detected);
            setDocTitle((curr) => (isGenericDocTitle(curr, file.name) ? detected : curr));
          }
          return;
        }
      } catch (renderErr) {
        console.warn("Render PDF error:", renderErr);
      }
    }

    // 5. Fallback for raw files under 3 MB
    if (file.size <= 3 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setUploadQueue((prev) =>
          prev.map((it) =>
            it.id === itemId ? { ...it, base64, isProcessing: false } : it
          )
        );
      };
      reader.readAsDataURL(file);
    } else {
      setUploadQueue((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, isProcessing: false } : it))
      );
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploadSuccess(null);

    const isSingle = files.length === 1 && uploadQueue.length === 0;
    const newItems: UploadQueueItem[] = [];
    for (const file of files) {
      const item = await processQueueItem(file, docCategory, isPastExam);
      newItems.push(item);
    }

    setUploadQueue((prev) => [...prev, ...newItems]);

    // If single file and docTitle is empty, prefill docTitle
    if (isSingle && !docTitle.trim()) {
      setDocTitle(newItems[0].title);
    }

    // Trigger extraction in parallel
    for (const item of newItems) {
      extractContentForItem(item.id, item.file, isSingle);
    }
  };

  const handleFileSelected = (file: File) => {
    handleFilesSelected([file]);
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

  // User session state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    fetchModule();
    fetchCurrentUser();
  }, [moduleId]);

  // Handle Document Upload (Single or Multi-Document Batch)
  const handleUploadDocument = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    const storedProvider = typeof window !== "undefined" ? localStorage.getItem("studyhub_ai_provider") || "gemini" : "gemini";
    const storedKey = typeof window !== "undefined" 
      ? (localStorage.getItem(`studyhub_api_key_${storedProvider}`) || localStorage.getItem("studyhub_api_key") || undefined) 
      : undefined;

    // Case A: Manual Text Document (no files in queue)
    if (uploadQueue.length === 0) {
      const effectiveTitle = docTitle.trim();
      if (!effectiveTitle) {
        setUploadError(
          lang === "de"
            ? "Bitte gib einen Namen für das Dokument ein oder wähle eine Datei aus."
            : "Please enter a document title or select a file."
        );
        return;
      }

      setIsUploading(true);
      setUploadStage(lang === "de" ? "Indiziere Vorlesungsinhalte..." : "Indexing lecture contents...");

      try {
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleId,
            title: effectiveTitle,
            category: isPastExam ? "EXAM_PAST" : docCategory,
            isPastExam,
            textContent: docText.trim() || undefined,
            apiKey: storedKey,
            provider: storedProvider,
          }),
        });

        const rawText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { error: rawText.slice(0, 150) };
        }

        if (res.ok) {
          setUploadSuccess(
            lang === "de"
              ? `✓ "${effectiveTitle}" erfolgreich hochgeladen und indexiert! (${data.extractedChars || 0} Zeichen Text erfasst)`
              : `✓ "${effectiveTitle}" successfully uploaded and indexed! (${data.extractedChars || 0} characters parsed)`
          );
          setDocTitle("");
          setSuggestedDocTitle("");
          setDocText("");
          setIsPastExam(false);
          fetchModule();
          setTimeout(() => setUploadSuccess(null), 8000);
        } else {
          setUploadError(data.error || "Fehler beim Erstellen des Dokuments.");
          if (res.status === 401) setShowAuthModal(true);
        }
      } catch (err: any) {
        setUploadError(err.message || "Netzwerkfehler.");
      } finally {
        setIsUploading(false);
        setUploadStage("");
      }
      return;
    }

    // Case B: Batch Upload Queue (1 or multiple files)
    const itemsToUpload = uploadQueue.filter((it) => it.status !== "done");
    if (itemsToUpload.length === 0) {
      setUploadSuccess(lang === "de" ? "Alle Dokumente wurden bereits indexiert." : "All documents already indexed.");
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;
    let completedCount = 0;
    const CONCURRENCY = 3;

    setUploadStage(
      lang === "de"
        ? `Lade ${itemsToUpload.length} Dokumente parallel hoch...`
        : `Uploading ${itemsToUpload.length} documents in parallel...`
    );

    const uploadSingleDocument = async (item: UploadQueueItem) => {
      setUploadQueue((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: "uploading", errorMessage: undefined } : it))
      );

      // Single item can also take docTitle or docText if user typed in main form
      const effectiveTitle = (uploadQueue.length === 1 && docTitle.trim()) 
        ? docTitle.trim() 
        : item.title.trim() || item.name.replace(/\.[^/.]+$/, "");

      const effectiveText = (uploadQueue.length === 1 && docText.trim())
        ? (item.clientExtractedText ? `${item.clientExtractedText}\n\n${docText.trim()}` : docText.trim())
        : item.clientExtractedText || undefined;

      const effectiveCategory = uploadQueue.length === 1 ? (isPastExam ? "EXAM_PAST" : docCategory) : (item.isPastExam ? "EXAM_PAST" : item.category);
      const effectiveIsPastExam = uploadQueue.length === 1 ? isPastExam : item.isPastExam;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      try {
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            moduleId,
            title: effectiveTitle,
            category: effectiveCategory,
            isPastExam: effectiveIsPastExam,
            fileName: item.name,
            fileBase64: item.base64,
            mimeType: item.mimeType,
            textContent: effectiveText,
            apiKey: storedKey,
            provider: storedProvider,
          }),
        });
        clearTimeout(timeoutId);

        let errorMsg = "";
        let data: any = {};
        try {
          const rawText = await res.text();
          try {
            data = JSON.parse(rawText);
            if (data.error) errorMsg = data.error;
          } catch {
            if (res.status === 413) {
              errorMsg = lang === "de" ? "Datei zu groß (> 4.5 MB)" : "Payload too large (> 4.5 MB)";
            } else if (res.status === 401) {
              errorMsg = lang === "de" ? "Sitzung abgelaufen" : "Session expired";
            } else if (res.status === 504) {
              errorMsg = lang === "de" ? "KI-Zeitüberschreitung" : "AI timeout";
            } else {
              errorMsg = rawText.slice(0, 120) || `Serverfehler (${res.status})`;
            }
          }
        } catch (readErr: any) {
          errorMsg = readErr.message || "Netzwerkfehler";
        }

        if (res.ok) {
          successCount++;
          const confirmedTitle = data.title || effectiveTitle;
          setUploadQueue((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, title: confirmedTitle, status: "done", extractedChars: data.extractedChars || 0 }
                : it
            )
          );
        } else {
          failCount++;
          setUploadQueue((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: "error", errorMessage: errorMsg || `Fehler (${res.status})` }
                : it
            )
          );
          if (res.status === 401) setShowAuthModal(true);
        }
      } catch (reqErr: any) {
        clearTimeout(timeoutId);
        failCount++;
        const errMsg = reqErr.name === "AbortError"
          ? (lang === "de" ? "Zeitüberschreitung" : "Timeout")
          : (reqErr.message || "Netzwerkfehler");
        setUploadQueue((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: "error", errorMessage: errMsg } : it
          )
        );
      } finally {
        completedCount++;
        setUploadProgressIndex(completedCount);
        setUploadStage(
          lang === "de"
            ? `${completedCount} von ${itemsToUpload.length} Dokumenten indexiert...`
            : `${completedCount} of ${itemsToUpload.length} documents indexed...`
        );
      }
    };

    // Run parallel queue with up to 3 concurrent connections
    let nextQueueIdx = 0;
    const workers = Array.from(
      { length: Math.min(CONCURRENCY, itemsToUpload.length) },
      async () => {
        while (nextQueueIdx < itemsToUpload.length) {
          const idx = nextQueueIdx++;
          await uploadSingleDocument(itemsToUpload[idx]);
        }
      }
    );
    await Promise.all(workers);

    fetchModule();
    setIsUploading(false);
    setUploadStage("");

    if (successCount > 0 && failCount === 0) {
      setUploadSuccess(
        lang === "de"
          ? (successCount === 1
              ? `✓ Dokument erfolgreich hochgeladen und indexiert!`
              : `✓ Alle ${successCount} Dokumente erfolgreich hochgeladen und indexiert!`)
          : (successCount === 1
              ? `✓ Document successfully uploaded and indexed!`
              : `✓ All ${successCount} documents successfully uploaded and indexed!`)
      );
      setTimeout(() => {
        setUploadQueue((prev) => prev.filter((it) => it.status !== "done"));
        setDocTitle("");
        setSuggestedDocTitle("");
        setDocText("");
      }, 3500);
    } else if (successCount > 0 && failCount > 0) {
      setUploadSuccess(
        lang === "de"
          ? `✓ ${successCount} Dokument(e) indexiert (${failCount} fehlgeschlagen).`
          : `✓ ${successCount} document(s) indexed (${failCount} failed).`
      );
    } else if (failCount > 0) {
      setUploadError(
        lang === "de"
          ? "Upload fehlgeschlagen. Bitte prüfe die Fehlermeldungen bei den einzelnen Dateien."
          : "Upload failed. Please check the error messages."
      );
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
  const startTraining = (mode: "ALL" | "SC" | "MC" | "FREE_TEXT" | "MATCHING" | "DUE" | "SIMULATION") => {
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
    } else if (mode === "MATCHING") {
      filtered = filtered.filter((q) => q.type === "MATCHING");
      modeLabel = "Zuordnungs- & Abbildungstraining (Drag & Drop)";
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
  const [aiQuestionCount, setAiQuestionCount] = useState<number>(10);
  const [aiSuccessToast, setAiSuccessToast] = useState<string | null>(null);
  const [aiErrorToast, setAiErrorToast] = useState<string | null>(null);

  // Question Management State
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionTypeFilter, setQuestionTypeFilter] = useState<"ALL" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "MATCHING" | "FREE_TEXT">("ALL");
  const [isDeletingQuestionId, setIsDeletingQuestionId] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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
  const handleGenerateAiQuestions = async (topicId?: string, countOverride?: number) => {
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

    const effectiveCount = countOverride || aiQuestionCount || 10;
    setIsGeneratingAiQuestions(true);
    setAiSuccessToast(null);
    setAiErrorToast(null);

    try {
      const storedProvider = typeof window !== "undefined" ? localStorage.getItem("studyhub_ai_provider") || "gemini" : "gemini";
      const storedKey = typeof window !== "undefined" 
        ? (localStorage.getItem(`studyhub_api_key_${storedProvider}`) || localStorage.getItem("studyhub_api_key") || undefined) 
        : undefined;
      const storedModel = typeof window !== "undefined"
        ? (localStorage.getItem(`studyhub_ai_model_${storedProvider}`) || localStorage.getItem("studyhub_ai_model") || undefined)
        : undefined;

      const res = await fetch("/api/trainer/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          topicId,
          count: effectiveCount,
          apiKey: storedKey,
          provider: storedProvider,
          model: storedModel,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setAiSuccessToast(
          lang === "de"
            ? `✓ ${data.count || effectiveCount} neue Klausurfragen erfolgreich aus deinen Vorlesungsunterlagen generiert und gespeichert!`
            : `✓ ${data.count || effectiveCount} new exam questions successfully generated from your documents!`
        );
        setTimeout(() => setAiSuccessToast(null), 8000);
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
        setSelectedQuestionIds((prev) => prev.filter((id) => id !== qId));
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

  const handleToggleSelectQuestion = (qId: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const handleSelectAllFiltered = () => {
    const visibleIds = filteredManageQuestions.map((q: any) => q.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id: string) => selectedQuestionIds.includes(id));
    if (allSelected) {
      // Unselect visible questions
      setSelectedQuestionIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      // Select all visible questions
      setSelectedQuestionIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleBulkDeleteQuestions = async () => {
    if (selectedQuestionIds.length === 0) return;
    const count = selectedQuestionIds.length;
    if (
      !confirm(
        lang === "de"
          ? `Möchtest du wirklich alle ${count} ausgewählten Prüfungsfragen unwiderruflich löschen?`
          : `Are you sure you want to delete all ${count} selected questions?`
      )
    ) {
      return;
    }
    setIsBulkDeleting(true);
    try {
      const res = await fetch("/api/trainer/questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedQuestionIds }),
      });
      if (res.ok) {
        setSelectedQuestionIds([]);
        fetchModule();
      } else {
        const data = await res.json();
        alert(data.error || "Fehler beim Löschen der ausgewählten Fragen.");
      }
    } catch (e: any) {
      alert(e.message || "Fehler beim Löschen.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Start Targeted Gap Training ("Lücke schließen" with 5 questions)
  const handleStartGapTraining = async (topicId: string) => {
    try {
      const storedProvider = typeof window !== "undefined" ? localStorage.getItem("studyhub_ai_provider") || "gemini" : "gemini";
      const storedKey = typeof window !== "undefined" 
        ? (localStorage.getItem(`studyhub_api_key_${storedProvider}`) || localStorage.getItem("studyhub_api_key") || undefined) 
        : undefined;
      const storedModel = typeof window !== "undefined"
        ? (localStorage.getItem(`studyhub_ai_model_${storedProvider}`) || localStorage.getItem("studyhub_ai_model") || undefined)
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
          model: storedModel,
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
                  {moduleData.examLocation && (() => {
                    const mapInfo = getCampusMapInfo(moduleData.examLocation, preferredUniversity, customUniversity);
                    return (
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-400">Raum/Ort:</span>
                        {mapInfo.url ? (
                          <a
                            href={mapInfo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-bold"
                            title={`In ${mapInfo.providerName} öffnen`}
                          >
                            <MapPin className="w-3.5 h-3.5 text-rose-500" />
                            <span>{mapInfo.cleanLocation}</span>
                            <ExternalLink className="w-3 h-3 text-sky-500" />
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold ml-0.5">
                              {mapInfo.badgeLabel}
                            </span>
                          </a>
                        ) : (
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-rose-500" /> {moduleData.examLocation}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </div>

                {moduleData.events && moduleData.events.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-2 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        Zugeordnete Vorlesungen & Termine ({moduleData.events.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {moduleData.events.map((evt: any) => {
                        const evtMap = evt.location ? getCampusMapInfo(evt.location, preferredUniversity, customUniversity) : null;
                        let icon = "📚";
                        let badgeColor =
                          "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800";
                        if (evt.eventType === "EXAM") {
                          icon = "🔥";
                          badgeColor =
                            "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold";
                        } else if (evt.eventType === "TEST") {
                          icon = "⚡";
                          badgeColor =
                            "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-bold";
                        } else if (evt.eventType === "EXERCISE") {
                          icon = "✏️";
                          badgeColor =
                            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
                        }

                        return (
                          <div
                            key={evt.id}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${badgeColor}`}>
                                {icon} {evt.eventType === "EXAM" ? "Klausur" : evt.eventType === "TEST" ? "Test" : evt.eventType === "EXERCISE" ? "Übung" : "Vorlesung"}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-500">
                                {new Date(evt.date).toLocaleDateString(lang === "de" ? "de-DE" : "en-US", {
                                  day: "2-digit",
                                  month: "2-digit",
                                })}
                              </span>
                            </div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={evt.title}>
                              {evt.title}
                            </div>
                            <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500">
                              {evt.startTime && <span>{evt.startTime} Uhr</span>}
                              {evt.location && evtMap && (
                                evtMap.url ? (
                                  <a
                                    href={evtMap.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5 truncate max-w-[120px]"
                                    title={`In ${evtMap.providerName} öffnen`}
                                  >
                                    <MapPin className="w-2.5 h-2.5 text-rose-500 flex-shrink-0" />
                                    <span className="truncate">{evtMap.cleanLocation}</span>
                                  </a>
                                ) : (
                                  <span className="truncate max-w-[120px]">{evt.location}</span>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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

        {/* Tabs Navigation (Tab 1 -> Tab 2 -> Tab 3 -> Tab 4) */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("documents")}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
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
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
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
            onClick={() => setActiveTab("tutor")}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "tutor"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <MessageSquareText className="w-4 h-4" />
            {t.tabTutorName}
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">
              {lang === "de" ? "Frag die Vorlesung" : "Q&A"}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("grade")}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "grade"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Award className="w-4 h-4" />
            {t.tab4Name}
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

                {uploadSuccess && (
                  <div className="mb-3.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{uploadSuccess}</span>
                  </div>
                )}

                {uploadError && (
                  <div className="mb-3.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span>{uploadError}</span>
                      {(!currentUser || uploadError.toLowerCase().includes("anmeld") || uploadError.toLowerCase().includes("sitzung")) && (
                        <button
                          type="button"
                          onClick={() => setShowAuthModal(true)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 shadow-sm"
                        >
                          {lang === "de" ? "Jetzt anmelden" : "Log in now"}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!currentUser && (
                  <div className="mb-3.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{lang === "de" ? "Nicht angemeldet: Bitte melde dich an, um Unterlagen zu speichern." : "Not logged in: Please log in to save documents."}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0"
                    >
                      {lang === "de" ? "Anmelden" : "Log in"}
                    </button>
                  </div>
                )}

                <form onSubmit={handleUploadDocument} className="space-y-3.5">
                  {/* Drag & Drop Zone (Supports Multi-File Drag & Drop or Selection) */}
                  <div>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const files = Array.from(e.dataTransfer.files || []);
                        if (files.length > 0) handleFilesSelected(files);
                      }}
                      className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                        uploadQueue.length > 0
                          ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20"
                          : "border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) handleFilesSelected(files);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />

                      <div className="flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2">
                          {uploadQueue.length > 0 ? (
                            <Files className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <UploadCloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {uploadQueue.length > 0
                            ? (lang === "de" ? "+ Weitere Dokumente (PDF, Bilder, Scans) hinzufügen" : "+ Add more documents (PDF, images, scans)")
                            : (lang === "de" ? "Dokumente & Vorlesungsfolien (PDF, PNG, JPG) ablegen" : "Drop lecture documents & slides (PDF, PNG, JPG) here")}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {lang === "de"
                            ? "✨ Mehrere Dateien gleichzeitig möglich • Automatische Titelerkennung & OCR"
                            : "✨ Multi-file upload supported • Automatic title detection & OCR"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Case 1: Pure manual text document (no files in queue) */}
                  {uploadQueue.length === 0 && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t.uploadDocNameLabel}
                        </label>
                        <input
                          type="text"
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
                          {lang === "de" ? "Vorlesungstext oder Notizen (optional):" : "Lecture Text or Notes (optional):"}
                        </label>
                        <textarea
                          rows={3}
                          placeholder={t.docTextContentPlaceholder}
                          value={docText}
                          onChange={(e) => setDocText(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Case 2: Upload Queue Cards (1 or multiple files selected) */}
                  {uploadQueue.length > 0 && (
                    <div className="space-y-3">
                      {/* Queue header & summary */}
                      <div className="flex items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                          <Files className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>
                            {uploadQueue.length === 1
                              ? (lang === "de" ? "1 Dokument ausgewählt" : "1 document selected")
                              : (lang === "de" ? `${uploadQueue.length} Dokumente in Warteschlange` : `${uploadQueue.length} documents in queue`)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({uploadQueue.reduce((acc, it) => acc + (it.file?.size || 0), 0) > 1024 * 1024
                              ? `${(uploadQueue.reduce((acc, it) => acc + (it.file?.size || 0), 0) / (1024 * 1024)).toFixed(1)} MB`
                              : `${Math.round(uploadQueue.reduce((acc, it) => acc + (it.file?.size || 0), 0) / 1024)} KB`})
                          </span>
                        </div>
                        {!isUploading && (
                          <button
                            type="button"
                            onClick={() => {
                              setUploadQueue([]);
                              setDocTitle("");
                              setSuggestedDocTitle("");
                              setDocText("");
                            }}
                            className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold cursor-pointer"
                          >
                            {lang === "de" ? "Alle entfernen" : "Clear all"}
                          </button>
                        )}
                      </div>

                      {/* Scrollable list of document cards in the queue */}
                      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                        {uploadQueue.map((item) => (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border transition-all ${
                              item.status === "done"
                                ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20"
                                : item.status === "uploading"
                                ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-950/30 shadow-xs"
                                : item.status === "error"
                                ? "border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80"
                            }`}
                          >
                            {/* Item header */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    item.status === "done"
                                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                                      : item.status === "uploading"
                                      ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
                                      : item.status === "error"
                                      ? "bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400"
                                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                  }`}
                                >
                                  {item.status === "done" ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : item.status === "uploading" ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : item.status === "error" ? (
                                    <AlertCircle className="w-4 h-4" />
                                  ) : item.mimeType.includes("pdf") ? (
                                    <FileText className="w-4 h-4" />
                                  ) : (
                                    <FileCheck className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                    {item.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {item.sizeStr} • {item.mimeType.includes("pdf") ? "PDF" : "Foto / Folie"}
                                  </p>
                                </div>
                              </div>

                              {!isUploading && item.status !== "done" && (
                                <button
                                  type="button"
                                  onClick={() => removeQueueItem(item.id)}
                                  className="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-xs transition-colors"
                                  title={lang === "de" ? "Datei entfernen" : "Remove file"}
                                >
                                  ✕
                                </button>
                              )}
                            </div>

                            {/* Editable Title */}
                            <div className="mt-2.5 space-y-1">
                              <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
                                <span className="text-slate-500 dark:text-slate-400 font-semibold">
                                  {lang === "de" ? "Titel im Modul:" : "Title in module:"}
                                </span>
                                {item.suggestedTitle && item.title !== item.suggestedTitle && item.status !== "done" && (
                                  <button
                                    type="button"
                                    onClick={() => updateQueueItemTitle(item.id, item.suggestedTitle!)}
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                                  >
                                    <Sparkles className="w-2.5 h-2.5" />
                                    {lang === "de" ? "Vorschlag:" : "Suggest:"} „{item.suggestedTitle}“
                                  </button>
                                )}
                                {item.suggestedTitle && item.title === item.suggestedTitle && (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                                    <Check className="w-2.5 h-2.5" /> {lang === "de" ? "Aus Inhalt erkannt" : "From content"}
                                  </span>
                                )}
                              </div>
                              <input
                                type="text"
                                disabled={item.status === "done" || isUploading}
                                value={item.title}
                                onChange={(e) => updateQueueItemTitle(item.id, e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium"
                                placeholder={lang === "de" ? "Titel des Dokuments" : "Document title"}
                              />
                            </div>

                            {/* Category & Past Exam */}
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <select
                                disabled={item.status === "done" || isUploading}
                                value={item.category}
                                onChange={(e) => updateQueueItemCategory(item.id, e.target.value)}
                                className="px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                              >
                                <option value="LECTURE_SLIDES">{t.catSlides}</option>
                                <option value="EXAM_PAST">{t.pastExamBadge}</option>
                                <option value="EXERCISE">{t.catExercises}</option>
                                <option value="LITERATURE">{t.catLiterature}</option>
                              </select>

                              <label className="text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-1.5 cursor-pointer bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 px-2 py-0.5 rounded-lg">
                                <input
                                  type="checkbox"
                                  disabled={item.status === "done" || isUploading}
                                  checked={item.isPastExam}
                                  onChange={(e) => updateQueueItemPastExam(item.id, e.target.checked)}
                                  className="rounded border-amber-400 text-indigo-600 text-xs"
                                />
                                <span className="font-semibold">{t.markAsPastExam}</span>
                              </label>
                            </div>

                            {/* Extraction & Upload Status Indicator */}
                            <div className="mt-2 text-[10px] flex items-center gap-1.5 flex-wrap">
                              {item.isProcessing ? (
                                <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> {lang === "de" ? "Texterkennung läuft im Browser..." : "Browser OCR in progress..."}
                                </span>
                              ) : item.clientExtractedText ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" /> {lang === "de" ? `${item.clientExtractedText.length} Zeichen Text erkannt` : `${item.clientExtractedText.length} chars text recognized`}
                                </span>
                              ) : item.mimeType.startsWith("image/") ? (
                                <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-medium">
                                  ✨ {lang === "de" ? "KI-Fotoerkennung aktiv (Gemini Vision OCR)" : "AI Vision OCR active"}
                                </span>
                              ) : (
                                <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-medium">
                                  📸 {lang === "de" ? "Foto- / Scan-PDF (Gemini Vision OCR)" : "Photo/Scan PDF (Gemini Vision)"}
                                </span>
                              )}

                              {item.status === "done" && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-auto flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {lang === "de" ? `Erfolgreich indiziert (${item.extractedChars || 0} Zeichen)` : `Indexed (${item.extractedChars || 0} chars)`}
                                </span>
                              )}
                              {item.status === "error" && (
                                <span className="text-rose-600 dark:text-rose-400 font-semibold ml-auto flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {item.errorMessage}
                                </span>
                              )}
                            </div>

                            {/* If single file, show optional editable text area */}
                            {uploadQueue.length === 1 && (
                              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                  {lang === "de"
                                    ? (docText.trim() ? "Extrahierter / bearbeitbarer Vorlesungstext:" : "Zusätzliche Notizen oder Text (optional):")
                                    : (docText.trim() ? "Extracted / Editable Text:" : "Additional Notes or Text (optional):")}
                                </label>
                                <textarea
                                  rows={docText.trim().length > 80 ? 4 : 2}
                                  placeholder={t.docTextContentPlaceholder}
                                  value={docText}
                                  onChange={(e) => setDocText(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px]"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload Progress Banner */}
                  {isUploading && (
                    <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                        <span>{uploadStage || (lang === "de" ? "Dokumente werden verarbeitet..." : "Processing documents...")}</span>
                      </div>
                      <div className="w-full bg-indigo-200 dark:bg-indigo-900 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              uploadQueue.length > 0
                                ? Math.round(((uploadProgressIndex + 1) / Math.max(1, uploadQueue.filter((i) => i.status !== "done").length)) * 100)
                                : 65
                            }%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {lang === "de"
                          ? "Jedes Dokument wird einzeln per Multimodal-KI & RAG-Pipeline erfasst, komprimiert und den Modul-Themen zugeordnet."
                          : "Each document is individually processed, compressed, and mapped to module topics."}
                      </p>
                    </div>
                  )}

                  {/* Submit / Upload Button */}
                  <button
                    type="submit"
                    disabled={isUploading || (uploadQueue.length > 0 && uploadQueue.every((i) => i.status === "done"))}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        {uploadQueue.length > 1
                          ? (lang === "de"
                              ? `Lade Dokument ${uploadProgressIndex + 1} von ${uploadQueue.filter((i) => i.status !== "done").length} hoch...`
                              : `Uploading document ${uploadProgressIndex + 1} of ${uploadQueue.filter((i) => i.status !== "done").length}...`)
                          : t.uploadingAndIndexing}
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        {uploadQueue.length > 1
                          ? (lang === "de"
                              ? `Alle ${uploadQueue.filter((i) => i.status !== "done").length} Dokumente nacheinander hochladen & indexieren`
                              : `Upload & Index All ${uploadQueue.filter((i) => i.status !== "done").length} Documents`)
                          : uploadQueue.length === 1
                          ? (lang === "de" ? "1 Dokument hochladen & indexieren" : "Upload & Index Document")
                          : t.uploadAndIndexBtn}
                      </>
                    )}
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

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1.5">
                        {lang === "de" ? "Anzahl:" : "Qty:"}
                      </span>
                      {[5, 10, 15, 20, 25, 30].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setAiQuestionCount(cnt)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            aiQuestionCount === cnt
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700"
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleGenerateAiQuestions(undefined, aiQuestionCount)}
                      disabled={isGeneratingAiQuestions}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      {isGeneratingAiQuestions
                        ? (lang === "de" ? `Generiere ${aiQuestionCount} Fragen mit KI...` : `Generating ${aiQuestionCount} questions...`)
                        : (lang === "de" ? `Mit KI ${aiQuestionCount} Fragen generieren` : `Generate ${aiQuestionCount} Questions`)}
                    </button>
                  </div>
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
                        <div
                          onClick={() => {
                            setPreviewDoc(doc);
                            setIsEditingDocContent(false);
                            setEditDocContentText(doc.parsedText || "");
                          }}
                          className="flex items-start gap-3 cursor-pointer flex-1 min-w-0"
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isExam
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300"
                                : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400"
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
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
                              {isValidPdfText(doc.parsedText) ? (
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {t.indexedBadge}
                                </span>
                              ) : (
                                <span
                                  className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium cursor-pointer"
                                  title="Enthält unleserliche Steuerzeichen oder Scan"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                  {lang === "de" ? "⚠️ Text prüfen / Scan" : "⚠️ Incomplete text"}
                                </span>
                              )}
                              <span>•</span>
                              <span>{new Date(doc.createdAt).toLocaleDateString(lang === "de" ? "de-DE" : "en-US")}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingDoc({ id: doc.id, title: doc.title, category: doc.category })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title={lang === "de" ? "Name umbenennen" : "Rename document"}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewDoc(doc);
                              setIsEditingDocContent(false);
                              setEditDocContentText(doc.parsedText || "");
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title={lang === "de" ? "Dokument ansehen & Text prüfen" : "View document & inspect text"}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
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

            {/* Document Preview & Inspector Modal */}
            {previewDoc && (
              <Portal>
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {previewDoc.title}
                            </h4>
                            <button
                              type="button"
                              onClick={() => setEditingDoc({ id: previewDoc.id, title: previewDoc.title, category: previewDoc.category })}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                            >
                              <Edit2 className="w-3 h-3" />
                              {lang === "de" ? "Umbenennen" : "Rename"}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {previewDoc.fileName || "Dokument"} • {previewDoc.category === "EXAM_PAST" ? "Altklausur" : "Vorlesungsunterlage"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setPreviewDoc(null); setDocSearchTerm(""); }}
                        className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Warning if unreadable content */}
                    {!isValidPdfText(previewDoc.parsedText) && !isEditingDocContent && (
                      <div className="mb-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5 animate-in fade-in">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold">
                            {lang === "de" ? "⚠️ Unleserlicher Inhalt oder veraltete Zeichenkodierung" : "⚠️ Incomplete text or legacy encoding detected"}
                          </p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-normal">
                            {lang === "de"
                              ? "Dieses Dokument enthält unleserliche Glyphen/Steuerzeichen (z. B. aus einem früheren Upload oder einem Scan). Bitte lösche das Dokument kurz und lade es erneut hoch – unsere neue Mozilla PDF.js-Engine entschlüsselt Schriftarten jetzt vollständig mit echten Sätzen – oder klicke unten auf 'Text bearbeiten'."
                              : "This document contains unreadable characters. Please delete and re-upload it with our enhanced PDF.js engine, or click 'Edit text' below."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Stats & Search Toolbar */}
                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap text-xs">
                      <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {previewDoc.parsedText ? `${previewDoc.parsedText.length.toLocaleString()} Zeichen` : "0 Zeichen"}
                        </span>
                        <span>•</span>
                        {isValidPdfText(previewDoc.parsedText) ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t.indexedBadge}
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> {lang === "de" ? "Text unvollständig" : "Incomplete"}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!isEditingDocContent && (
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder={lang === "de" ? "Im Text suchen..." : "Search text..."}
                              value={docSearchTerm}
                              onChange={(e) => setDocSearchTerm(e.target.value)}
                              className="pl-8 pr-2.5 py-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 w-36 sm:w-44"
                            />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingDocContent(!isEditingDocContent);
                            setEditDocContentText(previewDoc.parsedText || "");
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>{isEditingDocContent ? (lang === "de" ? "Ansicht" : "View") : (lang === "de" ? "Text bearbeiten" : "Edit text")}</span>
                        </button>

                        {!isEditingDocContent && (
                          <button
                            type="button"
                            onClick={() => {
                              if (previewDoc.parsedText) {
                                navigator.clipboard.writeText(previewDoc.parsedText);
                                setCopiedDocId(previewDoc.id);
                                setTimeout(() => setCopiedDocId(null), 2000);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            {copiedDocId === previewDoc.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>{lang === "de" ? "Kopiert!" : "Copied!"}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>{lang === "de" ? "Kopieren" : "Copy"}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Text View or Editable Textarea */}
                    {isEditingDocContent ? (
                      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 p-3 rounded-2xl border border-indigo-200 dark:border-indigo-800 min-h-[320px]">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {lang === "de" ? "Vorlesungstext / Notizen bearbeiten:" : "Edit lecture text / notes:"}
                          </span>
                          <span>{editDocContentText.length.toLocaleString()} Zeichen</span>
                        </div>
                        <textarea
                          value={editDocContentText}
                          onChange={(e) => setEditDocContentText(e.target.value)}
                          placeholder={lang === "de" ? "Füge hier den Vorlesungs- oder Klausurtext ein..." : "Paste lecture or exam text here..."}
                          className="flex-1 w-full p-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          rows={14}
                        />
                        <div className="flex items-center justify-end gap-2 pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => setIsEditingDocContent(false)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
                          >
                            {lang === "de" ? "Abbrechen" : "Cancel"}
                          </button>
                          <button
                            type="button"
                            disabled={isSavingDocContent}
                            onClick={handleSaveDocContent}
                            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 flex items-center gap-1.5 shadow-sm"
                          >
                            {isSavingDocContent ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>{lang === "de" ? "Wird gespeichert..." : "Saving..."}</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>{lang === "de" ? "Änderungen speichern" : "Save changes"}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <pre className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line font-mono leading-relaxed select-text">
                          {previewDoc.parsedText
                            ? (docSearchTerm.trim()
                                ? previewDoc.parsedText
                                    .split("\n")
                                    .filter((line: string) => line.toLowerCase().includes(docSearchTerm.toLowerCase()))
                                    .join("\n") || `Keine Treffer für "${docSearchTerm}" gefunden.`
                                : previewDoc.parsedText)
                            : "Kein extrahierter Text vorhanden."}
                        </pre>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteDocument(previewDoc.id);
                          setPreviewDoc(null);
                        }}
                        className="text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t.delete}
                      </button>

                      <button
                        type="button"
                        onClick={() => { setPreviewDoc(null); setDocSearchTerm(""); }}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                      >
                        {lang === "de" ? "Schließen" : "Close"}
                      </button>
                    </div>
                  </div>
                </div>
              </Portal>
            )}

            {/* Rename Document Modal */}
            {editingDoc && (
              <Portal>
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Edit2 className="w-4 h-4 text-indigo-600" />
                        {lang === "de" ? "Unterlage umbenennen" : "Rename Document"}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setEditingDoc(null)}
                        className="text-slate-400 hover:text-slate-600 font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleSaveDocName} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {lang === "de" ? "Name / Thema des Dokuments" : "Document Title"}
                        </label>
                        <input
                          type="text"
                          required
                          value={editingDoc.title}
                          onChange={(e) => setEditingDoc({ ...editingDoc, title: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t.categoryLabel}
                        </label>
                        <select
                          value={editingDoc.category || "LECTURE_SLIDES"}
                          onChange={(e) => setEditingDoc({ ...editingDoc, category: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        >
                          <option value="LECTURE_SLIDES">{t.catSlides}</option>
                          <option value="EXAM_PAST">{t.pastExamBadge}</option>
                          <option value="EXERCISE">{t.catExercises}</option>
                          <option value="LITERATURE">{t.catLiterature}</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingDoc(null)}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {lang === "de" ? "Abbrechen" : "Cancel"}
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingDoc}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white shadow-sm flex items-center gap-1.5"
                        >
                          {isSavingDoc ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                          {lang === "de" ? "Speichern" : "Save"}
                        </button>
                      </div>
                    </form>
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
                    {moduleData.weakestTopics && moduleData.weakestTopics.length > 0
                      ? (lang === "de"
                          ? `Die ${moduleData.weakestTopics.length} Themengebiete mit der geringsten Klausurreife in "${moduleData.name}".`
                          : `Topics with lowest mastery in "${moduleData.name}".`)
                      : (lang === "de"
                          ? `Individuelle Themenerkennung für "${moduleData.name}".`
                          : `Topic overview for "${moduleData.name}".`)}
                  </p>
                </div>
              </div>

              {moduleData.weakestTopics && moduleData.weakestTopics.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {moduleData.weakestTopics.map((topic: any) => {
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
                            {lang === "de" ? "Zusammenfassung generieren" : "Generate Summary"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartGapTraining(topic.id)}
                            className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Play className="w-3.5 h-3.5" />
                            {lang === "de" ? "Lücke schließen (5 Fragen)" : "Close Gap (5 Questions)"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="max-w-md mx-auto">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                      {lang === "de"
                        ? `Noch keine Themengebiete für "${moduleData.name}" vorhanden`
                        : `No topics created yet for "${moduleData.name}"`}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {lang === "de"
                        ? `Lade in Tab 1 Vorlesungsfolien oder eine Altklausur für "${moduleData.name}" hoch. Die KI erkennt den Stoff und strukturiert automatisch deine Schwerpunkte und Schwachstellen speziell für dieses Fach!`
                        : `Upload lecture slides or a past exam for "${moduleData.name}" in Tab 1. The AI will analyze the material and organize your topics automatically.`}
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("documents")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {lang === "de" ? "Zu Tab 1: Unterlagen hochladen" : "Go to Tab 1: Upload Materials"}
                    </button>
                  </div>
                </div>
              )}
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

                <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                  <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1.5">
                      {lang === "de" ? "Anzahl:" : "Qty:"}
                    </span>
                    {[5, 10, 15, 20, 25, 30].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setAiQuestionCount(cnt)}
                        className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          aiQuestionCount === cnt
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700"
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleGenerateAiQuestions(undefined, aiQuestionCount)}
                    disabled={isGeneratingAiQuestions}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {isGeneratingAiQuestions
                      ? (lang === "de" ? `Generiere ${aiQuestionCount} Fragen mit KI...` : `Generating ${aiQuestionCount} questions...`)
                      : (lang === "de" ? `Mit KI ${aiQuestionCount} neue Fragen generieren` : `Generate ${aiQuestionCount} Questions`)}
                  </button>
                </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-2">
                {/* Single Choice */}
                <button
                  type="button"
                  onClick={() => startTraining("SC")}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white dark:bg-slate-800/60 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-left transition-all group cursor-pointer"
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
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white dark:bg-slate-800/60 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-left transition-all group cursor-pointer"
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

                {/* Zuordnung & Abbildungen (Matching Drag & Drop) */}
                <button
                  type="button"
                  onClick={() => startTraining("MATCHING")}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-400 bg-white dark:bg-slate-800/60 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 text-left transition-all group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1">
                    Zuordnung &amp; Schema
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Begriffe &amp; Diagramme per Drag &amp; Drop den richtigen Stellen zuweisen.
                  </p>
                </button>

                {/* Free Text */}
                <button
                  type="button"
                  onClick={() => startTraining("FREE_TEXT")}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white dark:bg-slate-800/60 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-left transition-all group cursor-pointer"
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
                  className="p-5 rounded-2xl border-2 border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700 text-left transition-all shadow-md group cursor-pointer"
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
                      onClick={() => setQuestionTypeFilter("MATCHING")}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        questionTypeFilter === "MATCHING"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Zuordnung
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

              {/* Batch Action Toolbar */}
              {filteredManageQuestions.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="selectAllQuestions"
                      checked={
                        filteredManageQuestions.length > 0 &&
                        filteredManageQuestions.every((q: any) => selectedQuestionIds.includes(q.id))
                      }
                      onChange={handleSelectAllFiltered}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label
                      htmlFor="selectAllQuestions"
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                    >
                      {lang === "de" ? "Alle sichtbaren Fragen auswählen" : "Select all visible questions"}
                    </label>
                    {selectedQuestionIds.length > 0 && (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {selectedQuestionIds.length} {lang === "de" ? "ausgewählt" : "selected"}
                      </span>
                    )}
                  </div>

                  {selectedQuestionIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedQuestionIds([])}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {lang === "de" ? "Auswahl aufheben" : "Clear selection"}
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkDeleteQuestions}
                        disabled={isBulkDeleting}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {isBulkDeleting
                          ? (lang === "de" ? "Löscht..." : "Deleting...")
                          : (lang === "de"
                              ? `Ausgewählte löschen (${selectedQuestionIds.length})`
                              : `Delete selected (${selectedQuestionIds.length})`)}
                      </button>
                    </div>
                  )}
                </div>
              )}

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

                    const isSelected = selectedQuestionIds.includes(q.id);

                    return (
                      <div
                        key={q.id}
                        className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                          isSelected
                            ? "border-indigo-400 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 ring-1 ring-indigo-400"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            {/* Selection Checkbox */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectQuestion(q.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                              title={lang === "de" ? "Frage auswählen" : "Select question"}
                            />

                            <span className="text-xs font-mono font-bold text-slate-400">
                              #{idx + 1}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                q.type === "SINGLE_CHOICE"
                                  ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300"
                                  : q.type === "MULTIPLE_CHOICE"
                                  ? "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300"
                                  : q.type === "MATCHING"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                                  : "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300"
                              }`}
                            >
                              {q.type === "SINGLE_CHOICE"
                                ? "Single Choice"
                                : q.type === "MULTIPLE_CHOICE"
                                ? "Multiple Choice"
                                : q.type === "MATCHING"
                                ? "Zuordnung / Schema"
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

                        {/* Options preview for SC and MC */}
                        {(q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE") && parsedOptions.length > 0 && (
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

                        {/* Matching pairs preview */}
                        {q.type === "MATCHING" && parsedOptions.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {parsedOptions.map((opt: any, optIdx: number) => (
                              <div
                                key={optIdx}
                                className="p-2.5 rounded-xl text-xs bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 text-amber-950 dark:text-amber-200 flex items-center justify-between gap-2"
                              >
                                <span className="font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 flex-shrink-0">
                                  {opt.text}
                                </span>
                                <span className="text-slate-400 flex-shrink-0">➔</span>
                                <span className="truncate flex-1 text-right text-slate-700 dark:text-slate-300 font-medium">
                                  {opt.target || opt.explanation || "Zielfeld"}
                                </span>
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
        {/* TAB 3: KI-VORLESUNGS-TUTOR & DOKUMENTEN-CHAT */}
        {/* ========================================================================= */}
        {activeTab === "tutor" && (
          <div className="h-[750px] max-h-[82vh]">
            <ModuleTutorChat
              moduleId={moduleData.id}
              moduleName={moduleData.name}
              documentsCount={moduleData.documents?.length || 0}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: NOTEN- & MODULABSCHLUSS */}
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

      {/* Auth Modal for Login / Session Refresh */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          currentUser={currentUser}
          onSuccess={(u) => {
            setCurrentUser(u);
            setShowAuthModal(false);
            fetchModule();
          }}
          onLogout={() => {
            setCurrentUser(null);
            setShowAuthModal(false);
            fetchModule();
          }}
        />
      )}

      {/* Floating AI Tutor Quick Button */}
      {moduleData && activeTab !== "tutor" && (
        <button
          type="button"
          onClick={() => setIsTutorDrawerOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 text-white font-bold text-xs sm:text-sm shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20"
        >
          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          <span>{lang === "de" ? "Frag die Vorlesung" : "Ask the Lecture"}</span>
        </button>
      )}

      {/* Slide-over Drawer for Quick Tutor Q&A */}
      {isTutorDrawerOpen && moduleData && (
        <Portal>
          <div className="fixed inset-0 z-[110] flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-xl h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
              <ModuleTutorChat
                moduleId={moduleData.id}
                moduleName={moduleData.name}
                documentsCount={moduleData.documents?.length || 0}
                isOpenAsDrawer
                onCloseDrawer={() => setIsTutorDrawerOpen(false)}
              />
            </div>
          </div>
        </Portal>
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
