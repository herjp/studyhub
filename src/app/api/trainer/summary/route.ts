import { NextResponse } from "next/server";
import { generateTopicSummary } from "@/lib/ai-service";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { moduleId, topicId, apiKey, provider, isEnglish } = body;

    if (!moduleId || !topicId) {
      return NextResponse.json(
        { error: "moduleId und topicId sind erforderlich" },
        { status: 400 }
      );
    }

    // Fallback to database user AI settings if not provided in request body
    if (!apiKey || !apiKey.trim()) {
      const user = await getCurrentUser();
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { aiProvider: true, geminiApiKey: true, openaiApiKey: true, anthropicApiKey: true },
        });
        if (dbUser) {
          const effectiveProvider = provider || dbUser.aiProvider || "gemini";
          provider = effectiveProvider;
          if (effectiveProvider === "gemini") apiKey = dbUser.geminiApiKey || undefined;
          else if (effectiveProvider === "openai") apiKey = dbUser.openaiApiKey || undefined;
          else if (effectiveProvider === "anthropic") apiKey = dbUser.anthropicApiKey || undefined;
          if (!apiKey && dbUser.geminiApiKey) {
            apiKey = dbUser.geminiApiKey;
            provider = "gemini";
          }
        }
      }
    }

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
    });

    if (!topic) {
      return NextResponse.json({ error: "Themengebiet nicht gefunden" }, { status: 404 });
    }

    const summary = await generateTopicSummary({
      moduleId,
      topicName: topic.name,
      currentSummary: topic.summary,
      apiKey: apiKey?.trim() || undefined,
      provider: provider || "gemini",
      isEnglish: !!isEnglish,
    });

    // Optionally persist summary if needed
    if (!topic.summary) {
      await prisma.topic.update({
        where: { id: topicId },
        data: { summary: summary.summary },
      });
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Summary generation error:", error);
    return NextResponse.json({ error: "Fehler beim Generieren der Zusammenfassung" }, { status: 500 });
  }
}
