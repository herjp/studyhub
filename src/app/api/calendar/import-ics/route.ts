import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  cleanModuleName,
  classifyEventType,
  extractCourseCode,
  groupIcsEventsByCourse,
  ParsedIcsEvent,
} from "@/lib/ics-parser";
import { getSemesterInfoForDate, matchesSemesterName } from "@/lib/semester-utils";

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
        const eventType =
          raw.eventType && raw.eventType !== "OTHER"
            ? raw.eventType
            : classifyEventType(summary, desc);
        return {
          uid: raw.uid || Math.random().toString(36).substring(2),
          summary,
          cleanModuleName: clean,
          courseCode: code,
          description: desc,
          location: raw.location || "",
          startDate: raw.startDate
            ? new Date(raw.startDate)
            : raw.dateStr
            ? new Date(raw.dateStr)
            : null,
          endDate: raw.endDate ? new Date(raw.endDate) : null,
          dateStr: raw.dateStr || "",
          timeStr: raw.timeStr || "",
          endTimeStr: raw.endTimeStr || "",
          eventType,
          isExam: eventType === "EXAM" || eventType === "TEST",
          matchedModuleId:
            raw.target && raw.target !== "create_new" ? raw.target : raw.matchedModuleId,
          selected: raw.selected !== false,
        };
      });
      groupsToProcess = groupIcsEventsByCourse(sanitizedEvents, existingModules);
    } else {
      return NextResponse.json(
        { error: "Keine Termine zum Importieren übergeben" },
        { status: 400 }
      );
    }

    const activeGroups = groupsToProcess.filter((g) => g.action !== "ignore");
    if (activeGroups.length === 0) {
      return NextResponse.json(
        { error: "Keine Fächer zum Importieren ausgewählt" },
        { status: 400 }
      );
    }

    // Stream real-time progress via ndjson
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        };

        try {
          send({ type: "start", total: activeGroups.length });

          let createdModulesCount = 0;
          let linkedModulesCount = 0;
          let importedEventsCount = 0;
          let createdSemestersCount = 0;

          for (let i = 0; i < activeGroups.length; i++) {
            const group = activeGroups[i];
            const modName = (group.cleanModuleName || "Neues Fach").trim();
            const courseCode = group.courseCode || extractCourseCode(modName) || null;
            const subEvents = group.allEvents || group.events || [];

            // Determine exam and test events
            const examEvents = subEvents.filter(
              (e: any) => e.eventType === "EXAM" || (e.isExam && !/test/i.test(e.summary))
            );
            const testEvents = subEvents.filter(
              (e: any) => e.eventType === "TEST" || /test/i.test(e.summary)
            );

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
              eventDates.sort((a, b) => a.getTime() - b.getTime());
              const repDate = eventDates[0];
              const semInfo = getSemesterInfoForDate(repDate);

              let matchedSemester = userSemesters.find((s) => matchesSemesterName(s.name, semInfo));

              if (!matchedSemester) {
                matchedSemester = await prisma.semester.create({
                  data: {
                    userId: user.id,
                    name: semInfo.name,
                    startDate: semInfo.startDate,
                    endDate: semInfo.endDate,
                    isActive: userSemesters.length === 0,
                    order: semInfo.order,
                  },
                });
                userSemesters.push(matchedSemester);
                createdSemestersCount++;
              }

              groupSemester = matchedSemester;
            }

            if (!groupSemester) {
              const defaultSemInfo = getSemesterInfoForDate(new Date());
              groupSemester = await prisma.semester.create({
                data: {
                  userId: user.id,
                  name: defaultSemInfo.name,
                  startDate: defaultSemInfo.startDate,
                  endDate: defaultSemInfo.endDate,
                  isActive: true,
                  order: defaultSemInfo.order,
                },
              });
              userSemesters.push(groupSemester);
              createdSemestersCount++;
            }

            let targetModule: any = null;

            // Link to existing module ONLY if it belongs to this exact target semester!
            if (group.action === "link" && group.matchedModuleId) {
              const candidate = existingModules.find((m) => m.id === group.matchedModuleId);
              if (candidate && candidate.semesterId === groupSemester.id) {
                targetModule = candidate;
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

            // If create_new OR linking to an old semester was requested, create or link within groupSemester!
            if (!targetModule && group.action !== "ignore") {
              const existingSameName = existingModules.find(
                (m) =>
                  m.semesterId === groupSemester.id &&
                  m.name.toLowerCase().trim() === modName.toLowerCase().trim()
              );

              if (existingSameName) {
                targetModule = existingSameName;
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

            if (targetModule) {
              // High performance bulk insertion of calendar events using createMany
              const validEvents = subEvents.filter(
                (ev: any) => ev.dateStr && ev.eventType !== "HOLIDAY" && ev.selected !== false
              );

              if (validEvents.length > 0) {
                const existingEvents = await prisma.calendarEvent.findMany({
                  where: { moduleId: targetModule.id },
                  select: { title: true, date: true },
                });

                const existingSet = new Set(
                  existingEvents.map(
                    (e) => `${e.title.trim().toLowerCase()}___${e.date.toISOString().slice(0, 10)}`
                  )
                );

                const eventsToCreate: any[] = [];
                for (const ev of validEvents) {
                  const eventDate = new Date(ev.dateStr);
                  const key = `${ev.summary.trim().toLowerCase()}___${eventDate
                    .toISOString()
                    .slice(0, 10)}`;
                  if (existingSet.has(key)) continue;
                  existingSet.add(key);

                  let eventType = ev.eventType;
                  if (!eventType || eventType === "OTHER") {
                    eventType = classifyEventType(ev.summary, ev.description);
                  }
                  if (eventType === "HOLIDAY") continue;

                  eventsToCreate.push({
                    moduleId: targetModule.id,
                    title: ev.summary,
                    eventType: eventType as any,
                    date: eventDate,
                    startTime: ev.timeStr || null,
                    endTime: ev.endTimeStr || null,
                    location: ev.location || null,
                    description: ev.description || null,
                  });
                }

                if (eventsToCreate.length > 0) {
                  await prisma.calendarEvent.createMany({
                    data: eventsToCreate,
                  });
                  importedEventsCount += eventsToCreate.length;
                }
              }
            }

            // Stream progress event after each course group is saved
            const percent = Math.round(((i + 1) / activeGroups.length) * 100);
            send({
              type: "progress",
              current: i + 1,
              total: activeGroups.length,
              course: modName,
              percent,
            });
          }

          const semInfoStr =
            createdSemestersCount > 0
              ? ` (${createdSemestersCount} neue Semester wie z. B. Sommersemester automatisch angelegt)`
              : "";

          send({
            type: "done",
            success: true,
            createdModulesCount,
            linkedModulesCount,
            importedEventsCount,
            createdSemestersCount,
            total: activeGroups.length,
            message: `Erfolgreich importiert: ${createdModulesCount} neue Module erstellt, ${linkedModulesCount} Module aktualisiert, ${importedEventsCount} Vorlesungs- & Prüfungstermine eingetragen!${semInfoStr}`,
          });

          controller.close();
        } catch (streamErr: any) {
          send({ type: "error", error: streamErr.message || "Fehler beim Verarbeiten" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error: any) {
    console.error("Error importing ICS events:", error);
    return NextResponse.json(
      { error: "Fehler beim Verarbeiten des ICS-Imports: " + error.message },
      { status: 500 }
    );
  }
}
