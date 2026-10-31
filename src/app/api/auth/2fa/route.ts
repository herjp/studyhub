import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, getCurrentUser, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, code, enable } = body;

    // Toggle 2FA for logged in user
    if (action === "toggle") {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
      }

      const updated = await prisma.user.update({
        where: { id: currentUser.id },
        data: { twoFactorEnabled: Boolean(enable) },
      });

      return NextResponse.json({
        success: true,
        twoFactorEnabled: updated.twoFactorEnabled,
      });
    }

    if (!email) {
      return NextResponse.json({ error: "E-Mail ist erforderlich" }, { status: 400 });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    // Resend 2FA code
    if (action === "resend") {
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorCode: newCode,
          twoFactorExpires: expires,
        },
      });

      return NextResponse.json({
        success: true,
        devCode: newCode,
        message: "Ein neuer 6-stelliger 2FA-Code wurde an deine E-Mail gesendet.",
      });
    }

    // Verify 2FA code during login
    if (action === "verify") {
      if (!code) {
        return NextResponse.json({ error: "Bitte gib den 6-stelligen Code ein." }, { status: 400 });
      }

      if (!user.twoFactorCode || user.twoFactorCode !== code.trim()) {
        return NextResponse.json({ error: "Ungültiger Bestätigungscode." }, { status: 400 });
      }

      if (!user.twoFactorExpires || user.twoFactorExpires < new Date()) {
        return NextResponse.json(
          { error: "Der Code ist abgelaufen. Bitte fordere einen neuen an." },
          { status: 400 }
        );
      }

      // Clear 2FA code
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorCode: null,
          twoFactorExpires: null,
        },
      });

      const sessionUser = { id: user.id, email: user.email, name: user.name };
      const token = await createSessionToken(sessionUser);

      const response = NextResponse.json({
        success: true,
        user: sessionUser,
      });

      response.cookies.set({
        name: COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
      });

      return response;
    }

    return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
  } catch (error: any) {
    console.error("2FA Error:", error);
    return NextResponse.json({ error: "Fehler bei der 2FA-Verarbeitung." }, { status: 500 });
  }
}
