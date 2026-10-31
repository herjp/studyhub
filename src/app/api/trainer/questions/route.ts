import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { QuestionType } from "@prisma/client";

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { id, questionText, type, options, sampleSolution, sourceRef } = body;

    if (!id) {
      return NextResponse.json({ error: "Fragen-ID fehlt" }, { status: 400 });
    }

    const existing = await prisma.question.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            semester: true,
          },
        },
      },
    });

    if (!existing || existing.module.semester.userId !== user.id) {
      return NextResponse.json({ error: "Frage nicht gefunden oder nicht autorisiert" }, { status: 403 });
    }

    const updated = await prisma.question.update({
      where: { id },
      data: {
        questionText: questionText !== undefined ? questionText.trim() : existing.questionText,
        type: type !== undefined ? (type as QuestionType) : existing.type,
        options: options !== undefined ? (typeof options === "string" ? options : JSON.stringify(options)) : existing.options,
        sampleSolution: sampleSolution !== undefined ? sampleSolution : existing.sampleSolution,
        sourceRef: sourceRef !== undefined ? sourceRef : existing.sourceRef,
      },
    });

    return NextResponse.json({ success: true, question: updated });
  } catch (error: any) {
    console.error("Failed to update question:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren der Frage" }, { status: 500 });
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
      return NextResponse.json({ error: "Fragen-ID fehlt" }, { status: 400 });
    }

    const existing = await prisma.question.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            semester: true,
          },
        },
      },
    });

    if (!existing || existing.module.semester.userId !== user.id) {
      return NextResponse.json({ error: "Frage nicht gefunden oder nicht autorisiert" }, { status: 403 });
    }

    // Delete question (cascades to QuestionProgress)
    await prisma.question.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error("Failed to delete question:", error);
    return NextResponse.json({ error: "Fehler beim Löschen der Frage" }, { status: 500 });
  }
}
