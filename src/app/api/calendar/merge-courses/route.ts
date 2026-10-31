import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cleanModuleName, extractCourseCode, classifyEventType } from "@/lib/ics-parser";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const modules = await prisma.module.findMany({
      where: { semester: { userId: user.id } },
      include: {
        _count: { select: { documents: true, questions: true, topics: true, events: true } },
      },
    });

    // Only process dummy modules that have 0 documents and 0 questions
    const candidateModules = modules.filter(
      (m) => m._count.documents === 0 && m._count.questions === 0
    );

    const holidayIds: string[] = [];
    const courseGroups = new Map<string, typeof candidateModules>();

    for (const m of candidateModules) {
      const type = classifyEventType(m.name);
      if (type === "HOLIDAY" || /vorlesungsfrei|ferien|feiertag/i.test(m.name)) {
        holidayIds.push(m.id);
        continue;
      }

      const clean = cleanModuleName(m.name);
      const key = clean.toLowerCase();

      if (!courseGroups.has(key)) {
        courseGroups.set(key, []);
      }
      courseGroups.get(key)!.push(m);
    }

    // 1. Delete holiday modules
    let deletedHolidaysCount = 0;
    if (holidayIds.length > 0) {
      await prisma.calendarEvent.deleteMany({ where: { moduleId: { in: holidayIds } } });
      const del = await prisma.module.deleteMany({ where: { id: { in: holidayIds } } });
      deletedHolidaysCount = del.count;
    }

    let consolidatedCoursesCount = 0;
    let redundantDeletedCount = 0;

    // 2. Consolidate each course group
    for (const [key, list] of courseGroups.entries()) {
      const cleanName = cleanModuleName(list[0].name);
      const code = list.map((m) => extractCourseCode(m.name)).find(Boolean) || null;

      const primary = list[0];
      const redundant = list.slice(1);

      let bestExamDate = primary.examDate;
      let bestExamTime = primary.examTime;
      let bestExamLocation = primary.examLocation;
      let bestExamDesc = primary.examDescription;

      for (const m of list) {
        const type = classifyEventType(m.name, m.examDescription || "");
        if (type === "EXAM") {
          bestExamDate = m.examDate || bestExamDate;
          bestExamTime = m.examTime || bestExamTime;
          bestExamLocation = m.examLocation || bestExamLocation;
          bestExamDesc = m.examDescription || bestExamDesc;
          break;
        }
      }

      await prisma.module.update({
        where: { id: primary.id },
        data: {
          name: cleanName,
          code: code,
          ects: 5,
          examDate: bestExamDate,
          examTime: bestExamTime,
          examLocation: bestExamLocation,
          examDescription: bestExamDesc,
        },
      });

      // Transfer appointments into CalendarEvents
      for (const m of list) {
        if (!m.examDate) continue;

        const eventType = classifyEventType(m.name, m.examDescription || "");

        const existing = await prisma.calendarEvent.findFirst({
          where: {
            moduleId: primary.id,
            date: m.examDate,
            title: m.name,
          },
        });

        if (!existing) {
          await prisma.calendarEvent.create({
            data: {
              moduleId: primary.id,
              title: m.name,
              eventType: eventType as any,
              date: m.examDate,
              startTime: m.examTime || null,
              location: m.examLocation || null,
              description: m.examDescription || null,
            },
          });
        }
      }

      if (redundant.length > 0) {
        const redundantIds = redundant.map((r) => r.id);
        await prisma.calendarEvent.deleteMany({ where: { moduleId: { in: redundantIds } } });
        const del = await prisma.module.deleteMany({ where: { id: { in: redundantIds } } });
        redundantDeletedCount += del.count;
      }

      consolidatedCoursesCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Erfolgreich ${consolidatedCoursesCount} Module konsolidiert und ${redundantDeletedCount + deletedHolidaysCount} Duplikate bereinigt!`,
      consolidatedCoursesCount,
      deletedCount: redundantDeletedCount + deletedHolidaysCount,
    });
  } catch (error: any) {
    console.error("Error merging courses:", error);
    return NextResponse.json(
      { error: "Fehler beim Zusammenführen der Module: " + error.message },
      { status: 500 }
    );
  }
}
