import { NextResponse } from "next/server";
import { generateTopicSummary } from "@/lib/ai-service";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { moduleId, topicId, apiKey, provider, isEnglish } = body;

    if (!moduleId || !topicId) {
      return NextResponse.json(
        { error: "moduleId und topicId sind erforderlich" },
        { status: 400 }
      );
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
      apiKey,
      provider,
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
