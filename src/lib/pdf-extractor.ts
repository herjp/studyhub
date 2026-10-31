import { inflate, inflateRaw } from "pako";

/**
 * Browser-side high fidelity PDF text extractor using Mozilla PDF.js.
 * Correctly decodes custom font encodings, TrueType/Type0 subsets, and ToUnicode CMaps
 * so that full lecture books and digital slides are transcribed with authentic German sentences.
 * Returns empty string if the document has no digital text (e.g. pure scanned photos).
 */
export async function extractPdfTextWithPdfJs(input: File | ArrayBuffer): Promise<string> {
  if (typeof window === "undefined") return "";

  // 1. Ensure PDF.js is loaded in the browser
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-pdfjs="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.src = "/pdf.min.js";
      script.setAttribute("data-pdfjs", "true");
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Fallback to CDN if needed
        const cdnScript = document.createElement("script");
        cdnScript.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        cdnScript.setAttribute("data-pdfjs", "true");
        cdnScript.onload = () => resolve();
        cdnScript.onerror = reject;
        document.head.appendChild(cdnScript);
      };
      document.head.appendChild(script);
    });
  }

  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) return "";

  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  } catch (e) {
    console.warn("GlobalWorkerOptions workerSrc error:", e);
  }

  try {
    const arrayBuffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
    // Copy array buffer so underlying buffer isn't detached
    const data = new Uint8Array(arrayBuffer.slice(0));

    const loadingTask = pdfjsLib.getDocument({
      data,
      cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/",
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const pageTexts: string[] = [];

    // Parse up to 150 pages for large books to balance comprehensiveness with browser responsiveness
    const maxPages = Math.min(numPages, 150);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items = textContent.items || [];
        const pageLines: string[] = [];

        for (const item of items) {
          if (item && typeof item.str === "string" && item.str.trim()) {
            pageLines.push(item.str);
          }
        }

        const joined = pageLines.join(" ").replace(/[ \t]+/g, " ").trim();
        if (joined.length > 0) {
          pageTexts.push(`[Seite ${pageNum}]\n${joined}`);
        }
      } catch (pageErr) {
        console.warn(`Error reading PDF page ${pageNum}:`, pageErr);
      }
    }

    const fullResult = sanitizePostgresString(pageTexts.join("\n\n"));
    if (fullResult.length > 300000) {
      return fullResult.slice(0, 300000) + "\n\n[... Auszug für Klausurtrainer gekürzt ...]";
    }
    return fullResult;
  } catch (err: any) {
    console.warn("PDF.js extraction error:", err);
    return "";
  }
}

/**
 * Renders the first pages of a scanned/photo PDF to a compressed JPEG in the browser using PDF.js.
 * Produces crisp, high-resolution (~1500px) images that are tiny in payload (~200 KB)
 * so they easily pass Vercel's 4.5 MB payload limit and are lightning fast for Gemini Vision OCR.
 */
