import { NextResponse } from "next/server";
import { evaluateFreeTextAnswer } from "@/lib/ai-service";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      questionId,
      moduleId,
      questionText,
      sampleSolution,
      userAnswer,
      sourceRef,
      apiKey,
      provider,
    } = body;

    if (!moduleId || !questionText || !userAnswer) {
      return NextResponse.json(
        { error: "moduleId, questionText und userAnswer sind erforderlich" },
        { status: 400 }
      );
    }

    const evaluation = await evaluateFreeTextAnswer({
      moduleId,
      questionText,
      sampleSolution: sampleSolution || "",
      userAnswer,
      sourceRef,
      apiKey,
      provider,
    });

    // If questionId provided, update Spaced Repetition progress
    if (questionId) {
      const existingProgress = await prisma.questionProgress.findFirst({
        where: { questionId },
      });

      let nextInterval = 1;
      const isCorrect = evaluation.isCorrect;

      if (isCorrect) {
        if (!existingProgress) {
          nextInterval = 3;
        } else {
          const current = existingProgress.intervalDays;
          if (current <= 1) nextInterval = 3;
          else if (current <= 3) nextInterval = 7;
          else if (current <= 7) nextInterval = 14;
          else nextInterval = 30; // Mastered
        }
      } else {
        // Fallback on error to 1 day
        nextInterval = 1;
      }

      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);

      if (existingProgress) {
        await prisma.questionProgress.update({
          where: { id: existingProgress.id },
          data: {
            intervalDays: nextInterval,
            nextReviewDate,
            lastAnswerDate: new Date(),
            lastWasCorrect: isCorrect,
          },
        });
      } else {
        await prisma.questionProgress.create({
          data: {
            questionId,
            intervalDays: nextInterval,
            nextReviewDate,
            lastAnswerDate: new Date(),
            lastWasCorrect: isCorrect,
          },
        });
      }

      // Update topic mastery score if question has topic
      const q = await prisma.question.findUnique({
        where: { id: questionId },
        include: { topic: true },
      });

      if (q?.topicId) {
        const delta = isCorrect ? 5 : -4;
        const currentMastery = q.topic?.masteryScore ?? 50;
        const newScore = Math.min(100, Math.max(0, currentMastery + delta));

        await prisma.topic.update({
          where: { id: q.topicId },
          data: { masteryScore: newScore },
        });
      }
    }

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error("Evaluation error:", error);
    return NextResponse.json({ error: "Fehler bei der KI-Bewertung" }, { status: 500 });
  }
}
