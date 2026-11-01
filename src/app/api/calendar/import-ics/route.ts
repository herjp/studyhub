import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { cleanModuleName, classifyEventType, extractCourseCode, groupIcsEventsByCourse, ParsedIcsEvent } from "@/lib/ics-parser";

/**
 * Determine the academic semester based on the date of a course/event.
 * In European / DACH universities:
 * - Wintersemester: October 1st to March 31st (e.g. 01.10.2025 - 31.03.2026 is Wintersemester 2025/26)
 * - Sommersemester: April 1st to September 30th (e.g. 01.04.2026 - 30.09.2026 is Sommersemester 2026)
 */
function getSemesterInfoForDate(date: Date): { name: string; type: "WINTER" | "SUMMER"; year: number; order: number } {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0 = Jan, 1 = Feb, 2 = Mar, 3 = Apr, ... 8 = Sep, 9 = Oct, 10 = Nov, 11 = Dec

  // Months Oct (9), Nov (10), Dec (11): Wintersemester y/(y+1)
  if (m >= 9) {
    const nextYearShort = (y + 1).toString().slice(-2);
    return {
      name: `Wintersemester ${y}/${nextYearShort}`,
      type: "WINTER",
      year: y,
      order: y * 2 + 1,
    };
  }
  // Months Jan (0), Feb (1), Mar (2): Wintersemester (y-1)/y
  else if (m <= 2) {
    const yearShort = y.toString().slice(-2);
    return {
      name: `Wintersemester ${y - 1}/${yearShort}`,
      type: "WINTER",
      year: y - 1,
      order: (y - 1) * 2 + 1,
    };
  }
  // Months Apr (3) to Sep (8): Sommersemester y
  else {
    return {
      name: `Sommersemester ${y}`,
      type: "SUMMER",
      year: y,
      order: y * 2,
    };
  }
}

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

    // Fetch all user's existing semesters
    const userSemesters = await prisma.semester.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
    });

    // Default fallback semester (active or first)
    const activeSemester = userSemesters.find((s) => s.isActive) || userSemesters[0] || null;

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
    let createdSemestersCount = 0;

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

      // Collect all valid dates in this course group to determine its semester
      const eventDates: Date[] = [];
      if (primaryExamDate && !isNaN(primaryExamDate.getTime())) {
        eventDates.push(primaryExamDate);
      }
      for (const ev of subEvents) {
        if (ev.dateStr) {
          const d = new Date(ev.dateStr);
          if (!isNaN(d.getTime())) eventDates.push(d);
        }
      }

      // Determine target semester based on event dates
      let groupSemester: any = activeSemester;

      if (eventDates.length > 0) {
        // Sort dates ascending
        eventDates.sort((a, b) => a.getTime() - b.getTime());
        // Pick representative date (earliest event in the series)
        const repDate = eventDates[0];
        const semInfo = getSemesterInfoForDate(repDate);

        // Find if user already has a semester matching this term
        let matchedSemester = userSemesters.find((s) => {
          const sName = s.name.toLowerCase();
          const targetName = semInfo.name.toLowerCase();
          if (sName === targetName) return true;
          if (semInfo.type === "SUMMER") {
            return (
              sName.includes(semInfo.year.toString()) &&
              (sName.includes("sommer") || sName.includes("sose") || sName.includes("ss"))
            );
          } else {
            const shortNext = (semInfo.year + 1).toString().slice(-2);
            return (
              (sName.includes(semInfo.year.toString()) || sName.includes(shortNext)) &&
              (sName.includes("winter") || sName.includes("wise") || sName.includes("ws"))
            );
          }
        });

        if (!matchedSemester) {
          // Automatically create the new semester for future or past terms!
          matchedSemester = await prisma.semester.create({
            data: {
              userId: user.id,
              name: semInfo.name,
              isActive: userSemesters.length === 0, // only active if user had no existing semester
              order: semInfo.order,
            },
          });
          userSemesters.push(matchedSemester);
          createdSemestersCount++;
        }

        groupSemester = matchedSemester;
      }

      if (!groupSemester) {
        // Fallback: create default semester if completely blank
        groupSemester = await prisma.semester.create({
          data: {
            userId: user.id,
            name: "Wintersemester 2025/26",
            isActive: true,
            order: 1,
          },
        });
        userSemesters.push(groupSemester);
        createdSemestersCount++;
      }

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

      // If create_new or no existing module matched, create the module EXACTLY ONCE in groupSemester!
      if (!targetModule && group.action !== "ignore") {
        // Check if a module with this clean name already exists in groupSemester
        const existingSameName = existingModules.find(
          (m) => m.semesterId === groupSemester.id && m.name.toLowerCase().trim() === modName.toLowerCase().trim()
        );

        if (existingSameName) {
          targetModule = existingSameName;
          linkedModulesCount++;
        } else {
          targetModule = await prisma.module.create({
            data: {
              semesterId: groupSemester.id,
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

    const semInfoStr = createdSemestersCount > 0 ? ` (${createdSemestersCount} neue Semester wie z. B. Sommersemester automatisch angelegt)` : "";

    return NextResponse.json({
      success: true,
      createdModulesCount,
      linkedModulesCount,
      importedEventsCount,
      createdSemestersCount,
      message: `Erfolgreich importiert: ${createdModulesCount} neue Module erstellt, ${linkedModulesCount} Module aktualisiert, ${importedEventsCount} Vorlesungs- & Prüfungstermine eingetragen!${semInfoStr}`,
    });
  } catch (error: any) {
    console.error("Error importing ICS events:", error);
    return NextResponse.json(
      { error: "Fehler beim Verarbeiten des ICS-Imports: " + error.message },
      { status: 500 }
    );
  }
}