export async function renderPdfToCompressedJpeg(
  input: File | ArrayBuffer,
  maxPages: number = 4
): Promise<{ base64: string; mimeType: string; sizeStr: string } | null> {
  if (typeof window === "undefined") return null;

  // Ensure PDF.js is loaded
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-pdfjs="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.src = "/pdf.min.js";
      script.setAttribute("data-pdfjs", "true");
      script.async = true;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) return null;

  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  } catch (e) {
    console.warn("GlobalWorkerOptions workerSrc error:", e);
  }

  try {
    const arrayBuffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
    const data = new Uint8Array(arrayBuffer.slice(0));
    const loadingTask = pdfjsLib.getDocument({
      data,
      cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/",
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    if (numPages === 0) return null;

    const pagesToRender = Math.min(numPages, maxPages);
    const canvases: HTMLCanvasElement[] = [];

    let totalHeight = 0;
    let maxWidth = 0;

    for (let p = 1; p <= pagesToRender; p++) {
      const page = await pdf.getPage(p);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      // Scale to max 1200px width for fast rendering and optimal OCR readability
      const targetWidth = Math.min(1200, Math.max(800, unscaledViewport.width * 1.2));
      const scale = targetWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, viewport }).promise;
      canvases.push(canvas);

      maxWidth = Math.max(maxWidth, canvas.width);
      totalHeight += canvas.height;
    }

    if (canvases.length === 0) return null;

    // Stitch pages vertically if multi-page scan
    const combinedCanvas = document.createElement("canvas");
    combinedCanvas.width = maxWidth;
    combinedCanvas.height = totalHeight;
    const combinedCtx = combinedCanvas.getContext("2d");
    if (!combinedCtx) return null;

    // Fill white background
    combinedCtx.fillStyle = "#ffffff";
    combinedCtx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

    let currentY = 0;
    for (const c of canvases) {
      combinedCtx.drawImage(c, 0, currentY);
      currentY += c.height;
    }

    // Export as optimized JPEG (quality 0.70)
    const jpegDataUrl = combinedCanvas.toDataURL("image/jpeg", 0.70);
    const cleanBase64 = jpegDataUrl.replace(/^data:image\/jpeg;base64,/, "");
    const approxBytes = Math.round((cleanBase64.length * 3) / 4);
    const sizeStr = `${Math.round(approxBytes / 1024)} KB (Scan komprimiert)`;

    return {
      base64: cleanBase64,
      mimeType: "image/jpeg",
      sizeStr,
    };
  } catch (err: any) {
    console.warn("Failed to render PDF to compressed JPEG:", err);
    return null;
  }
}

/**
 * Universal browser-side OCR engine using Tesseract.js.
 * Runs directly in WebAssembly inside the client browser.
 * Extracts genuine German / English lecture text from photos, scans, and screenshots
 * completely offline with ZERO API key required!
 */
export async function recognizeTextWithTesseract(
  imageSource: File | Blob | string | HTMLCanvasElement
): Promise<string> {
  if (typeof window === "undefined") return "";

  // Ensure Tesseract.js script is loaded
  if (!(window as any).Tesseract) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-tesseract="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.src = "/tesseract.min.js";
      script.setAttribute("data-tesseract", "true");
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Fallback to CDN if local bundle fails
        const cdnScript = document.createElement("script");
        cdnScript.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
        cdnScript.onload = () => resolve();
        cdnScript.onerror = reject;
        document.head.appendChild(cdnScript);
      };
      document.head.appendChild(script);
    });
  }

  const Tesseract = (window as any).Tesseract;
  if (!Tesseract) return "";

  try {
    const result = await Tesseract.recognize(imageSource, "deu+eng");
    const raw = result?.data?.text || "";
    return sanitizePostgresString(raw);
  } catch (err) {
    console.warn("Tesseract browser OCR fallback:", err);
    return "";
  }
}

/**
 * Automatically extracts and suggests a concise, human-readable document title
 * from the actual textual contents of a PDF, lecture slide, or exam.
 * Filters out screenshot UI noise (time, battery, navigation tabs), institution boilerplate,
 * and prioritizes Chapter headings, Case Study numbers, Exam headers, and Core topics.
 */
