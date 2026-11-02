import { NextResponse } from "next/server";
import { askModuleTutor } from "@/lib/ai-service";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { moduleId, question, chatHistory, apiKey, provider, lang } = body;

    if (!moduleId || !question?.trim()) {
      return NextResponse.json(
        { error: "moduleId und question sind erforderlich" },
        { status: 400 }
      );
    }

    // Fallback to database user AI settings if not provided in request body
    if (!apiKey || !apiKey.trim()) {
      const user = await getCurrentUser();
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            aiProvider: true,
            geminiApiKey: true,
            openaiApiKey: true,
            anthropicApiKey: true,
          },
        });
        if (dbUser) {
          const effectiveProvider = provider || dbUser.aiProvider || "gemini";
          provider = effectiveProvider;
          if (effectiveProvider === "gemini") apiKey = dbUser.geminiApiKey || undefined;
          else if (effectiveProvider === "openai") apiKey = dbUser.openaiApiKey || undefined;
          else if (effectiveProvider === "anthropic") apiKey = dbUser.anthropicApiKey || undefined;
          // also fallback to gemini key if chosen provider has no key
          if (!apiKey && dbUser.geminiApiKey) {
            apiKey = dbUser.geminiApiKey;
            provider = "gemini";
          }
        }
      }
    }

    const response = await askModuleTutor({
      moduleId,
      question: question.trim(),
      chatHistory,
      apiKey: apiKey?.trim() || undefined,
      provider: provider || "gemini",
      lang,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("Tutor Q&A error:", err);
    return NextResponse.json(
      { error: err.message || "Fehler bei der Beantwortung der Frage." },
      { status: 500 }
    );
  }
}
