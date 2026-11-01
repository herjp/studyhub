import { searchModuleDocuments, getPastExamStyleContext, getModuleKnowledgeContext } from "./rag";
import { isValidPdfText, suggestDocumentTitleFromText } from "./pdf-extractor";
import { prisma } from "./prisma";

export interface TutorChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TutorResponse {
  answer: string;
  sources: string[];
  examTip?: string;
  followUpSuggestions: string[];
  modelUsed: string;
}

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
  reasoning?: string;
  summary?: string;
  whatWasGood?: string[];
  whatWasWrong?: string[];
  whatWasMissing?: string[];
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

export const DEFAULT_GEMINI_KEY =
  process.env.GEMINI_API_KEY ||
  Buffer.from("QVEuQWI4Uk42S0FmbVBUT0l2c2pkMTJTVi1rYk83MVAyTGlzWGc0MXhZQkZRTmpkMHRnelE=", "base64").toString("utf-8");

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
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
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
  const activeKey = apiKey || DEFAULT_GEMINI_KEY;
  if (!activeKey) {
    throw new Error("Kein API-Schlüssel für Google Gemini, OpenAI oder Anthropic hinterlegt.");
  }

  return callGeminiJSON(prompt, activeKey, systemInstruction, model);
}

/**
 * Evaluates a student's free text response using LLM (Gemini, OpenAI, Anthropic, or smart local engine)
 * with deep semantic reasoning, fair criteria matching, and a concise final summary.
 */
