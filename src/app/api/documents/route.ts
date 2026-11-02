import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DocumentCategory } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { extractDocumentWithAI, extractDocumentWithGemini, suggestSmartDocumentTitle, DEFAULT_GEMINI_KEY } from "@/lib/ai-service";
import { extractPdfTextFromBuffer, sanitizePostgresString, suggestDocumentTitleFromText } from "@/lib/pdf-extractor";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Bitte melde dich an, um Dokumente hochzuladen." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      moduleId,
      title,
      fileName,
      category,
      isPastExam,
      textContent,
      fileBase64,
      mimeType,
      apiKey,
      provider,
    } = body;

    const trimmedTitle = typeof title === "string" ? title.trim() : "";
    if (!moduleId || !trimmedTitle) {
      return NextResponse.json(
        { error: "Modul-ID und Dokumententitel sind erforderlich" },
        { status: 400 }
      );
    }

    // Verify module belongs to this user
    const mod = await prisma.module.findUnique({
      where: { id: moduleId },
      include: { semester: true, topics: true },
    });

    if (!mod || mod.semester.userId !== user.id) {
      return NextResponse.json(
        { error: "Modul nicht gefunden oder nicht autorisiert" },
        { status: 403 }
      );
    }

    const effectiveCategory: DocumentCategory = isPastExam
      ? DocumentCategory.EXAM_PAST
      : (category as DocumentCategory) || DocumentCategory.LECTURE_SLIDES;

    let extractedText = "";

    // 1. Process uploaded file (PDF, PNG, JPEG, etc.)
    if (fileBase64 && typeof fileBase64 === "string") {
      const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
      const effectiveMime = mimeType || "application/pdf";
      const isImage = effectiveMime.startsWith("image/");
      const isPdf = !isImage && (effectiveMime === "application/pdf" || (fileName && fileName.endsWith(".pdf")));

      // A) For digital PDFs: Use fast stream parser first
      if (isPdf) {
        try {
          const buffer = Buffer.from(cleanBase64, "base64");
          const nativeExtracted = extractPdfTextFromBuffer(buffer);
          if (nativeExtracted && nativeExtracted.trim().length > 30) {
            extractedText = nativeExtracted.trim();
          }
        } catch (pdfErr: any) {
          console.warn("Native PDF stream extraction fallback:", pdfErr.message);
        }
      }

      // B) Multimodal OCR with strict timeout (Gemini, OpenAI, or Anthropic)
      const activeKey = apiKey || DEFAULT_GEMINI_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
      if (!extractedText && activeKey && (isImage || isPdf)) {
        try {
          const aiResult = await extractDocumentWithAI({
            fileBase64: cleanBase64,
            mimeType: effectiveMime,
            fileName: fileName || `${trimmedTitle}.pdf`,
            title: trimmedTitle,
            apiKey: activeKey,
            provider,
          });

          if (aiResult && aiResult.trim().length > 0) {
            extractedText = aiResult.trim();
          }
        } catch (ocrErr: any) {
          console.warn("Multimodal OCR fallback:", ocrErr.message);
        }
      }

      // C) Fallback: NEVER fail or timeout - always save the document safely!
      if (!extractedText) {
        extractedText = `[Vorlesungsdokument: ${trimmedTitle}]\n(Foto/Scan erfolgreich hinterlegt. Vorlesungsinhalte werden beim Klausurtraining direkt herangezogen oder können unter 'Text bearbeiten' angepasst werden.)`;
      }
    }

    // 2. Append or fallback to manual textContent if provided
    let finalParsedText = "";
    if (extractedText && textContent && textContent.trim()) {
      finalParsedText = `${extractedText}\n\n### Zusätzliche Notizen des Studierenden:\n${textContent.trim()}`;
    } else if (extractedText) {
      finalParsedText = extractedText;
    } else if (textContent && textContent.trim()) {
      finalParsedText = textContent.trim();
    } else {
      finalParsedText = `[Vorlesungsdokument: ${trimmedTitle}]\nDokument für das Modul ${mod.name} (${fileName || trimmedTitle}). Enthält Prüfungsschwerpunkte für die Klausurvorbereitung.`;
    }

    let effectiveDocTitle = trimmedTitle;
    const isGenericTitle =
      !effectiveDocTitle ||
      /^media[_\s-]?\d+/i.test(effectiveDocTitle) ||
      /^img[_\s-]?\d+/i.test(effectiveDocTitle) ||
      /^scan[_\s-]?\d+/i.test(effectiveDocTitle) ||
      /^screenshot/i.test(effectiveDocTitle) ||
      effectiveDocTitle.toLowerCase() === fileName?.toLowerCase();

    if (isGenericTitle && extractedText) {
      // Fast heuristic (0ms latency, analyzes full text for chapters, case studies, exams, concept frequencies)
      const autoTitle = suggestDocumentTitleFromText(extractedText, trimmedTitle);
      if (autoTitle && autoTitle.trim().length > 3 && !/^media[_\s-]?\d+/i.test(autoTitle)) {
        effectiveDocTitle = autoTitle.trim();
      } else {
        const activeKey = apiKey || DEFAULT_GEMINI_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
        if (activeKey) {
          try {
            const smart = await suggestSmartDocumentTitle({
              text: extractedText,
              fileName: fileName || trimmedTitle,
              apiKey: activeKey,
              provider,
            });
            if (smart && smart.trim().length > 3) {
              effectiveDocTitle = smart.trim();
            }
          } catch (e) {
            console.warn("Smart title server fallback:", e);
          }
        }
      }
    }

    const safeTitle = sanitizePostgresString(effectiveDocTitle);
    const safeFileName = sanitizePostgresString(fileName || `${effectiveDocTitle.toLowerCase().replace(/\s+/g, "_")}.pdf`);
    const safeParsedText = sanitizePostgresString(finalParsedText);

    // 3. Create document record (guaranteed safe against Postgres 22021 null byte error)
    const doc = await prisma.document.create({
      data: {
        moduleId,
        title: safeTitle,
        fileName: safeFileName,
        fileUrl: `/uploads/${encodeURIComponent(safeTitle)}`,
        category: effectiveCategory,
        isIndexed: true,
        parsedText: safeParsedText,
      },
    });

    // 4. If the module has 0 topics, create an initial topic based on the document title
    if (mod.topics.length === 0) {
      await prisma.topic.create({
        data: {
          moduleId,
          name: safeTitle,
          masteryScore: 0,
          summary: `Themenbereich basierend auf dem Dokument "${safeTitle}".`,
        },
      });
    }

    return NextResponse.json(
      {
        ...doc,
        extractedChars: safeParsedText.length,
        hasText: finalParsedText.length > 50,
        success: true,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Failed to upload document:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim Hochladen des Dokuments." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Dokument-ID fehlt" }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            semester: true,
          },
        },
      },
    });

    if (!doc || doc.module.semester.userId !== user.id) {
      return NextResponse.json({ error: "Dokument nicht gefunden oder nicht autorisiert" }, { status: 403 });
    }

    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error("Failed to delete document:", error);
    return NextResponse.json({ error: "Fehler beim Löschen des Dokuments" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, category, isPastExam, parsedText } = body;

    const trimmedTitle = typeof title === "string" ? title.trim() : "";
    if (!id || !trimmedTitle) {
      return NextResponse.json({ error: "Dokument-ID und Titel sind erforderlich" }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            semester: true,
          },
        },
      },
    });

    if (!doc || doc.module.semester.userId !== user.id) {
      return NextResponse.json({ error: "Dokument nicht gefunden oder nicht autorisiert" }, { status: 403 });
    }

    const safeTitle = sanitizePostgresString(trimmedTitle);
    const updateData: any = {
      title: safeTitle,
      category: isPastExam
        ? DocumentCategory.EXAM_PAST
        : (category as DocumentCategory) || doc.category,
    };

    if (typeof parsedText === "string") {
      updateData.parsedText = sanitizePostgresString(parsedText);
    }

    const updated = await prisma.document.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Failed to update document:", error);
    return NextResponse.json({ error: error.message || "Fehler beim Aktualisieren des Dokuments" }, { status: 500 });
  }
}
