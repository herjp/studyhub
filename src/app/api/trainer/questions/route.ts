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
    const singleId = url.searchParams.get("id");
    const queryIds = url.searchParams.get("ids")?.split(",").filter(Boolean);

    let targetIds: string[] = [];
    if (singleId) {
      targetIds = [singleId];
    } else if (queryIds && queryIds.length > 0) {
      targetIds = queryIds;
    } else {
      try {
        const body = await req.json();
        if (Array.isArray(body?.ids)) {
          targetIds = body.ids.filter((i: any) => typeof i === "string" && i.trim().length > 0);
        } else if (body?.id) {
          targetIds = [body.id];
        }
      } catch {
        // ignore JSON parse error if no body
      }
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ error: "Keine Fragen-IDs übergeben" }, { status: 400 });
    }

    // Strict ownership verification: only delete questions belonging to this user
    const deleteResult = await prisma.question.deleteMany({
      where: {
        id: { in: targetIds },
        module: {
          semester: {
            userId: user.id,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: deleteResult.count,
      deletedIds: targetIds,
    });
  } catch (error: any) {
    console.error("Failed to delete question(s):", error);
    return NextResponse.json({ error: "Fehler beim Löschen der Fragen" }, { status: 500 });
  }
}
