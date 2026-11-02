/**
 * Utility functions for academic semester classification.
 *
 * Rules:
 * - Wintersemester: October 1st to end of February (Months: Oct, Nov, Dec, Jan, Feb)
 * - Sommersemester: March 1st to September 30th (Months: Mar, Apr, May, Jun, Jul, Aug, Sep)
 */

export interface SemesterInfo {
  name: string;
  type: "WINTER" | "SUMMER";
  year: number; // The starting/academic year
  order: number; // Chronological order value (e.g. 2025*2 for SoSe 25, 2025*2+1 for WiSe 25/26)
  startDate: Date;
  endDate: Date;
}

export function getSemesterInfoForDate(date: Date): SemesterInfo {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0 = Jan, 1 = Feb, 2 = Mar, ..., 8 = Sep, 9 = Oct, 10 = Nov, 11 = Dec

  // Wintersemester: October (9), November (10), December (11), January (0), February (1)
  if (m >= 9) {
    // Months Oct, Nov, Dec of year y -> Wintersemester y/(y+1)
    const nextYearShort = (y + 1).toString().slice(-2);
    return {
      name: `Wintersemester ${y}/${nextYearShort}`,
      type: "WINTER",
      year: y,
      order: y * 2 + 1,
      startDate: new Date(y, 9, 1),
      endDate: new Date(y + 1, 1, 28),
    };
  } else if (m <= 1) {
    // Months Jan, Feb of year y -> Wintersemester (y-1)/y
    const yearShort = y.toString().slice(-2);
    return {
      name: `Wintersemester ${y - 1}/${yearShort}`,
      type: "WINTER",
      year: y - 1,
      order: (y - 1) * 2 + 1,
      startDate: new Date(y - 1, 9, 1),
      endDate: new Date(y, 1, 28),
    };
  } else {
    // Months Mar (2) through Sep (8) -> Sommersemester y
    return {
      name: `Sommersemester ${y}`,
      type: "SUMMER",
      year: y,
      order: y * 2,
      startDate: new Date(y, 2, 1),
      endDate: new Date(y, 8, 30),
    };
  }
}

/**
 * Checks if a given semester name matches a target semester info.
 * E.g. "Sommersemester 2026", "SoSe 2026", "SS 2026", "SS26" match Sommersemester 2026.
 * "Wintersemester 2025/26", "WiSe 2025/26", "WS 25/26" match Wintersemester 2025/26.
 */
export function matchesSemesterName(semesterName: string, target: SemesterInfo): boolean {
  const sName = semesterName.toLowerCase().replace(/[\s\-_/]+/g, "");
  const targetSimple = target.name.toLowerCase().replace(/[\s\-_/]+/g, "");

  if (sName.includes(targetSimple) || targetSimple.includes(sName)) {
    return true;
  }

  const yStr = target.year.toString();
  const yShort = yStr.slice(-2);

  if (target.type === "SUMMER") {
    const hasSummer =
      sName.includes("sommer") ||
      sName.includes("sose") ||
      sName.includes("ss") ||
      sName.includes("summer");
    const hasYear = sName.includes(yStr) || sName.includes(yShort);
    return hasSummer && hasYear;
  } else {
    const nextYearStr = (target.year + 1).toString();
    const nextYearShort = nextYearStr.slice(-2);
    const hasWinter =
      sName.includes("winter") ||
      sName.includes("wise") ||
      sName.includes("ws") ||
      sName.includes("wsem");
    const hasYear =
      sName.includes(yStr) ||
      sName.includes(yShort) ||
      sName.includes(nextYearStr) ||
      sName.includes(nextYearShort);
    return hasWinter && hasYear;
  }
}
