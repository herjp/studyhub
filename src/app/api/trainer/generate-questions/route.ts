import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { QuestionType } from "@prisma/client";
import { generateQuestionsWithAI, DEFAULT_GEMINI_KEY } from "@/lib/ai-service";
import { getCurrentUser } from "@/lib/auth";
import { isValidPdfText } from "@/lib/pdf-extractor";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert. Bitte melde dich an." }, { status: 401 });
    }

    const body = await req.json();
    const { moduleId, topicId, count = 10, apiKey, provider = "gemini", model } = body;
    const requestedCount = typeof count === "number" ? count : 10;

    if (!moduleId) {
      return NextResponse.json({ error: "moduleId ist erforderlich" }, { status: 400 });
    }

    // 1. Verify module exists and belongs to current user
    const mod = await prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        semester: true,
        documents: true,
        topics: true,
      },
    });

    if (!mod || mod.semester.userId !== user.id) {
      return NextResponse.json({ error: "Modul nicht gefunden oder nicht autorisiert" }, { status: 404 });
    }

    // 2. Check if documents exist in this module with valid, readable parsed text
    const validDocs = mod.documents.filter(
      (d) => d.parsedText && d.parsedText.trim().length > 20 && isValidPdfText(d.parsedText)
    );

    if (validDocs.length === 0) {
      const hasAnyDocs = mod.documents.length > 0;
      return NextResponse.json(
        {
          error: hasAnyDocs
            ? "In deinen hinterlegten Unterlagen wurde noch kein lesbarer Text gefunden (die vorhandenen Dateien enthalten anscheinend unleserliche Scans, Fotos oder binäre Zeichen). Bitte lade das Dokument erneut hoch oder passe den Text im Dokumenten-Viewer an, damit die KI-Texterkennung (Gemini Vision) den Text erfasst."
            : "Keine Vorlesungsunterlagen vorhanden. Bitte lade im Reiter 'Vorlesungsmaterialien & Unterlagen' zuerst Vorlesungsfolien (PDF) oder Bilder (PNG/JPG) hoch. Fragen werden ausschließlich aus deinen persönlichen Modul-Unterlagen generiert.",
          code: hasAnyDocs ? "NO_READABLE_TEXT" : "NO_DOCUMENTS",
        },
        { status: 400 }
      );
    }

    // 3. Check for API key
    const effectiveKey = apiKey || DEFAULT_GEMINI_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!effectiveKey) {
      return NextResponse.json(
        {
          error:
            "Kein API-Schlüssel hinterlegt. Bitte öffne die Einstellungen (Zahnrad oben rechts), wähle deinen KI-Anbieter (Google Gemini, OpenAI oder Anthropic) und trage deinen API-Schlüssel ein.",
          code: "NO_API_KEY",
        },
        { status: 400 }
      );
    }

    // 4. Determine topic
    let topicName = "Klausurrelevante Kernfragen";
    if (topicId) {
      const foundTopic = mod.topics.find((t) => t.id === topicId);
      if (foundTopic) {
        topicName = foundTopic.name;
      }
    } else if (mod.topics.length > 0) {
      topicName = mod.topics.map((t) => t.name).join(", ");
    } else {
      topicName = mod.name;
    }

    // 5. Fetch existing question texts to guarantee zero duplicates
    const existingQRecords = await prisma.question.findMany({
      where: { moduleId },
      select: { questionText: true },
    });
    const existingQuestionTexts = existingQRecords.map((q) => q.questionText);

    // 6. Combine document text strictly from this module
    const combinedDocText = validDocs
      .map(
        (doc, idx) =>
          `=== DOKUMENT ${idx + 1}: ${doc.title} (${doc.fileName}) ===\n${doc.parsedText}`
      )
      .join("\n\n");

    // 7. Generate questions strictly from uploaded documents without duplicates
    let aiQuestions;
    try {
      aiQuestions = await generateQuestionsWithAI({
        moduleId,
        topicName,
        documentsText: combinedDocText,
        count: Math.min(Math.max(1, requestedCount), 30),
        existingQuestions: existingQuestionTexts,
        apiKey: apiKey?.trim() || undefined,
        provider,
        model,
      });
    } catch (aiErr: any) {
      console.error("AI question generation failed:", aiErr);
      return NextResponse.json(
        {
          error: `Fehler bei der KI-Fragenerstellung: ${aiErr.message || "Das KI-Modell konnte keine Fragen generieren."}`,
        },
        { status: 500 }
      );
    }

    if (!aiQuestions || aiQuestions.length === 0) {
      return NextResponse.json(
        {
          error:
            "Aus den hochgeladenen Dokumenten konnten keine Fragen generiert werden. Bitte stelle sicher, dass die Unterlagen gut lesbaren Text enthalten.",
        },
        { status: 422 }
      );
    }

    // 8. Save to database with balanced topic distribution
    const createdQuestions = [];
    for (let i = 0; i < aiQuestions.length; i++) {
      const q = aiQuestions[i];

      let resolvedTopicId = topicId;
      if (!resolvedTopicId && mod.topics.length > 0) {
        const matched = mod.topics.find(
          (t) =>
            t.name.toLowerCase().includes((q.topicName || "").toLowerCase()) ||
            (q.topicName && q.topicName.toLowerCase().includes(t.name.toLowerCase()))
        );
        resolvedTopicId = matched ? matched.id : mod.topics[i % mod.topics.length].id;
      }

      const newQ = await prisma.question.create({
        data: {
          moduleId,
          topicId: resolvedTopicId || (mod.topics.length > 0 ? mod.topics[0].id : null),
          type:
            q.type === "SINGLE_CHOICE"
              ? QuestionType.SINGLE_CHOICE
              : q.type === "MULTIPLE_CHOICE"
              ? QuestionType.MULTIPLE_CHOICE
              : q.type === "MATCHING"
              ? QuestionType.MATCHING
              : QuestionType.FREE_TEXT,
          questionText: q.questionText,
          options: q.options ? JSON.stringify(q.options) : JSON.stringify([]),
          sampleSolution: q.sampleSolution || "",
          sourceRef: q.sourceRef || `${validDocs[0].title} (Folie/Skript)`,
        },
      });

      // Initialize Spaced Repetition progress
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
  } catch (error: any) {
    console.error("Generate questions route error:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim Generieren der Fragen" },
      { status: 500 }
    );
  }
}
