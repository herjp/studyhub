import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cleanModuleName, classifyEventType, extractCourseCode, groupIcsEventsByCourse, ParsedIcsEvent } from "@/lib/ics-parser";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Bitte melde dich an, um Kalendertermine zu importieren." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { events, courseGroups: incomingCourseGroups, cleanDuplicatesBeforeImport } = body;

    // Optional: Clean up empty duplicate modules first if requested
    if (cleanDuplicatesBeforeImport) {
      const emptyModules = await prisma.module.findMany({
        where: {
          semester: { userId: user.id },
          documents: { none: {} },
          questions: { none: {} },
          topics: { none: {} },
        },
        select: { id: true },
      });
      if (emptyModules.length > 0) {
        const ids = emptyModules.map((m) => m.id);
        await prisma.calendarEvent.deleteMany({ where: { moduleId: { in: ids } } });
        await prisma.module.deleteMany({ where: { id: { in: ids } } });
      }
    }

    // Find user's active semester for new modules
    let targetSemester = await prisma.semester.findFirst({
      where: {
        isActive: true,
        userId: user.id,
      },
    });

    if (!targetSemester) {
      targetSemester = await prisma.semester.findFirst({
        where: { userId: user.id },
        orderBy: { order: "asc" },
      });
    }

    if (!targetSemester) {
      return NextResponse.json({ error: "Kein aktives Semester gefunden." }, { status: 400 });
    }

    // Fetch existing modules for mapping
    const existingModules = await prisma.module.findMany({
      where: { semester: { userId: user.id } },
      select: { id: true, name: true, code: true, semesterId: true },
    });

    // Prepare course groups: either from explicit courseGroups or auto-grouped from raw events
    let groupsToProcess: any[] = [];

    if (Array.isArray(incomingCourseGroups) && incomingCourseGroups.length > 0) {
      groupsToProcess = incomingCourseGroups;
    } else if (Array.isArray(events) && events.length > 0) {
      const sanitizedEvents: ParsedIcsEvent[] = events.map((raw: any) => {
        const summary = (raw.summary || raw.cleanModuleName || "Termin").trim();
        const desc = raw.description || "";
        const clean = cleanModuleName(summary);
        const code = raw.courseCode || extractCourseCode(summary);
        const eventType = raw.eventType && raw.eventType !== "OTHER" ? raw.eventType : classifyEventType(summary, desc);
        return {
          uid: raw.uid || Math.random().toString(36).substring(2),
          summary,
          cleanModuleName: clean,
          courseCode: code,
          description: desc,
          location: raw.location || "",
          startDate: raw.startDate ? new Date(raw.startDate) : (raw.dateStr ? new Date(raw.dateStr) : null),
          endDate: raw.endDate ? new Date(raw.endDate) : null,
          dateStr: raw.dateStr || "",
          timeStr: raw.timeStr || "",
          endTimeStr: raw.endTimeStr || "",
          eventType,
          isExam: eventType === "EXAM" || eventType === "TEST",
          matchedModuleId: raw.target && raw.target !== "create_new" ? raw.target : raw.matchedModuleId,
          selected: raw.selected !== false,
        };
      });
      groupsToProcess = groupIcsEventsByCourse(sanitizedEvents, existingModules);
    } else {
      return NextResponse.json({ error: "Keine Termine zum Importieren übergeben" }, { status: 400 });
    }

    let createdModulesCount = 0;
    let linkedModulesCount = 0;
    let importedEventsCount = 0;

    for (const group of groupsToProcess) {
      if (group.action === "ignore") continue;

      const modName = (group.cleanModuleName || "Neues Fach").trim();
      const courseCode = group.courseCode || extractCourseCode(modName) || null;
      const subEvents = group.allEvents || group.events || [];

      // Determine exam and test events
      const examEvents = subEvents.filter((e: any) => e.eventType === "EXAM" || (e.isExam && !/test/i.test(e.summary)));
      const testEvents = subEvents.filter((e: any) => e.eventType === "TEST" || /test/i.test(e.summary));

      const primaryExam = examEvents[0] || testEvents[0] || null;
      const primaryExamDate = primaryExam?.dateStr ? new Date(primaryExam.dateStr) : null;
      const primaryExamTime = primaryExam?.timeStr || null;
      const primaryExamLocation = primaryExam?.location || null;

      let targetModule: any = null;

      if (group.action === "link" && group.matchedModuleId) {
        // Link to existing module
        targetModule = existingModules.find((m) => m.id === group.matchedModuleId);
        if (targetModule) {
          // If the module didn't have an exam date yet or if we found a verified exam, update it
          if (primaryExamDate) {
            await prisma.module.update({
              where: { id: targetModule.id },
              data: {
                examDate: primaryExamDate,
                examTime: primaryExamTime,
                examLocation: primaryExamLocation,
              },
            });
          }
          linkedModulesCount++;
        }
      }

      // If create_new or no existing module matched, create the module EXACTLY ONCE!
      if (!targetModule && group.action !== "ignore") {
        // Double-check if a module with this clean name already exists in targetSemester
        const existingSameName = existingModules.find(
          (m) => m.semesterId === targetSemester!.id && m.name.toLowerCase().trim() === modName.toLowerCase().trim()
        );

        if (existingSameName) {
          targetModule = existingSameName;
          linkedModulesCount++;
        } else {
          targetModule = await prisma.module.create({
            data: {
              semesterId: targetSemester.id,
              name: modName,
              code: courseCode,
              ects: 5,
              status: "IN_PROGRESS",
              examDate: primaryExamDate,
              examTime: primaryExamTime,
              examLocation: primaryExamLocation,
            },
          });
          createdModulesCount++;
          existingModules.push({
            id: targetModule.id,
            name: targetModule.name,
            code: targetModule.code,
            semesterId: targetModule.semesterId,
          });
        }
      }

      if (!targetModule) continue;

      // Now insert all selected sub-events (lectures, exercises, tests, exams) as CalendarEvents
      for (const ev of subEvents) {
        if (!ev.dateStr || ev.eventType === "HOLIDAY" || ev.selected === false) continue;

        const eventDate = new Date(ev.dateStr);
        let eventType = ev.eventType;
        if (!eventType || eventType === "OTHER") {
          eventType = classifyEventType(ev.summary, ev.description);
        }
        if (eventType === "HOLIDAY") continue;

        // Ensure we don't insert exact duplicate events
        const existingEvent = await prisma.calendarEvent.findFirst({
          where: {
            moduleId: targetModule.id,
            title: ev.summary,
            date: eventDate,
          },
        });

        if (!existingEvent) {
          await prisma.calendarEvent.create({
            data: {
              moduleId: targetModule.id,
              title: ev.summary,
              eventType: eventType as any,
              date: eventDate,
              startTime: ev.timeStr || null,
              endTime: ev.endTimeStr || null,
              location: ev.location || null,
              description: ev.description || null,
            },
          });
          importedEventsCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      createdModulesCount,
      linkedModulesCount,
      importedEventsCount,
      message: `Erfolgreich importiert: ${createdModulesCount} neue Module erstellt, ${linkedModulesCount} Module aktualisiert, ${importedEventsCount} Vorlesungs- & Prüfungstermine eingetragen!`,
    });
  } catch (error: any) {
    console.error("Error importing ICS events:", error);
    return NextResponse.json(
      { error: "Fehler beim Verarbeiten des ICS-Imports: " + error.message },
      { status: 500 }
    );
  }
}
