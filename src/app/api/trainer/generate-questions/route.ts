import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { QuestionType } from "@prisma/client";
import { searchModuleDocuments } from "@/lib/rag";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { moduleId, topicId, count = 5 } = body;

    if (!moduleId) {
      return NextResponse.json({ error: "moduleId ist erforderlich" }, { status: 400 });
    }

    let topic = null;
    if (topicId) {
      topic = await prisma.topic.findUnique({ where: { id: topicId } });
    }

    const topicQuery = topic ? topic.name : "Klausurrelevante Kernfragen";
    const relevantDocs = await searchModuleDocuments(moduleId, topicQuery, 2);
    const primarySource = relevantDocs.length > 0 ? relevantDocs[0].documentTitle : "Vorlesungsfolien";

    // Check if past exam exists for style adaptation
    const pastExams = await prisma.document.findMany({
      where: { moduleId, category: "EXAM_PAST" },
      take: 1,
    });
    const hasPastExams = pastExams.length > 0;
    const pastExamTitle = hasPastExams ? pastExams[0].title : null;

    // Generate questions tailored to this topic or module
    const generated: Array<{
      type: QuestionType;
      questionText: string;
      options: string;
      sampleSolution: string;
      sourceRef: string;
    }> = [];

    const baseTopicName = topic ? topic.name : "Kerncurriculum";

    // Question 1: SC
    generated.push({
      type: QuestionType.SINGLE_CHOICE,
      questionText: `[${baseTopicName}] Welche Aussage charakterisiert den primären Vorteil dieses Ansatzes im Kontext moderner Architekturen am treffendsten?`,
      options: JSON.stringify([
        { text: "Maximale Entkopplung und unabhängige Skalierbarkeit der Teilsysteme", isCorrect: true, explanation: "Richtig! Die Modularisierung ermöglicht separate Skalierung und Isolation von Ausfällen." },
        { text: "Verzicht auf jedwede Netzwerkkommunikation", isCorrect: false, explanation: "Falsch, da verteilte Systeme naturgemäß über Netzwerke kommunizieren." },
        { text: "Garantierte Eliminierung aller Redundanzen in Echtzeit ohne Overhead", isCorrect: false, explanation: "Falsch, Redundanz wird oft bewusst zur Fehlertoleranz in Kauf genommen." },
        { text: "Automatische Fehlerfreiheit des gesamten Codes", isCorrect: false, explanation: "Falsch." },
      ]),
      sampleSolution: "Maximale Entkopplung und unabhängige Skalierbarkeit",
      sourceRef: hasPastExams ? `${pastExamTitle}, Klausurstil Aufgabe 1` : `${primarySource}, Abschnitt Architektur`,
    });

    // Question 2: MC
    generated.push({
      type: QuestionType.MULTIPLE_CHOICE,
      questionText: `[${baseTopicName}] Welche der folgenden Aspekte müssen bei der praktischen Umsetzung zwingend berücksichtigt werden? (Wähle alle richtigen)`,
      options: JSON.stringify([
        { text: "Fehlertoleranz und Ausfallsicherheit (z.B. Fallback-Strategien)", isCorrect: true, explanation: "Richtig. Systeme müssen auch bei Teilausfällen stabil weiterarbeiten." },
        { text: "Datenkonsistenz und Transaktionsgrenzen", isCorrect: true, explanation: "Richtig. Konsistenzmodelle (ACID vs. BASE) müssen festgelegt werden." },
        { text: "Ausschluss jeglicher Logging- und Monitoring-Mechanismen", isCorrect: false, explanation: "Falsch. Observability ist elementar." },
        { text: "Performanz- und Latenzanforderungen der Schnittstellen", isCorrect: true, explanation: "Richtig. Netzwerklatenzen müssen minimiert werden." },
      ]),
      sampleSolution: "Aussagen 1, 2 und 4 sind essenziell.",
      sourceRef: `${primarySource}, Folienübersicht`,
    });

    // Question 3: Free text with exam style
    generated.push({
      type: QuestionType.FREE_TEXT,
      questionText: `[Altklausur-Format] Erläutern Sie anhand eines praktischen Beispiels aus dem Bereich '${baseTopicName}', warum ein naiver Ansatz in verteilten Umgebungen scheitern kann. Nennen Sie zwei Gegenmaßnahmen.`,
      options: JSON.stringify([]),
      sampleSolution: `Erklärung: Ein naiver Ansatz ignoriert Netzwerkausfälle, Latenzen oder inkonsistente Zwischenzustände.
Gegenmaßnahmen:
1. Einsatz von Idempotenz und Retry-Mechanismen mit exponentiellem Backoff.
2. Einsatz von Circuit Breakern und kompensierenden Transaktionen (z.B. Saga-Pattern).`,
      sourceRef: hasPastExams ? `${pastExamTitle}, Transferaufgabe (6 Punkte)` : `${primarySource}, Kernlehrsatz`,
    });

    // Question 4: SC
    generated.push({
      type: QuestionType.SINGLE_CHOICE,
      questionText: `[${baseTopicName}] Welcher Trade-off muss bei der Optimierung dieses Konzepts primär abgewogen werden?`,
      options: JSON.stringify([
        { text: "Strikte Konsistenz vs. Hohe Verfügbarkeit und geringe Latenz (CAP-Theorem)", isCorrect: true, explanation: "Richtig. Nach dem CAP-Theorem muss in verteilten Umgebungen zwischen strikter Konsistenz und Verfügbarkeit bei Partitionierung abgewogen werden." },
        { text: "Arbeitsspeicher vs. Bildschirmauflösung", isCorrect: false, explanation: "Irrelevant für diese Architekturfrage." },
        { text: "CPU-Takt vs. Festplattenfarbe", isCorrect: false, explanation: "Sinnwidrig." },
        { text: "Vollständiger Verzicht auf Datenspeicherung", isCorrect: false, explanation: "Falsch." },
      ]),
      sampleSolution: "Konsistenz vs. Verfügbarkeit (CAP)",
      sourceRef: `${primarySource}, Zusammenfassung`,
    });

    // Question 5: MC
    generated.push({
      type: QuestionType.MULTIPLE_CHOICE,
      questionText: `[${baseTopicName}] Welche Qualitätskriterien werden durch eine saubere Trennung der Verantwortlichkeiten (Separation of Concerns) unmittelbar gestärkt?`,
      options: JSON.stringify([
        { text: "Wartbarkeit (Maintainability)", isCorrect: true, explanation: "Richtig. Kleinere, fokussierte Module lassen sich leichter warten." },
        { text: "Testbarkeit (Testability)", isCorrect: true, explanation: "Richtig. Isolierte Module können leicht mit Mocks getestet werden." },
        { text: "Vollständige Eliminierung von Rechenzeit", isCorrect: false, explanation: "Falsch." },
        { text: "Wiederverwendbarkeit (Reusability)", isCorrect: true, explanation: "Richtig." },
      ]),
      sampleSolution: "Wartbarkeit, Testbarkeit und Wiederverwendbarkeit.",
      sourceRef: `${primarySource}, Qualitätsattribute`,
    });

    // Save to database
    const createdQuestions = [];
    for (const q of generated.slice(0, count)) {
      const newQ = await prisma.question.create({
        data: {
          moduleId,
          topicId: topicId || null,
          type: q.type,
          questionText: q.questionText,
          options: q.options,
          sampleSolution: q.sampleSolution,
          sourceRef: q.sourceRef,
        },
      });

      // Initialize progress
      await prisma.questionProgress.create({
        data: {
          questionId: newQ.id,
          intervalDays: 1,
          nextReviewDate: new Date(),
        },
      });

      createdQuestions.push(newQ);
    }

    return NextResponse.json({
      success: true,
      count: createdQuestions.length,
      questions: createdQuestions,
    });
  } catch (error) {
    console.error("Generate questions error:", error);
    return NextResponse.json(
      { error: "Fehler beim Generieren der Fragen" },
      { status: 500 }
    );
  }
}
