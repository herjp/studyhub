import { searchModuleDocuments, getPastExamStyleContext } from "./rag";
import { isValidPdfText } from "./pdf-extractor";

export interface EvaluationResult {
  score: number;
  maxScore: number;
  isCorrect: boolean;
  accuracyComment: string;
  detectedKeyTerms: string[];
  missingKeyTerms: string[];
  feedback: string;
  sourceRef: string;
  modelUsed: string;
}

export interface SummaryResult {
  topicName: string;
  summary: string;
  coreConcepts: string[];
  examTips: string[];
  sourceRefs: string[];
  modelUsed: string;
}

export interface GeneratedQuestion {
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "FREE_TEXT" | "MATCHING";
  questionText: string;
  options?: Array<{
    text: string;
    isCorrect?: boolean;
    explanation?: string;
    target?: string;
  }>;
  sampleSolution?: string;
  sourceRef: string;
  topicName?: string;
}

/**
 * Robust JSON extraction from raw model response, handling markdown blocks & formatting.
 */
export function extractJSONFromText(text: string): any {
  if (!text) throw new Error("Leere Modell-Antwort.");
  const clean = text.trim();
  try {
    return JSON.parse(clean);
  } catch {}

  // Try extracting from markdown code block ```json ... ```
  const codeBlockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  // Try finding outer brackets [ ... ] or { ... }
  const firstBracket = clean.indexOf("[");
  const firstBrace = clean.indexOf("{");
  let startIdx = -1;
  let endIdx = -1;

  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    startIdx = firstBracket;
    endIdx = clean.lastIndexOf("]");
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
    endIdx = clean.lastIndexOf("}");
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    try {
      return JSON.parse(clean.substring(startIdx, endIdx + 1));
    } catch {}
  }

  throw new Error(`Konnte kein valides JSON aus der Modell-Antwort parsen: ${clean.slice(0, 100)}...`);
}

// Cache available models per API key for 15 minutes to avoid redundant list calls
const geminiModelCache = new Map<string, { models: string[]; timestamp: number }>();

export async function getAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const cached = geminiModelCache.get(apiKey);
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 15) {
    return cached.models;
  }

  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: "GET", signal: AbortSignal.timeout(3000) }
    );
    if (listRes.ok) {
      const data = await listRes.json();
      if (Array.isArray(data.models)) {
        const supported = data.models
          .filter(
            (m: any) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes("generateContent")
          )
          .map((m: any) => m.name.replace(/^models\//, ""));

        if (supported.length > 0) {
          geminiModelCache.set(apiKey, { models: supported, timestamp: Date.now() });
          return supported;
        }
      }
    }
  } catch (err: any) {
    console.warn("Could not dynamically list Gemini models:", err.message);
  }

  return [];
}

/**
 * Resolves the optimal Gemini models to try in descending order of capability.
 * Prioritizes models verified to exist on the user's specific API key.
 */
export async function resolveGeminiModelsToTry(apiKey: string, preferredModel?: string): Promise<string[]> {
  const dynamicModels = await getAvailableGeminiModels(apiKey);

  // Modern production Gemini models supported for generateContent in Google Gemini API
  const modernPreferred = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
  ];

  const modelsToTry: string[] = [];

  // Use preferred model if specified and supported
  if (
    preferredModel &&
    !preferredModel.includes("1.0")
  ) {
    modelsToTry.push(preferredModel);
  }

  if (dynamicModels.length > 0) {
    // 1. Pick preferred models that exist in dynamic list
    for (const m of modernPreferred) {
      if (dynamicModels.includes(m) && !modelsToTry.includes(m)) {
        modelsToTry.push(m);
      }
    }
    // 2. Add other supported generateContent models from the API key
    for (const d of dynamicModels) {
      if (
        !modelsToTry.includes(d) &&
        !d.includes("embedding") &&
        !d.includes("tts") &&
        !d.includes("imagen")
      ) {
        modelsToTry.push(d);
      }
    }
  } else {
    // Fallback if dynamic listing failed
    for (const m of modernPreferred) {
      if (!modelsToTry.includes(m)) {
        modelsToTry.push(m);
      }
    }
  }

  return modelsToTry.slice(0, 3);
}

