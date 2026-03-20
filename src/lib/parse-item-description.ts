/**
 * Parses a raw item description into structured room-grouped bullets.
 *
 * Handles patterns like:
 *   "Banheiro A. 01 Balcão...; B. 01 Nicho... Cozinha A. 01 Nicho aéreo..."
 *
 * Returns an array of { room, items } or a flat list if no rooms detected.
 */

export interface ParsedDescriptionGroup {
  room: string | null;
  items: string[];
}

const ROOM_NAMES = [
  "Banheiro",
  "Cozinha",
  "Dormitório",
  "Sala",
  "Estar",
  "Varanda",
  "Lavabo",
  "Home Office",
  "Escritório",
  "Área de Serviço",
  "Lavanderia",
  "Corredor",
  "Hall",
  "Sacada",
  "Suíte",
  "Quarto",
  "Copa",
  "Closet",
  "Despensa",
  "Terraço",
  "Living",
  "Área Gourmet",
  "Churrasqueira",
  "Espaço Gourmet",
];

// Build a regex that finds room names at word boundaries
const roomRegex = new RegExp(
  `(?:^|(?<=[\\.;\\s]))\\s*(${ROOM_NAMES.join("|")})(?=\\s+[A-Z]\\.|\\s*$|\\s+\\d)`,
  "gi"
);

/** Strip leading codes like "A. 01", "B. 02", "C. 1" etc */
function stripCode(text: string): string {
  return text.replace(/^[A-Z]\.\s*\d+\s*/i, "").trim();
}

/** Replace "contendo" with "com" for readability */
function simplify(text: string): string {
  return text.replace(/\bcontendo\b/gi, "com").trim();
}

export function parseItemDescription(description: string | null | undefined): ParsedDescriptionGroup[] | null {
  if (!description || description.trim().length === 0) return null;

  const text = description.trim();

  // Short descriptions: return null (will be shown inline)
  if (text.length < 80 && !text.includes(";")) return null;

  // Try to detect room-based groupings
  const roomMatches: { room: string; index: number }[] = [];
  
  // More flexible room detection
  for (const roomName of ROOM_NAMES) {
    const re = new RegExp(`(?:^|[.;]\\s*)${roomName}(?=\\s)`, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const startIdx = match.index + (match[0].length - roomName.length);
      roomMatches.push({ room: roomName, index: startIdx });
    }
  }

  // Sort by position
  roomMatches.sort((a, b) => a.index - b.index);

  if (roomMatches.length > 0) {
    const groups: ParsedDescriptionGroup[] = [];

    for (let i = 0; i < roomMatches.length; i++) {
      const start = roomMatches[i].index + roomMatches[i].room.length;
      const end = i < roomMatches.length - 1 ? roomMatches[i + 1].index : text.length;
      const segment = text.substring(start, end).trim();

      // Split by ";" and/or "." followed by uppercase letter code
      const rawItems = segment
        .split(/;/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map(stripCode)
        .map(simplify)
        .filter((s) => s.length > 3);

      if (rawItems.length > 0) {
        groups.push({ room: roomMatches[i].room, items: rawItems });
      }
    }

    if (groups.length > 0) return groups;
  }

  // Fallback: split by ";" into flat bullets
  const bullets = text
    .split(/;/)
    .map((s) => s.trim())
    .map(stripCode)
    .map(simplify)
    .filter((s) => s.length > 3);

  if (bullets.length > 1) {
    return [{ room: null, items: bullets }];
  }

  // Single long paragraph — show as-is
  return [{ room: null, items: [simplify(text)] }];
}

export function isDescriptionExpandable(description: string | null | undefined): boolean {
  if (!description) return false;
  return description.trim().length >= 80 || description.includes(";");
}
