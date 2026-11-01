/**
 * Campus Maps & Room Navigation Helper
 * Universal support for TU Wien (maps.tuwien.ac.at), TUM (nav.tum.de), WU Wien (campus.wu.ac.at),
 * LMU, ETH Zürich, Uni Wien, RWTH, and any global university campus via intelligent location search.
 */

export interface UniversityProvider {
  id: string;
  name: string;
  shortName: string;
  country: "AT" | "DE" | "CH" | "OTHER";
  city?: string;
  mapSystem: string;
}

export const SUPPORTED_UNIVERSITIES: UniversityProvider[] = [
  { id: "tu_wien", name: "TU Wien (Technische Universität Wien)", shortName: "TU Wien", country: "AT", city: "Wien", mapSystem: "TUW Maps (Wegweiser)" },
  { id: "univie", name: "Universität Wien (Hauptuni)", shortName: "Uni Wien", country: "AT", city: "Wien", mapSystem: "Uni Wien Campus" },
  { id: "wu_wien", name: "WU Wien (Wirtschaftsuniversität)", shortName: "WU Wien", country: "AT", city: "Wien", mapSystem: "Campus WU Map" },
  { id: "tum", name: "TU München (TUM)", shortName: "TUM", country: "DE", city: "München", mapSystem: "TUM Nav (Indoor Navigation)" },
  { id: "lmu", name: "LMU München", shortName: "LMU", country: "DE", city: "München", mapSystem: "LMU Raumfinder" },
  { id: "rwth", name: "RWTH Aachen", shortName: "RWTH Aachen", country: "DE", city: "Aachen", mapSystem: "RWTH Campus" },
  { id: "kit", name: "KIT (Karlsruher Institut für Technologie)", shortName: "KIT", country: "DE", city: "Karlsruhe", mapSystem: "KIT Campus" },
  { id: "tu_berlin", name: "TU Berlin", shortName: "TU Berlin", country: "DE", city: "Berlin", mapSystem: "TU Berlin Campus" },
  { id: "eth_zuerich", name: "ETH Zürich", shortName: "ETH Zürich", country: "CH", city: "Zürich", mapSystem: "ETH Maps" },
  { id: "uzh", name: "Universität Zürich (UZH)", shortName: "UZH", country: "CH", city: "Zürich", mapSystem: "UZH Pläne" },
  { id: "other", name: "Andere Hochschule / Eigene Universität", shortName: "Universell", country: "OTHER", mapSystem: "Google Maps Campus" },
];

export interface CampusMapInfo {
  isOnline: boolean;
  isTuWien: boolean;
  cleanLocation: string;
  rawLocation: string;
  url: string | null;
  secondaryUrl?: string | null;
  providerName: string;
  badgeLabel: string;
}

/**
 * Clean room / location string by stripping noise like "siehe Zoomlink: ",
 * trailing building codes like " - MWB", " - INF", " - CH", etc.
 */
