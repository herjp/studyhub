import { inflate, inflateRaw } from "pako";

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
 */
export function extractPdfTextFromArrayBuffer(arrayBuffer: ArrayBuffer): string {
  try {
    const uint8 = new Uint8Array(arrayBuffer);
    let rawContent = "";
    for (let i = 0; i < uint8.length; i++) {
      rawContent += String.fromCharCode(uint8[i]);
    }

    const extractedLines: string[] = [];
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let streamMatch: RegExpExecArray | null;

    while ((streamMatch = streamRegex.exec(rawContent)) !== null) {
      const rawStreamStr = streamMatch[1];
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
          decompressed = rawStreamStr;
        }
      }

      if (!decompressed) continue;

      if (
        decompressed.includes("BT") ||
        decompressed.includes("Tj") ||
        decompressed.includes("TJ") ||
        decompressed.includes("T*")
      ) {
        const btBlocks = decompressed.match(/BT[\s\S]*?ET/g) || [decompressed];
        for (const block of btBlocks) {
          let blockText = "";

          // Match literal string operator: (text) Tj or ' or "
          const singleTjRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
          let tjMatch: RegExpExecArray | null;
          while ((tjMatch = singleTjRegex.exec(block)) !== null) {
            const decoded = decodePdfLiteralString(tjMatch[1]);
            if (decoded.trim()) blockText += decoded + " ";
          }

          // Match hex string operator: <hex> Tj
          const hexTjRegex = /<([0-9a-fA-F\s]+)>\s*(?:Tj|'|")/g;
          let hexMatch: RegExpExecArray | null;
          while ((hexMatch = hexTjRegex.exec(block)) !== null) {
            const decoded = decodePdfHexString(hexMatch[1]);
            if (decoded.trim()) blockText += decoded + " ";
          }

          // Match array string operator: [(t) 10 (e) 20 (x)] TJ
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

    // Fallback: If no text was found in streams, try direct uncompressed document body
    if (extractedLines.length === 0) {
      const directRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
      let directMatch: RegExpExecArray | null;
      while ((directMatch = directRegex.exec(rawContent)) !== null) {
        const decoded = decodePdfLiteralString(directMatch[1]);
        if (decoded.trim()) extractedLines.push(decoded.trim());
      }
    }

    return extractedLines
      .join("\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
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
