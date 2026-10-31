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
 * Universal call to Google Gemini REST API using structured JSON output.
 * Tries modern fast Gemini models with automatic fallback.
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

  // Deduplicate
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
        headers: {
          "Content-Type": "application/json",
        },
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

      const parsed = JSON.parse(rawText);
      return { parsed, modelUsed: model };
    } catch (err: any) {
      console.warn(`Error invoking Gemini model ${model}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models failed to generate content.");
}

/**
 * Evaluates a student's free text response using LLM (Gemini, OpenAI, or smart local engine).
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

  // Determine active API keys
  const isGemini = provider === "gemini" || (Boolean(apiKey) && apiKey!.startsWith("AIzaSy"));
  const activeGeminiKey: string | undefined = (isGemini && apiKey) ? apiKey : process.env.GEMINI_API_KEY;
  const activeOpenAiKey: string | undefined = (provider === "openai" && apiKey) ? apiKey : process.env.OPENAI_API_KEY;

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

  // 1. Google Gemini (Gemini Pro / Flash)
  if (activeGeminiKey) {
    try {
      const { parsed, modelUsed } = await callGeminiJSON(userPrompt, activeGeminiKey, systemInstruction);
      return {
        score: typeof parsed.score === "number" ? Math.min(5, Math.max(0, parsed.score)) : 3,
        maxScore: 5,
        isCorrect: typeof parsed.isCorrect === "boolean" ? parsed.isCorrect : (parsed.score >= 3),
        accuracyComment: parsed.accuracyComment || "KI-Bewertung abgeschlossen",
        detectedKeyTerms: Array.isArray(parsed.detectedKeyTerms) ? parsed.detectedKeyTerms : [],
        missingKeyTerms: Array.isArray(parsed.missingKeyTerms) ? parsed.missingKeyTerms : [],
        feedback: parsed.feedback || "Antwort erfolgreich geprüft.",
        sourceRef: parsed.sourceRef || effectiveSourceRef,
        modelUsed: `Google Gemini (${modelUsed})`,
      };
    } catch (err: any) {
      console.warn("Google Gemini evaluation failed, falling back:", err.message);
    }
  }

  // 2. OpenAI (gpt-4o)
  if (activeOpenAiKey && provider === "openai") {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeOpenAiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          temperature: 0.2,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = JSON.parse(data.choices[0].message.content);
        return {
          ...content,
          modelUsed: "OpenAI gpt-4o",
          sourceRef: content.sourceRef || effectiveSourceRef,
        };
      }
    } catch (err) {
      console.warn("OpenAI API call failed, falling back to semantic grading engine:", err);
    }
  }

  // 3. Intelligent Local Semantic Grading Engine (Fallback)
  const cleanAnswer = userAnswer.trim();
  const lowerAnswer = cleanAnswer.toLowerCase();

  // Extract key concept terms from sample solution
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
  } else {
    const rawScore = coverageRatio * 4.0 + (wordCount > 30 ? 1.0 : wordCount > 15 ? 0.6 : 0.2);
    score = Math.min(5, Math.max(0.5, Math.round(rawScore * 2) / 2));
  }

  const isCorrect = score >= 3.0;
  let accuracyComment = "";
  let feedback = "";

  if (score >= 4.5) {
    accuracyComment = "Hervorragende, fachlich präzise Ausarbeitung!";
    feedback = `Sehr stark beantwortet! Du hast die wesentlichen Kernkonzepte (${detectedKeyTerms.slice(0, 3).join(", ")}) präzise erfasst und logisch verknüpft. Diese Antwort würde in der echten Klausur die volle Punktzahl erzielen.`;
  } else if (score >= 3.0) {
    accuracyComment = "Überwiegend richtig mit gutem Grundverständnis.";
    feedback = `Gute Antwort! Die Grundlagen sind verstanden (${detectedKeyTerms.slice(0, 2).join(", ")} korrekt genannt). Um zur vollen Punktzahl aufzuschließen, solltest du noch auf folgende Aspekte vertiefend eingehen: ${missingKeyTerms.slice(0, 2).join(", ")}.`;
  } else {
    accuracyComment = "Ausbaufähig – zentrale Aspekte fehlen noch.";
    feedback = `Die Richtung stimmt ansatzweise, aber es fehlen entscheidende Fachbegriffe und Zusammenhänge (${missingKeyTerms.slice(0, 3).join(", ")}). Vergleiche deine Antwort nochmals mit den Folienhinweisen.`;
  }

  return {
    score,
    maxScore: 5,
    isCorrect,
    accuracyComment,
    detectedKeyTerms,
    missingKeyTerms: missingKeyTerms.slice(0, 4),
    feedback,
    sourceRef: effectiveSourceRef,
    modelUsed: "StudyHub Semantic RAG Engine",
  };
}

/**
 * Generates an exam cheat sheet / summary for a topic using Gemini or RAG fallback.
 */
export async function generateTopicSummary(params: {
  moduleId: string;
  topicName: string;
  currentSummary?: string | null;
  apiKey?: string;
  provider?: string;
}): Promise<SummaryResult> {
  const { moduleId, topicName, currentSummary, apiKey, provider = "gemini" } = params;
  const docs = await searchModuleDocuments(moduleId, topicName, 3);
  const docSources = docs.map((d) => d.documentTitle);
  const contextSnippet = docs.map((d) => d.textSnippet).join("\n\n");

  const isGemini = provider === "gemini" || (Boolean(apiKey) && apiKey!.startsWith("AIzaSy"));
  const activeGeminiKey: string | undefined = (isGemini && apiKey) ? apiKey : process.env.GEMINI_API_KEY;

  if (activeGeminiKey) {
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

      const { parsed, modelUsed } = await callGeminiJSON(userPrompt, activeGeminiKey, sys);
      return {
        topicName,
        summary: parsed.summary || "",
        coreConcepts: Array.isArray(parsed.coreConcepts) ? parsed.coreConcepts : [],
        examTips: Array.isArray(parsed.examTips) ? parsed.examTips : [],
        sourceRefs: Array.isArray(parsed.sourceRefs) && parsed.sourceRefs.length ? parsed.sourceRefs : docSources,
        modelUsed: `Google Gemini (${modelUsed})`,
      };
    } catch (err: any) {
      console.warn("Gemini topic summary failed, using fallback:", err.message);
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
    modelUsed: "StudyHub AI Engine",
  };
}

/**
 * Generates high-yield exam questions using Google Gemini from lecture notes & documents.
 */
export async function generateQuestionsWithAI(params: {
  moduleId: string;
  topicName?: string;
  count?: number;
  apiKey?: string;
  provider?: string;
}): Promise<GeneratedQuestion[]> {
  const { moduleId, topicName = "Klausurschwerpunkte", count = 5, apiKey, provider = "gemini" } = params;

  const isGemini = provider === "gemini" || (Boolean(apiKey) && apiKey!.startsWith("AIzaSy"));
  const activeGeminiKey: string | undefined = (isGemini && apiKey) ? apiKey : process.env.GEMINI_API_KEY;

  if (!activeGeminiKey) {
    return [];
  }

  const docs = await searchModuleDocuments(moduleId, topicName, 4);
  const contextSnippet = docs.map((d) => `[Dokument: ${d.documentTitle}]:\n${d.textSnippet}`).join("\n\n");

  const sys = `Du bist ein Hochschuldozent und erfahrener Klausurersteller.
Erstelle genau ${count} anspruchsvolle, abwechslungsreiche Klausurfragen zum Fachgebiet "${topicName}".
Erstelle eine ausgewogene Mischung aus:
1. SINGLE_CHOICE (Genau 1 richtige Option aus 4; jede Option hat ein kurzes Erklärungskommentar)
2. MULTIPLE_CHOICE (2 bis 3 richtige Optionen aus 4 mit Erklärungen)
3. FREE_TEXT (Klausurtypische Freitextaufgabe mit ausführlicher Musterlösung)

Antworte AUSSCHLIESSLICH im folgenden JSON-Format als valides Array von Objekten:
[
  {
    "type": "SINGLE_CHOICE",
    "questionText": "Fragestellung...",
    "options": [
      { "text": "Option A...", "isCorrect": true, "explanation": "Erklärung..." },
      { "text": "Option B...", "isCorrect": false, "explanation": "Erklärung..." },
      { "text": "Option C...", "isCorrect": false, "explanation": "Erklärung..." },
      { "text": "Option D...", "isCorrect": false, "explanation": "Erklärung..." }
    ],
    "sampleSolution": "Kurze Musterlösung",
    "sourceRef": "Name der Vorlesungsfolie / Thema",
    "topicName": "${topicName}"
  }
]`;

  const userPrompt = `THEMA: ${topicName}
AUSZÜGE AUS DEN HOCHGELADENEN VORLESUNGSUNTERLAGEN:
${contextSnippet || "Erstelle anspruchsvolle Universitätsfragen zum Themenbereich " + topicName}`;

  try {
    const { parsed } = await callGeminiJSON(userPrompt, activeGeminiKey, sys);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, count).map((item) => ({
        type: item.type === "SINGLE_CHOICE" ? "SINGLE_CHOICE" : item.type === "MULTIPLE_CHOICE" ? "MULTIPLE_CHOICE" : "FREE_TEXT",
        questionText: item.questionText || `Klausurfrage zu ${topicName}`,
        options: Array.isArray(item.options) ? item.options : undefined,
        sampleSolution: item.sampleSolution || "Musterlösung",
        sourceRef: item.sourceRef || `${topicName} (Gemini KI)`,
        topicName,
      }));
    }
  } catch (err: any) {
    console.warn("Error generating questions with Gemini:", err.message);
  }

  return [];
}

/**
 * Extracts and transcribes lecture documents (PDF, PNG, JPEG) using Gemini multimodal understanding.
 */
export async function extractDocumentWithGemini(params: {
  fileBase64: string;
  mimeType: string;
  title: string;
  apiKey?: string;
  provider?: string;
}): Promise<string | null> {
  const { fileBase64, mimeType, title, apiKey, provider = "gemini" } = params;
  const isGemini = provider === "gemini" || (Boolean(apiKey) && apiKey!.startsWith("AIzaSy"));
  const activeGeminiKey = (isGemini && apiKey) ? apiKey : process.env.GEMINI_API_KEY;

  if (!activeGeminiKey) return null;

  const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"];
  const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeGeminiKey}`;
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: `Du bist ein erfahrener Hochschuldozent und KI-Studienassistent. Analysiere dieses hochgeladene Dokument (Folie, Vorlesungsskript, Altklausur oder Mitschrift) mit dem Titel "${title}".
Extrahiere den gesamten Text, alle Definitionen, Theoreme, Formeln, Diagrammbeschreibungen und Klausurschwerpunkte.
Strukturiere die Inhalte klar in Markdown mit prägnanten Überschriften und Aufzählungspunkten, damit sie optimal von der RAG-Engine indiziert und für Prüfungsfragen genutzt werden können.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn(`Gemini document extraction (${model}) failed with status: ${res.status}`);
        continue;
      }

      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim().length > 0) {
        return text.trim();
      }
    } catch (e: any) {
      console.warn(`Gemini model ${model} error during extraction:`, e.message);
    }
  }

  return null;
}
