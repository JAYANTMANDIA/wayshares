/**
 * Strips India Post office-type suffixes from a stored city name.
 * Used to clean names that were saved before the suffix-stripping fix,
 * e.g. "Chennai G.p.o." → "Chennai", "Tambaram Ho" → "Tambaram".
 */
const POSTAL_SUFFIX_RE = /\s+(Ho|Bo|So|H\.o\.|B\.o\.|S\.o\.|H\.O\.|B\.O\.|S\.O\.|H\.O|B\.O|S\.O|HO|BO|SO|H\.q\.|H\.Q\.|Hq|HQ|G\.p\.o\.|G\.P\.O\.?|G\.p\.o|Gpo|GPO|R\.s\.|R\.S\.|RS|M\.d\.o\.|MDG|MDO|Head Office|Branch Office|Sub Office|Collectorate)\s*$/;
const BRACKET_SUFFIX_RE = /\s*\([^)]{1,40}\)\s*$/;

export function cleanCityName(name: string): string {
  if (!name) return name;
  let s = name.replace(POSTAL_SUFFIX_RE, '').trim();
  s = s.replace(BRACKET_SUFFIX_RE, '').trim();
  // Second pass in case suffix was after a bracket e.g. "Airport (Mumbai) So"
  s = s.replace(POSTAL_SUFFIX_RE, '').trim();
  return s || name; // fallback to original if somehow empty
}