/**
 * Universal call to Google Gemini REST API.
 */
export async function callGeminiJSON(
  prompt: string,
  apiKey: string,
  systemInstruction?: string,
  preferredModel?: string
): Promise<{ parsed: any; modelUsed: string }> {
  const uniqueModels = await resolveGeminiModelsToTry(apiKey, preferredModel);
  let lastError: any = null;

  for (const model of uniqueModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload: any = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`Gemini (${model}) returned status ${res.status}:`, errorText);
        lastError = new Error(`Gemini (${model}): ${res.status} ${errorText}`);
        continue;
      }

      const json = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        console.warn(`Gemini (${model}) returned empty text.`);
        lastError = new Error(`Empty response from Gemini ${model}`);
        continue;
      }

      const parsed = extractJSONFromText(rawText);
      return { parsed, modelUsed: model };
    } catch (err: any) {
      console.warn(`Error invoking Gemini model ${model}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models failed to generate content.");
}

/**
 * Universal call to OpenAI REST API.
 */
export async function callOpenAIJSON(
  prompt: string,
  apiKey: string,
  systemInstruction?: string,
  preferredModel?: string
): Promise<{ parsed: any; modelUsed: string }> {
  const models = preferredModel
    ? [preferredModel, "gpt-4o", "gpt-4o-mini"]
    : ["gpt-4o", "gpt-4o-mini"];
  const uniqueModels = Array.from(new Set(models));
  let lastError: any = null;

  for (const model of uniqueModels) {
    try {
      const messages: any[] = [];
      if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
      }
      messages.push({ role: "user", content: prompt });

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = new Error(`OpenAI (${model}): ${res.status} ${errText}`);
        continue;
      }

      const json = await res.json();
      const rawText = json.choices?.[0]?.message?.content;
      if (!rawText) {
        lastError = new Error(`Empty response from OpenAI (${model})`);
        continue;
      }

      const parsed = extractJSONFromText(rawText);
      return { parsed, modelUsed: model };
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error("OpenAI API call failed.");
}

/**
 * Universal call to Anthropic Claude REST API.
 */
export async function callAnthropicJSON(
  prompt: string,
  apiKey: string,
  systemInstruction?: string,
  preferredModel?: string
): Promise<{ parsed: any; modelUsed: string }> {
  const models = preferredModel
    ? [preferredModel, "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"]
    : ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"];
  const uniqueModels = Array.from(new Set(models));
  let lastError: any = null;

  for (const model of uniqueModels) {
    try {
      const payload: any = {
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      };
      if (systemInstruction) {
        payload.system = systemInstruction;
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = new Error(`Anthropic (${model}): ${res.status} ${errText}`);
        continue;
      }

      const json = await res.json();
      const rawText = json.content?.[0]?.text;
      if (!rawText) {
        lastError = new Error(`Empty response from Anthropic (${model})`);
        continue;
      }

      const parsed = extractJSONFromText(rawText);
      return { parsed, modelUsed: model };
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error("Anthropic API call failed.");
}

/**
 * Universal router to invoke chosen AI provider.
 */
export async function callUniversalAIJSON(params: {
  prompt: string;
  systemInstruction?: string;
  provider?: string;
  apiKey?: string;
  model?: string;
}): Promise<{ parsed: any; modelUsed: string }> {
  const { prompt, systemInstruction, model } = params;
  const provider = params.provider || "gemini";
  const apiKey = params.apiKey;

  if (provider === "openai" && (apiKey || process.env.OPENAI_API_KEY)) {
    return callOpenAIJSON(prompt, (apiKey || process.env.OPENAI_API_KEY)!, systemInstruction, model);
  }

  if (provider === "anthropic" && (apiKey || process.env.ANTHROPIC_API_KEY)) {
    return callAnthropicJSON(prompt, (apiKey || process.env.ANTHROPIC_API_KEY)!, systemInstruction, model);
  }

  // Default to Gemini
  const activeKey = apiKey || process.env.GEMINI_API_KEY;
  if (!activeKey) {
    throw new Error("Kein API-Schlüssel für Google Gemini, OpenAI oder Anthropic hinterlegt.");
  }

  return callGeminiJSON(prompt, activeKey, systemInstruction, model);
}

/**
 * Evaluates a student's free text response using LLM (Gemini, OpenAI, Anthropic, or smart local engine).
 */
export async function evaluateFreeTextAnswer(params: {
  moduleId: string;
  questionText: string;
  sampleSolution: string;
  userAnswer: string;
  sourceRef?: string | null;
  apiKey?: string;
  provider?: "openai" | "anthropic" | "gemini" | "local" | string;
}): Promise<EvaluationResult> {
  const { moduleId, questionText, sampleSolution, userAnswer, apiKey, provider = "local" } = params;

  // Retrieve relevant RAG context from uploaded module slides & past exams
  const relevantChunks = await searchModuleDocuments(moduleId, `${questionText} ${sampleSolution}`, 2);
  const ragContext = relevantChunks
    .map((c) => `[Quelle: ${c.documentTitle}]\n${c.textSnippet}`)
    .join("\n\n");

  const effectiveSourceRef =
    params.sourceRef ||
    (relevantChunks.length > 0
      ? `${relevantChunks[0].documentTitle}`
      : "Vorlesungsunterlagen");

  const systemInstruction = `Du bist ein erfahrener Universitätsprofessor und Klausurprüfer.
Bewerte die Antwort eines Studierenden auf eine Klausuraufgabe objektiv, akademisch präzise und konstruktiv.
Erkenne Fachbegriffe, beurteile inhaltliche Richtigkeit und Vollständigkeit anhand der Musterlösung und der Vorlesungsfolien.
Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "score": number (0 bis 5 Punkte, 0.5 Schritte erlaubt),
  "maxScore": 5,
  "isCorrect": boolean (true wenn score >= 3.0),
  "accuracyComment": "Kurzes Fazit zur inhaltlichen Korrektheit",
  "detectedKeyTerms": ["Fachbegriff 1", "Fachbegriff 2"],
  "missingKeyTerms": ["Fehlender Begriff 1"],
  "feedback": "Detailliertes, wohlwollendes aber präzises Feedback",
  "sourceRef": "${effectiveSourceRef}"
}`;

  const userPrompt = `AUFGABE:
${questionText}

MUSTERLÖSUNG:
${sampleSolution}

VORLESUNGSMATERIALIEN / ALTKLAUSUREN:
${ragContext}

ANTWORT DES STUDIERENDEN:
${userAnswer}`;

  // Try Universal AI Router if API key or provider is set
  if (apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
    try {
      const { parsed, modelUsed } = await callUniversalAIJSON({
        prompt: userPrompt,
        systemInstruction,
        provider,
        apiKey,
      });

      return {
        score: typeof parsed.score === "number" ? Math.min(5, Math.max(0, parsed.score)) : 3,
        maxScore: 5,
        isCorrect: typeof parsed.isCorrect === "boolean" ? parsed.isCorrect : (parsed.score >= 3),
        accuracyComment: parsed.accuracyComment || "KI-Bewertung abgeschlossen",
        detectedKeyTerms: Array.isArray(parsed.detectedKeyTerms) ? parsed.detectedKeyTerms : [],
        missingKeyTerms: Array.isArray(parsed.missingKeyTerms) ? parsed.missingKeyTerms : [],
        feedback: parsed.feedback || "Antwort erfolgreich geprüft.",
        sourceRef: parsed.sourceRef || effectiveSourceRef,
        modelUsed: `${provider.toUpperCase()} (${modelUsed})`,
      };
    } catch (err: any) {
      console.warn(`KI evaluation with provider ${provider} failed, falling back:`, err.message);
    }
  }

  // Local Semantic Grading Engine (Fallback)
  const cleanAnswer = userAnswer.trim();
  const lowerAnswer = cleanAnswer.toLowerCase();

  const potentialTerms = sampleSolution
    .replace(/[.,:;()\[\]"'/\\-]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 4 &&
        !["diese", "durch", "nicht", "sowie", "haben", "einer", "einem", "eines", "unter", "werden", "können", "solche"].includes(
          w.toLowerCase()
        )
    );

  const keyTerms = Array.from(new Set(potentialTerms)).slice(0, 10);
  const detectedKeyTerms: string[] = [];
  const missingKeyTerms: string[] = [];

  for (const term of keyTerms) {
    if (lowerAnswer.includes(term.toLowerCase())) {
      detectedKeyTerms.push(term);
    } else {
      missingKeyTerms.push(term);
    }
  }

  const wordCount = cleanAnswer.split(/\s+/).filter(Boolean).length;
  const coverageRatio = keyTerms.length > 0 ? detectedKeyTerms.length / keyTerms.length : 0.5;

  let score = 0;
  if (wordCount < 5) {
    score = 0.5;
  } else if (coverageRatio >= 0.75) {
    score = 5;
  } else if (coverageRatio >= 0.5) {
    score = 4;
  } else if (coverageRatio >= 0.25) {
    score = 2.5;
  } else {
    score = 1.5;
  }

  const isCorrect = score >= 3;
  let feedback = "";
  if (score >= 4.5) {
    feedback = `Ausgezeichnete Antwort! Du hast die wesentlichen Fachbegriffe (${detectedKeyTerms.join(
      ", "
    )}) präzise getroffen.`;
  } else if (score >= 3) {
    feedback = `Gute Antwort mit wesentlichen Kernaussagen. Zur vollen Punktzahl solltest du noch genauer auf folgende Aspekte eingehen: ${
      missingKeyTerms.slice(0, 3).join(", ") || "theoretische Fundierung"
    }.`;
  } else {
    feedback = `Die Antwort greift wichtige Aspekte auf, ist jedoch noch unvollständig. Fehlende Schlüsselkonzepte laut Vorlesungsfolien: ${
      missingKeyTerms.slice(0, 4).join(", ") || "siehe Musterlösung"
    }.`;
  }

  return {
    score,
    maxScore: 5,
    isCorrect,
    accuracyComment: isCorrect ? "Inhaltlich fundiert und klausurrelevant" : "Ausbaufähig – Lücken bei Fachbegriffen",
    detectedKeyTerms,
    missingKeyTerms,
    feedback,
    sourceRef: effectiveSourceRef,
    modelUsed: "Lokale Semantic Engine",
  };
}

/**
 * Summarizes a topic or creates a high-yield cheat sheet from lecture materials.
 */
export async function summarizeTopic(params: {
  moduleId: string;
  topicName: string;
  currentSummary?: string | null;
  apiKey?: string;
  provider?: string;
}): Promise<SummaryResult> {
  const { moduleId, topicName, currentSummary, apiKey, provider = "gemini" } = params;

  const docs = await searchModuleDocuments(moduleId, topicName, 4);
  const contextSnippet = docs.map((d) => `[Dokument: ${d.documentTitle}]:\n${d.textSnippet}`).join("\n\n");
  const docSources = Array.from(new Set(docs.map((d) => d.documentTitle)));

  if (apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
    try {
      const sys = `Du bist ein angesehener Universitätsprofessor.
Erstelle für Studierende eine erstklassige, klausurrelevante Zusammenfassung (Cheat Sheet) zum Themengebiet "${topicName}".
Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "summary": "Strukturierter Markdown-Text mit Abschnitten: ### 1. Kernkonzepte & Definitionen\\n\\n### 2. Vor- und Nachteile (Trade-offs)\\n\\n### 3. Typische Klausuraufgaben & Prüfungsfallen",
  "coreConcepts": ["Kernkonzept 1", "Kernkonzept 2", "Kernkonzept 3", "Kernkonzept 4"],
  "examTips": ["Prüfungstipp 1", "Prüfungstipp 2", "Prüfungstipp 3"],
  "sourceRefs": ["Vorlesungsfolien"]
}`;

      const userPrompt = `Fach/Thema: ${topicName}
