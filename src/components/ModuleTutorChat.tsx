"use client";

import React, { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/i18n";
import { MathMarkdownRenderer } from "./MathMarkdownRenderer";
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

  // AI status & connection state
  const [hasApiKey, setHasApiKey] = useState(false);
  const [activeProvider, setActiveProvider] = useState("gemini");
  const [activeModel, setActiveModel] = useState("gemini-2.5-flash");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const checkAiConfig = () => {
    if (typeof window === "undefined") return;
    const provider = localStorage.getItem("studyhub_ai_provider") || "gemini";
    const key =
      localStorage.getItem(`studyhub_api_key_${provider}`) ||
      localStorage.getItem("studyhub_api_key") ||
      localStorage.getItem("studyhub_api_key_gemini") ||
      "";
    const model =
      localStorage.getItem(`studyhub_ai_model_${provider}`) ||
      localStorage.getItem("studyhub_ai_model") ||
      (provider === "gemini" ? "gemini-2.5-flash" : provider === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet");

    setHasApiKey(Boolean(key && key.trim().length > 5));
    setActiveProvider(provider);
    setActiveModel(model);
  };

  useEffect(() => {
    checkAiConfig();

    const handleUpdate = () => checkAiConfig();
    window.addEventListener("studyhub_ai_config_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("studyhub_ai_config_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

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
        throw new Error(errorData.error || (lang === "de" ? `Serverfehler (${res.status})` : `Server error (${res.status})`));
      }

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: "a-" + Date.now(),
        role: "assistant",
        content: data.answer || (lang === "de" ? "Erklärung generiert." : "Explanation generated."),
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
                <div
                  title={lang === "de" ? "Gemini KI ist aktiv & mit deinem Key verbunden" : "Gemini AI is active & connected with your key"}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {activeProvider === "gemini" ? "Gemini" : activeProvider === "openai" ? "OpenAI" : "Claude"} {lang === "de" ? "aktiv & verbunden" : "active & connected"}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => window.dispatchEvent(new Event("studyhub_open_ai_settings"))}
                  title={lang === "de" ? "In Einstellungen verbinden" : "Connect in Settings"}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>{lang === "de" ? "KI in Einstellungen aktivieren" : "Activate AI in Settings"}</span>
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

                {/* Formatted Text Content with KaTeX Math & Mermaid Diagrams */}
                <MathMarkdownRenderer content={msg.content} />

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
