import zlib from "zlib";

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
 * Extracts readable text from a PDF Buffer in pure JavaScript without external worker dependencies.
 * Parses PDF stream objects (FlateDecode compressed and uncompressed) and extracts Tj / TJ text commands.
 */
export function extractPdfTextFromBuffer(buffer: Buffer): string {
  try {
    const rawContent = buffer.toString("latin1");
    const extractedLines: string[] = [];

    // Regex to locate stream ... endstream blocks in PDF
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let streamMatch: RegExpExecArray | null;

    while ((streamMatch = streamRegex.exec(rawContent)) !== null) {
      const rawStream = Buffer.from(streamMatch[1], "latin1");
      let decompressed = "";

      // 1. Try decompressing using zlib (FlateDecode)
      try {
        decompressed = zlib.inflateSync(rawStream).toString("latin1");
      } catch {
        try {
          decompressed = zlib.inflateRawSync(rawStream).toString("latin1");
        } catch {
          // Stream might be uncompressed plain text
          decompressed = rawStream.toString("latin1");
        }
      }

      if (!decompressed) continue;

      // Check if stream contains text operators (BT = Begin Text, ET = End Text, Tj/TJ = Show Text)
      if (
        decompressed.includes("BT") ||
        decompressed.includes("Tj") ||
        decompressed.includes("TJ") ||
        decompressed.includes("T*")
      ) {
        // Extract BT ... ET blocks
        const btBlocks = decompressed.match(/BT[\s\S]*?ET/g) || [decompressed];

        for (const block of btBlocks) {
          let blockText = "";

          // 1. Match literal string operator: (text) Tj or ' or "
          const singleTjRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
          let tjMatch: RegExpExecArray | null;
          while ((tjMatch = singleTjRegex.exec(block)) !== null) {
            const decoded = decodePdfLiteralString(tjMatch[1]);
            if (decoded.trim()) {
              blockText += decoded + " ";
            }
          }

          // 2. Match hex string operator: <hex> Tj
          const hexTjRegex = /<([0-9a-fA-F\s]+)>\s*(?:Tj|'|")/g;
          let hexMatch: RegExpExecArray | null;
          while ((hexMatch = hexTjRegex.exec(block)) !== null) {
            const decoded = decodePdfHexString(hexMatch[1]);
            if (decoded.trim()) {
              blockText += decoded + " ";
            }
          }

          // 3. Match array string operator: [(t) 10 (e) 20 (x)] TJ or [<0048> 20 <0065>] TJ
          const arrayTjRegex = /\[([\s\S]*?)\]\s*TJ/g;
          let arrMatch: RegExpExecArray | null;
          while ((arrMatch = arrayTjRegex.exec(block)) !== null) {
            const arrayInner = arrMatch[1];
            // Match both (str) and <hex> tokens inside the array
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

            if (innerText.trim()) {
              blockText += innerText + " ";
            }
          }

          if (blockText.trim()) {
            extractedLines.push(blockText.trim());
          }
        }
      }
    }

    // Fallback: If no text was found in streams, try direct uncompressed document body
    if (extractedLines.length === 0) {
      const directRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
      let directMatch: RegExpExecArray | null;
      while ((directMatch = directRegex.exec(rawContent)) !== null) {
        const decoded = decodePdfLiteralString(directMatch[1]);
        if (decoded.trim()) {
          extractedLines.push(decoded.trim());
        }
      }
    }

    // Clean up extracted text
    const result = extractedLines
      .join("\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return result;
  } catch (err: any) {
    console.warn("PDF stream parsing encountered an error:", err.message);
    return "";
  }
}
