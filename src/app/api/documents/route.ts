import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DocumentCategory } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { extractDocumentWithGemini } from "@/lib/ai-service";
import { extractPdfTextFromBuffer, sanitizePostgresString } from "@/lib/pdf-extractor";

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
      const isPdf = effectiveMime === "application/pdf" || (fileName && fileName.endsWith(".pdf"));

      // A) For PDFs: Use robust zero-worker stream parser first
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

      // B) If PDF had no embedded text (scanned slides/images) OR if file is an image: Try Gemini Multimodal OCR
      const activeGeminiKey = apiKey || process.env.GEMINI_API_KEY;
      if (!extractedText && activeGeminiKey) {
        try {
          const geminiResult = await extractDocumentWithGemini({
            fileBase64: cleanBase64,
            mimeType: effectiveMime,
            fileName: fileName || `${trimmedTitle}.pdf`,
            title: trimmedTitle,
            apiKey: activeGeminiKey,
            provider,
          });

          if (geminiResult && geminiResult.trim().length > 0) {
            extractedText = geminiResult.trim();
          }
        } catch (geminiErr: any) {
          console.warn("Gemini multimodal OCR fallback:", geminiErr.message);
        }
      }

      // C) If still no text (e.g. image without Gemini key)
      if (!extractedText && effectiveMime.startsWith("image/")) {
        extractedText = `[Vorlesungsfolie / Bilddokument: ${trimmedTitle}]\nHinterlegte Grafik für Modul ${mod.name}.`;
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

    const safeTitle = sanitizePostgresString(trimmedTitle);
    const safeFileName = sanitizePostgresString(fileName || `${trimmedTitle.toLowerCase().replace(/\s+/g, "_")}.pdf`);
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
          masteryScore: 50,
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
