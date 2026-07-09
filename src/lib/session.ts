export const SESSION_COOKIE = "relay_demo_session";

/** Session-only cookie (no Max-Age): a fresh browser always lands on /login. */
export function openMockSession(): void {
  document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax`;
}

export function closeMockSession(): void {
  document.cookie = `${SESSION_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
}
