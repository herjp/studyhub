/**
 * Campus Maps & Room Navigation Helper
 * Universal support for TU Wien (maps.tuwien.ac.at), Google Maps, TUM (nav.tum.de),
 * WU Wien (campus.wu.ac.at), LMU, ETH Zürich, Uni Wien, RWTH, and any global university campus.
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
  { id: "tu_wien", name: "TU Wien (Technische Universität Wien)", shortName: "TU Wien", country: "AT", city: "Wien", mapSystem: "TU Wien Maps" },
  { id: "fhwn", name: "FH Wiener Neustadt (FHWN Campus & Standorte)", shortName: "FH Wiener Neustadt", country: "AT", city: "Wiener Neustadt", mapSystem: "FHWN Standorte & Maps" },
  { id: "google_maps", name: "Google Maps (Direkte Routen- & Raumsuche)", shortName: "Google Maps", country: "OTHER", mapSystem: "Google Maps" },
  { id: "tum", name: "TU München (TUM)", shortName: "TUM", country: "DE", city: "München", mapSystem: "TUM Nav" },
  { id: "univie", name: "Universität Wien (Hauptuni)", shortName: "Uni Wien", country: "AT", city: "Wien", mapSystem: "Uni Wien Campus" },
  { id: "wu_wien", name: "WU Wien (Wirtschaftsuniversität)", shortName: "WU Wien", country: "AT", city: "Wien", mapSystem: "Campus WU Map" },
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
 * Normalizes combined building codes like "GM3" -> "GM 3", "EI2" -> "EI 2".
 */
