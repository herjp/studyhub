import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ModuleStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const semesterId = searchParams.get("semesterId");

    const whereClause: any = semesterId ? { semesterId } : {};
    if (user) {
      whereClause.semester = { userId: user.id };
    }

    const modules = await prisma.module.findMany({
      where: whereClause,
      include: {
        semester: true,
        topics: true,
        documents: true,
        questions: {
          include: {
            progress: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = modules.map((mod) => {
      // Calculate days until exam
      let daysUntilExam: number | null = null;
      if (mod.examDate) {
        const now = new Date();
        const exam = new Date(mod.examDate);
        const diffMs = exam.getTime() - now.getTime();
        daysUntilExam = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      // Calculate readiness score (Fahrschulbalken) based on topic mastery and question progress
      const totalQuestions = mod.questions.length;
      let readinessScore = 0;

      if (mod.topics.length > 0) {
        const avgTopicMastery =
          mod.topics.reduce((sum, t) => sum + t.masteryScore, 0) / mod.topics.length;
        readinessScore = Math.round(avgTopicMastery);
      } else if (totalQuestions > 0) {
        const masteredCount = mod.questions.filter((q) =>
          q.progress.some((p) => (p.intervalDays ?? 0) >= 7)
        ).length;
        readinessScore = Math.round((masteredCount / totalQuestions) * 100);
      }

      // Calculate daily question goal:
      // Formel: (Verbleibende ungelöste / fällige Wissensfragen) / (Tage bis Prüfungstermin) = Tägliches Fragenziel
      const now = new Date();
      const dueOrUnsolvedQuestions = mod.questions.filter((q) => {
        if (!q.progress.length) return true;
        const prog = q.progress[0];
        return !prog.lastAnswerDate || new Date(prog.nextReviewDate) <= now;
      }).length;

      let dailyGoal = 0;
      if (daysUntilExam && daysUntilExam > 0) {
        dailyGoal = Math.max(1, Math.ceil(dueOrUnsolvedQuestions / daysUntilExam));
      } else if (dueOrUnsolvedQuestions > 0) {
        dailyGoal = Math.min(dueOrUnsolvedQuestions, 5);
      }

      // Today's answered questions for this module
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const answeredToday = mod.questions.filter((q) =>
        q.progress.some((p) => p.lastAnswerDate && new Date(p.lastAnswerDate) >= todayStart)
      ).length;

      return {
        ...mod,
        daysUntilExam,
        readinessScore,
        dailyGoal,
        answeredToday,
        dueQuestionsCount: dueOrUnsolvedQuestions,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Failed to fetch modules:", error);
    return NextResponse.json({ error: "Failed to fetch modules" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { semesterId, name, code, ects, examDate, examTime, examLocation, examDescription, status } = body;

    if (!semesterId || !name || ects === undefined) {
      return NextResponse.json(
        { error: "Semester, Name und ECTS sind Pflichtfelder" },
        { status: 400 }
      );
    }

    const newModule = await prisma.module.create({
      data: {
        semesterId,
        name,
        code: code || null,
        ects: parseFloat(ects),
        examDate: examDate ? new Date(examDate) : null,
        examTime: examTime || null,
        examLocation: examLocation || null,
        examDescription: examDescription || null,
        status: (status as ModuleStatus) || ModuleStatus.IN_PROGRESS,
      },
    });

    return NextResponse.json(newModule, { status: 201 });
  } catch (error) {
    console.error("Failed to create module:", error);
    return NextResponse.json({ error: "Failed to create module" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, code, ects, examDate, examTime, examLocation, examDescription, status, grade } = body;

    if (!id) {
      return NextResponse.json({ error: "Modul ID fehlt" }, { status: 400 });
    }

    const updated = await prisma.module.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        code: code !== undefined ? code : undefined,
        ects: ects !== undefined ? parseFloat(ects) : undefined,
        examDate: examDate !== undefined ? (examDate ? new Date(examDate) : null) : undefined,
        examTime: examTime !== undefined ? examTime : undefined,
        examLocation: examLocation !== undefined ? examLocation : undefined,
        examDescription: examDescription !== undefined ? examDescription : undefined,
        status: status !== undefined ? (status as ModuleStatus) : undefined,
        grade: grade !== undefined ? (grade ? parseFloat(grade) : null) : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update module:", error);
    return NextResponse.json({ error: "Failed to update module" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Modul ID fehlt" }, { status: 400 });
    }

    await prisma.module.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete module:", error);
    return NextResponse.json({ error: "Failed to delete module" }, { status: 500 });
  }
}
