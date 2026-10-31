import { inflate, inflateRaw } from "pako";

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
 * rather than random binary image data or noise.
 */
export function isValidPdfText(text: string): boolean {
  if (!text || text.trim().length < 25) return false;
  const clean = text.replace(/\s+/g, "");
  if (clean.length < 15) return false;

  // Count printable characters (letters, numbers, common German/English punctuation, symbols)
  const printableMatch = clean.match(/[\p{L}\p{N}\p{P}\p{S}]/gu);
  if (!printableMatch) return false;

  const ratio = printableMatch.length / clean.length;
  // Real text must be at least 75% printable glyphs
  return ratio >= 0.75;
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

          // 1. Match literal string operator: (text) Tj or ' or "
          const singleTjRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
          let tjMatch: RegExpExecArray | null;
          while ((tjMatch = singleTjRegex.exec(block)) !== null) {
            const decoded = decodePdfLiteralString(tjMatch[1]);
            if (decoded.trim()) blockText += decoded + " ";
          }

          // 2. Match hex string operator: <hex> Tj
          const hexTjRegex = /<([0-9a-fA-F\s]+)>\s*(?:Tj|'|")/g;
          let hexMatch: RegExpExecArray | null;
          while ((hexMatch = hexTjRegex.exec(block)) !== null) {
            const decoded = decodePdfHexString(hexMatch[1]);
            if (decoded.trim()) blockText += decoded + " ";
          }

          // 3. Match array string operator: [(t) 10 (e) 20 (x)] TJ
          const arrayTjRegex = /\[([\s\S]*?)\]\s*TJ/g;
          let arrMatch: RegExpExecArray | null;
          while ((arrMatch = arrayTjRegex.exec(block)) !== null) {
            const arrayInner = arrMatch[1];
            const tokenRegex = /\(([\s\S]*?)\)|<([0-9a-fA-F\s]+)>/g;
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