Auszüge aus den Modulunterlagen:
${contextSnippet || "Standard-Vorlesungsinhalte"}

Vorherige Notizen:
${currentSummary || "Keine vorhanden."}`;

      const { parsed, modelUsed } = await callUniversalAIJSON({
        prompt: userPrompt,
        systemInstruction: sys,
        provider,
        apiKey,
      });

      return {
        topicName,
        summary: parsed.summary || "",
        coreConcepts: Array.isArray(parsed.coreConcepts) ? parsed.coreConcepts : [],
        examTips: Array.isArray(parsed.examTips) ? parsed.examTips : [],
        sourceRefs: Array.isArray(parsed.sourceRefs) && parsed.sourceRefs.length ? parsed.sourceRefs : docSources,
        modelUsed: `${provider.toUpperCase()} (${modelUsed})`,
      };
    } catch (err: any) {
      console.warn("Topic summary AI failed, using fallback:", err.message);
    }
  }

  // Deterministic fallback
  const coreConcepts = [
    `Kernprinzipien & Definitionen zu "${topicName}"`,
    `Vor- und Nachteile sowie Trade-offs in der Praxis`,
    `Typische Klausurfallen und Best Practices`,
    `Abgrenzung zu verwandten Konzepten der Vorlesung`,
  ];

  const examTips = [
    `In Altklausuren wird hier besonders auf präzise Fachterminologie geachtet.`,
    `Achte bei Freitext-Aufgaben auf das Nennen von konkreten Beispielen.`,
    `Unterscheide stets zwischen Entwurfsmuster/Konzept und konkreter Implementierung.`,
  ];

  const summary = `### Kompakter Klausur-Spickzettel: ${topicName}

