/**
 * Campus Maps & Room Navigation Helper
 * Specifically optimized for TU Wien Maps (maps.tuwien.ac.at) and university campus locations.
 */

export interface CampusMapInfo {
  isOnline: boolean;
  isTuWien: boolean;
  cleanLocation: string;
  url: string | null;
  providerName: string;
  badgeLabel: string;
}

export function getCampusMapInfo(rawLocation?: string | null, preferredUniversity: string = "tu_wien"): CampusMapInfo {
  if (!rawLocation || !rawLocation.trim()) {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: "",
      url: null,
      providerName: "",
      badgeLabel: "",
    };
  }

  const loc = rawLocation.trim();
  const lower = loc.toLowerCase();

  // 1. Online Platforms Check
  if (lower.includes("tuwel")) {
    return {
      isOnline: true,
      isTuWien: true,
      cleanLocation: "TUWEL (Online)",
      url: "https://tuwel.tuwien.ac.at/",
      providerName: "TUWEL",
      badgeLabel: "In TUWEL öffnen",
    };
  }

  if (lower.includes("zoom") || lower.includes("teams") || lower.includes("webex") || lower.includes("online")) {
    return {
      isOnline: true,
      isTuWien: false,
      cleanLocation: loc,
      url: null,
      providerName: "Online",
      badgeLabel: "Online-Termin",
    };
  }

  // 2. Clean room name: strip trailing building suffixes like " - UIW", " - INF", " - CH"
  let cleanRoom = loc.replace(/\s*-\s*(UIW|INF|CH|MB|ET|BI|ARCH|WIMB)\b/gi, "").trim();

  // 3. Detect if location is likely TU Wien or user preferred TU Wien
  const tuWienKeywords = [
    "ei ", "ei1", "ei2", "ei3", "ei4", "ei5", "ei6", "ei7", "ei8", "ei9", "ei10", "ei11",
    "fh ", "freihaus", "kuppelsaal", "prechtl", "radinger", "gußhaus", "gusshaus",
    "karlsplatz", "favoritenstraße", "treitlstraße", "getreidemarkt", "seminarraum",
    "informatikhörsaal", "fritz paschke", "boecklsaal", "stiege", "audi.max", "audimax",
    "theresianum", "theresianumgasse", "hs 1", "hs 2", "hs 3", "hs 4", "hs 5"
  ];

  const hasTuWienPattern = tuWienKeywords.some((kw) => lower.includes(kw));
  const isTuWien = preferredUniversity === "tu_wien" || hasTuWienPattern;

  if (isTuWien) {
    // Format search query for maps.tuwien.ac.at
    // Examples: "EI 10 Fritz Paschke HS" -> https://maps.tuwien.ac.at/?q=EI+10+Fritz+Paschke
    const query = encodeURIComponent(cleanRoom);
    return {
      isOnline: false,
      isTuWien: true,
      cleanLocation: cleanRoom,
      url: `https://maps.tuwien.ac.at/?q=${query}`,
      providerName: "TU Wien Maps",
      badgeLabel: "TUW Maps",
    };
  }

  // 4. Default fallback: Google Maps
  const gmapsQuery = encodeURIComponent(loc);
  return {
    isOnline: false,
    isTuWien: false,
    cleanLocation: loc,
    url: `https://www.google.com/maps/search/?api=1&query=${gmapsQuery}`,
    providerName: "Google Maps",
    badgeLabel: "Karte",
  };
}