export function suggestDocumentTitleFromText(text: string, fallbackFileName: string = ""): string {
  if (!text || !text.trim()) return fallbackFileName;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Filter out noise / UI artifacts / boilerplate
  const isNoise = (l: string) => {
    if (l.length < 3) return true;
    if (/^\[Seite\s*\d+\]/i.test(l)) return true;
    if (/^\d{1,2}:\d{2}/.test(l)) return true; // time like 14:51
    if (/^(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i.test(l)) return true;
    if (/^\d+\s*%/i.test(l) || /%\s*[A-Z0-9]?$/i.test(l)) return true; // battery
    if (/^VL\s*\d+$/i.test(l)) return true;
    if (/^TU\s*WIEN$/i.test(l) || l === "WIEN" || l === "TU" || l === "im" || l === "IS") return true;
    if (/^(Name|Matr\.?\s*Nr|Datum|Unterschrift|Punkte|Bearbeitungszeit|Bitte schreiben Sie|Viel Erfolg)\b/i.test(l)) return true;
    if (/^--+/.test(l) || /^[•\-_=*~]+$/.test(l)) return true;
    if (/^(Institut für|Research Group|Academy for Continuing Education)\b/i.test(l)) return true;
    return false;
  };

  const cleanLines = lines.filter((l) => !isNoise(l));

  // 1. Look for explicit keyword patterns (Fallstudie, Kapitel, Vorlesung, Übung, Klausur)
  for (let i = 0; i < Math.min(cleanLines.length, 15); i++) {
    const line = cleanLines[i];

    // Case Study: e.g. "Fall 9 — Der Umbau beginnt vor dem Umbau"
    const fallMatch = line.match(/^Fall\s*\d+[:\s–—-]+(.+)/i);
    if (fallMatch) {
      const nextLine = cleanLines[i + 1];
      if (nextLine && nextLine.length < 45 && !isNoise(nextLine) && !nextLine.includes(".")) {
        const full = `${line.replace(/\s*[-–—]\s*/, ": ")} (${nextLine})`;
        return full.length > 65 ? full.slice(0, 62) + "..." : full;
      }
      return line.replace(/\s*[-–—]\s*/, ": ");
    }

    // Chapters / Lecture / Exercise: e.g. "Kapitel 4: Transaktionen & Isolation"
    if (/^(Kapitel|Vorlesung|Übung|Session|Unit|Modul)\s*\d*[:\s–—-]+/i.test(line)) {
      return line.length > 65 ? line.slice(0, 62) + "..." : line;
    }

    // Exam headers: e.g. "Abschlussklausur, 2. Dezember 2025"
    if (/\b(Abschlussklausur|Altklausur|Klausur|Prüfung|Midterm|Final Exam)\b/i.test(line)) {
      const prevLine = cleanLines[i - 1];
      if (
        prevLine &&
        prevLine.length > 6 &&
        prevLine.length < 45 &&
        !prevLine.includes("Prof") &&
        !prevLine.includes("TU")
      ) {
        const full = `${prevLine} - ${line}`;
        return full.length > 65 ? full.slice(0, 62) + "..." : full;
      }
      return line;
    }
  }

  // 2. Look for book titles like "Erfolgreich in turbulenten Zeiten: Leadership..."
  for (const line of cleanLines.slice(0, 10)) {
    const bookMatch = line.match(
      /(?:Auflage\s+)?([A-ZÄÖÜ][^.]{12,65}(?:Leadership|Management|Informatik|Systeme|Architektur|Engineering|Entwicklung|Zeiten)[^.]{0,35})/i
    );
    if (bookMatch) {
      const t = bookMatch[1].trim();
      return t.length > 65 ? t.slice(0, 62) + "..." : t;
    }
  }

  // 3. Fallback: First substantive headline
  for (const line of cleanLines.slice(0, 8)) {
    if (
      line.length >= 8 &&
      line.length <= 65 &&
      !line.endsWith(".") &&
      !line.toLowerCase().includes("institut") &&
      !line.toLowerCase().includes("management science")
    ) {
      return line;
    }
  }

  return fallbackFileName;
}

/**
 * Strips null bytes (0x00) and dangerous non-printable control characters
 * to ensure compatibility with PostgreSQL text / varchar columns.
 */
export function sanitizePostgresString(str: string): string {
  if (!str) return "";
  return str
    .replace(/\0/g, "") // Remove 0x00 null bytes (Postgres error 22021)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ") // Replace control chars with space
    .trim();
}

/**
 * Validates whether an extracted string is genuine human-readable text
 * (in German, English, etc.) rather than random binary image data,
 * font glyph index noise, or raw PostScript stream remnants.
 */
export function isValidPdfText(text: string): boolean {
  if (!text || text.trim().length < 40) return false;
  const trimmed = text.trim();

  // 1. Check for dense non-ASCII high-byte garbage (e.g. ¹ºµÆÇÂ¿À»±²’“Ž...)
  // In normal German/English text, high Latin-1 / weird symbols should not exceed 12%
  const highByteGarbageMatch = trimmed.match(/[\u007F-\u009F\u00A0-\u00BF\u00D7\u00F7\u0250-\uFFFF]/g);
  if (highByteGarbageMatch && highByteGarbageMatch.length / trimmed.length > 0.12) {
    return false;
  }

  // 2. Count genuine pronounceable words separated by whitespace
  const rawWords = trimmed.split(/\s+/);
  if (rawWords.length < 8) return false;

  let validWordChars = 0;
  let validWordCount = 0;

  for (const w of rawWords) {
    const clean = w.replace(/^[.,:;!?"'()\[\]{}«»„“”\-_/\\]+|[.,:;!?"'()\[\]{}«»„“”\-_/\\]+$/g, "");
    if (/^[a-zA-ZäöüÄÖÜß]{2,35}$/.test(clean)) {
      if (/[aeiouyäöüAEIOUYÄÖÜ]/.test(clean)) {
        validWordChars += clean.length;
        validWordCount++;
      }
    }
  }

  const wordRatio = validWordChars / trimmed.length;
  // Must have at least 8 real words and real words must make up at least 30% of character content
  return validWordCount >= 8 && wordRatio >= 0.30;
}

/**
 * Decodes standard PDF escape sequences in literal strings: (text)
 */
function decodePdfLiteralString(str: string): string {
  return str
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\r/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "")
    .replace(/\\f/g, "")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

/**
 * Decodes hexadecimal string literals in PDFs: <48656c6c6f>
 */
function decodePdfHexString(hex: string): string {
  const cleanHex = hex.replace(/\s+/g, "");
  if (!cleanHex) return "";

  // Check for UTF-16BE BOM (FE FF)
  if (cleanHex.toLowerCase().startsWith("feff")) {
    let result = "";
    for (let i = 4; i < cleanHex.length; i += 4) {
      const code = parseInt(cleanHex.slice(i, i + 4), 16);
      if (!isNaN(code)) result += String.fromCharCode(code);
    }
    return result;
  }

  // Check if UTF-16BE (2 bytes per character, e.g. 0048 0065)
  if (cleanHex.length >= 4 && cleanHex.length % 4 === 0 && cleanHex.startsWith("00")) {
    let result = "";
    for (let i = 0; i < cleanHex.length; i += 4) {
      const code = parseInt(cleanHex.slice(i, i + 4), 16);
      if (!isNaN(code) && code >= 32) result += String.fromCharCode(code);
    }
    if (result.length > 0) return result;
  }

  // 1-byte ASCII / Latin-1 hex
  let result = "";
  for (let i = 0; i < cleanHex.length; i += 2) {
    const code = parseInt(cleanHex.slice(i, i + 2), 16);
    if (!isNaN(code)) result += String.fromCharCode(code);
  }
  return result;
}

/**
 * Extracts readable text from an ArrayBuffer (runs in both Browser and Node.js).
 * Returns empty string if the PDF contains scanned photos or images without real text.
 */
export function extractPdfTextFromArrayBuffer(arrayBuffer: ArrayBuffer): string {
  try {
    const uint8 = new Uint8Array(arrayBuffer);
    // Instant C++ native decoding (takes ~30ms for 15MB instead of freezing browser with JS loop)
    const rawContent = new TextDecoder("latin1").decode(uint8);

    const extractedLines: string[] = [];
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let streamMatch: RegExpExecArray | null;
    let streamCount = 0;
    const MAX_STREAMS = 1500;

    while ((streamMatch = streamRegex.exec(rawContent)) !== null && streamCount < MAX_STREAMS) {
      streamCount++;
      const rawStreamStr = streamMatch[1];
      if (!rawStreamStr) continue;

      const rawStreamBytes = new Uint8Array(rawStreamStr.length);
      for (let i = 0; i < rawStreamStr.length; i++) {
        rawStreamBytes[i] = rawStreamStr.charCodeAt(i);
      }

      let decompressed = "";
      try {
        const out = inflate(rawStreamBytes);
        decompressed = new TextDecoder("latin1").decode(out);
      } catch {
        try {
          const out = inflateRaw(rawStreamBytes);
          decompressed = new TextDecoder("latin1").decode(out);
        } catch {
          // Uncompressed text stream
          decompressed = rawStreamStr;
        }
      }

      if (!decompressed) continue;

      // Only search for text if explicit Begin Text (BT) and End Text (ET) operators exist
      if (decompressed.includes("BT") && decompressed.includes("ET")) {
        const btBlocks = decompressed.match(/BT[\s\S]*?ET/g);
        if (!btBlocks) continue;

        for (const block of btBlocks) {
          let blockText = "";

          // 1. Match literal string operator: (text) Tj
          const singleTjRegex = /\(([^()]{0,2000})\)\s*Tj\b/g;
          let tjMatch: RegExpExecArray | null;
          while ((tjMatch = singleTjRegex.exec(block)) !== null) {
            const decoded = decodePdfLiteralString(tjMatch[1]);
            if (decoded.trim()) blockText += decoded + " ";
          }

          // 2. Match hex string operator: <hex> Tj
          const hexTjRegex = /<([0-9a-fA-F\s]{1,2000})>\s*Tj\b/g;
          let hexMatch: RegExpExecArray | null;
          while ((hexMatch = hexTjRegex.exec(block)) !== null) {
            const decoded = decodePdfHexString(hexMatch[1]);
            if (decoded.trim()) blockText += decoded + " ";
          }

          // 3. Match array string operator: [(t) 10 (e) 20 (x)] TJ
          const arrayTjRegex = /\[([^\[\]]{1,15000})\]\s*TJ\b/g;
          let arrMatch: RegExpExecArray | null;
          while ((arrMatch = arrayTjRegex.exec(block)) !== null) {
            const arrayInner = arrMatch[1];
            const tokenRegex = /\(([^()]{0,1000})\)|<([0-9a-fA-F\s]{1,1000})>/g;
            let tokenMatch: RegExpExecArray | null;
            let innerText = "";
            while ((tokenMatch = tokenRegex.exec(arrayInner)) !== null) {
              if (tokenMatch[1] !== undefined) {
                innerText += decodePdfLiteralString(tokenMatch[1]);
              } else if (tokenMatch[2] !== undefined) {
                innerText += decodePdfHexString(tokenMatch[2]);
              }
            }
            if (innerText.trim()) blockText += innerText + " ";
          }

          if (blockText.trim()) {
            extractedLines.push(blockText.trim());
          }
        }
      }
    }

    const rawResult = extractedLines
      .join("\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n");

    const sanitized = sanitizePostgresString(rawResult);

    // If it's not genuine human text (e.g. scanned image PDF), return empty string so Gemini Vision runs!
    if (!isValidPdfText(sanitized)) {
      return "";
    }

    // Limit text to 300,000 chars for large books to ensure swift database indexing
    if (sanitized.length > 300000) {
      return sanitized.slice(0, 300000) + "\n\n[... Auszug für Klausurtrainer gekürzt ...]";
    }

    return sanitized;
  } catch (err: any) {
    console.warn("ArrayBuffer PDF parsing error:", err.message);
    return "";
  }
}

/**
 * Extracts readable text from a Node.js Buffer.
 */
export function extractPdfTextFromBuffer(buffer: Buffer): string {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return extractPdfTextFromArrayBuffer(arrayBuffer);
}