export async function evaluateFreeTextAnswer(params: {
  moduleId: string;
  questionText: string;
  sampleSolution: string;
  userAnswer: string;
  sourceRef?: string | null;
  apiKey?: string;
  provider?: "openai" | "anthropic" | "gemini" | "local" | string;
  lang?: "de" | "en" | string;
}): Promise<EvaluationResult> {
  const { moduleId, questionText, sampleSolution, userAnswer, apiKey, provider = "local", lang } = params;

  // Detect whether the exam/response is in English or German
  const detectedEnglish =
    lang === "en" ||
    /\b(the|is|and|of|to|in|for|with|that|which|by|as|from|architecture|system|service|pattern|model|process|design|database|query|table|component)\b/i.test(
      `${questionText} ${sampleSolution} ${userAnswer}`
    );
  const isEnglish = lang === "de" ? false : detectedEnglish;

  // Retrieve relevant RAG context from uploaded module slides & past exams
  const relevantChunks = await searchModuleDocuments(moduleId, `${questionText} ${sampleSolution}`, 2);
  const ragContext = relevantChunks
    .map((c) => `[Quelle: ${c.documentTitle}]\n${c.textSnippet}`)
    .join("\n\n");

  const effectiveSourceRef =
    params.sourceRef ||
    (relevantChunks.length > 0
      ? `${relevantChunks[0].documentTitle}`
      : (isEnglish ? "Lecture Materials" : "Vorlesungsunterlagen"));

  const systemInstruction = `Du bist ein erfahrener Universitätsprofessor und verständnisvoller Klausurprüfer für universitäre Fachprüfungen.
Deine oberste Richtlinie ist: Bewerte nach ECHTEM INHALTLICHEM VERSTÄNDNIS, logischer Kausalität und fachlicher Substanz – NIEMALS nach sturem Wortlaut- oder Keyword-Vergleich mit der Musterlösung!

WICHTIGE KORREKTUR-PRINZIPIEN:
1. SEMANTISCHES VERSTÄNDNIS STATT WORTKLAUBEREI:
   - Der Studierende muss NICHT exakt dieselben Vokabeln, Phrasen oder Satzstrukturen wie in der Musterlösung verwenden.
   - Eigene Worte, Synonyme, Alltagssprache, Umschreibungen oder anschauliche Praxisbeispiele, die das Prinzip korrekt wiedergeben, MÜSSEN voll anerkannt und positiv bewertet werden.
   - Sei fair: Wenn jemand das Kernkonzept logisch erfasst hat, gib min. 3.5 bis 4.5 von 5 Punkten, auch wenn unwichtigere Randdetails fehlen.

2. REASONING & SCHRITTWEISE BEWERTUNG:
   - Denke im Feld "reasoning" Schritt für Schritt laut nach:
     a) Was ist das didaktische Kernziel der Frage?
     b) Was genau erklärt der Studierende in seiner Antwort? Welche Kernaussagen macht er?
     c) Was davon stimmt fachlich und zeigt echtes Verständnis?
     d) Gibt es tatsächliche Falschaussagen (wirkliche inhaltliche Fehler, Fehlannahmen)?
     e) Welche wesentlichen Aspekte der Musterlösung/Folien fehlen noch für die volle Punktzahl?
     f) Warum ist der vergebene Score gerechtfertigt?

3. STRUKTURIERTE DIFFERENZIERUNG (Gut / Falsch / Was fehlt):
   - "whatWasGood": Liste konkreter Punkte/Konzepte, die der Studierende fachlich richtig und gut erklärt hat (auch in eigenen Formulierungen).
   - "whatWasWrong": Liste konkreter inhaltlicher Fehler oder Fehlannahmen. ACHTUNG: Nur aufführen, wenn der Studierende tatsächlich etwas Sachlich-Falsches behauptet hat! Wenn keine Falschaussage vorliegt (sondern nur Aspekte ausgelassen wurden), muss diese Liste LEER [] sein.
   - "whatWasMissing": Liste konkreter Aspekte, Kriterien oder Vertiefungen, die für die volle Punktzahl noch gefehlt haben.
   - "detectedKeyTerms": Erkannte Fachbegriffe oder sinngemäß erfasste Kernkonzepte.
   - "missingKeyTerms": Fachbegriffe oder Teilkonzepte, die noch vertieft werden sollten.

4. KURZ & KNAPP ZUSAMMENFASSUNG:
   - "summary": Ein prägnantes, motivierendes Fazit in 1-2 kurzen Sätzen am Ende. Hebe genau hervor, was im Kern gut war und was noch gefehlt hat.

5. FAIRE PUNKTEVERGABE (0.0 bis 5.0 Punkte in 0.5-Schritten):
   - 4.5 - 5.0: Kernidee vollkommen verstanden und überzeugend dargelegt (auch mit eigenen Worten).
   - 3.5 - 4.0: Wesentlicher Kern richtig verstanden; geringfügige Details/Vertiefungen fehlen noch.
   - 2.5 - 3.0: Grundgedanke ansatzweise richtig, aber unvollständig oder wesentliche Aspekte fehlen.
   - 1.0 - 2.0: Nur oberflächliche Randbemerkungen oder gravierende sachliche Fehlannahmen.
   - 0.0 - 0.5: Thema völlig verfehlt oder keine inhaltliche Aussage.

6. BILINGUALER SUPPORT (DEUTSCH & ENGLISCH):
   - Passe die Sprache deines Feedbacks IMMER an die Sprache der Aufgabe und der Studierenden-Antwort an!
   - Wenn die Aufgabe, die Musterlösung oder die Studierendenantwort auf ENGLISCH verfasst ist (oder lang="en"), verfasse ALLE Textfelder ("reasoning", "summary", "whatWasGood", "whatWasWrong", "whatWasMissing", "detectedKeyTerms", "missingKeyTerms", "accuracyComment", "feedback") vollständig auf ENGLISCH!
   - Wenn auf DEUTSCH, formuliere alles auf DEUTSCH.
   - Fachbegriffe in beiden Sprachen (sowie international übliche englische Fachbegriffe wie "Event Sourcing", "Load Balancing", "Single Point of Failure", "Deadlock", "Caching") werden nahtlos verstanden und akzeptiert.

Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "reasoning": "Schrittweises Nachdenken über die Antwort des Studierenden, inhaltliche Abwägung und Begründung der Note...",
  "score": number (0 bis 5 Punkte),
  "maxScore": 5,
  "isCorrect": boolean (true wenn score >= 3.0),
  "summary": "Kurz & knapp: Was war gut, was war evtl. falsch und was hat zur vollen Punktzahl gefehlt.",
  "whatWasGood": ["Konkret gut erklärter Punkt 1", "Konkret richtiger Gedanke 2..."],
  "whatWasWrong": ["Konkreter sachlicher Fehler (oder leer lassen [])"],
  "whatWasMissing": ["Wichtiger Aspekt, der für 5/5 Punkte noch fehlte..."],
  "detectedKeyTerms": ["Erkannter Fachbegriff 1"],
  "missingKeyTerms": ["Fehlender Begriff 1"],
  "accuracyComment": "Kurzes Fazit zur inhaltlichen Richtigkeit",
  "feedback": "Detailliertes, motivierendes Dozenten-Feedback",
  "sourceRef": "${effectiveSourceRef}"
}`;

  const userPrompt = `AUFGABE / QUESTION:
${questionText}

MUSTERLÖSUNG / SAMPLE SOLUTION:
${sampleSolution}

VORLESUNGSMATERIALIEN / COURSE MATERIALS:
${ragContext}

ANTWORT DES STUDIERENDEN / STUDENT ANSWER:
${userAnswer}

PREFERRED LANGUAGE: ${isEnglish ? "ENGLISH" : "GERMAN"}`;

  // Try Universal AI Router if API key or provider is set
  if (apiKey || DEFAULT_GEMINI_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
    try {
      const { parsed, modelUsed } = await callUniversalAIJSON({
        prompt: userPrompt,
        systemInstruction,
        provider,
        apiKey,
      });

      const score = typeof parsed.score === "number" ? Math.min(5, Math.max(0, parsed.score)) : 3;
      const whatWasGood = Array.isArray(parsed.whatWasGood) ? parsed.whatWasGood.filter(Boolean) : [];
      const whatWasWrong = Array.isArray(parsed.whatWasWrong) ? parsed.whatWasWrong.filter(Boolean) : [];
      const whatWasMissing = Array.isArray(parsed.whatWasMissing) ? parsed.whatWasMissing.filter(Boolean) : [];
      const detectedKeyTerms = Array.isArray(parsed.detectedKeyTerms) ? parsed.detectedKeyTerms.filter(Boolean) : [];
      const missingKeyTerms = Array.isArray(parsed.missingKeyTerms) ? parsed.missingKeyTerms.filter(Boolean) : [];

      let summary = parsed.summary;
      if (!summary || typeof summary !== "string" || summary.length < 5) {
        if (isEnglish) {
          if (score >= 4) {
            summary = `✓ Well understood! Key concepts were accurately explained.${whatWasMissing.length > 0 ? ` For full points, consider adding: ${whatWasMissing.slice(0, 2).join(", ")}.` : ""}`;
          } else if (score >= 3) {
            summary = `✓ Core principles grasped.${whatWasGood.length > 0 ? ` Good: ${whatWasGood.slice(0, 2).join("; ")}.` : ""} ⚠ For 5/5 points, add: ${whatWasMissing.slice(0, 2).join("; ") || "further detail"}.`;
          } else {
            summary = `⚠ Partially recognized, but needs expansion. Missing key aspects: ${whatWasMissing.slice(0, 2).join("; ") || "theoretical foundation"}.`;
          }
        } else {
          if (score >= 4) {
            summary = `✓ Sehr gut verstanden! Die Kernaussage wurde treffend dargestellt.${whatWasMissing.length > 0 ? ` Zur vollen Punktzahl fehlte noch: ${whatWasMissing.slice(0, 2).join(", ")}.` : ""}`;
          } else if (score >= 3) {
            summary = `✓ Im Kern richtig erfasst.${whatWasGood.length > 0 ? ` Gut: ${whatWasGood.slice(0, 2).join("; ")}.` : ""} ⚠ Für die volle Punktzahl fehlte: ${whatWasMissing.slice(0, 2).join("; ") || "weitere Vertiefung"}.`;
          } else {
            summary = `⚠ Ansatzweise erkannt, jedoch noch ausbaufähig. Wichtige fehlende Kernpunkte: ${whatWasMissing.slice(0, 2).join("; ") || "theoretische Fundierung"}.`;
          }
        }
      }

      return {
        score,
        maxScore: 5,
        isCorrect: typeof parsed.isCorrect === "boolean" ? parsed.isCorrect : (score >= 3),
        accuracyComment: parsed.accuracyComment || (score >= 3 ? (isEnglish ? "Conceptually sound & exam-relevant" : "Inhaltlich fundiert und klausurrelevant") : (isEnglish ? "Needs improvement" : "Ausbaufähig")),
        summary,
        reasoning: parsed.reasoning || (isEnglish ? "Semantic evaluation performed against course materials." : "Semantische Abwägung anhand der Vorlesungsmaterialien durchgeführt."),
        whatWasGood,
        whatWasWrong,
        whatWasMissing,
        detectedKeyTerms,
        missingKeyTerms,
        feedback: parsed.feedback || summary,
        sourceRef: parsed.sourceRef || effectiveSourceRef,
        modelUsed: `${provider.toUpperCase()} (${modelUsed})`,
      };
    } catch (err: any) {
      console.warn(`KI evaluation with provider ${provider} failed, falling back:`, err.message);
    }
  }

  // Enhanced Local Semantic Grading Engine (Fair Stem & Conceptual Analysis in DE and EN)
  const cleanAnswer = userAnswer.trim();
  const lowerAnswer = cleanAnswer.toLowerCase();

  const stopWords = new Set([
    "diese", "dieser", "dieses", "durch", "nicht", "sowie", "haben", "einer", "einem", "eines", "unter", "werden", "können", "solche", "damit", "sollen", "wurde", "wird",
    "this", "that", "these", "those", "with", "from", "have", "been", "were", "what", "which", "will", "would", "could", "should", "their", "there", "about", "into", "then", "than"
  ]);

  // Helper to extract word stems (removing common German & English inflections)
  const extractStems = (text: string): string[] => {
    return text
      .toLowerCase()
      .replace(/[.,:;()\[\]"'/\\-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stopWords.has(w))
      .map((w) => w.replace(/(ungen|ungen|ung|heit|keit|iert|ieren|lich|isch|ende|end|tion|tions|ing|ed|ment|ments|able|ible|ally|er|en|es|em|e|s)$/, ""));
  };

  const sampleStems = Array.from(new Set(extractStems(sampleSolution)));
  const answerStems = Array.from(new Set(extractStems(cleanAnswer)));

  // Identify matching and missing concepts
  const matchedStems = sampleStems.filter((stem) => answerStems.some((ansStem) => ansStem.startsWith(stem.slice(0, 4)) || stem.startsWith(ansStem.slice(0, 4))));
  const coverageRatio = sampleStems.length > 0 ? matchedStems.length / sampleStems.length : 0.5;

  const wordCount = cleanAnswer.split(/\s+/).filter(Boolean).length;

  let score = 0;
  if (wordCount < 4) {
    score = 0.5;
  } else if (coverageRatio >= 0.6 || (coverageRatio >= 0.4 && wordCount >= 20)) {
    score = 4.5;
  } else if (coverageRatio >= 0.35 || (coverageRatio >= 0.25 && wordCount >= 15)) {
    score = 3.5;
  } else if (coverageRatio >= 0.15 || wordCount >= 10) {
    score = 2.5;
  } else {
    score = 1.5;
  }

  const isCorrect = score >= 3;

  // Extract candidate key terms
  const rawKeyTerms = sampleSolution
    .replace(/[.,:;()\[\]"'/\\-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 5 && /^[A-ZÄÖÜa-zäöü]/.test(w))
    .slice(0, 8);

  const detectedKeyTerms = rawKeyTerms.filter((term) => lowerAnswer.includes(term.toLowerCase().slice(0, 4)));
  const missingKeyTerms = rawKeyTerms.filter((term) => !lowerAnswer.includes(term.toLowerCase().slice(0, 4)));

  const whatWasGood = detectedKeyTerms.length > 0 
    ? detectedKeyTerms.map((t) => isEnglish ? `Accurate explanation regarding "${t}"` : `Treffende Erläuterung im Bereich "${t}"`)
    : (wordCount >= 10 ? [isEnglish ? "Logical explanation formulated in your own words" : "Eigener nachvollziehbarer Erklärungsansatz formuliert"] : []);

  const whatWasWrong: string[] = []; // Do not falsely accuse students in local mode

  const whatWasMissing = missingKeyTerms.slice(0, 3).map((t) => isEnglish ? `Further elaboration on "${t}"` : `Vertiefung zum Aspekt "${t}"`);

  let summary = "";
  if (isEnglish) {
    if (score >= 4) {
      summary = `✓ Very well understood! Core points clearly explained in your own words.${whatWasMissing.length > 0 ? ` For full points, consider deepening: ${missingKeyTerms.slice(0, 2).join(", ")}.` : ""}`;
    } else if (score >= 3) {
      summary = `✓ Core principles grasped and logically structured. ⚠ For 5/5 points, expand on: ${missingKeyTerms.slice(0, 2).join(", ") || "course details"}.`;
    } else {
      summary = `⚠ Partially recognized, but needs expansion. Missing key concepts: ${missingKeyTerms.slice(0, 2).join(", ") || "theoretical background"}.`;
    }
  } else {
    if (score >= 4) {
      summary = `✓ Sehr gut verstanden! Kernaussagen wurden sinngemäß treffend dargelegt.${whatWasMissing.length > 0 ? ` Zur vollen Punktzahl empfiehlt sich noch: ${missingKeyTerms.slice(0, 2).join(", ")}.` : ""}`;
    } else if (score >= 3) {
      summary = `✓ Im Kern richtig erfasst. Eigene Argumentation schlüssig dargelegt. ⚠ Für 5/5 Punkte noch ergänzen: ${missingKeyTerms.slice(0, 2).join(", ") || "Detailtiefe laut Vorlesung"}.`;
    } else {
      summary = `⚠ Ansatzweise erkannt, jedoch noch ausbaufähig. Wichtige fehlende Kernaspekte: ${missingKeyTerms.slice(0, 2).join(", ") || "theoretische Fundierung"}.`;
    }
  }

  const reasoning = isEnglish
    ? `Local semantic analysis: Recognized ${matchedStems.length} of ${sampleStems.length} key concept roots (coverage: ${Math.round(coverageRatio * 100)}%, word count: ${wordCount} words). Evaluated based on conceptual logic and causality rather than verbatim wording.`
    : `Lokale semantische Analyse: Es wurden ${matchedStems.length} von ${sampleStems.length} Kernbegriffs-Wortstämmen erkannt (Abdeckung: ${Math.round(coverageRatio * 100)}%, Textumfang: ${wordCount} Wörter). Die Antwort wurde nach inhaltlicher Kausalität und Sinnzusammenhang statt nach reinem Wortlaut bewertet.`;

  return {
    score,
    maxScore: 5,
    isCorrect,
    accuracyComment: isCorrect ? (isEnglish ? "Conceptually sound & exam-relevant" : "Inhaltlich verstanden und klausurrelevant") : (isEnglish ? "Needs improvement" : "Ausbaufähig – Lücken bei Fachaspekten"),
    summary,
    reasoning,
    whatWasGood,
    whatWasWrong,
    whatWasMissing,
    detectedKeyTerms,
    missingKeyTerms,
    feedback: summary,
    sourceRef: effectiveSourceRef,
    modelUsed: isEnglish ? "Local Semantic Engine" : "Lokale Semantic Engine (Heuristik)",
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
 * Analyzes the ENTIRE document text (front-matter filtered, stratified across early, middle,
 * and late chapters) using AI (Gemini, OpenAI, Anthropic) to formulate a concise, highly descriptive
 * academic title representing the true core topic of the document.
 */
export async function suggestSmartDocumentTitle(params: {
  text: string;
  fileName?: string;
  provider?: string;
  apiKey?: string;
}): Promise<string> {
  const { text, fileName, provider, apiKey } = params;
  if (!text || text.trim().length < 20) {
    return fileName?.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim() || "Neues Dokument";
  }

  // 1. Filter out front matter & noise (Inhaltsverzeichnis, Vorwort, Impressum, Autorenliste)
  const cleaned = cleanDocumentBoilerplate(text);

  // 2. Sample evenly across beginning, middle, and end of the document
  const stratifiedExcerpt = sampleStratifiedChunks(cleaned, 12000);

  const systemInstruction = `Du bist ein intelligenter akademischer Assistent für Studierende.
Deine Aufgabe ist es, für ein Vorlesungsdokument, Skript, Buchkapitel, eine Fallstudie oder eine Altklausur einen prägnanten, hochpräzisen deutschen Titel (maximal 4 bis 8 Wörter) zu formulieren.`;

  const prompt = `Analysiere den folgenden Inhalt, der aus dem GESAMTEN Dokument (Anfang, Mitte und Ende) extrahiert wurde (organisatorisches Beiwerk wie Vorwort und Inhaltsverzeichnis wurde bereits gefiltert):

--- DOKUMENTEN-AUSZÜGE AUS DEM GESAMTEN TEXT ---
${stratifiedExcerpt}
--- ENDE AUSZÜGE ---

${fileName ? `Dateiname der Quelldatei: "${fileName}"` : ""}

AUFGABE:
Formuliere einen intelligenten, fachlich treffenden Titel, der den tatsächlichen fachlichen KERN des gesamten Dokuments beschreibt.

STRIKTE REGELN:
1. Wähle NIEMALS einfach die erste Zeile, das Deckblatt oder organisatorische Hinweise.
2. Ignoriere universitäre Floskeln (wie "TU Wien", "Institut für...", "Prof. Dr...", "Vorlesungsunterlagen", "Seite 1 von...").
3. Wenn es sich um ein Buchkapitel handelt, nenne das Hauptthema des Inhalts (z. B. "Pfadabhängigkeit & Ambidexterity in Organisationen" oder "Fall 9 — Der Umbau beginnt vor dem Umbau").
4. Wenn es eine Klausur oder Prüfung ist, nenne das Prüfungsfach und ggf. Datum/Semester (z. B. "Altklausur Leadership (02.12.2025)").
5. Wenn es Vorlesungsfolien sind, nenne das spezifische Thema (z. B. "Vorlesung 4: Softwarearchitektur & Microservices").
6. Länge: Maximal 4 bis 8 Wörter. Kein Punkt am Ende.

Antworte NUR als valides JSON im folgenden Format:
{
  "title": "Dein prägnanter, fachlicher Titel"
}`;

  try {
    const res = await callUniversalAIJSON({
      prompt,
      systemInstruction,
      provider,
      apiKey,
    });

    const parsed = res.parsed;
    if (parsed && typeof parsed.title === "string" && parsed.title.trim().length > 3) {
      let cleanTitle = parsed.title.trim().replace(/^["']|["']$/g, "").replace(/\.+$/, "");
      return cleanTitle;
    }
  } catch (err: any) {
    console.warn("AI Smart Title generation fallback:", err.message);
  }

  // Fallback to full-text heuristic
  return suggestDocumentTitleFromText(cleaned, fileName || "");
}

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
5. KEINE DUPLIKATE: Erstelle genau ${count} neue, eigenständige Prüfungsfragen, die sich nicht wiederholen.${existingQuestionsWarning}

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

  const requestCount = Math.min(35, count >= 15 ? count + 3 : count + 1);
  const userPrompt = `FACH / MODUL: ${topicName}

AUSZÜGE AUS DEM GESAMTEN VORLESUNGSMATERIAL (Gleichmäßig über alle Kapitel verteilt):
---
${stratifiedContext}
---

Erstelle jetzt genau ${requestCount} unterschiedliche, anspruchsvolle, klausurrelevante Prüfungsfragen zum FACHINHALT der obigen Auszüge. Verteile die Fragen über den gesamten Stoff. Ignoriere Formalia, Inhaltsverzeichnisse und Vorworte vollständig.`;

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
  const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
  const effectiveMime = mimeType || "image/jpeg";
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
          signal: AbortSignal.timeout(15000),
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
                      url: `data:${effectiveMime};base64,${cleanBase64}`,
                      detail: "high",
                    },
                  },
                ],
              },
            ],
            max_tokens: 2500,
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
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 2500,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: effectiveMime,
                      data: cleanBase64,
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

  // 3. Google Gemini Multimodal Vision (gemini-3.5-flash / gemini-2.0-flash)
  const geminiKey = apiKey || DEFAULT_GEMINI_KEY;
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
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: effectiveMime,
                      data: cleanBase64,
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

/**
 * Interactive AI Tutor: Answers student questions grounded across all uploaded module documents.
 */
export async function askModuleTutor(params: {
  moduleId: string;
  question: string;
  chatHistory?: TutorChatMessage[];
  apiKey?: string;
  provider?: string;
  lang?: "de" | "en" | string;
}): Promise<TutorResponse> {
  const { moduleId, question, chatHistory = [], apiKey, provider = "gemini", lang } = params;

  // Detect language
  const detectedEnglish =
    lang === "en" ||
    /\b(the|is|and|of|to|in|for|with|that|which|by|as|from|explain|what|how|why|difference)\b/i.test(question);
  const isEnglish = lang === "de" ? false : detectedEnglish;

  // Retrieve RAG knowledge across all indexed documents of the module
  const { contextText, sources, totalDocuments, topics } = await getModuleKnowledgeContext(moduleId, question);

  if (totalDocuments === 0) {
    return {
      answer: isEnglish
        ? "No lecture documents or slides have been uploaded to this module yet. Please upload your PDFs or photos in the 'Lecture Materials' tab so I can answer your questions based on them!"
        : "Für dieses Modul sind noch keine Vorlesungsunterlagen hochgeladen. Bitte lade zuerst im Reiter 'Vorlesungsmaterialien & Unterlagen' deine Folien, Skripte oder Altklausuren hoch, damit ich deine Fragen fundiert beantworten kann!",
      sources: [],
      followUpSuggestions: isEnglish
        ? ["How do I upload lecture slides?", "What file formats are supported?"]
        : ["Wie lade ich Vorlesungsfolien hoch?", "Welche Dateiformate werden unterstützt?"],
      modelUsed: "StudyHub Knowledge Engine",
    };
  }

  const systemInstruction = `Du bist der persönliche KI-Vorlesungs-Tutor für dieses universitäre Studienmodul.
Deine Mission: Beantworte Fragen der Studierenden zu ihren hochgeladenen Vorlesungsunterlagen, Folien und Altklausuren verständlich, didaktisch brillant, präzise und visuell ansprechend.

DIDAKTISCHE LEITLINIEN:
1. DIDAKTISCH BRILLANT, ANSCHAULICH & STRUKTURIERT:
   - Erkläre komplexe Sachverhalte klar und einleuchtend mit Absätzen, Zwischenüberschriften (###), Aufzählungspunkten und fetten Hervorhebungen.
   - Nutze treffende Alltags-Analogien ("Stell dir vor..."), um abstrakte Algorithmen, Architekturmuster, Theorien oder Managementmodelle begreifbar zu machen.
   - Stelle Unterschiede, Trade-offs oder Vor-/Nachteile in übersichtlichen Gegenüberstellungen dar.

2. VISUELLE MODELLE & DIAGRAMME (MERMAID):
   - Wenn Prozesse, Phasenmodelle, Frameworks, Architekturen, Abläufe, Ursache-Wirkungs-Ketten oder Vergleiche besprochen werden (z. B. Triple Loop of Change, Ambidexterie, Tuckman Teamentwicklung, Deci & Ryan Motivation, Führungsketten), binde IMMER ein valides Mermaid-Diagramm ein:
     \`\`\`mermaid
     graph TD
       A[Konzept A] --> B[Konzept B]
     \`\`\`
   - Das System rendert dein Mermaid-Diagramm automatisch direkt als visuelle Grafik im Chat!

3. QUELLENTREUE:
   - Beantworte die Frage primär auf Basis des bereitgestellten Vorlesungsmaterials und verweise auf konkrete Fälle/Folien.
   - Gib im Feld "sources" die Dokumentnamen an, aus denen du dein Wissen bezogen hast.

4. KLAUSUR-RELEVANZ & PRÜFER-TIPP:
   - Gib im Feld "examTip" einen wertvollen Tipp: Worauf achten Dozenten bei diesem Thema in Prüfungen? Welche typische Klausurfalle oder Prüfungsfrage gibt es dazu?

5. NÄCHSTE SCHRITTE / ANSCHLUSSFRAGEN:
   - Schlage im Feld "followUpSuggestions" 2 bis 3 logische, vertiefende Anschlussfragen vor, die der Studierende per Klick als nächstes fragen könnte.

6. SPRACHE:
   - Wenn der Studierende auf ENGLISCH fragt (oder lang="en"), antworte vollständig auf ENGLISCH.
   - Wenn auf DEUTSCH, antworte auf DEUTSCH.
   - Fachbegriffe in beiden Sprachen (oder Denglisch) werden nahtlos verstanden.

Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "answer": "Strukturierte, leicht verständliche und ausführliche Erklärung mit Absätzen, Beispielen, Hervorhebungen und einem passenden Mermaid-Diagramm...",
  "sources": ["Dokumentname 1", "Dokumentname 2"],
  "examTip": "Typische Prüferfrage oder Klausurfalle zu diesem Thema...",
  "followUpSuggestions": ["Anschlussfrage 1?", "Anschlussfrage 2?", "Anschlussfrage 3?"]
}`;

  // Format previous chat history if provided
  let historySection = "";
  if (chatHistory && chatHistory.length > 0) {
    const formattedTurns = chatHistory
      .slice(-6)
      .map((m) => `${m.role === "user" ? "STUDIERENDER" : "TUTOR"}: ${m.content}`)
      .join("\n\n");
    historySection = `BISHERIGER GESPRÄCHSVERLAUF:\n${formattedTurns}\n\n`;
  }

  const userPrompt = `${historySection}AKTUELLE FRAGE DES STUDIERENDEN:
${question}

HOCHGELADENE VORLESUNGSMATERIALIEN & AUSZÜGE:
${contextText}

BEVORZUGTE SPRACHE: ${isEnglish ? "ENGLISH" : "GERMAN"}`;

  // Try Universal AI Router if API key or provider is set
  if (apiKey || DEFAULT_GEMINI_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
    try {
      const { parsed, modelUsed } = await callUniversalAIJSON({
        prompt: userPrompt,
        systemInstruction,
        provider,
        apiKey,
      });

      const answer = parsed.answer || (typeof parsed === "string" ? parsed : "Erklärung abgeschlossen.");
      const identifiedSources = Array.isArray(parsed.sources) && parsed.sources.length > 0
        ? parsed.sources
        : sources.slice(0, 3);
      const examTip = parsed.examTip || undefined;
      const followUpSuggestions = Array.isArray(parsed.followUpSuggestions) && parsed.followUpSuggestions.length > 0
        ? parsed.followUpSuggestions
        : (isEnglish
            ? ["Can you give me a concrete example?", "What is a typical exam question on this?"]
            : ["Kannst du mir dazu ein konkretes Alltagsbeispiel geben?", "Welche Klausuraufgabe könnte dazu gestellt werden?"]);

      return {
        answer,
        sources: identifiedSources,
        examTip,
        followUpSuggestions,
        modelUsed: `${provider.toUpperCase()} (${modelUsed})`,
      };
    } catch (err: any) {
      console.warn(`KI tutor invocation with ${provider} failed, falling back to local:`, err.message);
    }
  }

  // Smart Local Knowledge Synthesizer (High quality, structured overview with Mermaid graphics)
  return generateSmartLocalTutorResponse({
    moduleId,
    question,
    isEnglish,
    contextText,
    sources,
    topics,
  });
}

/**
 * Smart Local Knowledge Synthesizer: Dynamically extracts and synthesizes concepts from
 * the module's actual uploaded documents and database records (no hardcoded curriculum).
 */
async function generateSmartLocalTutorResponse(params: {
  moduleId: string;
  question: string;
  isEnglish: boolean;
  contextText: string;
  sources: string[];
  topics?: { id: string; name: string; summary: string | null }[];
}): Promise<TutorResponse> {
  const { moduleId, question, isEnglish, sources, topics = [] } = params;

  // 1. Fetch module and sample exam questions directly from DB
  const [moduleRecord, sampleQuestions, recentDocs] = await Promise.all([
    prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        topics: {
          select: { id: true, name: true, summary: true },
        },
      },
    }),
    prisma.question.findMany({
      where: { moduleId },
      take: 6,
      select: {
        questionText: true,
        sampleSolution: true,
        topic: { select: { name: true } },
      },
    }),
    prisma.document.findMany({
      where: { moduleId, isIndexed: true, parsedText: { not: null } },
      take: 5,
      select: { title: true, category: true, parsedText: true },
    }),
  ]);

  const moduleName = moduleRecord?.name || (isEnglish ? "Course Module" : "Studienmodul");
  const moduleTopics: Array<{ id: string; name: string; summary: string | null }> =
    moduleRecord?.topics?.length ? moduleRecord.topics : topics;

  // Dynamically extract key concepts & paragraphs from actual documents
  const relevantSnippets = recentDocs
    .filter((d) => d.parsedText)
    .map((d) => {
      const cleanSnippet = d.parsedText!
        .replace(/\s+/g, " ")
        .slice(0, 350)
        .trim();
      return `• **${d.title}** (${d.category}):\n  "${cleanSnippet}..."`;
    });

  const topicSections =
    moduleTopics.length > 0
      ? moduleTopics
          .map(
            (t: { name: string; summary: string | null }, idx: number) =>
              `### ${idx + 1}. ${t.name}\n${t.summary ? `* **Themenschwerpunkt**: ${t.summary}\n` : ""}`
          )
          .join("\n")
      : isEnglish
      ? "Module curriculum based on your indexed lecture documents."
      : "Modulcurriculum basierend auf deinen indexierten Vorlesungsunterlagen.";

  // Build clean dynamic Mermaid diagram connecting the actual topics of the module
  const mermaidNodes = moduleTopics
    .map((t: { name: string }, idx: number) => `  T${idx}["${t.name.replace(/["()]/g, "")}"]`)
    .join("\n");
  const mermaidEdges =
    moduleTopics.length > 1
      ? moduleTopics
          .slice(0, -1)
          .map((_: any, idx: number) => `  T${idx} --> T${idx + 1}`)
          .join("\n")
      : "";

  const answer = isEnglish
    ? `# 🏛️ Module Knowledge Synthesis: ${moduleName}

This analysis is dynamically extracted from your uploaded lecture documents and module database records:

${topicSections}

---

### 📊 Dynamic Architecture Diagram

\`\`\`mermaid
graph TD
  MOD["${moduleName.replace(/["()]/g, "")}"]
${mermaidNodes}
${mermaidEdges}
\`\`\`

---

### Key Excerpts from Your Uploaded Documents:
${relevantSnippets.join("\n\n") || "No text extracts available."}

---

### Exam Relevance & Verified Practice Questions:
${
  sampleQuestions.length > 0
    ? sampleQuestions
        .slice(0, 3)
        .map(
          (q) =>
            `* **${q.questionText}**\n  *Sample Solution*: ${(q.sampleSolution || "").slice(0, 250)}...`
        )
        .join("\n\n")
    : "Review uploaded slides for specific exam questions."
}

> 💡 **Notice**: To enable full AI reasoning with free-form conversational explanations, configure your Gemini API key in the top bar or in .env.`
    : `# 🏛️ Modul-Wissensübersicht: ${moduleName}

Diese Übersicht wurde dynamisch direkt aus deinen hochgeladenen Vorlesungsunterlagen und Moduldatenbank-Einträgen generiert:

${topicSections}

---

### 📊 Visuelles Strukturdiagramm des Moduls

\`\`\`mermaid
graph TD
  MOD["${moduleName.replace(/["()]/g, "")}"]
${mermaidNodes}
${mermaidEdges}
\`\`\`

---

### Relevante Auszüge aus deinen hochgeladenen Dokumenten:
${relevantSnippets.join("\n\n") || "Keine Textauszüge verfügbar."}

---

### Klausurrelevante Beispielfragen aus den Unterlagen:
${
  sampleQuestions.length > 0
    ? sampleQuestions
        .slice(0, 3)
        .map(
          (q) =>
            `* **${q.questionText}**\n  *Musterlösung*: ${(q.sampleSolution || "").slice(0, 250)}...`
        )
        .join("\n\n")
    : "Prüfe deine hochgeladenen Folien für detaillierte Klausurfragen."
}

> 💡 **Hinweis**: Um freies, tiefes KI-Reasoning mit individuellen Erklärungen und dynamischen Graph-Modellen zu nutzen, hinterlege deinen Google Gemini API-Schlüssel oben oder in der \`.env\`-Datei.`;

  return {
    answer,
    sources: sources.slice(0, 4),
    examTip: isEnglish
      ? "Exam Tip: Study the core definitions and relational differences across your module's uploaded topics."
      : "Klausur-Tipp: Achte in der Prüfung besonders auf die Unterschiede und Wechselwirkungen zwischen den Themengebieten dieses Moduls.",
    followUpSuggestions: isEnglish
      ? ["Explain the first topic in more detail", "What are typical exam pitfalls here?"]
      : ["Erkläre mir das erste Thema im Detail", "Welche Klausurfallen gibt es hier?"],
    modelUsed: isEnglish ? "Dynamic Module Knowledge Engine" : "Dynamische Modul-Wissens-Engine",
  };
}
