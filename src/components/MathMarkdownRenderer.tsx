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
 * Parses inline math ($...$, \(...\), and bare mathematical formulas), bold, code, and symbols.
 */
export function renderInlineMathAndMarkdown(content: string): React.ReactNode[] {
  if (!content) return [];

  // Match:
  // 1. Display math: $$ ... $$
  // 2. Inline math: $ ... $
  // 3. LaTeX escaped math: \( ... \)
  // 4. Inline code: ` ... `
  // 5. Bold: ** ... **
  // 6. Bare function formulas like V = f(P, U), E = mc^2, f(x) = y
  // 7. Inequalities / relational math: e.g. alpha <= beta, x <= y, a >= b
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\([\s\S]+?\\\)|`[^`]+`|\*\*[^*]+\*\*|(?:\b[A-Za-z]\s*=\s*[A-Za-z0-9_]+\([A-Za-z0-9_,\s]+\))|(?:\b[A-Za-z0-9_]+\s*(?:<=|>=|!=|<|>)\s*[A-Za-z0-9_]+))/g;
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
          className="inline-math px-1.5 py-0.5 rounded bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-serif font-medium"
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
          className="inline-math px-1.5 py-0.5 rounded bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-serif font-medium"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Bare formula pattern (e.g. V = f(P, U), E = mc^2)
    if (/^[A-Za-z]\s*=\s*[A-Za-z0-9_]+\([A-Za-z0-9_,\s]+\)$/.test(part.trim())) {
      const html = renderKaTeXHTML(part.trim(), false);
      return (
        <span
          key={idx}
          className="inline-math px-1.5 py-0.5 rounded bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-200 font-serif font-bold border border-indigo-200/60 dark:border-indigo-800/60"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Bare inequality pattern (e.g. alpha <= beta, x >= y)
    if (/^[A-Za-z0-9_]+\s*(?:<=|>=|!=|<|>)\s*[A-Za-z0-9_]+$/.test(part.trim())) {
      let latexExpr = part.trim()
        .replace(/<=/g, "\\le ")
        .replace(/>=/g, "\\ge ")
        .replace(/!=/g, "\\ne ");
      const html = renderKaTeXHTML(latexExpr, false);
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
 * Universal Markdown Section Renderer:
 * Line-by-line block parser that cleanly translates:
 * - `# ` -> H1
 * - `## ` -> H2
 * - `### ` -> H3
 * - `#### ` -> H4
 * - `---` -> HR
 * - `> ` -> Blockquote / Callout
 * - `- `, `* `, `• `, `1. ` -> Lists
 * - Code blocks (``` ... ```)
 * - Standard paragraphs with inline math & styling
 * ZERO raw hashtags ever leaked to user view!
 */
export function renderMarkdownSection(sectionText: string, keyPrefix: string): React.ReactNode {
  if (!sectionText) return null;

  // Split lines while preserving blocks
  const rawLines = sectionText.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let currentListItems: React.ReactNode[] = [];
  let isCurrentListOrdered = false;

  const flushList = (keySuffix: string | number) => {
    if (currentListItems.length > 0) {
      if (isCurrentListOrdered) {
        elements.push(
          <ol key={`ol_${keyPrefix}_${keySuffix}`} className="list-decimal pl-5 space-y-1 my-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
            {currentListItems}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul_${keyPrefix}_${keySuffix}`} className="space-y-1 my-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
            {currentListItems}
          </ul>
        );
      }
      currentListItems = [];
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList(i);
      continue;
    }

    // Horizontal Rule
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      flushList(i);
      elements.push(
        <hr key={`hr_${i}`} className="my-4 border-slate-200 dark:border-slate-700/80" />
      );
      continue;
    }

    // Display Math $$ ... $$ on a single line
    if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4) {
      flushList(i);
      const formula = trimmed.slice(2, -2).trim();
      const html = renderKaTeXHTML(formula, true);
      elements.push(
        <div
          key={`math_${i}`}
          className="my-3 py-3 px-5 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 overflow-x-auto flex justify-center shadow-2xs text-slate-900 dark:text-white"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
      continue;
    }

    // H1 Heading (# ...)
    if (/^#\s+/.test(trimmed)) {
      flushList(i);
      const text = trimmed.replace(/^#\s+/, "");
      elements.push(
        <h1
          key={`h1_${i}`}
          className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-4 mb-2 pb-1 border-b border-slate-200 dark:border-slate-700 leading-snug"
        >
          {renderInlineMathAndMarkdown(text)}
        </h1>
      );
      continue;
    }

    // H2 Heading (## ...)
    if (/^##\s+/.test(trimmed)) {
      flushList(i);
      const text = trimmed.replace(/^##\s+/, "");
      elements.push(
        <h2
          key={`h2_${i}`}
          className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-3.5 mb-1.5 leading-snug"
        >
          {renderInlineMathAndMarkdown(text)}
        </h2>
      );
      continue;
    }

    // H3 Heading (### ...)
    if (/^###\s+/.test(trimmed)) {
      flushList(i);
      const text = trimmed.replace(/^###\s+/, "");
      elements.push(
        <h3
          key={`h3_${i}`}
          className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-3 mb-1 leading-snug"
        >
          {renderInlineMathAndMarkdown(text)}
        </h3>
      );
      continue;
    }

    // H4 Heading (#### ...)
    if (/^####\s+/.test(trimmed)) {
      flushList(i);
      const text = trimmed.replace(/^####\s+/, "");
      elements.push(
        <h4
          key={`h4_${i}`}
          className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-300 mt-2 mb-1 leading-snug"
        >
          {renderInlineMathAndMarkdown(text)}
        </h4>
      );
      continue;
    }

    // Blockquote (> ...)
    if (trimmed.startsWith(">")) {
      flushList(i);
      const text = trimmed.replace(/^>\s*/, "");
      elements.push(
        <div
          key={`quote_${i}`}
          className="p-3 my-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-500 text-xs text-slate-700 dark:text-slate-300 italic"
        >
          {renderInlineMathAndMarkdown(text)}
        </div>
      );
      continue;
    }

    // Bullet List Item (- ..., * ..., • ...)
    if (/^[-*•]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*•]\s+/, "");
      isCurrentListOrdered = false;
      currentListItems.push(
        <li key={`li_${i}`} className="pl-1 relative leading-relaxed">
          <span className="text-indigo-500 font-bold mr-1.5">•</span>
          {renderInlineMathAndMarkdown(itemText)}
        </li>
      );
      continue;
    }

    // Numbered List Item (1. ..., 2. ...)
    if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s+(.*)$/);
      const itemText = match ? match[2] : trimmed;
      isCurrentListOrdered = true;
      currentListItems.push(
        <li key={`li_${i}`} className="pl-1 leading-relaxed">
          {renderInlineMathAndMarkdown(itemText)}
        </li>
      );
      continue;
    }

    // Regular Paragraph Line
    flushList(i);
    elements.push(
      <p key={`p_${i}`} className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed my-1">
        {renderInlineMathAndMarkdown(trimmed)}
      </p>
    );
  }

  flushList("end");

  return (
    <div key={keyPrefix} className="space-y-1">
      {elements}
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

  return <div className={`space-y-2 leading-relaxed ${className}`}>{segments}</div>;
}
