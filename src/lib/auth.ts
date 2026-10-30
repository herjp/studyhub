import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "studyhub-super-secret-key-32-bytes-long!!"
);

export const COOKIE_NAME = "studyhub_session";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name || "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.id || !payload.email) return null;
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: (payload.name as string) || null,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Returns the currently logged in user from cookie, or null.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch (e) {
    return null;
  }
}

/**
 * Ensures a demo user exists in the database for instant testing/guest mode.
 */
export async function getOrCreateDemoUser() {
  const demoEmail = "demo@studyhub.app";
  let user = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  if (!user) {
    const hashedPassword = await hashPassword("studyhub123");
    user = await prisma.user.create({
      data: {
        email: demoEmail,
        name: "Max Mustermann",
        password: hashedPassword,
      },
    });

    // Link any unassigned semesters to this demo user
    await prisma.semester.updateMany({
      where: { userId: null },
      data: { userId: user.id },
    });
  }

  return user;
}
