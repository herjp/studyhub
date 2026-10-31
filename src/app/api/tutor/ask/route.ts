import { NextResponse } from "next/server";
import { askModuleTutor } from "@/lib/ai-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { moduleId, question, chatHistory, apiKey, provider, lang } = body;

    if (!moduleId || !question?.trim()) {
      return NextResponse.json(
        { error: "moduleId und question sind erforderlich" },
        { status: 400 }
      );
    }

    const response = await askModuleTutor({
      moduleId,
      question: question.trim(),
      chatHistory,
      apiKey,
      provider,
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
