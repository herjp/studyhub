export type IcsEventType = "EXAM" | "TEST" | "LECTURE" | "EXERCISE" | "HOLIDAY" | "OTHER";

export interface ParsedIcsEvent {
  uid: string;
  summary: string;
  cleanModuleName: string;
  courseCode?: string;
  description: string;
  location: string;
  startDate: Date | null;
  endDate: Date | null;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm or ""
  endTimeStr?: string; // HH:mm or ""
  eventType: IcsEventType;
  isExam: boolean; // True for EXAM or TEST
  matchedModuleId?: string | null;
  matchedModuleName?: string | null;
  selected: boolean;
}

export interface CourseGroup {
  cleanModuleName: string;
  courseCode?: string;
  allEvents: ParsedIcsEvent[];
  examCount: number;
  testCount: number;
  lectureCount: number;
  exerciseCount: number;
  primaryExamDate?: Date;
  primaryExamLocation?: string;
  primaryExamTime?: string;
  matchedModuleId?: string | null;
  matchedModuleName?: string | null;
  action: "link" | "create_new" | "ignore";
}

/**
 * Extracts clean base module name from raw course titles (e.g., TU Wien TISS format)
 * "330.285 VO Industrielle Informationssysteme" -> "Industrielle Informationssysteme"
 * "330.286 UE Industrielle Informationssysteme (Prüfung) - Test Lektion 1" -> "Industrielle Informationssysteme"
 */
export function cleanModuleName(raw: string): string {
  let name = raw.trim();

  // Strip prefix like "Klausur zu", "Prüfung:", etc.
  name = name.replace(/^(Klausur|Prüfung|Exam|Test)(\s+(zu|für|in))?:\s*/i, "");
  name = name.replace(/^(Klausur|Prüfung|Exam|Test)\s+(zu|für|in)\s+/i, "");

  // Strip LVA number prefix like "330.285" or "064.051"
  name = name.replace(/^\d{3}\.\d{3}\s*/, "");

  // Strip LVA type prefix like VO, UE, VU, SE, PR, LU, EX, VL
  name = name.replace(/^(VO|UE|VU|SE|PR|LU|EX|VL|PS|KO)\s+/i, "");

  // Strip exam/test suffixes
  name = name.replace(/\s*\(Prüfung\).*$/i, "");
  name = name.replace(/\s*-\s*(Test|Prüfung|Klausur|Exam).*$/i, "");
  name = name.replace(/\s*\(in\s+TUWEL\).*$/i, "");
  name = name.replace(/\s*\(Vorlesung\)/i, "");
  name = name.replace(/\s*\(Übung\)/i, "");

  // Strip group identifiers like "- Group 1", "- Gruppe 2"
  name = name.replace(/\s*-\s*(Group|Gruppe)\s*\d+.*$/i, "");

  return name.trim() || raw.trim();
}

/**
 * Extracts 6-digit university course code if present (e.g. "330.285")
 */
export function extractCourseCode(raw: string): string | undefined {
  const match = raw.match(/\b\d{3}\.\d{3}\b/);
  return match ? match[0] : undefined;
}

/**
 * Classifies appointment type: Exam, Test, Lecture, Exercise, or Holiday
 */
export function classifyEventType(summary: string, description: string = ""): IcsEventType {
  const text = (summary + " " + description).toLowerCase();

  // 1. Non-academic holidays / days off
  if (
    /ferien|vorlesungsfrei|feiertag|nationalfeiertag|allerheiligen|allerseelen|karfreitag|ostermontag|christi himmelfahrt|pfingstmontag|fronleichnam|mariä empfängnis|staatsfeiertag/.test(
      text
    )
  ) {
    return "HOLIDAY";
  }

  // 2. Main Exams / Klausuren
  if (
    /klausur|abschlussprüfung|prüfungstermin|hauptprüfung|nachklausur|endterm|final exam/.test(text) ||
    (/prüfung/.test(text) && !/test/.test(text))
  ) {
    return "EXAM";
  }

  // 3. Tests / Midterms / Colloquia
  if (/test|zwischentest|kurztest|kolloquium|midterm|test lektion/.test(text)) {
    return "TEST";
  }

  // 4. Exercises / Labs / Practicals
  if (/(\bue\b|übung|praktikum|labor|laborübung|tutorium|exercise|lab\b)/i.test(summary)) {
    return "EXERCISE";
  }

  // 5. Regular Lectures and Seminars
  if (/(\bvo\b|vorlesung|\bvu\b|lecture|\bvl\b|\bse\b|seminar)/i.test(summary)) {
    return "LECTURE";
  }

  return "OTHER";
}

