import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { name, avatarUrl } = body;

    const updated = await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        ...(name !== undefined ? { name: name.trim() || null } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        twoFactorEnabled: true,
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren des Profils" }, { status: 500 });
  }
}
