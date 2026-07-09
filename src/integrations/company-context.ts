// What Re:lay knows about the company it works for: offering, ICP, stakes.
// Built conversationally (the assistant reads the website, the human
// confirms) and consumed wherever the agent writes or reasons — starting
// with the assistant's own system prompt. Anchored on globalThis like the
// other demo stores so dev recompiles keep it.

export type CompanyContext = {
  website?: string;
  offering: string;
  icp: string;
  stakes: string;
  notes?: string;
  updatedAt: string;
};

const globalStore = globalThis as { __relayCompanyContext?: CompanyContext };

export function getCompanyContext(): CompanyContext | null {
  return globalStore.__relayCompanyContext ?? null;
}

export function saveCompanyContext(context: Omit<CompanyContext, "updatedAt">): CompanyContext {
  const saved = { ...context, updatedAt: new Date().toISOString() };
  globalStore.__relayCompanyContext = saved;
  return saved;
}

export function resetCompanyContext(): void {
  delete globalStore.__relayCompanyContext;
}

const MAX_CHARS = 8000;

// readWebsite is reachable from the unauthenticated MCP endpoint, so the
// server must never be talked into fetching itself or the internal network
// (SSRF). Literal private hosts are rejected before any request goes out;
// this does not defeat DNS rebinding, which is out of scope for the demo.
function assertPublicHttpUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs can be read.");
  }
  const host = url.hostname.toLowerCase();
  const isPrivateName =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal");
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(host);
  const isPrivateIpv4 =
    ipv4 !== null &&
    (ipv4[1] === "0" ||
      ipv4[1] === "10" ||
      ipv4[1] === "127" ||
      (ipv4[1] === "169" && ipv4[2] === "254") ||
      (ipv4[1] === "172" && Number(ipv4[2]) >= 16 && Number(ipv4[2]) <= 31) ||
      (ipv4[1] === "192" && ipv4[2] === "168"));
  // URL.hostname keeps IPv6 brackets: [::1], [fd00::1]…
  const isPrivateIpv6 = host.startsWith("[") && /^\[(::1|f[cd]|fe80)/.test(host);
  if (isPrivateName || isPrivateIpv4 || isPrivateIpv6) {
    throw new Error("That host is not reachable from here.");
  }
  return url;
}

// Fetches a page and reduces it to readable text the model can digest —
// scripts/styles/tags stripped, whitespace collapsed, hard-capped so a heavy
// site can never blow up the conversation.
export async function readWebsite(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ text: string; truncated: boolean }> {
  assertPublicHttpUrl(url);
  const response = await fetchImpl(url, {
    headers: { "User-Agent": "Re:lay onboarding (+https://www.shonen.app)", Accept: "text/html" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Website responded ${response.status}`);
  const html = await response.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { text: text.slice(0, MAX_CHARS), truncated: text.length > MAX_CHARS };
}
