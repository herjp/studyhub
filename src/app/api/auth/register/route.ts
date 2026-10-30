import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSessionToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email und Passwort sind erforderlich." },
        { status: 400 }
      );
    }

    const trimmedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse ist bereits registriert." },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: trimmedEmail,
        password: hashedPassword,
        name: name?.trim() || null,
      },
    });

    // Create an initial default semester for this new user
    const currentYear = new Date().getFullYear();
    await prisma.semester.create({
      data: {
        userId: user.id,
        name: `Wintersemester ${currentYear}/${(currentYear + 1).toString().slice(2)}`,
        isActive: true,
        order: 1,
      },
    });

    const sessionUser = { id: user.id, email: user.email, name: user.name };
    const token = await createSessionToken(sessionUser);

    const response = NextResponse.json({ user: sessionUser });
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Registration error:", error);
    let msg = "Fehler bei der Registrierung.";
    if (error?.message?.includes("readonly") || error?.message?.includes("unable to open database file")) {
      msg = "Cloud-Datenbank schreibgeschützt: Für Vercel wird eine Cloud-PostgreSQL-Datenbank (z. B. Supabase/Neon) benötigt.";
    } else if (error?.message) {
      msg = `Fehler: ${error.message}`;
    }
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
