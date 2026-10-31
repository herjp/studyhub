import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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
    const { events } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "Keine Termine zum Importieren übergeben" }, { status: 400 });
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

    let updatedCount = 0;
    let createdCount = 0;

    for (const ev of events) {
      if (!ev.dateStr || ev.target === "ignore") continue;

      const examDate = new Date(ev.dateStr);

      if (ev.target && ev.target !== "create_new") {
        // Link to existing module - check ownership
        const mod = await prisma.module.findUnique({
          where: { id: ev.target },
          include: { semester: true },
        });

        if (mod && mod.semester.userId === user.id) {
          await prisma.module.update({
            where: { id: ev.target },
            data: {
              examDate,
              examTime: ev.timeStr || null,
              examLocation: ev.location || null,
              examDescription: ev.description || undefined,
            },
          });
          updatedCount++;
        }
      } else if (ev.target === "create_new" && targetSemester) {
        // Create new module
        await prisma.module.create({
          data: {
            semesterId: targetSemester.id,
            name: (ev.newModuleName || ev.summary || "Neues Fach").trim(),
            ects: Number(ev.newModuleEcts) || 5,
            status: "IN_PROGRESS",
            examDate,
            examTime: ev.timeStr || null,
            examLocation: ev.location || null,
            examDescription: ev.description || null,
          },
        });
        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      importedCount: updatedCount + createdCount,
      updatedCount,
      createdCount,
    });
  } catch (error) {
    console.error("Error importing ICS events:", error);
    return NextResponse.json(
      { error: "Fehler beim Verarbeiten des ICS-Imports" },
      { status: 500 }
    );
  }
}
