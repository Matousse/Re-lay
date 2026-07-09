import type { AxiosError, AxiosInstance } from "axios";
import { attachErrorInterceptor, createApiClient } from "@/lib/http";

// One place for how Re:lay talks to the Sillage public API: base URL, bearer
// auth, and a readable error. The read feed (sillage.ts) sits on the v1 paths,
// the setup and sync clients on v2 — but they share the same host and auth, so
// they all build their axios instance here. `attachSillageErrorInterceptor`
// lets a client with an injected instance (tests) share the same error style.

export const SILLAGE_BASE_URL = "https://api.getsillage.com";

// Surface the RFC 9457 `detail`/`title` when Sillage sends one (typed 402
// credits, 403 feature-off, 422 bad payload); otherwise a plain status line.
function describeSillageError(error: AxiosError): string {
  const problem = error.response?.data as { detail?: string; title?: string } | undefined;
  const reason = problem?.detail ?? problem?.title;
  const line = `Sillage API ${error.config?.url} responded ${error.response?.status ?? ""}`.trim();
  return reason ? `${line}: ${reason}` : line;
}

export function sillageHttp(apiKey: string): AxiosInstance {
  return createApiClient({
    baseURL: `${SILLAGE_BASE_URL}/api`,
    apiKey,
    describeError: describeSillageError,
  });
}

export function attachSillageErrorInterceptor(http: AxiosInstance): AxiosInstance {
  return attachErrorInterceptor(http, describeSillageError);
}
