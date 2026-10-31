import { searchModuleDocuments, getPastExamStyleContext } from "./rag";

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
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "FREE_TEXT";
  questionText: string;
  options?: Array<{ text: string; isCorrect: boolean; explanation: string }>;
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

/**
 * Universal call to Google Gemini REST API.
 */
export async function callGeminiJSON(
  prompt: string,
  apiKey: string,
  systemInstruction?: string,
  preferredModel?: string
): Promise<{ parsed: any; modelUsed: string }> {
  const models = preferredModel
    ? [preferredModel, "gemini-1.5-pro", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"]
    : ["gemini-1.5-pro", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];

  const uniqueModels = Array.from(new Set(models));
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
  apiKey?: string;
  provider?: string;
  model?: string;
}): Promise<GeneratedQuestion[]> {
  const { moduleId, topicName = "Klausurschwerpunkte", documentsText, count = 5, apiKey, provider = "gemini", model } = params;

  let contextSnippet = documentsText;
  if (!contextSnippet) {
    const docs = await searchModuleDocuments(moduleId, topicName, 6);
    contextSnippet = docs.map((d) => `[Dokument: ${d.documentTitle}]:\n${d.textSnippet}`).join("\n\n");
  }

  if (!contextSnippet || contextSnippet.trim().length === 0) {
    throw new Error("Kein Text in den Vorlesungsunterlagen gefunden. Bitte lade Unterlagen mit lesbarem Text (PDF oder Bilder) hoch.");
  }

  const sys = `Du bist ein angesehener Universitätsprofessor und Klausurersteller.
WICHTIGSTE VORGABE: Erstelle Klausurfragen AUSSCHLIESSLICH und STRENG auf Basis der unten bereitgestellten Vorlesungsunterlagen.
Erfinde KEINE Fragen zu anderen Themengebieten, die nicht im Skript vorkommen!
Erstelle genau ${count} anspruchsvolle Prüfungsfragen zum Inhalt des Skripts.
Ausgewogene Mischung:
1. SINGLE_CHOICE (Genau 1 richtige Option aus 4; jede Option mit Begründung/Erklärung)
2. MULTIPLE_CHOICE (2 bis 3 richtige Optionen aus 4 mit Erklärungen)
3. FREE_TEXT (Klausurtypische Freitextaufgabe mit ausführlicher Musterlösung)

Antworte AUSSCHLIESSLICH als valides JSON-Objekt mit dem Key "questions":
{
  "questions": [
    {
      "type": "SINGLE_CHOICE",
      "questionText": "Klausuraufgabe...",
      "options": [
        { "text": "Option A...", "isCorrect": true, "explanation": "Erklärung..." },
        { "text": "Option B...", "isCorrect": false, "explanation": "Erklärung..." },
        { "text": "Option C...", "isCorrect": false, "explanation": "Erklärung..." },
        { "text": "Option D...", "isCorrect": false, "explanation": "Erklärung..." }
      ],
      "sampleSolution": "Kurze Musterlösung",
      "sourceRef": "Name der Vorlesungsunterlage / Folie",
      "topicName": "${topicName}"
    }
  ]
}`;

  const userPrompt = `FACH / THEMA: ${topicName}

HOCHGELADENE VORLESUNGSMATERIALIEN DES STUDIERENDEN:
---
${contextSnippet.slice(0, 28000)}
---

Erstelle jetzt genau ${count} Prüfungsfragen, die sich STRIKT auf die obigen Auszüge beziehen.`;

  const { parsed, modelUsed } = await callUniversalAIJSON({
    prompt: userPrompt,
    systemInstruction: sys,
    provider,
    apiKey,
    model,
  });

  const rawList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.questions) ? parsed.questions : []);

  if (rawList.length > 0) {
    return rawList.slice(0, count).map((item: any) => ({
      type: item.type === "SINGLE_CHOICE" ? "SINGLE_CHOICE" : item.type === "MULTIPLE_CHOICE" ? "MULTIPLE_CHOICE" : "FREE_TEXT",
      questionText: item.questionText || `Klausurfrage zu ${topicName}`,
      options: Array.isArray(item.options) ? item.options : undefined,
      sampleSolution: item.sampleSolution || "Musterlösung",
      sourceRef: item.sourceRef || `${topicName} (${provider.toUpperCase()})`,
      topicName: item.topicName || topicName,
    }));
  }

  throw new Error("Das KI-Modell hat keine Fragen generiert. Bitte prüfe das Vorlesungsdokument.");
}

/**
 * Extracts and transcribes lecture documents (PDF, PNG, JPEG) using Gemini multimodal understanding.
 */
export async function extractDocumentWithGemini(params: {
  fileBase64: string;
  mimeType: string;
  fileName?: string;
  title?: string;
  apiKey?: string;
  provider?: string;
}): Promise<string> {
  const { fileBase64, mimeType, fileName, title, apiKey } = params;
  const activeKey = apiKey || process.env.GEMINI_API_KEY;

  if (!activeKey) {
    throw new Error("Kein Google Gemini API Key für Multimodal-OCR verfügbar.");
  }

  const docLabel = fileName || title || "Vorlesungsdokument";
  const prompt = `Analysiere dieses Dokument / diese Vorlesungsfolie ("${docLabel}") gründlich für einen Universitäts-Klausurtrainer.
Extrahiere:
1. Den vollständigen Text der Folien / Seiten
2. Alle Definitionen, Lehrsätze, Formeln und Algorithmen
3. Wichtige Fachtermini und Kernaussagen
Formatiere das Ergebnis in klarem, strukturiertem Text/Markdown.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
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

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini Multimodal OCR fehlgeschlagen (${res.status}): ${errorText}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini OCR lieferte keinen Text zurück.");
  }

  return text;
}
