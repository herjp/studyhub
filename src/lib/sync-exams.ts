import { prisma } from "@/lib/prisma";

/**
 * Automatically syncs exam dates, times, and locations from linked CalendarEvents into Modules.
 * Finds upcoming exam/test events and updates module.examDate, examTime, and examLocation in the database.
 */
export async function syncExamDatesFromCalendar(userId: string) {
  try {
    const modules = await prisma.module.findMany({
      where: { semester: { userId } },
      include: {
        events: {
          orderBy: { date: "asc" },
        },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const mod of modules) {
      if (!mod.events || mod.events.length === 0) continue;

      // Filter for exam / test events
      const examEvents = mod.events.filter((e) => {
        if (e.eventType === "EXAM" || e.eventType === "TEST") return true;
        const title = (e.title || "").toLowerCase();
        return /klausur|prüfung|exam|test|colloquium|abschlussprüfung|midterm|final/i.test(title);
      });

      if (examEvents.length === 0) continue;

      // Find earliest upcoming exam event (date >= today), or latest if all passed
      const upcoming = examEvents.find((e) => new Date(e.date) >= today) || examEvents[examEvents.length - 1];
      if (!upcoming) continue;

      const upcomingDate = new Date(upcoming.date);
      const modCurrentDate = mod.examDate ? new Date(mod.examDate) : null;

      // Needs update if:
      // 1. Module has no examDate at all
      // 2. Current examDate has already passed while this event is upcoming
      // 3. Current examDate date string differs from event date string
      const needsDateUpdate =
        !modCurrentDate ||
        (modCurrentDate < today && upcomingDate >= today) ||
        modCurrentDate.toISOString().slice(0, 10) !== upcomingDate.toISOString().slice(0, 10);

      const needsTimeUpdate = !mod.examTime && Boolean(upcoming.startTime);
      const needsLocUpdate = !mod.examLocation && Boolean(upcoming.location);

      if (needsDateUpdate || needsTimeUpdate || needsLocUpdate) {
        await prisma.module.update({
          where: { id: mod.id },
          data: {
            examDate: upcomingDate,
            examTime: upcoming.startTime || mod.examTime || null,
            examLocation: upcoming.location || mod.examLocation || null,
            examDescription: mod.examDescription || upcoming.description || undefined,
          },
        });
      }
    }
  } catch (err) {
    console.warn("Auto-sync exam dates from calendar:", err);
  }
}