${currentSummary || "Zentraler Vorlesungsschwerpunkt."}

#### 1. Relevante Vorlesungsauszüge & Definitionen
${
  contextSnippet ||
  `Das Themengebiet **${topicName}** ist ein wiederkehrender Schwerpunkt in den Prüfungen. Achte insbesondere auf die theoretische Fundierung und die praktische Anwendung.`
}

#### 2. Wichtigste Kriterien für die Klausur
- **Präzision:** Vermeide schwammige Alltagssprache; verwende die exakten Begriffe des Dozenten.
- **Zusammenhang:** Verknüpfe theoretische Eigenschaften mit den praktischen Konsequenzen für Wartbarkeit, Skalierbarkeit und Konsistenz.
- **Transferleistung:** Bereite dich auf Aufgaben vor, in denen du Vor- und Nachteile in einem gegebenen Szenario abwägen musst.`;

  return {
    topicName,
    summary,
    coreConcepts,
    examTips,
    sourceRefs: docSources.length ? docSources : ["Vorlesungsskript & Altklausuren"],
    modelUsed: "StudyHub Engine",
  };
}

/**
 * Strips non-examinable introductory metadata, tables of contents,
 * prefaces, acknowledgements, publisher boilerplate, and course logistics.
 */
export function cleanDocumentBoilerplate(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const cleanedLines: string[] = [];
  let skippingBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    // Check if line indicates start of a boilerplate section
    if (
      /^(inhaltsverzeichnis|table of contents|inhalt|gliederung)\b/i.test(trimmed) ||
      /^(vorwort|preface|danksagung|widmung|acknowledgements?)\b/i.test(trimmed) ||
      /^(impressum|copyright|alle rechte vorbehalten|bibliografische information)\b/i.test(trimmed) ||
      /^(über die autoren|über den autor|autorenverzeichnis|about the authors?)\b/i.test(trimmed) ||
      /^(organisatorisches|hinweise zur vorlesung|klausurmodalit[äa]ten|sprechstunde)\b/i.test(trimmed)
    ) {
      skippingBlock = true;
      continue;
    }

    // Stop skipping if we hit an actual chapter or lecture topic
    if (
      skippingBlock &&
      (/^(kapitel\s+\d+|chapter\s+\d+|teil\s+[a-z\d]+|\d+\.\s+[a-zäöü])/i.test(trimmed) ||
       (trimmed.startsWith("[Seite ") && !/seite\s+[1-4]\b/i.test(trimmed)))
    ) {
      skippingBlock = false;
    }

    if (skippingBlock) {
      continue;
    }

    // Filter out individual boilerplate lines (copyright notices, page numbers, author lines)
    if (
      /copyright\s*©|all rights reserved|isbn\s*[\d\-]+/i.test(lower) ||
      /^seite\s*\d+\s*(von|\/)\s*\d+$/i.test(lower) ||
      /^(prof\.|dr\.|prof\. dr\.|universit[äa]t|lehrstuhl für)\b/i.test(lower) ||
      /^(wintersemester|sommersemester)\s*20\d\d/i.test(lower)
    ) {
      continue;
    }

    cleanedLines.push(line);
  }

  const result = cleanedLines.join("\n").trim();
  // If cleaning stripped too much, fallback to original text so we don't return empty string
  return result.length > 200 ? result : text;
}

/**
 * Evenly samples substantive lecture excerpts across the entire document
 * (early, middle, and late chapters/slides) so questions cover the whole course.
 */
export function sampleStratifiedChunks(cleanedText: string, maxTotalChars: number = 32000): string {
  if (!cleanedText) return "";
  if (cleanedText.length <= maxTotalChars) return cleanedText;

  // Split into page blocks or paragraphs
  const rawBlocks = cleanedText.includes("[Seite ")
    ? cleanedText.split(/(?=\[Seite \d+\])/g).filter((b) => b.trim().length > 50)
    : cleanedText.split(/\n{2,}/g).filter((b) => b.trim().length > 60);

  if (rawBlocks.length <= 6) {
    const usableText = cleanedText.slice(Math.min(2000, Math.floor(cleanedText.length * 0.05)));
    return usableText.slice(0, maxTotalChars);
  }

  // Discard first 5% of blocks if they might be front matter
  const startIndex = Math.min(3, Math.floor(rawBlocks.length * 0.05));
  const usableBlocks = rawBlocks.slice(startIndex);

  // We sample across 7 distinct regions evenly distributed through the entire material
  const numSamples = 7;
  const step = Math.max(1, Math.floor(usableBlocks.length / numSamples));
  const charsPerSample = Math.floor(maxTotalChars / numSamples);
  const selectedExcerpts: string[] = [];

  for (let s = 0; s < numSamples; s++) {
    const blockIndex = Math.min(usableBlocks.length - 1, s * step);
    const block = usableBlocks[blockIndex];
    if (block) {
      selectedExcerpts.push(block.trim().slice(0, charsPerSample));
    }
  }

  return selectedExcerpts.join("\n\n---\n[Weiteres Vorlesungskapitel / Abschnitt]\n---\n\n");
}

export const generateTopicSummary = summarizeTopic;

/**
 * Generates high-yield exam questions using AI (Gemini, OpenAI, Anthropic) from lecture notes & documents.
 * STRICT GROUNDING: Creates questions ONLY from uploaded documents!
 */
export async function generateQuestionsWithAI(params: {
  moduleId: string;
  topicName?: string;
  documentsText?: string;
  count?: number;
  existingQuestions?: string[];
  apiKey?: string;
  provider?: string;
  model?: string;
}): Promise<GeneratedQuestion[]> {
  const {
    moduleId,
    topicName = "Klausurschwerpunkte",
    documentsText,
    count = 5,
    existingQuestions = [],
    apiKey,
    provider = "gemini",
    model,
  } = params;

  let rawContext = documentsText;
  if (!rawContext) {
    const docs = await searchModuleDocuments(moduleId, topicName, 8);
    rawContext = docs.map((d) => `[Dokument: ${d.documentTitle}]:\n${d.textSnippet}`).join("\n\n");
  }

  if (!rawContext || rawContext.trim().length === 0) {
    throw new Error("Kein Text in den Vorlesungsunterlagen gefunden. Bitte lade Unterlagen mit lesbarem Text (PDF oder Bilder) hoch.");
  }

  // Validate that document text is genuine readable words, not binary garbage
  if (!isValidPdfText(rawContext)) {
    throw new Error(
      "Die hinterlegten Unterlagen enthalten noch keinen lesbaren Text (möglicherweise reine Scans/Fotos oder unleserliche Zeichen). Bitte lade das Dokument erneut hoch, damit die KI-Texterkennung (Gemini Vision OCR) den Inhalt automatisch erfasst."
    );
  }

  // 1. Clean boilerplate (Vorwort, Inhaltsverzeichnis, Impressum, Organisatorisches)
  const cleanedText = cleanDocumentBoilerplate(rawContext);

  // 2. Sample stratified excerpts across the ENTIRE document (beginning, middle, and end)
  const stratifiedContext = sampleStratifiedChunks(cleanedText, 32000);

  const existingQuestionsWarning =
    existingQuestions && existingQuestions.length > 0
      ? `\nBEREITS EXISTIERENDE FRAGEN (STRENG VERBOTEN ZU WIEDERHOLEN!):\n${existingQuestions
          .slice(0, 30)
          .map((q, i) => `${i + 1}. ${q}`)
          .join("\n")}\n`
      : "";

  const sys = `Du bist ein erfahrener Universitätsprofessor und anspruchsvoller Klausurersteller.
