// Normalize a company name for fuzzy identity matching. A Sillage signal names a
// company as free text ("Qonto SAS") and it has to line up with the CRM's own
// spelling of the same account ("Qonto"). Lowercase, strip accents and
// punctuation, and drop trailing legal-entity suffixes so the brand is what gets
// compared. Deliberately conservative — only true trailing entity suffixes are
// removed, never leading brand words — so distinct companies don't collapse
// together and produce a wrong match.

const LEGAL_SUFFIXES = new Set([
  "inc",
  "llc",
  "ltd",
  "limited",
  "co",
  "corp",
  "corporation",
  "sa",
  "sas",
  "sasu",
  "sarl",
  "eurl",
  "sci",
  "gmbh",
  "ag",
  "bv",
  "nv",
  "oy",
  "ab",
  "as",
  "plc",
  "spa",
  "srl",
  "sl",
  "kg",
  "kk",
  "pte",
  "pvt",
]);

export function normalizeCompanyName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // strip accents
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ") // punctuation → space
    .trim();
  if (!cleaned) return "";

  const tokens = cleaned.split(/\s+/);
  // Drop trailing legal suffixes only; keep at least one token (a leading "SAS"
  // in "SAS Institute" is the brand, not a suffix).
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}
