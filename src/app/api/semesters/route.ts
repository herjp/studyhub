import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    // Strict user isolation: If not logged in, return empty array so no private user data is ever exposed
    if (!user) {
      return NextResponse.json([]);
    }

    const semesters = await prisma.semester.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
      include: {
        modules: {
          include: {
            questions: true,
            topics: true,
            documents: true,
          },
        },
      },
    });

    return NextResponse.json(semesters);
  } catch (error) {
    console.error("Failed to fetch semesters:", error);
    return NextResponse.json({ error: "Failed to fetch semesters" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Bitte melde dich an, um ein Semester anzulegen." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, startDate, endDate, isActive } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
    }

    // Get max order for this user
    const lastSemester = await prisma.semester.findFirst({
      where: { userId: user.id },
      orderBy: { order: "desc" },
    });
    const order = (lastSemester?.order ?? 0) + 1;

    // If marked active, set other semesters to isActive: false
    if (isActive) {
      await prisma.semester.updateMany({
        where: { userId: user.id, isActive: true },
        data: { isActive: false },
      });
    }

    const newSemester = await prisma.semester.create({
      data: {
        name: name.trim(),
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(),
        isActive: isActive ?? true,
        order,
        userId: user.id,
      },
    });

    return NextResponse.json(newSemester, { status: 201 });
  } catch (error) {
    console.error("Failed to create semester:", error);
    return NextResponse.json({ error: "Failed to create semester" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, startDate, endDate, isActive, order } = body;

    if (!id) {
      return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
    }

    if (isActive) {
      await prisma.semester.updateMany({
        where: { id: { not: id }, isActive: true },
        data: { isActive: false },
      });
    }

    const updated = await prisma.semester.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        order: order !== undefined ? Number(order) : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update semester:", error);
    return NextResponse.json({ error: "Failed to update semester" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Semester ID fehlt" }, { status: 400 });
    }

    await prisma.semester.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete semester:", error);
    return NextResponse.json({ error: "Failed to delete semester" }, { status: 500 });
  }
}
