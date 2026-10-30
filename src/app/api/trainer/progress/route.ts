import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { questionId, isCorrect } = body;

    if (!questionId || typeof isCorrect !== "boolean") {
      return NextResponse.json(
        { error: "questionId und isCorrect sind erforderlich" },
        { status: 400 }
      );
    }

    const existingProgress = await prisma.questionProgress.findFirst({
      where: { questionId },
    });

    let nextInterval = 1;
    if (isCorrect) {
      if (!existingProgress) {
        nextInterval = 3;
      } else {
        const cur = existingProgress.intervalDays;
        if (cur <= 1) nextInterval = 3;
        else if (cur <= 3) nextInterval = 7;
        else if (cur <= 7) nextInterval = 14;
        else nextInterval = 30; // Gemeistert
      }
    } else {
      // Fehlerhafter Versuch: Rückfall auf Tag 1
      nextInterval = 1;
    }

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);

    let progress;
    if (existingProgress) {
      progress = await prisma.questionProgress.update({
        where: { id: existingProgress.id },
        data: {
          intervalDays: nextInterval,
          nextReviewDate,
          lastAnswerDate: new Date(),
          lastWasCorrect: isCorrect,
        },
      });
    } else {
      progress = await prisma.questionProgress.create({
        data: {
          questionId,
          intervalDays: nextInterval,
          nextReviewDate,
          lastAnswerDate: new Date(),
          lastWasCorrect: isCorrect,
        },
      });
    }

    // Update topic mastery
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { topic: true },
    });

    if (question?.topicId) {
      const delta = isCorrect ? 6 : -5;
      const currentMastery = question.topic?.masteryScore ?? 50;
      const newScore = Math.min(100, Math.max(0, currentMastery + delta));

      await prisma.topic.update({
        where: { id: question.topicId },
        data: { masteryScore: newScore },
      });
    }

    return NextResponse.json({
      success: true,
      progress,
      nextInterval,
      nextReviewDate,
    });
  } catch (error) {
    console.error("Progress update error:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Lernfortschritts" },
      { status: 500 }
    );
  }
}
