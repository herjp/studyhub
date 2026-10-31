import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSessionToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, code, newPassword } = body;

    if (!email) {
      return NextResponse.json(
        { error: "E-Mail-Adresse ist erforderlich." },
        { status: 400 }
      );
    }

    const trimmedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user) {
      // Security: Do not reveal if email exists or not
      return NextResponse.json({
        success: true,
        message: "Falls diese E-Mail existiert, wurde ein 6-stelliger Wiederherstellungscode generiert.",
      });
    }

    if (action === "request") {
      // Generate a 6-digit numeric reset code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: resetCode,
          resetExpires: expires,
        },
      });

      return NextResponse.json({
        success: true,
        email: user.email,
        devCode: resetCode,
        message: "Ein 6-stelliger Sicherheitscode wurde an deine E-Mail-Adresse gesendet.",
      });
    }

    if (action === "reset") {
      if (!code || !newPassword) {
        return NextResponse.json(
          { error: "Code und neues Passwort sind erforderlich." },
          { status: 400 }
        );
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "Das neue Passwort muss mindestens 6 Zeichen lang sein." },
          { status: 400 }
        );
      }

      if (!user.resetToken || user.resetToken !== code.trim()) {
        return NextResponse.json(
          { error: "Der eingegebene Code ist ungültig." },
          { status: 400 }
        );
      }

      if (!user.resetExpires || user.resetExpires < new Date()) {
        return NextResponse.json(
          { error: "Der Code ist abgelaufen. Bitte fordere einen neuen an." },
          { status: 400 }
        );
      }

      const hashedPassword = await hashPassword(newPassword);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetExpires: null,
        },
      });

      // Auto login
      const sessionUser = { id: user.id, email: user.email, name: user.name };
      const token = await createSessionToken(sessionUser);

      const response = NextResponse.json({
        success: true,
        user: sessionUser,
        message: "Passwort erfolgreich geändert!",
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
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Fehler beim Zurücksetzen des Passworts." },
      { status: 500 }
    );
  }
}
