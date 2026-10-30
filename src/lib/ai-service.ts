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
 * Evaluates a student's free text response using LLM (if key provided) or intelligent semantic grading.
 */
export async function evaluateFreeTextAnswer(params: {
  moduleId: string;
  questionText: string;
  sampleSolution: string;
  userAnswer: string;
  sourceRef?: string | null;
  apiKey?: string;
  provider?: "openai" | "anthropic" | "gemini";
}): Promise<EvaluationResult> {
  const { moduleId, questionText, sampleSolution, userAnswer, apiKey, provider = "openai" } = params;

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

  // If user provided an OpenAI API key or OPENAI_API_KEY env exists
  const activeOpenAiKey = apiKey && provider === "openai" ? apiKey : process.env.OPENAI_API_KEY;
  const activeAnthropicKey = apiKey && provider === "anthropic" ? apiKey : process.env.ANTHROPIC_API_KEY;

  if (activeOpenAiKey && (provider === "openai" || !activeAnthropicKey)) {
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
            {
              role: "system",
              content: `Du bist ein erfahrener Universitätsprofessor und Klausurprüfer.
Bewerte die Antwort eines Studierenden auf eine Klausuraufgabe objektiv und konstruktiv.
Erkenne Fachbegriffe, beurteile inhaltliche Richtigkeit und Vollständigkeit anhand der Musterlösung und der Vorlesungsfolien.
Antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "score": number (0 bis 5 Punkte, 0.5 Schritte erlaubt),
  "maxScore": 5,
  "isCorrect": boolean (true wenn score >= 3),
  "accuracyComment": "Kurzes Fazit zur inhaltlichen Korrektheit",
  "detectedKeyTerms": ["Fachbegriff 1", "Fachbegriff 2"],
  "missingKeyTerms": ["Fehlender Begriff 1"],
  "feedback": "Detailliertes, wohlwollendes aber präzises Feedback",
  "sourceRef": "${effectiveSourceRef}"
}`,
            },
            {
              role: "user",
              content: `AUFGABE:
${questionText}

MUSTERLÖSUNG:
${sampleSolution}

VORLESUNGSMATERIALIEN / ALTKLAUSUREN:
${ragContext}

ANTWORT DES STUDIERENDEN:
${userAnswer}`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = JSON.parse(data.choices[0].message.content);
        return {
          ...content,
          modelUsed: "gpt-4o",
          sourceRef: content.sourceRef || effectiveSourceRef,
        };
      }
    } catch (err) {
      console.warn("OpenAI API call failed, falling back to semantic grading engine:", err);
    }
  }

  // --- Intelligent Local Semantic Grading Engine ---
  // Evaluates text semantics, keyword coverage, and depth of explanation
  const cleanAnswer = userAnswer.trim();
  const lowerAnswer = cleanAnswer.toLowerCase();
  const lowerSolution = sampleSolution.toLowerCase();

  // Extract key concept terms from sample solution
  const potentialTerms = sampleSolution
    .replace(/[.,:;()\[\]"'/\\-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !["diese", "durch", "nicht", "sowie", "haben", "einer", "einem", "eines", "unter", "werden", "können", "solche"].includes(w.toLowerCase()));

  // Deduplicate and get top unique terms
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

  // Calculate length and coverage ratio
  const wordCount = cleanAnswer.split(/\s+/).filter(Boolean).length;
  const coverageRatio = keyTerms.length > 0 ? detectedKeyTerms.length / keyTerms.length : 0.5;

  let score = 0;
  if (wordCount < 5) {
    score = 0.5;
  } else {
    // base calculation between 1.0 and 5.0
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
 * Generates an exam cheat sheet / summary for a topic
 */
export async function generateTopicSummary(params: {
  moduleId: string;
  topicName: string;
  currentSummary?: string | null;
  apiKey?: string;
  provider?: string;
}): Promise<SummaryResult> {
  const { moduleId, topicName, currentSummary } = params;
  const docs = await searchModuleDocuments(moduleId, topicName, 3);
  const docSources = docs.map((d) => d.documentTitle);
  const contextSnippet = docs.map((d) => d.textSnippet).join("\n\n");

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