export function sanitizeRoomLocation(rawLocation?: string | null): { cleanRoom: string; extractedUrl: string | null } {
  if (!rawLocation || typeof rawLocation !== "string") return { cleanRoom: "", extractedUrl: null };

  // 1. Check for embedded URL
  const urlRegex = /(https?:\/\/[^\s"',;<>]+)/i;
  const match = rawLocation.match(urlRegex);
  const extractedUrl = match ? match[1] : null;

  // 2. Remove URL from text
  let text = rawLocation.replace(urlRegex, "").trim();

  // 3. Remove leading labels like "siehe Zoomlink:", "Ort:", "Raum:", "Location:"
  text = text.replace(/^(siehe\s+(?:zoomlink|link|url|zoom)?\s*:?|ort\s*:|raum\s*:|location\s*:)\s*/i, "").trim();

  // 4. Normalize building code + number combinations without spaces: "GM3" -> "GM 3", "EI1" -> "EI 1", "FH2" -> "FH 2"
  text = text.replace(/\b(GM|EI|FH|MWB|CD|CA|DA|DB|DC|DD|DE|DF|DG|DH|DI|DJ|FA|FB|FC|FD|FE|FF|FG|FH|HA|HB|HC|HD|HE|HF|HG|IA|IB|IC|ID|IE|IF|IG|JA|JB|JC|JD|JE|JF|JG|TA|TC|TI|BA|BD|BE|BF|BG|BH|BI|BK|BL|BM|BN|BO|BP|BQ|BR|BS|BT|BU|BV|BW|BX|BY|BZ)(\d+)\b/gi, "$1 $2");

  // 5. Remove common faculty / institute / department acronym tags at end like " - MWB", " - INF", " - UIW", " - CH"
  text = text.replace(/\s*-\s*(MWB|UIW|INF|CH|MB|ET|BI|ARCH|WIMB|TI)\b/gi, "").trim();

  // 6. Clean trailing dashes or commas
  text = text.replace(/[-,\s]+$/, "").trim();

  return { cleanRoom: text || (extractedUrl ? "Online-Link" : rawLocation), extractedUrl };
}

export function getCampusMapInfo(
  rawLocation?: string | null,
  preferredUniversity?: string,
  customUniversityName?: string
): CampusMapInfo {
  if (!rawLocation || typeof rawLocation !== "string" || !rawLocation.trim()) {
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

  // 2. Resolve Active University preference
  let activeUni = preferredUniversity;
  let activeCustom = customUniversityName;

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("studyhub_preferred_university");
      if (stored) {
        activeUni = stored;
      }
      const storedCustom = localStorage.getItem("studyhub_custom_university");
      if (storedCustom) {
        activeCustom = storedCustom;
      }
    } catch {
      // fallback
    }
  }
  if (!activeUni) activeUni = "tu_wien";

  // CASE 1: TU Wien (ALWAYS use TU Wien Maps maps.tuwien.ac.at)
  if (activeUni === "tu_wien") {
    let tuwSearchTerm = cleanRoom;
    if (/vortmann/i.test(cleanRoom)) {
      tuwSearchTerm = "Vortmann";
    } else if (/\bgm\s*3\b/i.test(cleanRoom)) {
      tuwSearchTerm = "Vortmann";
    } else if (/radinger/i.test(cleanRoom) || /\bgm\s*2\b/i.test(cleanRoom)) {
      tuwSearchTerm = "Radinger";
    } else if (/knoller/i.test(cleanRoom) || /\bgm\s*4\b/i.test(cleanRoom)) {
      tuwSearchTerm = "Knoller";
    } else if (/parkus/i.test(cleanRoom) || /\bgm\s*1\b/i.test(cleanRoom)) {
      tuwSearchTerm = "Parkus";
    } else if (/prechtl/i.test(cleanRoom)) {
      tuwSearchTerm = "Prechtlsaal";
    } else if (/kuppelsaal/i.test(cleanRoom)) {
      tuwSearchTerm = "Kuppelsaal";
    } else if (/informatikhörsaal|inf\s*hs/i.test(cleanRoom)) {
      tuwSearchTerm = "Informatikhörsaal";
    } else if (/audimax|audi\.max/i.test(cleanRoom)) {
      tuwSearchTerm = "Audimax";
    } else if (/boeckl|böckl/i.test(cleanRoom)) {
      tuwSearchTerm = "Böcklsaal";
    } else if (/fritz\s*paschke/i.test(cleanRoom)) {
      tuwSearchTerm = "Fritz Paschke";
    } else if (/hochenegg/i.test(cleanRoom) || /\bei\s*2\b/i.test(cleanRoom)) {
      tuwSearchTerm = "Hochenegg";
    } else if (/petzold/i.test(cleanRoom) || /\bei\s*1\b/i.test(cleanRoom)) {
      tuwSearchTerm = "Petzold";
    } else if (/sahulka/i.test(cleanRoom) || /\bei\s*3\b/i.test(cleanRoom)) {
      tuwSearchTerm = "Sahulka";
    }

    const tuwUrl = `https://maps.tuwien.ac.at/?q=${encodeURIComponent(tuwSearchTerm)}`;

    return {
      isOnline: false,
      isTuWien: true,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: tuwUrl,
      secondaryUrl: null,
      providerName: "TU Wien Maps",
      badgeLabel: "TUW Maps",
    };
  }

  // CASE 2: Google Maps explicitly selected
  if (activeUni === "google_maps") {
    const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanRoom)}`;
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: gmapsUrl,
      secondaryUrl: null,
      providerName: "Google Maps",
      badgeLabel: "Google Maps",
    };
  }

  // CASE 3: TU München (TUM Nav)
  if (activeUni === "tum") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://nav.tum.de/?q=${encodeURIComponent(cleanRoom)}`,
      secondaryUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`TU München ${cleanRoom}`)}`,
      providerName: "TUM Nav",
      badgeLabel: "TUM Nav",
    };
  }

  // CASE 4: FH Wiener Neustadt (FHWN)
  if (
    activeUni === "fhwn" ||
    (activeUni === "other" && /fh\s*wiener\s*neustadt|fhwn/i.test(activeCustom || "")) ||
    (!activeUni && /fh\s*wiener\s*neustadt|fhwn/i.test(raw))
  ) {
    let campusTarget = "FH Wiener Neustadt";
    let badgeText = "FHWN Campus";

    if (/city\s*campus|\bcc\b|schlögelgasse/i.test(cleanRoom) || /city\s*campus|\bcc\b|schlögelgasse/i.test(raw)) {
      campusTarget = "FH Wiener Neustadt City Campus, Schlögelgasse 22-26, 2700 Wiener Neustadt";
      badgeText = "FHWN City Campus";
    } else if (/wieselburg|\bwb\b/i.test(cleanRoom) || /wieselburg/i.test(raw)) {
      campusTarget = "FH Wiener Neustadt Campus Wieselburg, Zeiselgraben 4, 3250 Wieselburg";
      badgeText = "FHWN Wieselburg";
    } else if (/tulln/i.test(cleanRoom) || /tulln/i.test(raw)) {
      campusTarget = "FH Wiener Neustadt Campus Tulln, Konrad-Lorenz-Straße 10, 3430 Tulln";
      badgeText = "FHWN Tulln";
    } else if (/rudolfinerhaus|billroth/i.test(cleanRoom) || /rudolfinerhaus/i.test(raw)) {
      campusTarget = "Campus Rudolfinerhaus Wien, Billrothstraße 78, 1190 Wien";
      badgeText = "FHWN Rudolfinerhaus";
    } else if (/johannes\s*gutenberg|hauptcampus|\bmc\b/i.test(cleanRoom) || /johannes\s*gutenberg/i.test(raw)) {
      campusTarget = "FH Wiener Neustadt Hauptcampus, Johannes Gutenberg-Straße 3, 2700 Wiener Neustadt";
      badgeText = "FHWN Hauptcampus";
    } else {
      campusTarget = "FH Wiener Neustadt, Johannes Gutenberg-Straße 3, 2700 Wiener Neustadt";
      badgeText = "FHWN";
    }

    const searchQuery = `${campusTarget} ${cleanRoom}`.trim();
    const fhwnGmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;

    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: fhwnGmapsUrl,
      secondaryUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`FH Wiener Neustadt ${cleanRoom}`)}`,
      providerName: "FH Wiener Neustadt",
      badgeLabel: badgeText,
    };
  }

  // CASE 5: WU Wien
  if (activeUni === "wu_wien") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://campus.wu.ac.at/?q=${encodeURIComponent(cleanRoom)}`,
      secondaryUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`WU Wien Campus ${cleanRoom}`)}`,
      providerName: "Campus WU",
      badgeLabel: "Campus WU",
    };
  }

  // CASE 6: LMU München
  if (activeUni === "lmu") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://www.raumfinder.lmu.de/?q=${encodeURIComponent(cleanRoom)}`,
      secondaryUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`LMU München ${cleanRoom}`)}`,
      providerName: "LMU Raumfinder",
      badgeLabel: "LMU Raum",
    };
  }

  // CASE 7: ETH Zürich
  if (activeUni === "eth_zuerich") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://maps.ethz.ch/?query=${encodeURIComponent(cleanRoom)}`,
      secondaryUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`ETH Zürich ${cleanRoom}`)}`,
      providerName: "ETH Maps",
      badgeLabel: "ETH Maps",
    };
  }

  // CASE 8: Universität Wien
  if (activeUni === "univie") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Universität Wien ${cleanRoom}`)}`,
      secondaryUrl: `https://ufind.univie.ac.at/de/search.html?query=${encodeURIComponent(cleanRoom)}`,
      providerName: "Uni Wien",
      badgeLabel: "Uni Wien",
    };
  }

  // CASE 9: RWTH Aachen
  if (activeUni === "rwth") {
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

  // CASE 10: KIT Karlsruhe
  if (activeUni === "kit") {
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

  // CASE 11: TU Berlin
  if (activeUni === "tu_berlin") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`TU Berlin ${cleanRoom}`)}`,
      providerName: "TU Berlin",
      badgeLabel: "TU Berlin",
    };
  }

  // CASE 12: UZH
  if (activeUni === "uzh") {
    return {
      isOnline: false,
      isTuWien: false,
      cleanLocation: cleanRoom,
      rawLocation: raw,
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Universität Zürich ${cleanRoom}`)}`,
      providerName: "UZH Pläne",
      badgeLabel: "UZH",
    };
  }

  // FALLBACK: Other or custom university -> Google Maps
  const uniName = (activeCustom && activeCustom.trim()) || "";
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
