import { NextResponse } from "next/server";
import { getOrCreateDemoUser, createSessionToken, COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  try {
    const user = await getOrCreateDemoUser();
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
    console.error("Demo login error:", error);
    return NextResponse.json({ error: "Fehler beim Demo-Login." }, { status: 500 });
  }
}
