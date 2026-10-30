export interface ParsedIcsEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  startDate: Date | null;
  endDate: Date | null;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm or ""
  isExam: boolean;
  matchedModuleId?: string | null;
  matchedModuleName?: string | null;
  selected: boolean;
}

/**
 * Parses RFC 5545 iCalendar (.ics) files.
 * Handles line unfolding, DTSTART formats (UTC, local, DATE-only, TZID),
 * and basic text unescaping.
 */
export function parseIcsContent(
  icsRaw: string,
  availableModules: Array<{ id: string; name: string; code?: string | null }> = []
): ParsedIcsEvent[] {
  if (!icsRaw) return [];

  // Unfold lines: RFC 5545 states that a line starting with space or tab is a continuation
  const unfolded = icsRaw.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  const events: ParsedIcsEvent[] = [];
  let inEvent = false;
  let currentEvent: Record<string, string> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (line === "END:VEVENT") {
      inEvent = false;
      const parsed = processRawEvent(currentEvent, availableModules);
      if (parsed) {
        events.push(parsed);
      }
      continue;
    }

    if (inEvent) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const propFull = line.substring(0, colonIdx);
        const val = line.substring(colonIdx + 1);
        const propKey = propFull.split(";")[0].toUpperCase();

        // Save with full property name or base key
        if (!currentEvent[propKey]) {
          currentEvent[propKey] = unescapeIcsText(val);
        }
      }
    }
  }

  // Sort events by date ascending
  return events.sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return a.startDate.getTime() - b.startDate.getTime();
  });
}

function processRawEvent(
  raw: Record<string, string>,
  modules: Array<{ id: string; name: string; code?: string | null }>
): ParsedIcsEvent | null {
  const summary = (raw["SUMMARY"] || "Unbenannter Termin").trim();
  const description = (raw["DESCRIPTION"] || "").trim();
  const location = (raw["LOCATION"] || "").trim();
  const uid = raw["UID"] || Math.random().toString(36).substring(2);

  const dtstart = raw["DTSTART"] || "";
  const dtend = raw["DTEND"] || "";

  const startDate = parseIcsDate(dtstart);
  const endDate = parseIcsDate(dtend);

  if (!startDate) {
    // If no valid date could be parsed, skip
    return null;
  }

  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, "0");
  const day = String(startDate.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  const hours = String(startDate.getHours()).padStart(2, "0");
  const minutes = String(startDate.getMinutes()).padStart(2, "0");
  const hasTime = !(startDate.getHours() === 0 && startDate.getMinutes() === 0 && dtstart.length === 8);
  const timeStr = hasTime ? `${hours}:${minutes}` : "";

  // Heuristic: Is this event likely an exam?
  const lowerText = `${summary} ${description}`.toLowerCase();
  const examKeywords = [
    "klausur",
    "prüfung",
    "exam",
    "test",
    "abschlussprüfung",
    "midterm",
    "final",
    "colloquium",
    "leistungsnachweis",
    "benotet",
  ];
  const isExam = examKeywords.some((kw) => lowerText.includes(kw));

  // Fuzzy match with existing modules
  let matchedModuleId: string | null = null;
  let matchedModuleName: string | null = null;

  for (const m of modules) {
    const mName = m.name.toLowerCase().trim();
    const mCode = m.code ? m.code.toLowerCase().trim() : "";

    if (
      (mCode && lowerText.includes(mCode)) ||
      (mName.length > 3 && lowerText.includes(mName)) ||
      (mName.length > 3 && mName.includes(summary.toLowerCase()))
    ) {
      matchedModuleId = m.id;
      matchedModuleName = m.name;
      break;
    }
  }

  return {
    uid,
    summary,
    description,
    location,
    startDate,
    endDate,
    dateStr,
    timeStr,
    isExam,
    matchedModuleId,
    matchedModuleName,
    // By default, auto-select if it's an exam or if it matched a module
    selected: isExam || Boolean(matchedModuleId),
  };
}

function parseIcsDate(val: string): Date | null {
  if (!val) return null;
  const clean = val.replace(/[^0-9TZ]/g, "");

  // Format YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  if (clean.includes("T")) {
    const [datePart, timePart] = clean.split("T");
    if (datePart.length === 8) {
      const y = parseInt(datePart.substring(0, 4), 10);
      const m = parseInt(datePart.substring(4, 6), 10) - 1;
      const d = parseInt(datePart.substring(6, 8), 10);
      const hr = parseInt(timePart.substring(0, 2) || "0", 10);
      const min = parseInt(timePart.substring(2, 4) || "0", 10);
      const sec = parseInt(timePart.substring(4, 6) || "0", 10);
      return new Date(y, m, d, hr, min, sec);
    }
  }

  // Format YYYYMMDD (all day date)
  if (clean.length === 8) {
    const y = parseInt(clean.substring(0, 4), 10);
    const m = parseInt(clean.substring(4, 6), 10) - 1;
    const d = parseInt(clean.substring(6, 8), 10);
    return new Date(y, m, d, 9, 0, 0); // Default to 09:00 morning
  }

  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function unescapeIcsText(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\N/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}
