import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DocumentCategory } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { extractDocumentWithGemini } from "@/lib/ai-service";
import { PDFParse } from "pdf-parse";

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

    if (!moduleId || !title) {
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

    // 1. If fileBase64 is provided (PDF, PNG, JPEG, etc.)
    if (fileBase64 && typeof fileBase64 === "string") {
      const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
      const effectiveMime = mimeType || "application/pdf";

      // Try Gemini multimodal extraction first
      try {
        const geminiResult = await extractDocumentWithGemini({
          fileBase64: cleanBase64,
          mimeType: effectiveMime,
          title,
          apiKey,
          provider,
        });

        if (geminiResult && geminiResult.trim().length > 0) {
          extractedText = geminiResult;
        }
      } catch (geminiErr: any) {
        console.warn("Gemini multimodal extraction fallback:", geminiErr.message);
      }

      // If Gemini did not return text and it's a PDF, extract via PDFParse
      if (!extractedText && effectiveMime === "application/pdf") {
        try {
          const buffer = Buffer.from(cleanBase64, "base64");
          const parser = new PDFParse({ data: buffer });
          const pdfResult = await parser.getText();
          if (pdfResult && pdfResult.text) {
            extractedText = pdfResult.text.trim();
          }
          await parser.destroy();
        } catch (pdfErr: any) {
          console.warn("Local PDFParse error:", pdfErr.message);
        }
      }

      // If it's an image without Gemini
      if (!extractedText && effectiveMime.startsWith("image/")) {
        extractedText = `[Vorlesungsfolie / Bilddokument: ${title}]\nHinterlegte Grafik für Modul ${mod.name}. Für automatische Texterkennung & Tafelbild-Transkription aktiviere Google Gemini in den Einstellungen.`;
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
      finalParsedText = `[Dokument: ${title}]\nHinterlegter Textinhalt für das Modul ${mod.name}. Enthält zentrale Definitionen und Vorlesungsinhalte für die RAG-Klausurvorbereitung.`;
    }

    // 3. Create document record
    const doc = await prisma.document.create({
      data: {
        moduleId,
        title: title.trim(),
        fileName: fileName || `${title.toLowerCase().replace(/\s+/g, "_")}.pdf`,
        fileUrl: `/uploads/${encodeURIComponent(title)}`,
        category: effectiveCategory,
        isIndexed: true,
        parsedText: finalParsedText,
      },
    });

    // 4. If the module has 0 topics, create an initial topic based on the document title
    if (mod.topics.length === 0) {
      await prisma.topic.create({
        data: {
          moduleId,
          name: title.trim(),
          masteryScore: 50,
          summary: `Themenbereich basierend auf dem Dokument "${title}".`,
        },
      });
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Failed to upload document:", error);
    return NextResponse.json({ error: "Fehler beim Upload des Dokuments" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Dokument-ID fehlt" }, { status: 400 });
    }

    // Verify ownership
    const doc = await prisma.document.findUnique({
      where: { id },
      include: { module: { include: { semester: true } } },
    });

    if (!doc || doc.module.semester.userId !== user.id) {
      return NextResponse.json({ error: "Dokument nicht gefunden oder nicht autorisiert" }, { status: 403 });
    }

    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return NextResponse.json({ error: "Fehler beim Löschen des Dokuments" }, { status: 500 });
  }
}
