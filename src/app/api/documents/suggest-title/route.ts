import { NextResponse } from "next/server";
import { suggestSmartDocumentTitle } from "@/lib/ai-service";
import { suggestDocumentTitleFromText } from "@/lib/pdf-extractor";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, fileName, apiKey, provider } = body;

    if (!text || typeof text !== "string" || text.trim().length < 15) {
      const fallback = fileName?.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim() || "Neues Dokument";
      return NextResponse.json({ title: fallback });
    }

    const title = await suggestSmartDocumentTitle({
      text,
      fileName,
      apiKey,
      provider,
    });

    return NextResponse.json({ title: title || suggestDocumentTitleFromText(text, fileName || "") });
  } catch (err: any) {
    console.error("suggest-title API route error:", err);
    return NextResponse.json(
      { title: "" },
      { status: 200 }
    );
  }
}
