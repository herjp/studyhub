import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { syncExamDatesFromCalendar } from "@/lib/sync-exams";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json([]);
    }

    // Automatically sync exam dates, times, and rooms from calendar events into modules
    await syncExamDatesFromCalendar(user.id);

    const whereClause: any = {
      examDate: { not: null },
      semester: { userId: user.id },
    };

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

    // Also fetch all sub-events (lectures, tests, exercises) from CalendarEvent
    const calendarEvents = await prisma.calendarEvent.findMany({
      where: {
        module: {
          semester: { userId: user.id },
        },
      },
      include: {
        module: {
          include: { semester: true },
        },
      },
      orderBy: { date: "asc" },
    });

    const enrichedEvents = calendarEvents.map((evt) => ({
      id: evt.id,
      moduleId: evt.moduleId,
      moduleName: evt.module.name,
      moduleCode: evt.module.code,
      semesterName: evt.module.semester.name,
      title: evt.title,
      eventType: evt.eventType,
      date: evt.date,
      startTime: evt.startTime,
      endTime: evt.endTime,
      location: evt.location,
      description: evt.description,
    }));

    return NextResponse.json({
      exams: enriched,
      events: enrichedEvents,
    });
  } catch (error) {
    console.error("Failed to fetch calendar exams:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Termine" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

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
        where: { semester: { userId: user.id } },
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

    // Verify ownership
    const targetModule = await prisma.module.findUnique({
      where: { id: targetModuleId },
      include: { semester: true },
    });

    if (!targetModule || targetModule.semester.userId !== user.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
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

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty on simple DELETE requests
    }

    // Support single event deletion
    if (body.eventId) {
      const evt = await prisma.calendarEvent.findUnique({
        where: { id: body.eventId },
        include: { module: { include: { semester: true } } },
      });
      if (evt && evt.module.semester.userId === user.id) {
        await prisma.calendarEvent.delete({ where: { id: body.eventId } });
        return NextResponse.json({ success: true, message: "Termin erfolgreich gelöscht." });
      }
      return NextResponse.json({ error: "Termin nicht gefunden oder nicht berechtigt." }, { status: 404 });
    }

    let deleteEmptyModules = typeof body.deleteEmptyModules === "boolean" ? body.deleteEmptyModules : true;

    // 1. Find all modules belonging to this user
    const userModules = await prisma.module.findMany({
      where: { semester: { userId: user.id } },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            documents: true,
            questions: true,
            topics: true,
          },
        },
      },
    });

    const allModuleIds = userModules.map((m) => m.id);

    // 2. Delete all CalendarEvents for this user's modules
    const deletedEvents = await prisma.calendarEvent.deleteMany({
      where: { moduleId: { in: allModuleIds } },
    });

    // 3. Reset examDate, examTime, examLocation on all user's modules
    const resetExams = await prisma.module.updateMany({
      where: {
        id: { in: allModuleIds },
        examDate: { not: null },
      },
      data: {
        examDate: null,
        examTime: null,
        examLocation: null,
      },
    });

    // 4. Optionally delete empty dummy modules (with 0 docs, 0 questions, 0 topics)
    let deletedEmptyModulesCount = 0;
    if (deleteEmptyModules) {
      const emptyModuleIds = userModules
        .filter(
          (m) =>
            m._count.documents === 0 &&
            m._count.questions === 0 &&
            m._count.topics === 0
        )
        .map((m) => m.id);

      if (emptyModuleIds.length > 0) {
        const deletedEmpty = await prisma.module.deleteMany({
          where: { id: { in: emptyModuleIds } },
        });
        deletedEmptyModulesCount = deletedEmpty.count;
      }
    }

    return NextResponse.json({
      success: true,
      deletedEventsCount: deletedEvents.count,
      resetExamsCount: resetExams.count,
      deletedEmptyModulesCount,
      message: `Kalender erfolgreich zurückgesetzt: ${deletedEvents.count} Termine gelöscht, ${resetExams.count} Prüfungstermine zurückgesetzt${
        deletedEmptyModulesCount > 0
          ? `, ${deletedEmptyModulesCount} leere Import-Module entfernt`
          : ""
      }.`,
    });
  } catch (error: any) {
    console.error("Failed to reset calendar:", error);
    return NextResponse.json(
      { error: "Fehler beim Zurücksetzen des Kalenders: " + error.message },
      { status: 500 }
    );
  }
}
