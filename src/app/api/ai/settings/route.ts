import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        aiProvider: true,
        geminiApiKey: true,
        openaiApiKey: true,
        anthropicApiKey: true,
        aiModel: true,
      },
    });

    return NextResponse.json({
      success: true,
      settings: dbUser || {},
    });
  } catch (error: any) {
    console.error("Error reading AI settings:", error);
    return NextResponse.json({ error: "Fehler beim Laden der KI-Einstellungen" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { provider, apiKey, geminiApiKey, openaiApiKey, anthropicApiKey, model } = body;

    const updateData: any = {};
    if (provider !== undefined) updateData.aiProvider = provider;
    if (model !== undefined) updateData.aiModel = model;

    if (geminiApiKey !== undefined) {
      updateData.geminiApiKey = geminiApiKey ? geminiApiKey.trim() : null;
    }
    if (openaiApiKey !== undefined) {
      updateData.openaiApiKey = openaiApiKey ? openaiApiKey.trim() : null;
    }
    if (anthropicApiKey !== undefined) {
      updateData.anthropicApiKey = anthropicApiKey ? anthropicApiKey.trim() : null;
    }

    // If a generic apiKey is passed along with a specific provider
    if (apiKey !== undefined && provider) {
      const cleanKey = apiKey ? apiKey.trim() : null;
      if (provider === "gemini") updateData.geminiApiKey = cleanKey;
      else if (provider === "openai") updateData.openaiApiKey = cleanKey;
      else if (provider === "anthropic") updateData.anthropicApiKey = cleanKey;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        aiProvider: true,
        geminiApiKey: true,
        openaiApiKey: true,
        anthropicApiKey: true,
        aiModel: true,
      },
    });

    return NextResponse.json({
      success: true,
      settings: updated,
    });
  } catch (error: any) {
    console.error("Error saving AI settings:", error);
    return NextResponse.json({ error: "Fehler beim Speichern der KI-Einstellungen" }, { status: 500 });
  }
}