WICHTIGSTE QUALITÄTSVORGABEN:
1. Erstelle Prüfungsfragen AUSSCHLIESSLICH auf Basis der fachlichen Inhalte des bereitgestellten Vorlesungsmaterials.
2. ABSOLUT VERBOTEN (STRENG FILTERN):
   - KEINE Fragen über Inhaltsverzeichnisse, Gliederungen oder Seitenzahlen!
   - KEINE Fragen über Vorworte, Widmungen, Danksagungen oder Impressum!
   - KEINE Meta-Fragen über Autoren, Professoren, Universitäten, Klausurtermine oder Sprechstunden!
3. ECHTE KLAUSURRELEVANZ:
   - Frage nach zentralen Fachbegriffen, Definitionen, Theorien, Modellen, Formeln, Architekturmustern und Trade-offs.
   - Frage nach Ursache-Wirkungs-Prinzipien, Vor- und Nachteilen, Praxisanwendungen und Abbildungszusammenhängen.
4. AUSGEWOGENER PRÜFUNGS-MIX:
   - SINGLE_CHOICE: Genau 1 richtige Option aus 4; jede Option mit Begründung/Erklärung.
   - MULTIPLE_CHOICE: 2 bis 3 richtige Optionen aus 4 mit Erklärungen.
   - FREE_TEXT: Akademische Transfer- oder Klausuraufgabe mit ausführlicher Kriterien-Musterlösung.
   - MATCHING: Zuordnungs- / Drag-and-Drop-Aufgabe für Prozesse, Modelle, Abbildungen oder Definitionen.
     (In 'options' hat jedes Element 'text' für den Begriff und 'target' für die passende Definition/Kategorie).
