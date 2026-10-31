"use client";

import React, { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/i18n";
import {
  Sparkles,
  Send,
  Loader2,
  FileText,
  RotateCcw,
  BookOpen,
  Lightbulb,
  Copy,
  Check,
  X,
  HelpCircle,
  ArrowRight,
  MessageSquareText,
  Layers,
  Key,
  ExternalLink,
  Cpu,
  ShieldCheck,
} from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  examTip?: string;
  followUpSuggestions?: string[];
  modelUsed?: string;
  timestamp: Date;
}

interface ModuleTutorChatProps {
  moduleId: string;
  moduleName?: string;
  documentsCount?: number;
  isOpenAsDrawer?: boolean;
  onCloseDrawer?: () => void;
}

/**
 * Renders Mermaid diagrams as responsive, interactive SVG graphics.
 */
function MermaidRenderer({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderId = useRef(`m_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "loose",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        });
        const cleanCode = chart.trim();
        const id = `mermaid_${renderId.current}_${Date.now()}`;
        const { svg } = await mermaid.render(id, cleanCode);
        if (isMounted) {
          setSvg(svg);
          setError(null);
        }
      } catch (err: any) {
        console.warn("Mermaid render error:", err);
        if (isMounted) {
          setError(err.message || "Fehler beim Rendern des Diagramms");
        }
      }
    };
    renderChart();
    return () => {
      isMounted = false;
    };
  }, [chart]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <div className="my-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-xs overflow-x-auto text-slate-700 dark:text-slate-300">
        <div className="text-[10px] text-amber-500 font-bold mb-1">Diagramm-Code (Mermaid):</div>
        <pre>{chart}</pre>
      </div>
    );
  }

  return (
    <div className="my-3 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-b from-slate-50/80 to-white dark:from-slate-800/80 dark:to-slate-900/90 p-3 sm:p-4 shadow-xs overflow-hidden">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-700/60 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300">
          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Visuelles Modell / Struktur-Diagramm</span>
        </div>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Kopiert" : "Mermaid Code"}</span>
        </button>
      </div>
      <div
        ref={containerRef}
        className="w-full overflow-x-auto flex justify-center py-2 min-h-[100px] items-center [&_svg]:max-w-full [&_svg]:h-auto text-slate-800 dark:text-slate-200"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

export function ModuleTutorChat({
  moduleId,
  moduleName,
  documentsCount = 0,
  isOpenAsDrawer = false,
  onCloseDrawer,
}: ModuleTutorChatProps) {
  const { lang } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick API Key setup state
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keyToast, setKeyToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const key =
      localStorage.getItem("studyhub_api_key_gemini") ||
      localStorage.getItem("studyhub_api_key");
    if (key && key.trim().length > 5) {
      setHasApiKey(true);
    }
  }, []);

  const handleSaveApiKey = () => {
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) return;
    localStorage.setItem("studyhub_api_key_gemini", cleanKey);
    localStorage.setItem("studyhub_api_key", cleanKey);
    localStorage.setItem("studyhub_ai_provider", "gemini");
    setHasApiKey(true);
    setShowKeyModal(false);
    setApiKeyInput("");
    setKeyToast(
      lang === "de"
        ? "✓ Google Gemini API-Schlüssel erfolgreich gespeichert! Ab sofort antwortet Gemini 2.5 Flash."
        : "✓ Google Gemini API key saved successfully! Gemini 2.5 Flash is now active."
    );
    setTimeout(() => setKeyToast(null), 4000);
  };

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Suggested starter prompts
  const quickPrompts =
    lang === "de"
      ? [
          {
            label: "Kernkonzepte erklären",
            query: "Erkläre mir die wichtigsten Kernkonzepte dieses Moduls im Überblick.",
            icon: BookOpen,
          },
          {
            label: "Alltagsbeispiel & Analogie",
            query: "Erkläre mir ein schwieriges Hauptthema dieses Moduls ganz einfach mit einer anschaulichen Alltags-Analogie.",
            icon: Lightbulb,
          },
          {
            label: "Unterschiede & Trade-offs",
            query: "Was sind die wichtigsten Unterschiede, Vor- und Nachteile der Modelle in den Vorlesungsfolien?",
            icon: HelpCircle,
          },
          {
            label: "Typische Klausurfallen",
            query: "Welche typischen Klausurfallen, Prüferfragen und Denkfehler gibt es bei diesem Stoff?",
            icon: Sparkles,
          },
        ]
      : [
          {
            label: "Explain Core Concepts",
            query: "Explain the primary core concepts of this course in an easy-to-understand overview.",
            icon: BookOpen,
          },
          {
            label: "Everyday Analogy",
            query: "Explain a difficult topic from this module using a vivid everyday analogy.",
            icon: Lightbulb,
          },
          {
            label: "Trade-offs & Comparisons",
            query: "What are the key trade-offs, advantages, and disadvantages discussed in the slides?",
            icon: HelpCircle,
          },
          {
            label: "Common Exam Pitfalls",
            query: "What are typical exam pitfalls, favorite professor questions, and misunderstandings?",
            icon: Sparkles,
          },
        ];

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: "u-" + Date.now(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Retrieve active provider & API key from localStorage
    let storedProvider = localStorage.getItem("studyhub_ai_provider") || "gemini";
    let storedKey =
      localStorage.getItem(`studyhub_api_key_${storedProvider}`) ||
      localStorage.getItem("studyhub_api_key") ||
      (storedProvider === "gemini" ? localStorage.getItem("studyhub_api_key_gemini") : undefined) ||
      undefined;

    if (!storedKey) {
      const geminiKey = localStorage.getItem("studyhub_api_key_gemini");
      const openaiKey = localStorage.getItem("studyhub_api_key_openai");
      const anthropicKey = localStorage.getItem("studyhub_api_key_anthropic");
      if (geminiKey) {
        storedProvider = "gemini";
        storedKey = geminiKey;
      } else if (openaiKey) {
        storedProvider = "openai";
        storedKey = openaiKey;
      } else if (anthropicKey) {
        storedProvider = "anthropic";
        storedKey = anthropicKey;
      }
    }

    try {
      const chatHistoryForBackend = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/tutor/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          question: textToSend,
          chatHistory: chatHistoryForBackend,
          apiKey: storedKey,
          provider: storedProvider,
          lang,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Serverfehler (${res.status})`);
      }

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: "a-" + Date.now(),
        role: "assistant",
        content: data.answer || "Erklärung generiert.",
        sources: data.sources || [],
        examTip: data.examTip,
        followUpSuggestions: data.followUpSuggestions || [],
        modelUsed: data.modelUsed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Tutor request error:", err);
      const errorMessage: ChatMessage = {
        id: "err-" + Date.now(),
        role: "assistant",
        content:
          lang === "de"
            ? `Entschuldigung, beim Beantworten ist ein Fehler aufgetreten: ${err.message}. Bitte überprüfe deine Netzwerkverbindung oder deinen API-Schlüssel in den Einstellungen.`
            : `Sorry, an error occurred while generating the answer: ${err.message}. Please verify your connection or API key in settings.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resetChat = () => {
    if (messages.length === 0) return;
    if (
      confirm(
        lang === "de"
          ? "Möchtest du den bisherigen Gesprächsverlauf löschen und einen neuen Chat beginnen?"
          : "Do you want to clear the conversation and start a new chat?"
      )
    ) {
      setMessages([]);
      setInput("");
    }
  };

  const renderInlineMarkdown = (content: string) => {
    const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className="font-bold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/80 font-mono text-[11px] text-indigo-600 dark:text-indigo-300 border border-slate-200 dark:border-slate-600"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const renderMarkdownSection = (sectionText: string, keyPrefix: string) => {
    const paragraphs = sectionText.split(/\n\s*\n/);
    return (
      <div key={keyPrefix} className="space-y-2.5">
        {paragraphs.map((para, pIdx) => {
          const trimmed = para.trim();
          if (!trimmed) return null;

          // H1 Headings
          if (trimmed.startsWith("# ")) {
            return (
              <h1
                key={pIdx}
                className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-4 mb-2 pb-1 border-b border-slate-200 dark:border-slate-700"
              >
                {renderInlineMarkdown(trimmed.replace(/^#\s+/, ""))}
              </h1>
            );
          }

          // H2 Headings
          if (trimmed.startsWith("## ")) {
            return (
              <h2
                key={pIdx}
                className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-3.5 mb-1.5"
              >
                {renderInlineMarkdown(trimmed.replace(/^##\s+/, ""))}
              </h2>
            );
          }

          // H3 Headings
          if (trimmed.startsWith("### ")) {
            return (
              <h3
                key={pIdx}
                className="text-xs sm:text-sm font-bold text-indigo-700 dark:text-indigo-400 mt-3 mb-1"
              >
                {renderInlineMarkdown(trimmed.replace(/^###\s+/, ""))}
              </h3>
            );
          }

          // Horizontal rule
          if (trimmed === "---" || trimmed === "***") {
            return <hr key={pIdx} className="my-3 border-slate-200 dark:border-slate-700" />;
          }

          // Blockquote / Tip
          if (trimmed.startsWith("> ")) {
            return (
              <div
                key={pIdx}
                className="p-3 my-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-500 text-xs text-slate-700 dark:text-slate-300 italic"
              >
                {renderInlineMarkdown(trimmed.replace(/^>\s*/, ""))}
              </div>
            );
          }

          // Regular paragraph or bullet list
          const lines = trimmed.split("\n");
          return (
            <div key={pIdx} className="text-xs sm:text-sm text-slate-800 dark:text-slate-200">
              {lines.map((line, lIdx) => {
                const isBullet =
                  line.trim().startsWith("- ") ||
                  line.trim().startsWith("• ") ||
                  line.trim().startsWith("* ");
                const cleanLine = isBullet ? line.trim().replace(/^[-•*]\s*/, "") : line;

                return (
                  <span
                    key={lIdx}
                    className={
                      isBullet
                        ? "block pl-4 relative my-1 text-slate-700 dark:text-slate-200"
                        : "block my-0.5 leading-relaxed"
                    }
                  >
                    {isBullet && (
                      <span className="absolute left-0 text-indigo-500 font-bold">•</span>
                    )}
                    {renderInlineMarkdown(cleanLine)}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const renderFormattedText = (text: string) => {
    const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
    const segments: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mermaidRegex.exec(text)) !== null) {
      const textBefore = text.slice(lastIndex, match.index);
      if (textBefore.trim()) {
        segments.push(renderMarkdownSection(textBefore, `pre_${lastIndex}`));
      }
      const chartCode = match[1];
      segments.push(<MermaidRenderer key={`chart_${match.index}`} chart={chartCode} />);
      lastIndex = match.index + match[0].length;
    }

    const remainingText = text.slice(lastIndex);
    if (remainingText.trim()) {
      segments.push(renderMarkdownSection(remainingText, `post_${lastIndex}`));
    }

    return <div className="space-y-3 leading-relaxed">{segments}</div>;
  };

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-slate-900 ${
        isOpenAsDrawer ? "p-0" : "rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm"
      }`}
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {lang === "de" ? "KI-Vorlesungs-Tutor" : "AI Lecture Tutor"}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {documentsCount} {lang === "de" ? "Dokumente im Kontext" : "Docs in context"}
              </span>

              {hasApiKey ? (
                <button
                  onClick={() => setShowKeyModal((prev) => !prev)}
                  title="Gemini API Key verwalten"
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                >
                  <Cpu className="w-3 h-3 text-indigo-500" />
                  <span>Gemini AI aktiv</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowKeyModal((prev) => !prev)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                >
                  <Key className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>{lang === "de" ? "Gemini Key eingeben" : "Add Gemini Key"}</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === "de"
                ? "Frage alles zu deinen Vorlesungsfolien, Skripten & Altklausuren (inkl. Diagrammen)"
                : "Ask anything grounded in your lecture slides & past exams (including diagrams)"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={resetChat}
              title={lang === "de" ? "Neuen Chat beginnen" : "Start new chat"}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {isOpenAsDrawer && onCloseDrawer && (
            <button
              onClick={onCloseDrawer}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick API Key Dropdown Banner */}
      {showKeyModal && (
        <div className="p-3.5 bg-indigo-50/90 dark:bg-slate-800/95 border-b border-indigo-200 dark:border-slate-700 animate-in slide-in-from-top duration-150">
          <div className="max-w-xl mx-auto space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                <Key className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>
                  {lang === "de"
                    ? "Kostenlosen Google Gemini API-Schlüssel hinterlegen"
                    : "Add free Google Gemini API Key"}
                </span>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
              {lang === "de"
                ? "Mit deinem Gemini-Key erhältst du unbegrenzte, frei formulierende KI-Antworten in Echtzeit. Dein Key bleibt lokal in deinem Browser gespeichert."
                : "With your Gemini key, you unlock unlimited live conversational AI answers. Stored locally in your browser."}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim()}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
              >
                {lang === "de" ? "Speichern" : "Save"}
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <span>Google AI Studio Key holen (dauert 30 Sek., kostenlos)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span>Funktioniert auch ohne Key mit der lokalen Wissens-Engine</span>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Toast */}
      {keyToast && (
        <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>{keyToast}</span>
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
        {/* Welcome State when empty */}
        {messages.length === 0 && (
          <div className="max-w-xl mx-auto py-8 text-center space-y-6 animate-in fade-in duration-300">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
              <MessageSquareText className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {lang === "de"
                  ? `Wie kann ich dir bei ${moduleName || "deinem Modul"} helfen?`
                  : `How can I help you with ${moduleName || "your course"}?`}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === "de"
                  ? "Ich antworte fundiert anhand deiner hochgeladenen Dokumente, erstelle visuelle Diagramme und gebe dir wertvolle Prüfer-Tipps für die Klausur."
                  : "I provide clear explanations grounded in your uploaded course materials, render visual diagrams, and share practical exam tips."}
              </p>
            </div>

            {/* Quick Starters */}
            <div className="pt-2 text-left">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3 text-center">
                {lang === "de" ? "Vorschläge zum Ausprobieren:" : "Suggested questions to start:"}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {quickPrompts.map((p, idx) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(p.query)}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 text-left transition-all duration-150 cursor-pointer shadow-2xs group flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {p.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {p.query}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Conversation turns */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            } animate-in fade-in duration-200`}
          >
            {/* User message */}
            {msg.role === "user" ? (
              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs bg-indigo-600 text-white px-4 py-3 shadow-sm text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </div>
            ) : (
              /* Assistant message */
              <div className="max-w-[95%] sm:max-w-[88%] rounded-2xl rounded-tl-xs bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 p-4 sm:p-5 shadow-xs space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {lang === "de" ? "Vorlesungs-Tutor" : "Lecture Tutor"}
                    </span>
                    {msg.modelUsed && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({msg.modelUsed})
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => copyToClipboard(msg.content, msg.id)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500 font-semibold">
                          {lang === "de" ? "Kopiert" : "Copied"}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{lang === "de" ? "Kopieren" : "Copy"}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Formatted Text Content with Mermaid Diagrams */}
                {renderFormattedText(msg.content)}

                {/* Exam Tip Callout */}
                {msg.examTip && (
                  <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>{lang === "de" ? "Prüfer-Tipp für die Klausur:" : "Professor Exam Tip:"}</span>
                    </div>
                    <p className="text-xs text-amber-950 dark:text-amber-200 leading-relaxed font-medium">
                      {msg.examTip}
                    </p>
                  </div>
                )}

                {/* Sources Used */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-2 flex-wrap text-xs">
                    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-bold text-[11px]">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      {lang === "de" ? "Quellen:" : "Sources:"}
                    </span>
                    {msg.sources.map((src, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-medium border border-slate-200 dark:border-slate-600"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                )}

                {/* Follow-up suggestions */}
                {msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      {lang === "de" ? "Anschlussfragen zum Weiterfragen:" : "Follow-up questions:"}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.followUpSuggestions.map((suggestion, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => handleSendMessage(suggestion)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer text-left"
                        >
                          <span>{suggestion}</span>
                          <ArrowRight className="w-3 h-3 text-indigo-500 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-50/60 dark:bg-slate-800/80 border border-indigo-100 dark:border-slate-700 max-w-[80%] animate-in fade-in duration-150">
            <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {lang === "de" ? "KI analysiert Vorlesungsunterlagen..." : "AI is analyzing course materials..."}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === "de"
                  ? "RAG generiert strukturierte Erklärung & Diagramme."
                  : "RAG is synthesizing slides into structured concepts & diagrams."}
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="relative flex items-end gap-2 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-300 dark:border-slate-700 p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={
              lang === "de"
                ? "Frage etwas zur Vorlesung (z. B. 'Erkläre mir die wichtigsten Kernkonzepte', 'Was bedeutet Ambidexterie?')..."
                : "Ask anything about your lecture (e.g. 'Explain the core concepts', 'What is Ambidexterity?')..."
            }
            className="flex-1 bg-transparent border-0 resize-none p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden leading-relaxed"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isLoading}
            className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all cursor-pointer shrink-0 ${
              input.trim() && !isLoading
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md scale-100"
                : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed opacity-60"
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
          <span>
            {lang === "de"
              ? "Drücke Enter zum Senden • Shift+Enter für neue Zeile"
              : "Press Enter to send • Shift+Enter for new line"}
          </span>
          <span className="hidden sm:inline">
            {lang === "de"
              ? "Antwortet basierend auf deinen Vorlesungsdateien"
              : "Answers based on your uploaded lecture files"}
          </span>
        </div>
      </div>
    </div>
  );
}
