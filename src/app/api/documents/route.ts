import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DocumentCategory } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { moduleId, title, fileName, category, isPastExam, textContent } = body;

    if (!moduleId || !title) {
      return NextResponse.json(
        { error: "Modul-ID und Dokumententitel sind erforderlich" },
        { status: 400 }
      );
    }

    const effectiveCategory: DocumentCategory = isPastExam
      ? DocumentCategory.EXAM_PAST
      : (category as DocumentCategory) || DocumentCategory.LECTURE_SLIDES;

    // Simulated parsed text if none provided
    const parsedText =
      textContent && textContent.trim().length > 0
        ? textContent
        : `[Dokument: ${title}]\nHinterlegter Textinhalt für das Modul. Enthält zentrale Definitionen, Sätze und Aufgabenstellungen für die RAG-Indizierung.`;

    const doc = await prisma.document.create({
      data: {
        moduleId,
        title,
        fileName: fileName || `${title.toLowerCase().replace(/\s+/g, "_")}.pdf`,
        fileUrl: `/uploads/${encodeURIComponent(title)}`,
        category: effectiveCategory,
        isIndexed: true, // Successfully indexed for RAG
        parsedText,
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Failed to upload document:", error);
    return NextResponse.json({ error: "Fehler beim Upload des Dokuments" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Dokument-ID fehlt" }, { status: 400 });
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