5. KEINE DUPLIKATE: Erstelle nur neue, unverbrauchte Fragen, die sich nicht wiederholen.${existingQuestionsWarning}

Antworte AUSSCHLIESSLICH als valides JSON-Objekt mit dem Key "questions":
{
  "questions": [
    {
      "type": "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "FREE_TEXT" | "MATCHING",
      "questionText": "Anspruchsvolle Klausurfrage...",
      "options": [
        { "text": "Begriff oder Option A", "isCorrect": true, "explanation": "Warum korrekt", "target": "Ziel-Definition bei MATCHING" }
      ],
      "sampleSolution": "Ausführliche Musterlösung für Klausurkorrektur",
      "sourceRef": "Themenbereich / Folienkapitel",
      "topicName": "${topicName}"
    }
  ]
}`;

  const userPrompt = `FACH / MODUL: ${topicName}

AUSZÜGE AUS DEM GESAMTEN VORLESUNGSMATERIAL (Gleichmäßig über alle Kapitel verteilt):
---
${stratifiedContext}
---

Erstelle jetzt genau ${count} anspruchsvolle, klausurrelevante Prüfungsfragen zum FACHINHALT der obigen Auszüge. Ignoriere Formalia, Inhaltsverzeichnisse und Vorworte vollständig.`;

  const { parsed } = await callUniversalAIJSON({
    prompt: userPrompt,
    systemInstruction: sys,
    provider,
    apiKey,
    model,
  });

  const rawList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.questions) ? parsed.questions : []);

  if (rawList.length > 0) {
    const existingSet = new Set(
      existingQuestions.map((eq) => eq.toLowerCase().replace(/[^a-z0-9äöü]/g, ""))
    );

    const result: GeneratedQuestion[] = [];
    for (const item of rawList) {
      const qText = item.questionText || `Klausurfrage zu ${topicName}`;
      const normalizedQ = qText.toLowerCase().replace(/[^a-z0-9äöü]/g, "");

      // Deduplicate: Skip if already exists
      if (existingSet.has(normalizedQ)) {
        continue;
      }
      existingSet.add(normalizedQ);

      const type =
        item.type === "SINGLE_CHOICE"
          ? "SINGLE_CHOICE"
          : item.type === "MULTIPLE_CHOICE"
          ? "MULTIPLE_CHOICE"
          : item.type === "MATCHING"
          ? "MATCHING"
          : "FREE_TEXT";

      result.push({
        type,
        questionText: qText,
        options: Array.isArray(item.options) ? item.options : undefined,
        sampleSolution: item.sampleSolution || "Musterlösung",
        sourceRef: item.sourceRef || `${topicName}`,
        topicName: item.topicName || topicName,
      });

      if (result.length >= count) break;
    }

    if (result.length > 0) {
      return result;
    }
  }

  throw new Error("Das KI-Modell hat keine neuen Fragen generiert. Bitte prüfe das Vorlesungsdokument.");
}

/**
 * Extracts and transcribes lecture documents (PDF, PNG, JPEG) using Gemini multimodal understanding.
 */
/**
 * Universal Multimodal Document & Handwriting Extraction (Gemini, OpenAI, Anthropic).
 * Uses fast vision models with strict timeouts (8s) to prevent gateway timeouts.
 */
export async function extractDocumentWithAI(params: {
  fileBase64: string;
  mimeType: string;
  fileName?: string;
  title?: string;
  apiKey?: string;
  provider?: string;
}): Promise<string> {
  const { fileBase64, mimeType, fileName, title, apiKey, provider = "gemini" } = params;
  const docLabel = fileName || title || "Vorlesungsdokument";
  const prompt = `Analysiere dieses Dokument / diese Vorlesungsfolie / handschriftliche Notiz ("${docLabel}") für einen Universitäts-Klausurtrainer.
