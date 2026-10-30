import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const whereClause = user ? { semester: { userId: user.id } } : {};

    const modules = await prisma.module.findMany({
      where: whereClause,
      include: {
        semester: true,
      },
    });

    let completedEcts = 0;
    let plannedEcts = 0;
    let weightedGradeSum = 0;
    let gradedEctsSum = 0;

    for (const mod of modules) {
      if (mod.status === "COMPLETED") {
        completedEcts += mod.ects;
        if (mod.grade && mod.grade > 0) {
          weightedGradeSum += mod.grade * mod.ects;
          gradedEctsSum += mod.ects;
        }
      } else if (mod.status === "IN_PROGRESS" || mod.status === "PLANNED") {
        plannedEcts += mod.ects;
      }
    }

    const gpa = gradedEctsSum > 0 ? Number((weightedGradeSum / gradedEctsSum).toFixed(2)) : null;

    // Count questions and progress
    const totalQuestions = await prisma.question.count();
    const answeredCount = await prisma.questionProgress.count({
      where: { lastAnswerDate: { not: null } },
    });

    return NextResponse.json({
      completedEcts,
      plannedEcts,
      gpa,
      gradedEctsSum,
      totalQuestions,
      answeredCount,
      moduleCount: modules.length,
    });
  } catch (error) {
    console.error("Failed to load stats:", error);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
