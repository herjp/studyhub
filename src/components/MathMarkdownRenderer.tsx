"use client";

import React, { useState, useEffect, useRef } from "react";
import katex from "katex";

export function renderKaTeXHTML(latex: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode,
      throwOnError: false,
    });
  } catch (err: any) {
    return `<span class="text-rose-500 font-mono text-xs">${latex}</span>`;
  }
}

/**
 * Renders Mermaid diagrams as responsive, interactive SVG graphics.
 */
export function MermaidRenderer({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
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

  if (error) {
    return (
      <div className="p-3 my-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 font-mono">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="p-6 my-2 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-xs text-slate-400 animate-pulse">
        Diagramm wird generiert...
      </div>
    );
  }

  return (
    <div className="my-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs overflow-x-auto flex justify-center">
      <div
        className="w-full max-w-full flex justify-center"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

/**
 * Parses inline math ($...$, \(...\), and bare formulas), bold, and code.
 */
export function renderInlineMathAndMarkdown(content: string): React.ReactNode[] {
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\([\s\S]+?\\\)|`[^`]+`|\*\*[^*]+\*\*|(?:\b[A-Z]\s*=\s*f\([A-Za-z,\s]+\)))/g;
  const parts = content.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Display math block $$ ... $$
    if (part.startsWith("$$") && part.endsWith("$$") && part.length > 4) {
      const formula = part.slice(2, -2).trim();
      const html = renderKaTeXHTML(formula, true);
      return (
        <span
          key={idx}
          className="block my-3 py-2 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 overflow-x-auto text-center"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Inline math $ ... $
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      const formula = part.slice(1, -1).trim();
      const html = renderKaTeXHTML(formula, false);
      return (
        <span
          key={idx}
          className="inline-math px-1 py-0.5 rounded bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-serif font-medium"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // LaTeX escaped inline math \( ... \)
    if (part.startsWith("\\(") && part.endsWith("\\)") && part.length > 4) {
      const formula = part.slice(2, -2).trim();
      const html = renderKaTeXHTML(formula, false);
      return (
        <span
          key={idx}
          className="inline-math px-1 py-0.5 rounded bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-serif font-medium"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Bare formula pattern (e.g. V = f(P, U))
    if (/^[A-Z]\s*=\s*f\([A-Za-z,\s]+\)$/.test(part.trim())) {
      const html = renderKaTeXHTML(part.trim(), false);
      return (
        <span
          key={idx}
          className="inline-math px-1.5 py-0.5 rounded bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-200 font-serif font-bold border border-indigo-200/60 dark:border-indigo-800/60"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Bold text ** ... **
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-bold text-slate-900 dark:text-white">
          {renderInlineMathAndMarkdown(part.slice(2, -2))}
        </strong>
      );
    }

    // Inline code ` ... `
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
}

/**
 * Formats markdown paragraphs, headings, blockquotes, math blocks, and lists.
 */
export function renderMarkdownSection(sectionText: string, keyPrefix: string): React.ReactNode {
  const paragraphs = sectionText.split(/\n\s*\n/);

  return (
    <div key={keyPrefix} className="space-y-2.5">
      {paragraphs.map((para, pIdx) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // Dedicated Display Math block $$ ... $$
        if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4) {
          const formula = trimmed.slice(2, -2).trim();
          const html = renderKaTeXHTML(formula, true);
          return (
            <div
              key={pIdx}
              className="my-3 py-3 px-5 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 overflow-x-auto flex justify-center shadow-2xs text-slate-900 dark:text-white"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        // H1 Headings
        if (trimmed.startsWith("# ")) {
          return (
            <h1
              key={pIdx}
              className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-4 mb-2 pb-1 border-b border-slate-200 dark:border-slate-700"
            >
              {renderInlineMathAndMarkdown(trimmed.replace(/^#\s+/, ""))}
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
              {renderInlineMathAndMarkdown(trimmed.replace(/^##\s+/, ""))}
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
              {renderInlineMathAndMarkdown(trimmed.replace(/^###\s+/, ""))}
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
              {renderInlineMathAndMarkdown(trimmed.replace(/^>\s*/, ""))}
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
                  {renderInlineMathAndMarkdown(cleanLine)}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Universal Rich Text Renderer: Parses Mermaid diagrams, LaTeX Math, and Markdown seamlessly.
 */
export function MathMarkdownRenderer({ content, className = "" }: { content: string; className?: string }) {
  if (!content) return null;

  const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mermaidRegex.exec(content)) !== null) {
    const textBefore = content.slice(lastIndex, match.index);
    if (textBefore.trim()) {
      segments.push(renderMarkdownSection(textBefore, `pre_${lastIndex}`));
    }
    const chartCode = match[1];
    segments.push(<MermaidRenderer key={`chart_${match.index}`} chart={chartCode} />);
    lastIndex = match.index + match[0].length;
  }

  const remainingText = content.slice(lastIndex);
  if (remainingText.trim()) {
    segments.push(renderMarkdownSection(remainingText, `post_${lastIndex}`));
  }

  return <div className={`space-y-3 leading-relaxed ${className}`}>{segments}</div>;
}
