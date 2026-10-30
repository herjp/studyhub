import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const whereClause: any = {
      examDate: { not: null },
    };
    if (user) {
      whereClause.semester = { userId: user.id };
    }

    const modulesWithExams = await prisma.module.findMany({
      where: whereClause,
      include: {
        semester: true,
        topics: true,
        questions: {
          include: { progress: true },
        },
      },
      orderBy: { examDate: "asc" },
    });

    const now = new Date();
    const enriched = modulesWithExams.map((mod) => {
      const exam = new Date(mod.examDate!);
      const diffMs = exam.getTime() - now.getTime();
      const daysUntilExam = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

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

      return {
        id: mod.id,
        name: mod.name,
        code: mod.code,
        ects: mod.ects,
        semesterId: mod.semesterId,
        semesterName: mod.semester.name,
        examDate: mod.examDate,
        examTime: mod.examTime,
        examLocation: mod.examLocation,
        examDescription: mod.examDescription,
        status: mod.status,
        daysUntilExam,
        readinessScore,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Failed to fetch calendar exams:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Klausurtermine" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      moduleId,
      moduleQuery,
      examDate,
      examTime,
      examLocation,
      examDescription,
    } = body;

    if (!examDate) {
      return NextResponse.json({ error: "Klausurdatum ist erforderlich" }, { status: 400 });
    }

    let targetModuleId = moduleId;

    // If no explicit moduleId provided, perform automatic fuzzy match against module names and codes!
    if (!targetModuleId && moduleQuery) {
      const allModules = await prisma.module.findMany({
        include: { semester: true },
      });

      const q = moduleQuery.trim().toLowerCase();
      // Look for exact code or name substring
      const matched = allModules.find(
        (m) =>
          (m.code && m.code.toLowerCase().includes(q)) ||
          m.name.toLowerCase().includes(q) ||
          q.includes(m.name.toLowerCase())
      );

      if (matched) {
        targetModuleId = matched.id;
      }
    }

    if (!targetModuleId) {
      return NextResponse.json(
        { error: "Kein passendes Modul gefunden. Bitte wähle das Modul aus der Liste." },
        { status: 404 }
      );
    }

    const updated = await prisma.module.update({
      where: { id: targetModuleId },
      data: {
        examDate: new Date(examDate),
        examTime: examTime || null,
        examLocation: examLocation || null,
        examDescription: examDescription !== undefined ? examDescription : undefined,
      },
      include: { semester: true },
    });

    return NextResponse.json({
      success: true,
      module: updated,
      matchedAutomatically: !moduleId && Boolean(moduleQuery),
    });
  } catch (error) {
    console.error("Failed to update exam date in calendar:", error);
    return NextResponse.json(
      { error: "Fehler beim Eintragen des Klausurtermins" },
      { status: 500 }
    );
  }
}
