import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Find all modules of this user that have NO documents, NO questions, NO topics
    const emptyModules = await prisma.module.findMany({
      where: {
        semester: { userId: user.id },
        documents: { none: {} },
        questions: { none: {} },
        topics: { none: {} },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    if (emptyModules.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Keine leeren Duplikate gefunden.",
        deletedCount: 0,
      });
    }

    const idsToDelete = emptyModules.map((m) => m.id);

    // Delete calendar events linked to these modules first (if any)
    await prisma.calendarEvent.deleteMany({
      where: { moduleId: { in: idsToDelete } },
    });

    // Delete the empty dummy modules
    const deleted = await prisma.module.deleteMany({
      where: { id: { in: idsToDelete } },
    });

    return NextResponse.json({
      success: true,
      message: `${deleted.count} leere Termin-Module wurden erfolgreich bereinigt.`,
      deletedCount: deleted.count,
    });
  } catch (error: any) {
    console.error("Error cleaning up duplicate modules:", error);
    return NextResponse.json(
      { error: "Fehler beim Bereinigen der Duplikate: " + error.message },
      { status: 500 }
    );
  }
}