export function sanitizeRoomLocation(rawLocation: string): { cleanRoom: string; extractedUrl: string | null } {
  if (!rawLocation) return { cleanRoom: "", extractedUrl: null };

  // 1. Check for embedded URL
  const urlRegex = /(https?:\/\/[^\s"',;<>]+)/i;
  const match = rawLocation.match(urlRegex);
  const extractedUrl = match ? match[1] : null;

  // 2. Remove URL from text
  let text = rawLocation.replace(urlRegex, "").trim();

  // 3. Remove leading labels like "siehe Zoomlink:", "Ort:", "Raum:", "Location:"
  text = text.replace(/^(siehe\s+(?:zoomlink|link|url|zoom)?\s*:?|ort\s*:|raum\s*:|location\s*:)\s*/i, "").trim();

  // 4. Remove common faculty / institute / department acronym tags at end like " - MWB", " - INF", " - UIW", " - CH"
  text = text.replace(/\s*-\s*(MWB|UIW|INF|CH|MB|ET|BI|ARCH|WIMB|TI)\b/gi, "").trim();

  // 5. Clean trailing dashes or commas
  text = text.replace(/[-,\s]+$/, "").trim();

  return { cleanRoom: text || (extractedUrl ? "Online-Link" : rawLocation), extractedUrl };
}

export function getCampusMapInfo(
  rawLocation?: string | null,
  preferredUniversity: string = "tu_wien",
  customUniversityName?: string
): CampusMapInfo {
  if (!rawLocation || !rawLocation.trim()) {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: "",
      rawLocation: "",
      url: null,
      providerName: "",
      badgeLabel: "",
    };
  }

  const raw = rawLocation.trim();
  const lower = raw.toLowerCase();
  const { cleanRoom, extractedUrl } = sanitizeRoomLocation(raw);

  // 1. Direct Web Links (Zoom, Teams, Webex, TUWEL, etc.)
  if (extractedUrl) {
    const isZoom = extractedUrl.includes("zoom");
    const isTeams = extractedUrl.includes("teams");
    const isMeet = extractedUrl.includes("meet.google");
    const isTuwel = extractedUrl.includes("tuwel.tuwien.ac.at");
    const isMoodle = extractedUrl.includes("moodle");

    return {
      isOnline: true,
      isTuWien: isTuwel || extractedUrl.includes("tuwien"),
      cleanLocation: cleanRoom || (isZoom ? "Zoom Meeting" : isTeams ? "MS Teams" : isTuwel ? "TUWEL Kurs" : "Online Link"),
      rawLocation: raw,
      url: extractedUrl,
      providerName: isZoom ? "Zoom" : isTeams ? "Teams" : isTuwel ? "TUWEL" : isMoodle ? "Moodle" : isMeet ? "Google Meet" : "Weblink",
      badgeLabel: isZoom ? "Zoom beitreten" : isTeams ? "Teams beitreten" : isTuwel ? "In TUWEL öffnen" : "Link öffnen",
    };
  }

  // Check keywords for online platforms without explicit URL
  if (lower.includes("tuwel")) {
    return {
      isOnline: true,
      isTuWien: true,
      cleanLocation: cleanRoom || "TUWEL",
      rawLocation: raw,
      url: "https://tuwel.tuwien.ac.at/",
      providerName: "TUWEL",
      badgeLabel: "In TUWEL öffnen",
    };
  }

  if (lower.includes("zoom") || lower.includes("teams") || lower.includes("webex") || lower.includes("moodle") || lower.includes("online")) {
    return {
      isOnline: true,
      isTuWien: false,
      cleanLocation: cleanRoom || "Online",
      rawLocation: raw,
      url: null,
      providerName: "Online",
      badgeLabel: "Online-Termin",
    };
  }

  // 2. Physical Campus Maps by University
  const queryEnc = encodeURIComponent(cleanRoom);

  // Auto-detect TU Wien if university is not explicitly set or if location strongly matches TU Wien
  const tuWienKeywords = [
    "ei ", "ei1", "ei2", "ei3", "ei4", "ei5", "ei6", "ei7", "ei8", "ei9", "ei10", "ei11",
    "fh ", "freihaus", "kuppelsaal", "prechtl", "radinger", "gußhaus", "gusshaus",
    "karlsplatz", "favoritenstraße", "treitlstraße", "getreidemarkt", "seminarraum",
    "informatikhörsaal", "fritz paschke", "boecklsaal", "stiege", "audi.max", "audimax",
    "theresianum", "theresianumgasse", "hs 1", "hs 2", "hs 3", "hs 4", "hs 5"
  ];
  const matchesTuWien = tuWienKeywords.some((kw) => lower.includes(kw));

  if (preferredUniversity === "tu_wien" || (preferredUniversity !== "other" && matchesTuWien)) {
    // TU Wien Maps (maps.tuwien.ac.at) supports ?q=<RoomCode or RoomName>
    const tuwUrl = `https://maps.tuwien.ac.at/?q=${queryEnc}`;
    const gmapsFallback = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`TU Wien ${cleanRoom}`)}`;

    return {
      isOnline: false,
      isTuWien: true,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: tuwUrl,
      secondaryUrl: gmapsFallback,
      providerName: "TUW Maps",
      badgeLabel: "TUW Maps",
    };
  }

  if (preferredUniversity === "wu_wien") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://campus.wu.ac.at/?q=${queryEnc}`,
      secondaryUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`WU Wien Campus ${cleanRoom}`)}`,
      providerName: "Campus WU",
      badgeLabel: "Campus WU",
    };
  }

  if (preferredUniversity === "tum") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://nav.tum.de/?q=${queryEnc}`,
      secondaryUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`TU München ${cleanRoom}`)}`,
      providerName: "TUM Nav",
      badgeLabel: "TUM Nav",
    };
  }

  if (preferredUniversity === "lmu") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://www.raumfinder.lmu.de/?q=${queryEnc}`,
      secondaryUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`LMU München ${cleanRoom}`)}`,
      providerName: "LMU Raumfinder",
      badgeLabel: "LMU Raum",
    };
  }

  if (preferredUniversity === "eth_zuerich") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://maps.ethz.ch/?query=${queryEnc}`,
      secondaryUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`ETH Zürich ${cleanRoom}`)}`,
      providerName: "ETH Maps",
      badgeLabel: "ETH Maps",
    };
  }

  if (preferredUniversity === "univie") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Universität Wien ${cleanRoom}`)}`,
      secondaryUrl: `https://ufind.univie.ac.at/de/search.html?query=${queryEnc}`,
      providerName: "Uni Wien",
      badgeLabel: "Uni Wien",
    };
  }

  if (preferredUniversity === "rwth") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`RWTH Aachen ${cleanRoom}`)}`,
      providerName: "RWTH Campus",
      badgeLabel: "RWTH Aachen",
    };
  }

  if (preferredUniversity === "kit") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`KIT Karlsruhe ${cleanRoom}`)}`,
      providerName: "KIT Campus",
      badgeLabel: "KIT",
    };
  }

  // 3. Universal fallback: Google Maps with custom university name context
  const uniName = (customUniversityName && customUniversityName.trim()) || "";
  const fullSearchTerm = uniName ? `${uniName} ${cleanRoom}` : cleanRoom;
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullSearchTerm)}`;

  return {
    isOnline: false,
    isTuWien: false,
    cleanLocation: cleanRoom,
    rawLocation: raw,
    url: gmapsUrl,
    secondaryUrl: null,
    providerName: uniName || "Google Maps",
    badgeLabel: uniName ? `${uniName}` : "Google Maps",
  };
}
