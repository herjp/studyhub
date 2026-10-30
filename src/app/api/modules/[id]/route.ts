import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
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

    if (!mod) {
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
    let dailyGoal = 0;
    if (daysUntilExam && daysUntilExam > 0) {
      dailyGoal = Math.max(1, Math.ceil(dueQuestions.length / daysUntilExam));
    } else {
      dailyGoal = Math.min(dueQuestions.length, 5);
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
