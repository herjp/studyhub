import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email und Passwort sind erforderlich." },
        { status: 400 }
      );
    }

    const trimmedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Ungültige E-Mail oder falsches Passwort." },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Ungültige E-Mail oder falsches Passwort." },
        { status: 401 }
      );
    }

    // Check if Two-Factor Authentication (2FA) is enabled for this user
    if (user.twoFactorEnabled) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorCode: code,
          twoFactorExpires: expires,
        },
      });

      return NextResponse.json({
        requires2FA: true,
        email: user.email,
        devCode: code,
        message: "2-Faktor-Authentifizierung erforderlich. Bitte gib den 6-stelligen Code ein.",
      });
    }

    const sessionUser = { id: user.id, email: user.email, name: user.name };
    const token = await createSessionToken(sessionUser);

    const response = NextResponse.json({ user: sessionUser });
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
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Fehler beim Anmelden." },
      { status: 500 }
    );
  }
}