Extrahiere präzise:
1. Den vollständigen Text der Folien / Handschrift
2. Alle Definitionen, Lehrsätze, Formeln, Diagramm-Beschriftungen und Kernaussagen
Formatiere das Ergebnis in klarem Text/Markdown.`;

  // 1. OpenAI Vision (gpt-4o-mini is extremely fast: ~1.5s)
  if (provider === "openai" || (apiKey && apiKey.startsWith("sk-") && !apiKey.startsWith("sk-ant-"))) {
    const openAiKey = apiKey || process.env.OPENAI_API_KEY;
    if (openAiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
          },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${mimeType};base64,${fileBase64}`,
                      detail: "high",
                    },
                  },
                ],
              },
            ],
            max_tokens: 1500,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const text = json.choices?.[0]?.message?.content;
          if (text && text.trim().length > 0) {
            return text.trim();
          }
        }
      } catch (err: any) {
        console.warn("OpenAI Vision OCR error:", err.message);
      }
    }
  }

  // 2. Anthropic Vision (claude-3-5-haiku)
  if (provider === "anthropic" || (apiKey && apiKey.startsWith("sk-ant-"))) {
    const antKey = apiKey || process.env.ANTHROPIC_API_KEY;
    if (antKey) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": antKey,
            "anthropic-version": "2023-06-01",
          },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 1500,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mimeType,
                      data: fileBase64,
                    },
                  },
                  { type: "text", text: prompt },
                ],
              },
            ],
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const text = json.content?.[0]?.text;
          if (text && text.trim().length > 0) {
            return text.trim();
          }
        }
      } catch (err: any) {
        console.warn("Anthropic Vision OCR error:", err.message);
      }
    }
  }

  // 3. Google Gemini Multimodal Vision (gemini-2.0-flash / gemini-1.5-flash)
  const geminiKey = apiKey || process.env.GEMINI_API_KEY;
  if (geminiKey && !geminiKey.startsWith("sk-")) {
    const models = await resolveGeminiModelsToTry(geminiKey);
    // Limit to top 2 models to guarantee fast response
    const modelsToAttempt = models.slice(0, 2);

    for (const model of modelsToAttempt) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: fileBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
            },
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim().length > 0) {
            return text.trim();
          }
        } else {
          const errText = await res.text();
          console.warn(`Gemini Vision (${model}) returned ${res.status}:`, errText);
        }
      } catch (err: any) {
        console.warn(`Gemini Vision (${model}) error:`, err.message);
      }
    }
  }

  throw new Error("Kein KI-Vision Modell konnte Text aus dem Bild/Scan extrahieren.");
}

export const extractDocumentWithGemini = extractDocumentWithAI;
