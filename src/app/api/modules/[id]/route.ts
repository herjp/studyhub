import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const moduleId = params.id;

    const mod = await prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        semester: true,
        documents: {
          orderBy: { createdAt: "desc" },
        },
        topics: {
          orderBy: { masteryScore: "asc" }, // Weakest first!
          include: {
            questions: true,
          },
        },
        questions: {
          include: {
            topic: true,
            progress: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!mod || mod.semester.userId !== user.id) {
      return NextResponse.json({ error: "Modul nicht gefunden" }, { status: 404 });
    }

    // Days until exam
    let daysUntilExam: number | null = null;
    if (mod.examDate) {
      const now = new Date();
      const exam = new Date(mod.examDate);
      const diffMs = exam.getTime() - now.getTime();
      daysUntilExam = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Readiness score
    let readinessScore = 0;
    if (mod.topics.length > 0) {
      const avg = mod.topics.reduce((acc, t) => acc + t.masteryScore, 0) / mod.topics.length;
      readinessScore = Math.round(avg);
    } else if (mod.questions.length > 0) {
      const mastered = mod.questions.filter((q) =>
        q.progress.some((p) => (p.intervalDays ?? 0) >= 7)
      ).length;
      readinessScore = Math.round((mastered / mod.questions.length) * 100);
    }

    // Due questions for spaced repetition (today or overdue)
    const now = new Date();
    const dueQuestions = mod.questions.filter((q) => {
      if (!q.progress.length) return true;
      const p = q.progress[0];
      return !p.lastAnswerDate || new Date(p.nextReviewDate) <= now;
    });

    // Daily Goal
    let dailyGoal = mod.dailyGoal || 5;
    if (!mod.dailyGoal && daysUntilExam && daysUntilExam > 0) {
      dailyGoal = Math.max(1, Math.ceil(dueQuestions.length / daysUntilExam));
    }

    // Today's answered questions
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const answeredToday = mod.questions.filter((q) =>
      q.progress.some((p) => p.lastAnswerDate && new Date(p.lastAnswerDate) >= todayStart)
    ).length;

    // Top 3 weakest topics
    const weakestTopics = mod.topics.slice(0, 3);

    return NextResponse.json({
      ...mod,
      daysUntilExam,
      readinessScore,
      dailyGoal,
      answeredToday,
      dueQuestionsCount: dueQuestions.length,
      dueQuestions,
      weakestTopics,
    });
  } catch (error) {
    console.error("Failed to load module details:", error);
    return NextResponse.json({ error: "Failed to load module" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const moduleId = params.id;

    // Verify ownership
    const existing = await prisma.module.findUnique({
      where: { id: moduleId },
      include: { semester: true },
    });

    if (!existing || existing.semester.userId !== user.id) {
      return NextResponse.json({ error: "Modul nicht gefunden" }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      code,
      ects,
      examDate,
      examTime,
      examLocation,
      examDescription,
      status,
      grade,
      dailyGoal,
    } = body;

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (code !== undefined) dataToUpdate.code = code ? code.trim() : null;
    if (ects !== undefined) dataToUpdate.ects = Number(ects);
    if (examDate !== undefined) dataToUpdate.examDate = examDate ? new Date(examDate) : null;
    if (examTime !== undefined) dataToUpdate.examTime = examTime || null;
    if (examLocation !== undefined) dataToUpdate.examLocation = examLocation || null;
    if (examDescription !== undefined) dataToUpdate.examDescription = examDescription || null;
    if (status !== undefined) dataToUpdate.status = status;
    if (grade !== undefined) dataToUpdate.grade = grade !== null && grade !== "" ? Number(grade) : null;
    if (dailyGoal !== undefined) dataToUpdate.dailyGoal = Math.max(1, Number(dailyGoal));

    const updated = await prisma.module.update({
      where: { id: moduleId },
      data: dataToUpdate,
      include: { semester: true },
    });

    return NextResponse.json({ success: true, module: updated });
  } catch (error: any) {
    console.error("Failed to update module:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren des Moduls" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const moduleId = params.id;

    // Verify ownership
    const existing = await prisma.module.findUnique({
      where: { id: moduleId },
      include: { semester: true },
    });

    if (!existing || existing.semester.userId !== user.id) {
      return NextResponse.json({ error: "Modul nicht gefunden" }, { status: 404 });
    }

    await prisma.module.delete({
      where: { id: moduleId },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete module:", error);
    return NextResponse.json({ error: "Fehler beim Löschen des Moduls" }, { status: 500 });
  }
}
