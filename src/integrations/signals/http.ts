import axios, { type AxiosInstance } from "axios";

// One place for how Re:lay talks to the Sillage public API: base URL, bearer
// auth, and the readable path-aware error that axios's default message drops.
// Used by both the signal source (sillage.ts) and the setup client
// (sillage-setup.ts).

export const SILLAGE_BASE_URL = "https://api.getsillage.com";

export function sillageHttp(apiKey: string): AxiosInstance {
  const http = axios.create({
    baseURL: `${SILLAGE_BASE_URL}/api`,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  });
  http.interceptors.response.use(undefined, (error) => {
    if (axios.isAxiosError(error)) {
      throw new Error(`Sillage API ${error.config?.url} responded ${error.response?.status}`);
    }
    throw error;
  });
  return http;
}
