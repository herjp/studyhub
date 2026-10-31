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
      let availableModels: string[] = [];

      // Step A: Query Google AI Studio API for valid key & list of accessible models
      try {
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${trimmedKey}`;
        const listRes = await fetch(listUrl, { method: "GET" });

        if (!listRes.ok) {
          const errText = await listRes.text();
          let errDetail = `Fehlercode ${listRes.status}`;
          try {
            const parsed = JSON.parse(errText);
            if (parsed.error?.message) {
              errDetail = parsed.error.message;
            }
          } catch {}
          return NextResponse.json({
            success: false,
            error: `API-Key ungültig (${errDetail}). Bitte prüfe deinen Schlüssel aus Google AI Studio (aistudio.google.com/app/apikey).`,
          });
        }

        const listData = await listRes.json();
        if (Array.isArray(listData.models)) {
          availableModels = listData.models
            .filter((m: any) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes("generateContent")
            )
            .map((m: any) => m.name.replace(/^models\//, ""));
        }
      } catch (listErr: any) {
        console.warn("Failed to fetch model list from Gemini:", listErr.message);
      }

      // Priority list of models to test
      const preferredModels = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-2.5-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro-latest",
      ];

      const modelsToTry: string[] = [];
      if (model) modelsToTry.push(model);

      for (const p of preferredModels) {
        if (availableModels.length === 0 || availableModels.includes(p)) {
          if (!modelsToTry.includes(p)) modelsToTry.push(p);
        }
      }

      // If availableModels has other generateContent models, add them too
      for (const a of availableModels) {
        if (!modelsToTry.includes(a)) modelsToTry.push(a);
      }

      if (modelsToTry.length === 0) {
        modelsToTry.push("gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash");
      }

      let lastErrorMsg = "";
      let workingModel = "";

      // Step B: Live ping generateContent on the best available model
      for (const testModel of modelsToTry) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${trimmedKey}`;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: "Antworte kurz mit: OK" }] }],
              generationConfig: { maxOutputTokens: 10 },
            }),
          });

          if (res.ok) {
            workingModel = testModel;
            break;
          } else {
            const errorText = await res.text();
            try {
              const parsed = JSON.parse(errorText);
              lastErrorMsg = parsed.error?.message || `Status ${res.status}`;
            } catch {
              lastErrorMsg = `Status ${res.status}`;
            }
          }
        } catch (fetchErr: any) {
          lastErrorMsg = fetchErr.message;
        }
      }

      if (!workingModel) {
        return NextResponse.json({
          success: false,
          error: `Verbindung fehlgeschlagen: ${lastErrorMsg || "Kein kompatibles Gemini-Modell gefunden."}`,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Erfolgreich verbunden! Google Gemini (${workingModel}) ist voll einsatzbereit.`,
        provider: "gemini",
        model: workingModel,
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
