import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { provider, apiKey, model } = body;

    const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";

    if (!trimmedKey) {
      return NextResponse.json(
        { success: false, error: "Kein API-Schlüssel eingegeben." },
        { status: 400 }
      );
    }

    // 1. Google Gemini
    if (provider === "gemini") {
      const testModel = model || "gemini-1.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${trimmedKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Antworte kurz mit: OK" }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMsg = `Google Gemini Fehler (${res.status})`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) {
            errorMsg = parsed.error.message;
          }
        } catch {}
        return NextResponse.json({
          success: false,
          error: `Verbindung fehlgeschlagen: ${errorMsg}`,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Erfolgreich verbunden! Google Gemini (${testModel}) ist einsatzbereit.`,
        provider: "gemini",
        model: testModel,
      });
    }

    // 2. OpenAI
    if (provider === "openai") {
      const testModel = model || "gpt-4o-mini";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${trimmedKey}`,
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: "user", content: "Antworte kurz mit: OK" }],
          max_tokens: 10,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMsg = `OpenAI Fehler (${res.status})`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) {
            errorMsg = parsed.error.message;
          }
        } catch {}
        return NextResponse.json({
          success: false,
          error: `Verbindung fehlgeschlagen: ${errorMsg}`,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Erfolgreich verbunden! OpenAI (${testModel}) ist einsatzbereit.`,
        provider: "openai",
        model: testModel,
      });
    }

    // 3. Anthropic
    if (provider === "anthropic") {
      const testModel = model || "claude-3-5-haiku-20241022";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": trimmedKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: testModel,
          max_tokens: 10,
          messages: [{ role: "user", content: "Antworte kurz mit: OK" }],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMsg = `Anthropic Fehler (${res.status})`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error?.message) {
            errorMsg = parsed.error.message;
          }
        } catch {}
        return NextResponse.json({
          success: false,
          error: `Verbindung fehlgeschlagen: ${errorMsg}`,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Erfolgreich verbunden! Anthropic (${testModel}) ist einsatzbereit.`,
        provider: "anthropic",
        model: testModel,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unbekannter KI-Provider: ${provider}` },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Test connection error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unerwarteter Netzwerkfehler beim Verbindungstest." },
      { status: 500 }
    );
  }
}