/**
 * Parses RFC 5545 iCalendar (.ics) files.
 * Correctly unescapes lines, categorizes events, and extracts course groups.
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

  if (!startDate) return null;

  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, "0");
  const day = String(startDate.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  const hours = String(startDate.getHours()).padStart(2, "0");
  const minutes = String(startDate.getMinutes()).padStart(2, "0");
  const hasTime = !(startDate.getHours() === 0 && startDate.getMinutes() === 0 && dtstart.length === 8);
  const timeStr = hasTime ? `${hours}:${minutes}` : "";

  let endTimeStr = "";
  if (endDate) {
    const endH = String(endDate.getHours()).padStart(2, "0");
    const endM = String(endDate.getMinutes()).padStart(2, "0");
    endTimeStr = `${endH}:${endM}`;
  }

  const cleanName = cleanModuleName(summary);
  const courseCode = extractCourseCode(summary);
  const eventType = classifyEventType(summary, description);
  const isExam = eventType === "EXAM" || eventType === "TEST";

  // Match with existing modules
  let matchedModuleId: string | null = null;
  let matchedModuleName: string | null = null;

  for (const m of modules) {
    const mName = m.name.toLowerCase().trim();
    const mCode = m.code ? m.code.toLowerCase().trim() : "";
    const cleanLower = cleanName.toLowerCase();

    if (
      (courseCode && mCode && (mCode.includes(courseCode) || courseCode.includes(mCode))) ||
      cleanLower === mName ||
      (mName.length >= 4 && cleanLower.includes(mName)) ||
      (cleanLower.length >= 4 && mName.includes(cleanLower))
    ) {
      matchedModuleId = m.id;
      matchedModuleName = m.name;
      break;
    }
  }

  return {
    uid,
    summary,
    cleanModuleName: cleanName,
    courseCode,
    description,
    location,
    startDate,
    endDate,
    dateStr,
    timeStr,
    endTimeStr,
    eventType,
    isExam,
    matchedModuleId,
    matchedModuleName,
    // Automatically preselect all valid academic events except non-academic holidays
    selected: eventType !== "HOLIDAY",
  };
}

/**
 * Groups events by their underlying Course / Module.
 * Ensures exactly ONE module is proposed per course, with all sub-events linked to it.
 */
export function groupIcsEventsByCourse(
  events: ParsedIcsEvent[],
  existingModules: Array<{ id: string; name: string; code?: string | null }> = []
): CourseGroup[] {
  const map: Record<string, ParsedIcsEvent[]> = {};

  for (const ev of events) {
    if (ev.eventType === "HOLIDAY") continue;
    const key = ev.cleanModuleName;
    if (!map[key]) map[key] = [];
    map[key].push(ev);
  }

  const groups: CourseGroup[] = [];

  for (const [modName, evList] of Object.entries(map)) {
    const courseCode = evList.find((e) => e.courseCode)?.courseCode;
    const examEvents = evList.filter((e) => e.eventType === "EXAM");
    const testEvents = evList.filter((e) => e.eventType === "TEST");
    const lectureEvents = evList.filter((e) => e.eventType === "LECTURE");
    const exerciseEvents = evList.filter((e) => e.eventType === "EXERCISE");

    // Determine primary exam / test date (exams take priority over tests)
    const primaryExamEvent = examEvents[0] || testEvents[0] || undefined;

    // Check if module already exists
    let matchedModuleId: string | null = null;
    let matchedModuleName: string | null = null;

    const lowerModName = modName.toLowerCase();

    for (const m of existingModules) {
      const mName = m.name.toLowerCase().trim();
      const mCode = m.code ? m.code.toLowerCase().trim() : "";

      if (
        (courseCode && mCode && (mCode.includes(courseCode) || courseCode.includes(mCode))) ||
        lowerModName === mName ||
        (mName.length >= 4 && lowerModName.includes(mName)) ||
        (lowerModName.length >= 4 && mName.includes(lowerModName))
      ) {
        matchedModuleId = m.id;
        matchedModuleName = m.name;
        break;
      }
    }

    groups.push({
      cleanModuleName: modName,
      courseCode,
      allEvents: evList,
      examCount: examEvents.length,
      testCount: testEvents.length,
      lectureCount: lectureEvents.length,
      exerciseCount: exerciseEvents.length,
      primaryExamDate: primaryExamEvent?.startDate || undefined,
      primaryExamLocation: primaryExamEvent?.location || undefined,
      primaryExamTime: primaryExamEvent?.timeStr || undefined,
      matchedModuleId,
      matchedModuleName,
      action: matchedModuleId ? "link" : "create_new",
    });
  }

  // Sort groups alphabetically by module name
  return groups.sort((a, b) => a.cleanModuleName.localeCompare(b.cleanModuleName));
}

function parseIcsDate(val: string): Date | null {
  if (!val) return null;
  const clean = val.replace(/[^0-9TZ]/g, "");

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

  if (clean.length === 8) {
    const y = parseInt(clean.substring(0, 4), 10);
    const m = parseInt(clean.substring(4, 6), 10) - 1;
    const d = parseInt(clean.substring(6, 8), 10);
    return new Date(y, m, d, 9, 0, 0);
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
