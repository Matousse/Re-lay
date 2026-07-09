// Company-domain hygiene: models and humans hand us "https://www.Qonto.com/about"
// as readily as "qonto.com" — normalize first, then validate, so the Sillage
// watch list only ever receives bare, well-formed domains.

const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** Normalizes user/model input to a bare lowercase domain; null when invalid. */
export function normalizeDomain(input: string): string | null {
  const bare = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "") // protocol
    .replace(/^www\./, "")
    .split(/[/?#]/)[0] // path, query, fragment
    .split(":")[0]; // port
  return DOMAIN_PATTERN.test(bare) ? bare : null;
}
